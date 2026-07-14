# budget 프로젝트 — Claude Code 설정

## 세션 시작 시 필수 작업

**반드시 `WORKLOG.md`를 읽고 이전 작업 상태를 파악한 뒤 대화를 시작하세요.**

## 프로젝트 개요

- **budget**: 웹 가계부 서비스 (Cloudflare Pages + Functions + D1)
- 스택: React + TypeScript + Tailwind CSS v4 + Vite
- 배포: Cloudflare Pages (`npm run deploy`)
- DB: Cloudflare D1 (`schema.sql`), 로컬 초기화 `npm run d1:init`

## 코드 규칙

- 한국어 주석 사용
- API 라우트: `functions/api/**` (Cloudflare Pages Functions)
- D1 바인딩 이름: `DB`

## 작업 워크플로우 (필수 순서)

**모든 작업은 아래 순서를 반드시 지킬 것:**

1. **WORKLOG.md에 작업 계획 기록** — 날짜, 작업 항목, 예상 변경 파일
2. **git commit & push** — 메시지: `chore: [작업명] 작업 시작 기록`
3. **실제 작업 수행**
4. **WORKLOG.md에 완료 내용 업데이트** — 완료 항목 체크, 미완료 항목 명시
5. **git commit & push** — 메시지: `feat/fix/chore: [작업 내용 요약]`

> 작업 시작 전 커밋, 작업 완료 후 커밋 — 총 2회 커밋이 기본 패턴

## 주요 커맨드

| 명령 | 설명 |
|------|------|
| `npm run dev` | Vite 개발 서버 (API 없음) |
| `wrangler pages dev` | 로컬 전체 서버 (API + Vite) |
| `npm run d1:init` | 로컬 D1 스키마 초기화 |
| `npm run deploy` | Cloudflare Pages 배포 |
| `npm run lint` | oxlint 검사 |
| `npm run typecheck` | tsc 타입 검사 |
