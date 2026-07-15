# WORKLOG

## 2026-07-15 (11차) — budgets NULL UNIQUE 중복 방지

### 작업 계획
- [ ] functions/api/budgets/index.ts POST — 애플리케이션 레벨 중복 체크 추가 (케이스 A: 매월반복, B: 특정월)
- [ ] functions/api/budgets/[id].ts PATCH — category/year_month 변경·재활성화 시 중복 체크
- [ ] src/lib/api.ts — BudgetConflictError 클래스 추가, createBudget/updateBudget 충돌 응답 처리
- [ ] src/components/BudgetManager.tsx — id 타입 string으로 수정, 카테고리 "이미 설정됨" 뱃지, 충돌 시 인라인 에러+수정 안내

### 변경 파일
- `functions/api/budgets/index.ts`, `functions/api/budgets/[id].ts`
- `src/lib/api.ts`, `src/components/BudgetManager.tsx`

### 상태
- 작업 중단 (집에서 이어서 진행 예정)
- 미완료 항목 전부 미착수 상태로 초기화

---

## 2026-07-15 (10차) — 코드 리뷰 4가지 수정

### 작업 계획
- [x] Issue 2: benefitMatcher.ts calcScore 버그 수정 (hasMerchant && hasCategory 시 카테고리 누수 제거)
- [x] Issue 4: billing.ts getCardBillingPeriod에 daysInMonth 클램핑 추가
- [x] Issue 3: budgets 테이블 id를 TEXT UUID로 변경 (migration 006 + 관련 파일 전부)
- [x] Issue 1: schema.sql을 모든 마이그레이션 반영한 최종 상태로 재작성

### 검증 결과
- tsc --noEmit: 통과
- oxlint: 통과
- schema.sql d1:init: 17 commands 전부 success
- migration 006 원격 적용: 완료 (5 queries, 31 rows written)
- billing.ts 2월 테스트: closing_day=31 → 2026-02-28로 클램핑 ✅ / 윤년 2024-02-29 ✅
- calcScore 구매처+분류 동시 지정 불일치 케이스: -1 반환 ✅ (기존 50 → 수정됨)
- 배포: https://34de9c70.budget-3wb.pages.dev

### 변경 파일
- `functions/lib/benefitMatcher.ts`, `src/lib/billing.ts`
- `migrations/006_budgets_text_id.sql` (신규), `functions/lib/budget.ts`
- `functions/api/budgets/index.ts`, `functions/api/budgets/[id].ts`
- `src/types.ts`, `src/lib/api.ts`
- `schema.sql`

---


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

## 2026-07-15 (9차)

### 작업 계획
- [x] SearchView.tsx — 수입/지출·날짜 범위(빠른선택 포함)·분류·결제방법·금액 범위 필터 추가, 결과 수입/지출 합계 표시, 할인 뱃지

---

## 2026-07-15 (8차)

### 완료
- [x] npm install xlsx (SheetJS 0.18)
- [x] functions/api/export/index.ts — GET(기간 필터, transactions LEFT JOIN cards로 카드명 포함)
- [x] src/lib/exportExcel.ts — 3시트 생성 (거래내역·월별요약·카드별정산), 금액 숫자 타입, 열 너비 설정
- [x] src/lib/api.ts — fetchExportData(start_date, end_date) 추가
- [x] src/components/ExportButton.tsx — 이번달/올해/전체/직접선택 preset, 모달 UI, 로딩 상태
- [x] SearchView.tsx 상단, AnnualReport.tsx 상단에 ExportButton 배치
- [x] tsc + lint + 배포 완료
- [x] Node.js 검증: 시트 3개 ✅, 금액 number 타입 ✅, 월별 합계 일치 ✅

---

## 2026-07-15 (7차)

### 완료
- [x] migrations/005_add_budgets.sql — budgets 테이블 + UNIQUE(user_id, category, year_month) (로컬+원격 적용)
- [x] functions/lib/budget.ts — calculateBudgetStatus: year_month 우선, 카테고리별+전체 지출 집계, exceeded 판단
- [x] functions/api/budgets/index.ts — GET(연월별 현황 포함) / POST(ON CONFLICT DO UPDATE)
- [x] functions/api/budgets/[id].ts — PATCH / DELETE
- [x] src/types.ts — Budget, BudgetStatus, NewBudget 타입 추가
- [x] src/lib/api.ts — fetchBudgetStatus, createBudget, updateBudget, deleteBudget 추가
- [x] src/components/BudgetManager.tsx — 진행률 바(🟢<80%/🟡80~100%/🔴초과), 초과 배너, 매월반복/이번달만 선택, 활성화 토글
- [x] src/components/TransactionForm.tsx — 카테고리 선택 시 예산 현황 인라인 표시, 입력 중 초과 예상 경고
- [x] src/App.tsx — 예산 탭(📋) 추가(7탭), 홈 화면 초과 배너, budgetStatuses 상태 관리
- [x] tsc + lint + vite 빌드 + Cloudflare Pages 배포 완료
- [x] 테스트: 🟢정상 → 🟡80%(식비 81%) → 🔴초과(식비 106%, 카페 110%) 시나리오 전부 통과

---

## 2026-07-15 (6차)

### 완료
- [x] migrations/004_add_benefits.sql — card_benefits 테이블 + transactions.original_amount/discount_amount/benefit_id (로컬+원격 적용)
- [x] functions/lib/benefitMatcher.ts — 우선순위 점수(merchant+category=150, merchant=100, category=50, global=10) 기반 매칭, 월 한도/사용액 계산
- [x] functions/api/benefits/index.ts — GET(card_id 필터) / POST
- [x] functions/api/benefits/match.ts — GET /api/benefits/match (정적 라우트, [id].ts보다 우선)
- [x] functions/api/benefits/[id].ts — PATCH / DELETE
- [x] src/types.ts — CardBenefit, BenefitMatch, NewBenefit 추가, Transaction에 recurring_id/original_amount/discount_amount/benefit_id 추가
- [x] src/lib/api.ts — fetchBenefits, createBenefit, updateBenefit, deleteBenefit, matchBenefit 추가
- [x] src/components/TransactionForm.tsx — 카드+금액 입력 시 400ms debounce로 매칭 호출, 단일 매칭 자동 적용/복수 라디오 선택, 실결제액 저장 버튼 표시
- [x] src/components/CardManager.tsx — 카드별 혜택 섹션(토글), 혜택 규칙 CRUD (할인유형/율/분류/구매처/한도/최소금액)
- [x] tsc + vite 빌드 통과, Cloudflare Pages 배포 완료

---

## 2026-07-15 (5차)

### 작업 계획
### 완료
- [x] migrations/003_add_benefits_and_recurring.sql — recurring_transactions 테이블, transactions.recurring_id 컬럼 (로컬+원격 적용)
- [x] functions/lib/recurring.ts — generateDueRecurringTransactions: 놓친 달 소급 생성, 중복 방지, last_generated_date 업데이트
- [x] functions/api/recurring/index.ts — GET/POST /api/recurring
- [x] functions/api/recurring/[id].ts — PATCH (active 토글 포함) / DELETE
- [x] functions/api/transactions/index.ts — GET 시 자동 생성 먼저 실행
- [x] src/types.ts — RecurringTransaction, NewRecurring 타입 추가
- [x] src/lib/api.ts — fetchRecurring, createRecurring, updateRecurring, deleteRecurring 추가
- [x] src/components/RecurringManager.tsx — 항목명/금액/분류/구매처/결제방법/매월 며칠/시작~종료일 등록, 활성/비활성 토글
- [x] src/App.tsx — 🔁 고정 탭 추가 (6탭), RecurringManager 연결
- [x] tsc + oxlint + vite 빌드 통과, Cloudflare Pages 배포 완료

---

## 2026-07-15 (4차)

### 작업 계획
### 완료
- [x] DB 마이그레이션 — users, sessions 테이블 / transactions·cards에 user_id 추가 (`migrations/002_add_auth.sql`)
- [x] 비밀번호 해싱 유틸 — PBKDF2 10,000회 + 랜덤 salt (`functions/lib/auth.ts`)
- [x] 인증 API — POST register, POST login, POST logout, GET me
- [x] Pages Functions 미들웨어 — `/api/auth/*` 제외 전체 보호, user_id context 주입
- [x] transactions/cards API — WHERE user_id = ? 필터로 본인 데이터만 접근
- [x] AuthContext — 로그인 상태 전역 관리, 앱 시작 시 /api/auth/me 자동 확인
- [x] AuthPage — 로그인/회원가입 탭 폼, 에러 메시지 표시
- [x] App.tsx — 미로그인 시 AuthPage, 헤더에 사용자 이름 + 로그아웃 버튼
- [x] tsc + vite 빌드 통과, Cloudflare Pages 배포 완료

---

## 2026-07-15 (3차)

### 작업 계획
### 완료
- [x] DB 마이그레이션 — transactions(merchant, payment_method, card_id), cards 테이블 (`migrations/001_add_cards.sql`)
- [x] 카드 API — GET/POST /api/cards, PATCH/DELETE /api/cards/[id]
- [x] 거래 API 확장 — 신규 필드(merchant, payment_method, card_id), 검색(q), 연도(year), 카드기간(card_id+date_start+date_end)
- [x] 하단 탭 네비게이션 5개 (홈/월정산/연정산/카드/검색)
- [x] TransactionForm — 구매처, 결제방법(현금/카드 칩 선택) 추가
- [x] CardManager — 카드 CRUD, 마감일·결제일 입력, 혜택 목록, 색상 선택
- [x] MonthlyReport — 현금수입/지출 + 카드별 청구기간 실출금 합산, 세부내역 펼치기
- [x] AnnualReport — 12개월 바 차트 + 월별 표
- [x] SearchView — 구매처·분류·메모 통합 검색, 카드 뱃지 표시
- [x] tsc + vite 빌드 통과, Cloudflare Pages 배포 완료

---

## 2026-07-15 (2차)

### 완료
- [x] 월별 필터 UI — 헤더에 ◀ 2026년 7월 ▶ 네비게이션, `오늘` 버튼으로 현재 월 복귀
- [x] API `?month=YYYY-MM` 쿼리 파라미터 지원 (`functions/api/transactions/index.ts`)
- [x] SummaryCard, CategoryBreakdown — month prop으로 교체, 내부 Date 하드코딩 제거
- [x] 거래 수정 기능 — `PATCH /api/transactions/[id]`, TransactionList 인라인 편집 폼
- [x] tsc 타입체크 + vite 빌드 + Cloudflare Pages 배포 완료
- 배포 URL: https://budget-3wb.pages.dev

---

## 2026-07-15

### 완료
- [x] Cloudflare D1 DB 생성 (`wrangler d1 create budget-db`)
  - database_id: `ff31284d-4e34-4a03-a99c-313cc330d7d0` (APAC 리전)
- [x] `wrangler.toml` database_id 실제 값으로 교체
- [x] 로컬 D1 스키마 초기화 (`npx wrangler d1 execute budget-db --local --file=./schema.sql`)
- [x] 원격 D1 스키마 적용 (`npx wrangler d1 execute budget-db --remote --file=./schema.sql`)
- [x] Cloudflare Pages 프로젝트 생성 (`budget` 프로젝트, 프로덕션 URL: https://budget-3wb.pages.dev)
- [x] 최초 배포 완료 (preview: https://e7905b8a.budget-3wb.pages.dev)

### 미완료 / 다음 작업
- [ ] Cloudflare 대시보드에서 D1 바인딩 연결 확인 (Pages → budget → Settings → Bindings)
- [ ] `npm run d1:init` 스크립트가 wrangler 전역 설치 없이 실패하는 문제 → package.json 스크립트를 `npx wrangler ...`로 수정 필요
- [ ] GitHub 저장소와 Cloudflare Pages 자동 배포 연결 여부 결정

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
