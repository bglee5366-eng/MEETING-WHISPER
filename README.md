# 회의 멍때리기 방지 요약기

회의 중 잠깐 집중하지 못했을 때 직전 10분의 대화를 빠르게 따라잡도록 도와주는 3줄 컨닝페이퍼 앱입니다.

## 주요 기능

- 브라우저 마이크 녹음과 최근 10분 Rolling Buffer
- 사용자가 `지금 살려줘!`를 눌렀을 때만 최근 음성을 서버로 전송
- 음성 전사(STT)와 핵심·쟁점·발언 포인트 3줄 요약
- OpenAI, Gemini, Claude provider 선택
- 귓속말 모드와 짧은 한마디 답변 생성
- 브라우저 SpeechSynthesis 기반 TTS
- 녹음 종료 또는 결과 삭제 시 브라우저 메모리의 녹음 데이터 삭제
- 모바일 반응형 화면

## 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript
- MediaRecorder API, SpeechSynthesis API
- Next.js Route Handler

## 로컬 실행

Node.js와 pnpm을 설치한 뒤 실행합니다.

```bash
pnpm install
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 환경변수 설정

`.env.example`을 `.env.local`로 복사하고 서버 전용 API 키를 설정합니다.

```bash
OPENAI_API_KEY=your_server_side_key
```

API 키는 클라이언트 코드, `localStorage`, `sessionStorage`, `NEXT_PUBLIC_*` 환경변수에 저장하지 않습니다. 실제 키가 포함된 `.env.local`은 Git에 커밋하지 않습니다.

## OpenAI API 사용 안내

OpenAI provider를 선택하면 음성은 `/api/transcribe` Route Handler에서 전사되고, 전사 결과는 `/api/summarize`와 `/api/reply` Route Handler를 통해 요약·답변 생성에 사용됩니다. API 키는 서버 환경변수 `OPENAI_API_KEY`에서만 읽습니다.

Gemini와 Claude를 사용할 때는 각 provider의 서버 환경변수를 배포 환경에 별도로 설정해야 합니다.

## Vercel 배포

1. GitHub에서 `bglee5366-eng/MEETING-WHISPER` 저장소를 Vercel에 Import합니다.
2. Framework Preset이 Next.js인지 확인합니다.
3. Production 환경변수에 `OPENAI_API_KEY`를 등록합니다.
4. 필요하다면 선택한 Gemini 또는 Claude provider의 서버 환경변수도 등록합니다.
5. Deploy를 실행합니다.

별도 Cloudflare, Wrangler, Vinext 설정 없이 Next.js App Router의 기본 구조로 배포할 수 있습니다.

## 개인정보 및 음성 데이터 처리

Rolling Buffer는 기본적으로 브라우저 메모리에만 유지하며, 전체 녹음 파일을 서버에 자동 업로드하지 않습니다. 회의 음성은 사용자가 `지금 살려줘!`를 눌렀을 때만 최근 10분 Blob으로 묶여 선택한 AI provider의 서버 Route Handler로 전송됩니다.

녹음 종료 시 저장된 음성 chunk를 삭제하고, 페이지를 새로고침하거나 종료하면 브라우저 메모리의 데이터가 남지 않습니다. 실제 회의 음성을 전송하기 전에 참가자와 조직의 개인정보·녹음 정책을 확인하세요.
