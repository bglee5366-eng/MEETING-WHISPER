"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ROLLING_BUFFER_LIMIT_MS } from "@/hooks/useRollingAudioBuffer";

export type TranscriptSegment = { id: string; text: string; timestamp: number; isFinal: true; speaker?: never };
export type RealtimeTranscriptStatus = "idle" | "transcribing" | "complete" | "error" | "unsupported";

type RecognitionResult = { isFinal: boolean; [index: number]: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: { length: number; [index: number]: RecognitionResult } };
type RecognitionErrorEvent = { error?: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;

function getRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const browserWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition || null;
}

function trimSegments(segments: TranscriptSegment[], now = Date.now()) {
  return segments.filter((segment) => segment.timestamp > now - ROLLING_BUFFER_LIMIT_MS);
}

export function useRealtimeTranscript(isRecording: boolean, isPaused: boolean) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [status, setStatus] = useState<RealtimeTranscriptStatus>("idle");
  const [error, setError] = useState("");
  const recognitionRef = useRef<Recognition | null>(null);
  const activeRef = useRef(false);
  const pausedRef = useRef(isPaused);
  const restartTimerRef = useRef<number | null>(null);
  const restartAttemptsRef = useRef(0);
  const segmentIdRef = useRef(0);
  const startRef = useRef<() => boolean>(() => false);

  const clear = useCallback(() => {
    setSegments([]);
    setInterimTranscript("");
    setError("");
    setStatus("idle");
    segmentIdRef.current = 0;
  }, []);

  const stop = useCallback((clearData = true) => {
    activeRef.current = false;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setInterimTranscript("");
    if (clearData) clear();
    else setStatus("complete");
  }, [clear]);

  const start = useCallback(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setStatus("unsupported");
      setError("현재 브라우저에서는 실시간 전사를 지원하지 않습니다. 녹음 후 AI 전사 기능을 이용할 수 있습니다.");
      return false;
    }
    activeRef.current = true;
    pausedRef.current = false;
    setError("");
    setStatus("transcribing");
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    // 짧은 발화 단위로 확정한 뒤 자동 재시작하면 장시간 연속 인식의
    // 브라우저 서비스 제한으로 한 번에 단어만 확정되는 현상을 줄일 수 있다.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      restartAttemptsRef.current = 0;
      let interim = "";
      const newSegments: TranscriptSegment[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript?.trim() || "";
        if (!text) continue;
        if (result.isFinal) newSegments.push({ id: `${Date.now()}-${segmentIdRef.current++}`, text, timestamp: Date.now(), isFinal: true });
        else interim += text;
      }
      if (newSegments.length) setSegments((current) => trimSegments([...current, ...newSegments]));
      setInterimTranscript(interim.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        activeRef.current = false;
        setStatus("unsupported");
        setError("현재 브라우저에서는 실시간 전사를 지원하지 않습니다. 녹음 후 AI 전사 기능을 이용할 수 있습니다.");
      } else if (event.error === "network") {
        setStatus("error");
        setError("네트워크 연결을 확인해주세요.");
      } else if (activeRef.current) {
        setStatus("error");
        setError("실시간 전사 연결이 중단되었습니다.");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (!activeRef.current || pausedRef.current) return;
      restartAttemptsRef.current += 1;
      if (restartAttemptsRef.current > 5) {
        setStatus("error");
        setError("실시간 전사 연결이 중단되었습니다. 녹음 후 AI 전사 기능을 이용할 수 있습니다.");
        return;
      }
      restartTimerRef.current = window.setTimeout(() => {
        if (activeRef.current && !pausedRef.current) startRef.current();
      }, 300);
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { recognitionRef.current = null; }
    return true;
  }, []);

  useEffect(() => { pausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { startRef.current = start; }, [start]);
  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      if (!isRecording) { if (activeRef.current) stop(false); return; }
      if (isPaused) { stop(false); return; }
      if (!activeRef.current) { restartAttemptsRef.current = 0; start(); }
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [isPaused, isRecording, start, stop]);
  useEffect(() => () => stop(true), [stop]);

  useEffect(() => {
    const timer = window.setInterval(() => setSegments((current) => trimSegments(current)), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const finalText = segments.map((segment) => segment.text).join("\n");
  return { segments, interimTranscript, finalText, status, error, clear, start, stop };
}
