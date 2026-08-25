"use client";

import { useRef } from "react";

export default function ProductHero({ onStart }: { onStart: () => void }) {
  const demoRef = useRef<HTMLDivElement>(null);
  const replayDemo = () => { demoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); };
  return <section className="product-hero" aria-label="Meeting Whisper 제품 소개">
    <div className="product-hero-copy"><span className="section-eyebrow">AI MEETING COPILOT</span><h3>잠깐 딴생각해도,<br />회의는 놓치지 마세요.</h3><p>Meeting Whisper가 실시간으로 회의를 전사하고,<br />직전 대화를 3줄로 정리해 갑작스러운 질문에도<br />바로 대응할 수 있게 합니다.</p><div className="product-hero-actions"><button className="button primary" onClick={onStart}>새 회의 시작</button><button className="button" onClick={replayDemo}>15초 사용법 보기</button></div><small className="product-hero-meta">실시간 전사 · AI 요약 · 귓속말 컨닝페이퍼</small></div>
    <div ref={demoRef} className="product-demo" role="img" aria-label="회의 전사, 갑작스러운 질문, 3줄 AI 브리핑을 보여주는 15초 제품 데모"><div className="demo-topbar"><span><i /> LIVE TRANSCRIPT</span><small>00:18:42</small></div><div className="demo-transcript"><p>내년도 사업은 데이터 확보가 중요합니다.</p><p>기관 간 공유 방식도 검토해야 합니다.</p><p>예산과 실증 연계가 핵심 쟁점입니다.</p><strong>OO님 의견은요?</strong></div><div className="demo-rescue">지금 따라잡기</div><div className="demo-brief"><span>AI BRIEF</span><b>무슨 얘기?</b><p>AI 데이터 확보와 실증 중심으로 추진</p><b>뭐가 쟁점?</b><p>데이터 비용과 기관 간 공유 방식</p><b>나는 뭐라고 하지?</b><p>실증사업과 연계한 확보 방안을 제안</p></div><div className="demo-footer">Meeting Whisper <small>회의 중, AI가 귓속말합니다.</small></div></div>
  </section>;
}
