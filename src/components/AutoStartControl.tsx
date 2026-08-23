"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

type Theme = "system" | "light" | "dark";
type Provider = "openai" | "gemini" | "anthropic";
type Section = "theme" | "provider" | "recording" | "font" | null;

const providers: Record<Provider, { name: string; icon: string }> = {
  openai: { name: "OpenAI", icon: "/provider-icons/chatgpt.png" },
  gemini: { name: "Gemini", icon: "/provider-icons/gemini.png" },
  anthropic: { name: "Claude", icon: "/provider-icons/claude.png" },
};

const fontSizes = [
  { value: "1", label: "작게" },
  { value: "2", label: "조금 작게" },
  { value: "3", label: "기본" },
  { value: "4", label: "조금 크게" },
  { value: "5", label: "크게" },
];

function ProviderMark({ provider }: { provider: Provider }) {
  return <Image src={providers[provider].icon} alt="" aria-hidden="true" width={18} height={18} />;
}

export default function AutoStartControl({ open }: { open: boolean }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [theme, setTheme] = useState<Theme>("system");
  const [provider, setProvider] = useState<Provider>("openai");
  const [fontSize, setFontSize] = useState("3");
  const [autoRecord, setAutoRecord] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<Section>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setHost(document.querySelector<HTMLElement>(".settings-popover"));
    const savedTheme = localStorage.getItem("meeting-whisper-theme") as Theme | null;
    const savedProvider = localStorage.getItem("meeting-whisper-provider") as Provider | null;
    const savedFontSize = localStorage.getItem("meeting-whisper-font-size");
    setTheme(savedTheme === "system" || savedTheme === "light" || savedTheme === "dark" ? savedTheme : "system");
    setProvider(savedProvider === "openai" || savedProvider === "gemini" || savedProvider === "anthropic" ? savedProvider : "openai");
    setFontSize(savedFontSize && fontSizes.some((item) => item.value === savedFontSize) ? savedFontSize : "3");
    setAutoRecord(localStorage.getItem("meeting-whisper-auto-record") === "true");
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSettingsOpen(false);
      setSection(null);
      setNotice("");
    }
  }, [open]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.fontSize = fontSize;
  }, [theme, fontSize]);

  const chooseTheme = (next: Theme) => {
    setTheme(next);
    localStorage.setItem("meeting-whisper-theme", next);
  };

  const chooseProvider = (next: Provider) => {
    setProvider(next);
    localStorage.setItem("meeting-whisper-provider", next);
    window.dispatchEvent(new CustomEvent("meeting-whisper-provider-change", { detail: next }));
  };

  const chooseFontSize = (next: string) => {
    setFontSize(next);
    localStorage.setItem("meeting-whisper-font-size", next);
  };

  const chooseAutoRecord = (next: boolean) => {
    setAutoRecord(next);
    localStorage.setItem("meeting-whisper-auto-record", String(next));
  };

  if (!open || !host) return null;

  const row = (key: Exclude<Section, null>, label: string, value: string, content: React.ReactNode) => (
    <div className="settings-side-row" key={key}>
      <button className="settings-side-trigger" type="button" onClick={() => setSection(section === key ? null : key)}>
        <span className="settings-side-chevron">{section === key ? "‹" : "›"}</span><span>{label}</span><small>{value}</small>
      </button>
      {section === key && <div className="settings-side-panel">{content}</div>}
    </div>
  );

  const actualSettings = (
    <div className="settings-side-menu">
      {row("theme", "화면 모드", theme === "system" ? "시스템" : theme === "light" ? "라이트" : "다크", <div className="settings-tree-options">{(["system", "light", "dark"] as Theme[]).map((option) => <button type="button" className={theme === option ? "selected" : ""} key={option} onClick={() => chooseTheme(option)}>{theme === option ? "✓" : "○"} {option === "system" ? "시스템 설정" : option === "light" ? "라이트 모드" : "다크 모드"}</button>)}</div>)}
      {row("provider", "AI Provider", providers[provider].name, <div className="settings-tree-options">{(Object.keys(providers) as Provider[]).map((option) => <button type="button" className={provider === option ? "selected" : ""} key={option} onClick={() => chooseProvider(option)}><ProviderMark provider={option} />{provider === option ? "✓ " : ""}{providers[option].name}</button>)}</div>)}
      {row("recording", "새 회의 시작 방식", autoRecord ? "바로 녹음" : "시작 화면", <div className="settings-tree-options"><button type="button" className={autoRecord ? "selected" : ""} onClick={() => chooseAutoRecord(true)}>{autoRecord ? "✓" : "○"} 바로 녹음 시작</button><button type="button" className={!autoRecord ? "selected" : ""} onClick={() => chooseAutoRecord(false)}>{!autoRecord ? "✓" : "○"} 시작 화면에서 녹음</button></div>)}
      {row("font", "글꼴 크기", fontSizes.find((item) => item.value === fontSize)?.label || "기본", <div className="settings-tree-options">{fontSizes.map((item) => <button type="button" className={fontSize === item.value ? "selected" : ""} key={item.value} onClick={() => chooseFontSize(item.value)}>{fontSize === item.value ? "✓" : "○"} {item.label}</button>)}</div>)}
    </div>
  );

  return createPortal(
    <div className="chat-settings-menu">
      <button className="chat-account-row" type="button" onClick={() => setNotice("현재 로그인 기능은 준비 중입니다.")}><span className="chat-account-avatar">MW</span><span className="chat-account-copy"><strong>Meeting Whisper</strong><small>Free plan</small></span><span className="chat-account-arrow">›</span></button>
      <div className="chat-settings-actions">
        <button type="button" className="chat-settings-action" onClick={() => setNotice("요금제 업그레이드 기능은 준비 중입니다.")}><span>✦</span>요금제 업그레이드</button>
        <button type="button" className="chat-settings-action" onClick={() => setNotice("개인 맞춤 설정 기능은 준비 중입니다.")}><span>◌</span>개인 맞춤 설정</button>
        <button type="button" className="chat-settings-action" onClick={() => setNotice("프로필 기능은 준비 중입니다.")}><span>◎</span>프로필</button>
        <button type="button" className={`chat-settings-action ${settingsOpen ? "selected" : ""}`} onClick={() => setSettingsOpen((value) => !value)}><span>⚙</span>설정<em>{settingsOpen ? "‹" : "›"}</em></button>
      </div>
      {settingsOpen && actualSettings}
      <div className="chat-settings-divider" />
      <button type="button" className="chat-settings-action" onClick={() => setNotice("도움말 기능은 준비 중입니다.")}><span>◉</span>도움말<em>›</em></button>
      {notice && <p className="chat-settings-notice" role="status">{notice}</p>}
    </div>,
    host,
  );
}
