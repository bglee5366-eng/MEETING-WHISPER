"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const ROLLING_BUFFER_LIMIT_MINUTES = 10;
export const ROLLING_BUFFER_LIMIT_SECONDS = ROLLING_BUFFER_LIMIT_MINUTES * 60;
export const ROLLING_BUFFER_LIMIT_MS = ROLLING_BUFFER_LIMIT_SECONDS * 1000;
const CHUNK_INTERVAL_MS = 1000;

export type RecordingState = "idle" | "recording" | "paused";
export type MicrophonePermission = "unknown" | "requesting" | "granted" | "denied" | "unsupported";
export type AudioChunk = { blob: Blob; timestamp: number; durationMs: number };

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
  const addChunk = useCallback((blob: Blob) => {
    if (!blob.size) return;
    const now = Date.now();
    const nextChunks = [...chunksRef.current, { blob, timestamp: now, durationMs: CHUNK_INTERVAL_MS }];
    const recentChunks = nextChunks.filter((chunk) => chunk.timestamp > now - ROLLING_BUFFER_LIMIT_MS);
    chunksRef.current = recentChunks;
    setAudioChunks(recentChunks);
    setRollingBuffer(recentChunks);
  }, []);

  const startRecording = useCallback(async () => {
    setError("");
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicrophonePermission("unsupported");
      setError("이 브라우저에서는 마이크 녹음을 지원하지 않습니다. 최신 Chrome, Edge 또는 Safari를 사용해 주세요.");
      return;
    }
    try {
      setMicrophonePermission("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicrophonePermission("granted");
      clearAudioData();
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => addChunk(event.data);
      recorder.onerror = () => setError("녹음 중 문제가 발생했습니다. 마이크 권한과 브라우저 상태를 확인해 주세요.");
      recorder.start(CHUNK_INTERVAL_MS);
      recordingStartedAtRef.current = Date.now();
      setRecording("recording");
    } catch (cause) {
      releaseMicrophone();
      setMicrophonePermission("denied");
      setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "마이크 권한이 거부되었습니다. 브라우저 주소창의 마이크 아이콘에서 권한을 허용한 뒤 다시 시도해 주세요." : "마이크를 시작할 수 없습니다. 연결된 마이크와 브라우저 권한을 확인해 주세요.");
    }
  }, [addChunk, clearAudioData, releaseMicrophone]);
  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") { recorderRef.current.pause(); setRecording("paused"); }
  }, []);
  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === "paused") { recorderRef.current.resume(); setRecording("recording"); }
  }, []);
  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
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
    return new Blob(chunksRef.current.map((chunk) => chunk.blob), { type: chunksRef.current[0].blob.type || "audio/webm" });
  }, []);

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
