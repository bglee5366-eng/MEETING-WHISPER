import type { Metadata } from "next";
import "./globals.css";
import "./whisper.css";

export const metadata: Metadata = {
  title: "회의 멍때리기 방지 요약기",
  description: "직전 2분의 회의 내용을 3줄로 정리해주는 컨닝페이퍼",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
