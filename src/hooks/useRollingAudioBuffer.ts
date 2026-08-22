"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const ROLLING_BUFFER_LIMIT_MINUTES = 10;
export const ROLLING_BUFFER_LIMIT_SECONDS = ROLLING_BUFFER_LIMIT_MINUTES * 60;
export const ROLLING_BUFFER_LIMIT_MS = ROLLING_BUFFER_LIMIT_SECONDS * 1000;
export const MAX_AUDIO_UPLOAD_BYTES = 4 * 1024 * 1024;
const CHUNK_INTERVAL_MS = 1000;
const AUDIO_BITRATE = 32_000;
const RECORDER_SEGMENT_INTERVAL_MS = 9 * 60 * 1000;

export type RecordingState = "idle" | "recording" | "paused";
export type MicrophonePermission = "unknown" | "requesting" | "granted" | "denied" | "unsupported";
export type AudioChunk = { blob: Blob; timestamp: number; durationMs: number; segmentId: number };

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

export function useRollingAudioBuffer() {
  const [recording, setRecording] = useState<RecordingState>("idle");
  const [microphonePermission, setMicrophonePermission] = useState<MicrophonePermission>("unknown");
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  const [rollingBuffer, setRollingBuffer] = useState<AudioChunk[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<AudioChunk[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingStateRef = useRef<RecordingState>("idle");
  const segmentIdRef = useRef(0);
  const rotatingRef = useRef(false);
  const startRecorderRef = useRef<(stream: MediaStream, segmentId: number) => void>(() => undefined);

  const clearAudioData = useCallback(() => {
    chunksRef.current = [];
    setAudioChunks([]);
    setRollingBuffer([]);
    setRecordingDuration(0);
  }, []);
  const releaseMicrophone = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);
  const addChunk = useCallback((blob: Blob, segmentId = segmentIdRef.current) => {
    if (!blob.size) return;
    const now = Date.now();
    const nextChunks = [...chunksRef.current, { blob, timestamp: now, durationMs: CHUNK_INTERVAL_MS, segmentId }];
    const recentChunks = nextChunks.filter((chunk) => chunk.timestamp > now - ROLLING_BUFFER_LIMIT_MS);
    chunksRef.current = recentChunks;
    setAudioChunks(recentChunks);
    setRollingBuffer(recentChunks);
  }, []);

  const startRecorder = useCallback((stream: MediaStream, segmentId: number) => {
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: AUDIO_BITRATE } : { audioBitsPerSecond: AUDIO_BITRATE });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => addChunk(event.data, segmentId);
    recorder.onerror = () => setError("녹음 중 문제가 발생했습니다. 마이크 권한과 브라우저 상태를 확인해 주세요.");
    recorder.onstop = () => {
      if (rotatingRef.current && recordingStateRef.current !== "idle" && streamRef.current === stream) {
        rotatingRef.current = false;
        segmentIdRef.current = segmentId + 1;
        startRecorderRef.current(stream, segmentId + 1);
      }
    };
    recorder.start(CHUNK_INTERVAL_MS);
  }, [addChunk]);
  const startRecording = useCallback(async () => {
    setError("");
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicrophonePermission("unsupported");
      setError("이 브라우저에서는 마이크 녹음을 지원하지 않습니다. 최신 Chrome, Edge 또는 Safari를 사용해 주세요.");
      return;
    }
    try {
      setMicrophonePermission("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16_000, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      setMicrophonePermission("granted");
      clearAudioData();
      segmentIdRef.current = 0;
      rotatingRef.current = false;
      startRecorderRef.current(stream, 0);
      recordingStartedAtRef.current = Date.now();
      recordingStateRef.current = "recording";
      setRecording("recording");
    } catch (cause) {
      releaseMicrophone();
      setMicrophonePermission("denied");
      setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "마이크 권한이 거부되었습니다. 브라우저 주소창의 마이크 아이콘에서 권한을 허용한 뒤 다시 시도해 주세요." : "마이크를 시작할 수 없습니다. 연결된 마이크와 브라우저 권한을 확인해 주세요.");
    }
  }, [clearAudioData, releaseMicrophone]);
  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") { recorderRef.current.pause(); recordingStateRef.current = "paused"; setRecording("paused"); }
  }, []);
  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === "paused") { recorderRef.current.resume(); recordingStateRef.current = "recording"; setRecording("recording"); }
  }, []);
  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    recordingStateRef.current = "idle";
    rotatingRef.current = false;
    const clearAfterStop = () => clearAudioData();
    if (recorder && recorder.state !== "inactive") {
      recorder.addEventListener("stop", clearAfterStop, { once: true });
      recorder.stop();
    } else {
      clearAfterStop();
    }
    releaseMicrophone();
    setRecording("idle");
    recordingStartedAtRef.current = null;
  }, [clearAudioData, releaseMicrophone]);
  const getRecentRollingBufferAudio = useCallback(() => {
    if (!chunksRef.current.length) return null;
    const currentSegment = chunksRef.current.filter((chunk) => chunk.segmentId === segmentIdRef.current);
    const chunks = currentSegment.length ? currentSegment : chunksRef.current;
    return new Blob(chunks.map((chunk) => chunk.blob), { type: (chunks[0].blob.type || "audio/webm").split(";")[0] });
  }, []);

  useEffect(() => {
    startRecorderRef.current = startRecorder;
  }, [startRecorder]);
  useEffect(() => {
    recordingStateRef.current = recording;
  }, [recording]);
  useEffect(() => {
    if (recording !== "recording") return;
    const segmentTimer = window.setInterval(() => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state !== "recording" || rotatingRef.current) return;
      rotatingRef.current = true;
      recorder.requestData();
      recorder.stop();
    }, RECORDER_SEGMENT_INTERVAL_MS);
    return () => window.clearInterval(segmentTimer);
  }, [recording]);
  useEffect(() => {
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: "microphone" as PermissionName }).then((permission) => {
      const update = () => setMicrophonePermission(permission.state === "granted" ? "granted" : permission.state === "denied" ? "denied" : "unknown");
      update();
      permission.onchange = update;
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (recording !== "recording" || !recordingStartedAtRef.current) return;
    const timer = window.setInterval(() => setRecordingDuration(Math.floor((Date.now() - (recordingStartedAtRef.current ?? Date.now())) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [recording]);
  useEffect(() => () => {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    releaseMicrophone();
    chunksRef.current = [];
  }, [releaseMicrophone]);

  return { recording, microphonePermission, audioChunks, rollingBuffer, recordingDuration, error, startRecording, pauseRecording, resumeRecording, stopRecording, getRecentRollingBufferAudio, clearAudioData };
}
