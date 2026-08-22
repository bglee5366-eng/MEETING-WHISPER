"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeTranscriptStatus, TranscriptSegment } from "@/hooks/useRealtimeTranscript";

type Props = { segments: TranscriptSegment[]; interimTranscript: string; status: RealtimeTranscriptStatus; error: string; recordingState?: "idle" | "recording" | "paused"; onPause?: () => void; onResume?: () => void; onStop?: () => void };
const statusLabels: Record<RealtimeTranscriptStatus, string> = { idle: "○ 전사 대기", transcribing: "● 실시간 전사 중", complete: "✓ 전사 완료", error: "⚠ 실시간 전사 오류", unsupported: "○ 전사 대기" };

export default function RealtimeTranscript({ segments, interimTranscript, status, error, recordingState = "idle", onPause, onResume, onStop }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtLatest, setIsAtLatest] = useState(true);
  const wasAtLatestRef = useRef(true);
  const updateScrollState = () => { const element = scrollRef.current; if (!element) return; const atLatest = element.scrollHeight - element.scrollTop - element.clientHeight < 36; wasAtLatestRef.current = atLatest; setIsAtLatest(atLatest); };
  useEffect(() => { const element = scrollRef.current; if (!element || !wasAtLatestRef.current) return; element.scrollTop = element.scrollHeight; }, [interimTranscript, segments]);
  const scrollToLatest = () => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; wasAtLatestRef.current = true; setIsAtLatest(true); };
  return <section className="realtime-transcript" aria-label="실시간 회의 전사"><div className="realtime-transcript-header"><div><b>실시간 회의 전사</b><span className={`realtime-status ${status}`}>{statusLabels[status]}</span></div><div className="realtime-header-actions">{interimTranscript && <span className="listening-label">듣는 중...</span>}{recordingState !== "idle" && <><button className="transcript-control pause" type="button" onClick={recordingState === "paused" ? onResume : onPause} title={recordingState === "paused" ? "회의 녹음 재개" : "회의 녹음 일시정지"} aria-label={recordingState === "paused" ? "회의 녹음 재개" : "회의 녹음 일시정지"}>{recordingState === "paused" ? "▶" : "Ⅱ"}</button><button className="transcript-control stop" type="button" onClick={onStop} title="회의 녹음 종료" aria-label="회의 녹음 종료">■</button></>}</div></div><div className="realtime-transcript-body" ref={scrollRef} onScroll={updateScrollState}>{segments.length === 0 && !interimTranscript && <p className="realtime-empty">회의를 시작하면 최근 10분의 전사 내용이 여기에 표시됩니다.</p>}{segments.map((segment) => <div className="transcript-segment" key={segment.id}><time>{new Date(segment.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><p>{segment.text}</p></div>)}{interimTranscript && <div className="transcript-segment interim"><time>인식 중</time><p>{interimTranscript}</p></div>}{error && <p className="realtime-error" role="alert">{error}</p>}</div>{!isAtLatest && <button className="latest-transcript-button" onClick={scrollToLatest}>↓ 최신 대화로 이동</button>}</section>;
}
