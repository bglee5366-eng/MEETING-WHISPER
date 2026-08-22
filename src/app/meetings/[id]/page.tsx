"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-location-assign-relative-destination */

import { useEffect, useState } from "react";

type Provider = "openai" | "gemini" | "anthropic";
type Summary = { core: string; issues: string; speaking_point: string; question?: string; decision?: string; numbers?: string[] };
type Detail = { meeting: { title: string; started_at: string; ended_at: string | null; duration_seconds: number | null }; transcripts: { text: string; sequence: number }[]; summaries: Summary[]; responses: { text: string }[]; note: { content: string } | null };

export default function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [id, setId] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [provider, setProvider] = useState<Provider>("openai");
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratedPoint, setRegeneratedPoint] = useState("");
  const [regenerateError, setRegenerateError] = useState("");

  useEffect(() => {
    void params.then(({ id: value }) => {
      setId(value);
      const savedProvider = localStorage.getItem("meeting-whisper-provider") as Provider | null;
      if (savedProvider === "openai" || savedProvider === "gemini" || savedProvider === "anthropic") setProvider(savedProvider);
      void fetch(`/api/meetings/${value}`).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) setError(payload?.error?.message || "회의를 불러오지 못했습니다.");
        else { setDetail(payload); setTitle(payload.meeting.title); setContent(payload.note?.content || ""); }
      });
    });
  }, [params]);

  const edit = () => { if (!detail) return; setTitle(detail.meeting.title); setContent(detail.note?.content || ""); setSaveState("idle"); setEditing(true); };
  const save = async () => {
    if (!title.trim() || !content.trim()) { setSaveState("error"); return; }
    setSaveState("saving");
    try {
      const meetingResponse = await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
      if (!meetingResponse.ok) throw new Error("회의 제목 저장에 실패했습니다.");
      const noteResponse = await fetch(`/api/meeting-notes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content }) });
      const payload = await noteResponse.json().catch(() => null);
      if (!noteResponse.ok) throw new Error(payload?.error?.message || "회의록 저장에 실패했습니다.");
      setDetail((current) => current ? { ...current, meeting: { ...current.meeting, title }, note: { content } } : current);
      setSaveState("saved"); setEditing(false);
    } catch { setSaveState("error"); }
  };
  const regenerateSpeakingPoint = async () => {
    if (!detail || detail.transcripts.length === 0) { setRegenerateError("저장된 전사 내용이 없어 발언 포인트를 만들 수 없습니다."); return; }
    setRegenerating(true); setRegenerateError("");
    try {
      const transcript = detail.transcripts.sort((a, b) => a.sequence - b.sequence).map((item) => item.text).join("\n");
      const response = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript, provider }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.summary?.speakingPoint) throw new Error(payload?.error?.message || "발언 포인트를 다시 만들지 못했습니다.");
      const nextPoint = payload.summary.speakingPoint as string;
      setRegeneratedPoint(nextPoint);
      const saveResponse = await fetch("/api/summaries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meeting_id: id, summary: payload.summary }) });
      if (!saveResponse.ok) throw new Error("새 발언 포인트 저장에 실패했습니다.");
      setDetail((current) => current ? { ...current, summaries: [{ ...payload.summary, speaking_point: nextPoint }, ...current.summaries] } : current);
    } catch (cause) { setRegenerateError(cause instanceof Error ? cause.message : "발언 포인트를 다시 만들지 못했습니다."); }
    finally { setRegenerating(false); }
  };
  const remove = async () => { if (!window.confirm("이 회의의 전사, 요약, 답변, 회의록이 모두 삭제됩니다. 계속하시겠습니까?")) return; const response = await fetch(`/api/meetings/${id}`, { method: "DELETE" }); if (response.ok) window.location.href = "/meetings"; };

  if (error) return <main className="archive-page"><a href="/meetings">← 지난 회의</a><p className="transcription-error">{error}</p></main>;
  if (!detail) return <main className="archive-page">불러오는 중...</main>;
  const last = detail.summaries[0];
  return <main className="archive-page"><a href="/meetings">← 지난 회의</a><p className="eyebrow">MEETING DETAIL</p>{editing ? <div className="archive-edit"><label htmlFor="edit-title">회의 제목</label><input id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} /><label htmlFor="edit-note">회의록 내용</label><textarea id="edit-note" value={content} onChange={(event) => setContent(event.target.value)} rows={16} /><div className="archive-edit-actions"><button className="button primary" onClick={() => void save()} disabled={saveState === "saving"}>{saveState === "saving" ? "저장 중..." : "변경사항 저장"}</button><button className="button ghost" onClick={() => setEditing(false)}>취소</button></div>{saveState === "error" && <p className="transcription-error">제목과 회의록 내용을 확인한 뒤 다시 저장해 주세요.</p>}</div> : <><h1>{detail.meeting.title}</h1><p>{new Date(detail.meeting.started_at).toLocaleString("ko-KR")} · {detail.meeting.duration_seconds ? `${Math.round(detail.meeting.duration_seconds / 60)}분` : "진행 중"}</p>{detail.note && <section className="archive-section"><div className="archive-section-heading"><h2>회의록</h2><button className="button ghost small-button" onClick={edit}>수정</button></div><pre>{detail.note.content}</pre></section>}{last && <section className="archive-section"><h2>3줄 요약</h2><p><b>핵심</b> {last.core}</p><p><b>쟁점</b> {last.issues}</p><p><b>발언 참고</b> {regeneratedPoint || last.speaking_point}</p><div className="regenerate-speaking-point"><label htmlFor="summary-provider">AI Provider</label><select id="summary-provider" value={provider} onChange={(event) => setProvider(event.target.value as Provider)}><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="anthropic">Claude</option></select><button className="button primary" onClick={() => void regenerateSpeakingPoint()} disabled={regenerating}>{regenerating ? "발언 포인트 생성 중..." : "발언 포인트 다시 생성"}</button></div>{regenerateError && <p className="transcription-error">{regenerateError}</p>}</section>}<section className="archive-section"><h2>한마디 답변</h2>{detail.responses.map((item, index) => <p key={index}>“{item.text}”</p>)}</section><section className="archive-section"><h2>전체 전사</h2>{detail.transcripts.map((item) => <p key={item.sequence}>{item.text}</p>)}</section><div className="archive-actions"><button className="button primary" onClick={edit}>회의 제목·내용 수정</button><button className="button ghost" onClick={() => void remove()}>회의 삭제</button></div></>}</main>;
}
