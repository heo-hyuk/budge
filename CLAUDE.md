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
