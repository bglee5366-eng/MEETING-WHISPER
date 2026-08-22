"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

export default function AutoStartControl({ open }: { open: boolean }) {
  const [autoStart, setAutoStart] = useState(false);
  useEffect(() => setAutoStart(localStorage.getItem("meeting-whisper-auto-record") === "true"), []);
  if (!open) return null;
  const choose = (value: boolean) => { setAutoStart(value); localStorage.setItem("meeting-whisper-auto-record", String(value)); };
  return <div className="auto-start-popover" role="dialog" aria-label="새 회의 녹음 시작 설정"><strong>새 회의 시작 방식</strong><p>새 회의를 눌렀을 때 녹음을 바로 시작할지 선택합니다.</p><button className={autoStart ? "selected" : ""} onClick={() => choose(true)}>✓ 바로 녹음 시작</button><button className={!autoStart ? "selected" : ""} onClick={() => choose(false)}>○ 시작 화면에서 녹음</button></div>;
}
