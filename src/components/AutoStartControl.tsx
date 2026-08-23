"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

type Theme = "system" | "light" | "dark";
type Provider = "openai" | "gemini" | "anthropic";
const providers: { value: Provider; label: string; icon: string }[] = [
  { value: "openai", label: "OpenAI", icon: "/provider-icons/chatgpt.png" },
  { value: "gemini", label: "Gemini", icon: "/provider-icons/gemini.png" },
  { value: "anthropic", label: "Claude", icon: "/provider-icons/claude.png" },
];
const fontSizes = [
  { value: "1", label: "작게" },
  { value: "2", label: "조금 작게" },
  { value: "3", label: "기본" },
  { value: "4", label: "조금 크게" },
  { value: "5", label: "크게" },
];

export default function AutoStartControl({ open }: { open: boolean }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [theme, setTheme] = useState<Theme>("system");
  const [provider, setProvider] = useState<Provider>("openai");
  const [autoStart, setAutoStart] = useState(false);
  const [fontSize, setFontSize] = useState("3");

  useEffect(() => {
    const savedTheme = localStorage.getItem("meeting-whisper-theme") as Theme | null;
    const savedProvider = localStorage.getItem("meeting-whisper-provider") as Provider | null;
    const savedFontSize = localStorage.getItem("meeting-whisper-font-size");
    if (savedTheme === "system" || savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    if (savedProvider === "openai" || savedProvider === "gemini" || savedProvider === "anthropic") setProvider(savedProvider);
    if (savedFontSize && fontSizes.some((item) => item.value === savedFontSize)) setFontSize(savedFontSize);
    setAutoStart(localStorage.getItem("meeting-whisper-auto-record") === "true");
  }, []);
  useEffect(() => { setHost(open ? document.querySelector<HTMLElement>(".settings-popover") : null); }, [open]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.dataset.fontSize = fontSize; }, [fontSize]);

  const chooseTheme = (value: Theme) => { setTheme(value); localStorage.setItem("meeting-whisper-theme", value); };
  const chooseProvider = (value: Provider) => { setProvider(value); localStorage.setItem("meeting-whisper-provider", value); window.dispatchEvent(new CustomEvent("meeting-whisper-provider-change", { detail: value })); };
  const chooseAutoStart = (value: boolean) => { setAutoStart(value); localStorage.setItem("meeting-whisper-auto-record", String(value)); };
  const chooseFontSize = (value: string) => { setFontSize(value); localStorage.setItem("meeting-whisper-font-size", value); };
  if (!open || !host) return null;

  const radio = (checked: boolean) => checked ? "●" : "○";
  const content = <div className="settings-tree" role="tree" aria-label="설정"><strong className="settings-tree-title">설정</strong><details open><summary>화면 모드</summary><div className="settings-tree-options">{(["system", "light", "dark"] as Theme[]).map((value) => <button key={value} className={theme === value ? "selected" : ""} onClick={() => chooseTheme(value)}>{radio(theme === value)} {value === "system" ? "시스템 설정" : value === "light" ? "라이트 모드" : "다크 모드"}</button>)}</div></details><details open><summary>AI Provider</summary><div className="settings-tree-options">{providers.map((item) => <button key={item.value} className={provider === item.value ? "selected" : ""} onClick={() => chooseProvider(item.value)}><Image src={item.icon} alt="" aria-hidden="true" width={18} height={18} />{radio(provider === item.value)} {item.label}</button>)}</div></details><details open><summary>새 회의 시작 방식</summary><p className="settings-tree-help">새 회의를 눌렀을 때 녹음 시작 방식을 선택합니다.</p><div className="settings-tree-options"><button className={autoStart ? "selected" : ""} onClick={() => chooseAutoStart(true)}>{radio(autoStart)} 바로 녹음 시작</button><button className={!autoStart ? "selected" : ""} onClick={() => chooseAutoStart(false)}>{radio(!autoStart)} 시작 화면에서 녹음</button></div></details><details open><summary>폰트 크기</summary><div className="settings-tree-options">{fontSizes.map((item) => <button key={item.value} className={fontSize === item.value ? "selected" : ""} onClick={() => chooseFontSize(item.value)}>{radio(fontSize === item.value)} {item.label}</button>)}</div></details></div>;
  return createPortal(content, host);
}
