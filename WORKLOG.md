# WORKLOG

## 2026-07-14

### 완료
- 프로젝트 초기 생성 (Vite + React + TypeScript + Tailwind v4)
- Cloudflare Pages Functions + D1 스캐폴딩
  - `wrangler.toml` (D1 바인딩 `DB`, database_id는 PLACEHOLDER)
  - `schema.sql` — transactions 테이블
  - `functions/api/transactions/index.ts` — 목록 조회(GET) / 추가(POST)
  - `functions/api/transactions/[id].ts` — 삭제(DELETE)
  - `src/App.tsx` — 기본 레이아웃 뼈대만 작성

### 미완료 / 다음 작업
- [ ] Cloudflare D1 실제 DB 생성 (`wrangler d1 create budget-db`) 후 wrangler.toml의 database_id 교체
- [ ] 로컬 D1 초기화: `npm run d1:init`
- [ ] 로컬에서 API 연동 테스트 (`wrangler pages dev` 등으로 functions 프록시 필요 — 현재 `npm run dev`는 vite만 실행해 /api 호출이 실패함)
- [ ] Cloudflare Pages 프로젝트 생성 및 최초 배포
- [ ] GitHub 저장소 연결 여부 결정

## 2026-07-14 (2차)

### 완료
- 어르신 사용자 배려 — 시인성 최우선 UI 구현
  - 전역 기본 폰트 18px로 확대 (`src/index.css`), 다크모드 비활성화(고대비 라이트 테마 고정)
  - `src/types.ts`, `src/lib/{api,categories,format}.ts` — 타입/유틸 분리
  - `src/components/SummaryCard.tsx` — 이번달 수입/지출/잔액 큰 숫자로 표시
  - `src/components/TransactionForm.tsx` — 수입/지출 큰 토글 버튼, 카테고리 칩, 큰 입력창(최소 높이 56px)
  - `src/components/TransactionList.tsx` — 날짜별 그룹, 색상으로 수입(파랑)/지출(빨강) 구분, 삭제 확인 다이얼로그
  - `src/App.tsx` — 모바일 1단, 데스크탑(lg 이상) 2단 레이아웃으로 재구성
  - tsc/oxlint 통과 확인

### 미완료 / 다음 작업 (이어서)
- [ ] Chrome 확장 연결 후 실제 화면 스크린샷으로 검증 (현재 확장 미연결로 육안 확인 필요)
- [ ] 위 D1/배포 관련 작업

## 2026-07-15

### 작업 계획
- [ ] Cloudflare D1 DB 생성 (`wrangler d1 create budget-db`)
- [ ] `wrangler.toml` database_id 실제 값으로 교체
- [ ] 로컬 D1 스키마 초기화 (`npm run d1:init`)
- [ ] Cloudflare Pages 프로젝트 생성 및 최초 배포 (`npm run deploy`)
- 예상 변경 파일: `wrangler.toml`, `WORKLOG.md`

---

## 2026-07-14 (3차)

### 완료
- 사용자 피드백 반영: 기본 폰트 크기 과도해서 16px(기본)로 축소, 컴포넌트별 여백/버튼 크기 한 단계씩 축소 (`src/index.css`, `SummaryCard`, `TransactionForm`, `TransactionList`, `App.tsx`)
- 세부 카테고리 직접 추가 기능
  - `src/lib/categories.ts` — 기본 카테고리 + localStorage에 사용자 정의 카테고리 저장/조회 (`getCategories`, `addCustomCategory`)
  - `TransactionForm.tsx` — "+ 직접입력" 칩으로 새 분류 추가 가능, 추가 즉시 선택됨
- 분류별 합계 기능
  - `src/components/CategoryBreakdown.tsx` 신규 — 이번달 지출/수입을 분류별로 집계해 막대그래프 리스트로 표시 (지출=빨강, 수입=파랑, 단일 색상바 + 직접 라벨링이라 범례 불필요)
  - `App.tsx`에 목록 위쪽에 배치
- tsc/oxlint 통과 확인

### 미완료 / 다음 작업 (이어서)
- [ ] 커스텀 카테고리는 현재 localStorage(브라우저 로컬)에만 저장됨 — 기기 간 동기화나 서버 저장이 필요하면 추후 논의
- [ ] Chrome 확장 연결 후 화면 스크린샷 검증
- [ ] D1/배포 관련 작업 (위 항목 동일)
