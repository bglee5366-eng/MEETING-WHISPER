"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination */

import { useState } from "react";

type Provider = "openai" | "gemini" | "anthropic";
type Summary = { core: string; issues: string; speakingPoint: string; question: string; decision: string; numbers: string[] };
type Detail = { meeting: { id: string; title: string; started_at: string; duration_seconds: number | null }; transcripts: { text: string; sequence: number }[]; summaries: Summary[]; responses: { text: string }[]; note: { content: string } | null };

function normalizeDetail(detail: Detail): Detail {
  return {
    ...detail,
    summaries: detail.summaries.map((summary) => {
      const stored = summary as Summary & { speaking_point?: string };
      return { ...summary, speakingPoint: summary.speakingPoint || stored.speaking_point || "" };
    }),
  };
}

export default function WorkspaceMeetingDetail({ detail: initialDetail, provider, onMeetingUpdated }: { detail: Detail; provider: Provider; onMeetingUpdated?: (meeting: Detail["meeting"]) => void }) {
  const [detail, setDetail] = useState(() => normalizeDetail(initialDetail));
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialDetail.meeting.title);
  const [content, setContent] = useState(initialDetail.note?.content || "");
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [message, setMessage] = useState("");
  const last = detail.summaries[0];

  const saveChanges = async () => {
    if (!title.trim() || !content.trim()) { setMessage("회의 제목과 내용을 입력해 주세요."); return; }
    setBusy(true); setMessage("");
    try {
      const meetingResponse = await fetch(`/api/meetings/${detail.meeting.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
      if (!meetingResponse.ok) throw new Error("회의 제목을 저장하지 못했습니다.");
      const noteResponse = await fetch(`/api/meeting-notes/${detail.meeting.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content }) });
      if (!noteResponse.ok) throw new Error("회의 내용을 저장하지 못했습니다.");
      setDetail((current) => ({ ...current, meeting: { ...current.meeting, title }, note: { content } })); onMeetingUpdated?.({ ...detail.meeting, title });
      setEditing(false); setMessage("변경사항을 저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "변경사항을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  };

  const regenerateSpeakingPoint = async () => {
    const transcript = detail.transcripts.sort((a, b) => a.sequence - b.sequence).map((item) => item.text).join("\n");
    if (!transcript.trim()) { setMessage("저장된 전사 내용이 없어 발언 포인트를 만들 수 없습니다."); return; }
    setRegenerating(true); setMessage("");
    try {
      const response = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript, provider }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.summary?.speakingPoint) throw new Error(payload?.error?.message || "발언 포인트를 다시 만들지 못했습니다.");
      const raw = payload.summary;
      const next: Summary = { core: raw.core || "", issues: raw.issues || "", speakingPoint: raw.speakingPoint, question: raw.question || "", decision: raw.decision || "", numbers: Array.isArray(raw.numbers) ? raw.numbers : [] };
      const saveResponse = await fetch("/api/summaries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meeting_id: detail.meeting.id, summary: next }) });
      if (!saveResponse.ok) throw new Error("새 발언 포인트를 저장하지 못했습니다.");
      setDetail((current) => ({ ...current, summaries: [next, ...current.summaries] })); setMessage("새 발언 포인트를 저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "발언 포인트를 다시 만들지 못했습니다."); }
    finally { setRegenerating(false); }
  };

  const deleteMeeting = async () => {
    if (!window.confirm("이 회의의 전사, 요약, 답변, 회의록이 모두 삭제됩니다. 계속하시겠습니까?")) return;
    const response = await fetch(`/api/meetings/${detail.meeting.id}`, { method: "DELETE" });
    if (response.ok) window.location.href = "/";
    else setMessage("회의를 삭제하지 못했습니다.");
  };

  return <section className="workspace-detail"><div className="detail-heading"><div><span className="section-eyebrow">MEETING DETAIL</span><h2>{detail.meeting.title}</h2><p>{new Date(detail.meeting.started_at).toLocaleString("ko-KR")} · {detail.meeting.duration_seconds ? `${Math.round(detail.meeting.duration_seconds / 60)}분` : "진행 중"}</p></div><a className="detail-page-link" href={`/meetings/${detail.meeting.id}`}>인쇄용 보기</a></div><div className="detail-actions"><button className="button" onClick={() => { setTitle(detail.meeting.title); setContent(detail.note?.content || ""); setEditing(true); }}>회의 내용 수정</button><button className="button" onClick={() => void regenerateSpeakingPoint()} disabled={regenerating}>{regenerating ? "발언 포인트 생성 중..." : "발언 포인트 다시 생성"}</button><button className="button danger-button" onClick={() => void deleteMeeting()}>회의 삭제</button></div>{editing && <section className="workspace-edit-panel"><label htmlFor="workspace-title">회의 제목</label><input id="workspace-title" value={title} onChange={(event) => setTitle(event.target.value)} /><label htmlFor="workspace-content">회의 내용</label><textarea id="workspace-content" rows={9} value={content} onChange={(event) => setContent(event.target.value)} /><div className="detail-actions"><button className="button primary" onClick={() => void saveChanges()} disabled={busy}>{busy ? "저장 중..." : "변경사항 저장"}</button><button className="button" onClick={() => setEditing(false)}>취소</button></div></section>}{message && <p className="workspace-action-message" role="status">{message}</p>}<div className="detail-tabs"><button className="active">Summary</button><button onClick={() => document.getElementById("workspace-notes")?.scrollIntoView({ behavior: "smooth" })}>Notes</button><button onClick={() => document.getElementById("workspace-transcript")?.scrollIntoView({ behavior: "smooth" })}>Transcript</button><button onClick={() => document.getElementById("workspace-responses")?.scrollIntoView({ behavior: "smooth" })}>Responses</button></div>{last && <div className="detail-summary"><div><span>핵심</span><p>{last.core}</p></div><div><span>쟁점</span><p>{last.issues}</p></div><div><span>발언 포인트</span><p>{last.speakingPoint}</p></div></div>}<section id="workspace-notes" className="detail-section"><h3>Notes</h3><pre>{detail.note?.content || "저장된 회의록이 없습니다."}</pre></section><section id="workspace-transcript" className="detail-section"><h3>Transcript</h3>{detail.transcripts.map((item) => <p key={item.sequence}>{item.text}</p>)}</section><section id="workspace-responses" className="detail-section"><h3>Responses</h3>{detail.responses.map((item, index) => <p key={index}>“{item.text}”</p>)}</section></section>;
}
