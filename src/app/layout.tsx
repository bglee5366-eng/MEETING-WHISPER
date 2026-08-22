import type { Metadata } from "next";
import "./globals.css";
import "./whisper.css";

export const metadata: Metadata = {
  title: "Meeting Whisper — AI Meeting Copilot",
  description: "회의를 놓쳤어도 10초 안에 다시 따라잡는 AI Meeting Copilot",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
