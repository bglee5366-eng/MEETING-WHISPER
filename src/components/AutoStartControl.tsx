"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function AutoStartControl({ open }: { open: boolean }) {
  const [autoStart, setAutoStart] = useState(false);
  const [settingsHost, setSettingsHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setAutoStart(localStorage.getItem("meeting-whisper-auto-record") === "true"); }, []);
  useEffect(() => { setSettingsHost(open ? document.querySelector<HTMLElement>(".settings-popover") : null); }, [open]);
  if (!open || !settingsHost) return null;
  const choose = (value: boolean) => { setAutoStart(value); localStorage.setItem("meeting-whisper-auto-record", String(value)); };
  return createPortal(<section className="settings-auto-start-section" aria-label="새 회의 녹음 시작 설정"><span className="settings-label">새 회의 시작 방식</span><p>새 회의를 눌렀을 때 녹음을 바로 시작할지 선택합니다.</p><button className={autoStart ? "selected" : ""} onClick={() => choose(true)}>✓ 바로 녹음 시작</button><button className={!autoStart ? "selected" : ""} onClick={() => choose(false)}>○ 시작 화면에서 녹음</button></section>, settingsHost);
}
