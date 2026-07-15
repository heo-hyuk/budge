# WORKLOG

## 2026-07-15 (17차) — 전체 이슈 감사 후 발견사항 전부 수정

fork로 프로젝트 전체(인증/거래/카드/고정지출/혜택/CORS) 감사 진행 후 발견된 것 전부 수정.

### 완료
- [x] **[심각] 로그인 비밀번호 검증 우회** — `functions/api/auth/login.ts`: 유효한 세션 쿠키가 있으면 요청 본문의 이메일/비밀번호를 전혀 확인하지 않고 기존 세션 유저를 그대로 반환하던 로직 제거. 이제 매 로그인 요청마다 항상 자격 증명을 검증함. 공유 PC에서 이전 사용자 세션이 남아있을 때 다른 계정으로 로그인해도 이전 사용자로 남는 문제였음 (curl로 재현 후 수정 검증: 유효 세션 + 틀린 비밀번호 → 이전엔 200, 이제 401)
- [x] **[중상] 카드 삭제 시 연관 데이터 미정리** — `functions/api/cards/[id].ts` DELETE: `recurring_transactions.card_id`를 정리 안 해서 고정지출이 죽은 카드ID로 매달 거래를 계속 생성하던 문제, `card_benefits`가 고아 레코드로 남던 문제(schema.sql의 `ON DELETE CASCADE`는 D1에 `PRAGMA foreign_keys=ON`이 없어 실제로 동작 안 함, 코드 전체 검색으로 확인) 수정 — 카드 삭제 시 고정지출은 현금으로 전환, 혜택 규칙은 명시적으로 DELETE
- [x] **[중간] PBKDF2 반복횟수 상향 + 기존 유저 호환** — `functions/lib/auth.ts`: 10,000 → 15,000회. Cloudflare Workers 무료 요금제(CPU 10ms/요청) 확인 후 `wrangler pages dev`(workerd) 실측으로 안전선 결정(15,000회≈5ms, 100,000회는 40ms로 무료 요금제에서 요청 자체가 실패함을 확인). 기존 유저 비밀번호가 깨지지 않도록 `users.iterations` 컬럼 추가(`migrations/007_add_password_iterations.sql`, 기본값 10000) 후 유저별 저장된 반복횟수로 검증하고, 로그인 성공 시 예전 반복횟수면 자동으로 최신 기준 재해싱(rehash-on-login)
- [x] **[중간] 거래 금액 음수/0 검증 없음** — `functions/api/transactions/index.ts` POST, `[id].ts` PATCH에 `amount > 0` 검증 추가 (프론트는 이미 막고 있었지만 API 직접 호출 시 우회 가능했음)
- [x] **[경미] 카드 혜택 등록 API 검증 없음** — `functions/api/benefits/index.ts` POST: card_id/name/discount_type 필수값 검증, discount_value>0 검증, 요청한 유저 소유의 카드인지 확인(다른 유저 card_id로 혜택 등록 방지) 추가
- [x] **[경미] CORS 와일드카드 제거** — `Access-Control-Allow-Origin: '*'`를 쓰던 11개 API 파일 + `_middleware.ts`에서 제거. 프론트엔드가 항상 same-origin 요청만 하므로 CORS 헤더 자체가 불필요 (실제 위험은 낮았음 — 쿠키에 `credentials:'include'`를 안 써서 크로스오리진 자동전송은 원래도 안 됐음 — 그래도 불필요한 노출이라 제거)
- [ ] **[정보, 의도적으로 스킵]** 고정지출 자동생성이 `/api/transactions` GET마다 실행되는 것 — 재검토 결과 이미 `active=1` 조건의 인덱스된 SELECT 1번+ (밀린 달이 없으면) 추가 쿼리 없음으로 비용이 낮아서, 이걸 위해 유저별 "마지막 체크일" 컬럼과 디바운스 로직을 새로 추가하는 건 실익 대비 불필요한 복잡도 증가로 판단해 스킵함

### 검증 결과
- tsc --noEmit(src) / oxlint(전체) 통과. functions/ 디렉터리는 별도 tsconfig가 없어 임시로 `tsc --ignoreConfig`로 직접 타입체크해 통과 확인
- wrangler pages dev(workerd) + curl로 전부 실측 검증:
  - PBKDF2 15,000회 실측 5ms / 100,000회 실측 40ms(무료 요금제 10ms 제한 초과 확인)
  - 기존 유저(10,000회) 로그인 성공 → iterations 15,000으로 자동 재해싱 확인 → 재해싱 후 재로그인도 정상
  - 유효 세션 + 틀린 비밀번호 로그인 시도 → 401 (수정 전 200)
  - 카드+고정지출+혜택 생성 → 카드 삭제 → 고정지출 card_id/payment_method 정리됨, 혜택 규칙 삭제됨 확인
  - 거래 음수 금액 POST → 400, 정상 금액 → 201
  - 존재하지 않는/타인 소유 card_id로 혜택 등록 → 404, 이름 누락 → 400
  - 응답 헤더에서 Access-Control-Allow-Origin 사라짐 확인
- Chrome 확장으로 홈 화면 정상 로드, 위 테스트로 생성된 거래 내역 정상 표시 확인

### ⚠️ 배포 전 필수 — 원격 D1 마이그레이션
`migrations/007_add_password_iterations.sql`을 **원격 D1에 먼저 적용해야** 함. 적용 전에 이 커밋을 배포하면 `users` 테이블에 `iterations` 컬럼이 없어서 로그인 API가 즉시 에러남 (운영 서비스 로그인 전체 장애). 원격 마이그레이션과 배포는 사용자 확인 후 별도 진행.

### 변경 파일
- `functions/api/auth/login.ts`, `functions/api/auth/register.ts`, `functions/lib/auth.ts`
- `functions/api/cards/[id].ts`
- `functions/api/transactions/index.ts`, `functions/api/transactions/[id].ts`
- `functions/api/benefits/index.ts`
- `functions/api/_middleware.ts`, `functions/api/cards/index.ts`, `functions/api/recurring/index.ts`, `functions/api/recurring/[id].ts`, `functions/api/auth/me.ts`, `functions/api/auth/logout.ts` (CORS 헤더 제거)
- `migrations/007_add_password_iterations.sql` (신규), `schema.sql`

---

## 2026-07-15 (16차) — 카드 청구기간 미리보기 문구 "32일" 버그 수정

### 완료
- [x] `src/components/CardManager.tsx` — 청구 마감일=31일일 때 안내 문구가 "전전월 32일"처럼 존재하지 않는 날짜를 보여주던 버그 수정 (사용자가 스크린샷으로 직접 발견). 원인: 시작일을 `closingDay + 1`로 손계산해서 31 초과를 처리하지 못함. 실제 청구 계산 로직(`getCardBillingPeriod`, `src/lib/billing.ts`)을 미리보기에도 그대로 재사용하도록 바꿔서 문구와 실제 계산이 항상 일치하게 함 — 재현 중 "전월/전전월" 같은 상대월 라벨도 손계산으로는 못 맞히는 경우가 있음을 발견 (마감월 직전 달의 실제 일수에 따라 시작일이 마감월과 같은 달에 들어올 수도 있음, 예: 마감 31일·결제 25일이면 11월이 30일까지라 시작일이 12월(마감월과 동일)로 밀림) — 실제 Date 기반 계산을 재사용해야만 모든 케이스가 맞음을 확인
- 같은 상대월 라벨이 중복 표시되는 경우(예: "전월 2일 ~ 전월 31일") 문구를 "전월 2일 ~ 31일"로 축약해 가독성 개선

### 검증 결과
- tsc --noEmit / oxlint / vite build 통과
- tsx로 직접 계산 검증: 마감31·결제25(버그 케이스), 마감14·결제25(기본), 마감25·결제5(역전), 마감31·결제31(동일값 말일), 마감31·결제1(역전+말일) — 모두 실제 달력 계산과 일치
- Chrome 확장으로 실제 화면 재현: 마감일을 31로 바꾸자 "매월 25일에 전월 2일 ~ 31일 사용분이 청구됩니다"로 정상 표시 확인 (기존엔 "전전월 32일 ~ 전월 31일"로 잘못 표시됐음)

### 변경 파일
- `src/components/CardManager.tsx`

---

## 2026-07-15 (15차) — 카드 등록 시 마감일 자동 제안

### 완료
- [x] `src/lib/cardDateUtils.ts`(신규) — `suggestClosingDay(billingDay)`: "마감일 = 결제일 - 11일" 패턴 기반 제안값 계산, 1 미만/31 초과 시 순환 보정. 정확한 카드사 규칙이 아니라 일반 패턴 기반 제안값이라는 점을 함수 주석에 명시
  - functions/lib이 아닌 src/lib에 배치: CardManager.tsx의 결제일 입력 onChange에서 네트워크 왕복 없이 즉시 계산해야 해서 프론트엔드 번들에 포함되어야 함 (functions/lib은 tsconfig.app.json의 include 대상이 아니라 프론트 전용 위치가 아님) — 기존 `src/lib/billing.ts`와 동일한 패턴
- [x] `src/components/CardManager.tsx` — 결제일 필드를 마감일보다 먼저 배치, 결제일 onChange 시 `suggestClosingDay`로 마감일 자동 채움(수동 수정 이력 추적 없이 매번 재계산해 덮어씀). 마감일 필드 자체는 계속 자유롭게 수정 가능한 일반 입력창. 안내 문구 추가. 수정 모드 진입 시(`startEdit`)는 onChange를 거치지 않고 `setForm`으로 기존 값을 바로 채우므로 자동 제안이 저장된 값을 덮어쓰지 않음
- [x] 저장 시 결제일/마감일 1~31 범위 검증 추가 — 프론트(`CardManager.handleSave`) + 백엔드(`functions/api/cards/index.ts` POST, `functions/api/cards/[id].ts` PATCH, 기존엔 없었음)

### 검증 결과
- tsc --noEmit / oxlint / vite build 통과
- tsx로 `suggestClosingDay` 직접 검증: 25→14, 5→25(순환), 11→31(경계), 1→21, 31→20
- wrangler pages dev --local + curl: 카드 등록 정상 케이스 200, closing_day=35(범위초과) POST 400, billing_day=0 PATCH 400, 정상 PATCH 200 확인
- Chrome 확장 미연결로 결제일 입력 시 마감일이 실시간으로 채워지는 화면 동작, 수정 모드 진입 시 기존값 유지 여부는 육안 확인 못함 (코드 리뷰로만 확인: onChange 핸들러 분리 구조상 startEdit의 setForm은 별도 경로라 자동 제안 로직을 타지 않음)

### 변경 파일
- `src/lib/cardDateUtils.ts` (신규)
- `src/components/CardManager.tsx`
- `functions/api/cards/index.ts`, `functions/api/cards/[id].ts`

---

## 2026-07-15 (14차) — 로그인 옵션 / 수입·지출정산 분리 / 마감일 로직 수정 / 사이드 메뉴

### 작업 계획
- [x] `src/lib/billing.ts` — 결제일이 마감일보다 빠른 카드(예: 마감 25일·결제 14일)는 결제가 다음 달로 넘어가도록 청구기간 계산 수정. `src/components/CardManager.tsx` 안내 문구도 실제 로직과 일치하도록 수정
- [x] `src/components/MonthlyReport.tsx` — 지출정산/수입정산 탭 분리, 수입 쪽에도 상세 내역 리스트 추가(현재 지출만 있음)
- [x] 로그인 "아이디 저장"(이메일 localStorage 기억) + "자동 로그인"(체크 해제 시 브라우저 종료 시 만료되는 세션 쿠키로 발급) — `functions/lib/auth.ts`, `functions/api/auth/login.ts`, `src/contexts/AuthContext.tsx`, `src/components/AuthPage.tsx`
- [x] 하단 탭 네비게이션 → 사이드 드로어 메뉴로 전환, 헤더에 햄버거 버튼 추가 — `src/App.tsx`

### 마감일/결제일 계산 방식 (사용자 확인 완료)
결제일이 마감일과 같거나 늦으면(예: 마감 14일·결제 25일) 같은 달 안에서 마감→결제.
결제일이 마감일보다 빠르면(예: 마감 25일·결제 14일, 실제 카드사에 흔한 패턴) 마감은 결제월 전월에
끝나 있는 것으로 계산 — `getCardBillingPeriod`에서 `billing_day < closing_day`일 때 마감월을
결제월보다 한 달 앞으로 당김. tsx로 5가지 케이스(동일월/타월/2월 클램핑 양쪽/동일값) 직접 계산해 검증.

### 검증 결과
- tsc --noEmit / oxlint / vite build 통과
- billing.ts: tsx로 케이스별 날짜 계산 직접 검증 (정상 케이스, 역전 케이스, 2월 클램핑 양쪽, 마감=결제 동일값)
- 로그인 옵션: wrangler pages dev --local + curl로 확인 — remember=true는 `Max-Age=2592000`(30일), remember=false는 Max-Age 없는 세션 쿠키로 정상 분기
- Chrome 확장 미연결로 수입/지출 탭 전환, 사이드 메뉴 열고 닫기 등 UI 동작은 육안 확인 못함 (코드 리뷰로만 확인)

### 변경 파일
- `src/lib/billing.ts`, `src/components/CardManager.tsx`
- `src/components/MonthlyReport.tsx`
- `functions/lib/auth.ts`, `functions/api/auth/login.ts`, `src/contexts/AuthContext.tsx`, `src/components/AuthPage.tsx`
- `src/App.tsx`

---

## 2026-07-15 (13차) — 금액 입력창 천단위 콤마 표시

### 완료
- [x] `src/lib/format.ts` — `formatNumberInput(raw)` 추가: 숫자만 남기고 천단위 콤마 포맷
- [x] `src/components/TransactionForm.tsx` — 금액 입력 onChange에 적용
- [x] `src/components/BudgetManager.tsx` — 월 한도 금액 입력 onChange + 수정 시작 시 초기값에도 적용
- [x] `src/components/RecurringManager.tsx` — 금액 입력 onChange + 수정 시작 시 초기값에도 적용
- [x] `src/components/TransactionList.tsx` — 인라인 수정 금액 입력 onChange + 수정 시작 시 초기값에도 적용
- 저장 시 파싱 로직은 기존에 이미 `.replace(/[^0-9]/g, '')`로 콤마를 포함한 비숫자 문자를 제거하고 있어 별도 수정 불필요
- 검색 화면의 금액 범위 필터(`type="number"`)는 네이티브 number input이라 콤마 삽입이 불가능해 대상에서 제외
- tsc --noEmit / oxlint 통과

### 변경 파일
- `src/lib/format.ts`
- `src/components/TransactionForm.tsx`, `src/components/BudgetManager.tsx`, `src/components/RecurringManager.tsx`, `src/components/TransactionList.tsx`

---

## 2026-07-15 (12차) — 거래 입력 금액 필드 텍스트 겹침 수정

### 완료
- [x] `src/components/TransactionForm.tsx` 금액 입력창 — 오른쪽에 절대 위치로 띄운 "원" 접미사 라벨과 입력 텍스트가 겹치던 문제 수정. 다른 금액 입력창(BudgetManager/RecurringManager)은 `pr-8`로 여백을 확보해뒀는데 이 필드만 `px-3`(여백 없음)이라 큰 금액 입력 시 숫자와 "원" 글자가 겹쳤음 → `pr-9`로 여백 추가
- tsc --noEmit / oxlint 통과

### 변경 파일
- `src/components/TransactionForm.tsx`

---

## 2026-07-15 (11차) — budgets NULL UNIQUE 중복 방지

### 작업 계획
- [x] functions/api/budgets/index.ts POST — 애플리케이션 레벨 중복 체크 추가 (케이스 A: 매월반복, B: 특정월)
- [x] functions/api/budgets/[id].ts PATCH — category/year_month 변경·재활성화 시 중복 체크
- [x] src/lib/api.ts — BudgetConflictError 클래스 추가, createBudget/updateBudget 충돌 응답 처리
- [x] src/components/BudgetManager.tsx — id 타입 string으로 수정, 카테고리 "이미 설정됨" 뱃지, 충돌 시 인라인 에러+수정 안내

### 추가로 발견한 문제
- PATCH 허용 필드(`allowed`)에 `category`가 빠져있어 예산 수정 폼에서 카테고리를 바꿔도 실제로는 반영되지 않던 기존 버그 발견 → `functions/api/budgets/[id].ts`에 `category` 추가

### 검증 결과 (wrangler pages dev --local, curl)
- 매월반복(year_month=NULL) 동일 카테고리 재등록 → 409 (기존엔 NULL UNIQUE 미적용으로 중복 행 생성됐음)
- 특정월(year_month=YYYY-MM) 동일 카테고리 재등록 → 409
- 비활성 예산에 동일 카테고리로 재등록 → 새 행 생성 없이 기존 id 재활성화 + 금액 갱신
- PATCH로 카테고리를 이미 활성 상태인 다른 카테고리명으로 변경 → 409, 무관한 카테고리로 변경은 200
- tsc --noEmit / oxlint 통과
- Chrome 확장 미연결로 BudgetManager UI(뱃지·인라인 에러·"기존 항목 수정하러 가기" 버튼)는 코드 리뷰로만 확인, 육안 검증은 못함

### 변경 파일
- `functions/api/budgets/index.ts`, `functions/api/budgets/[id].ts`
- `src/lib/api.ts`, `src/components/BudgetManager.tsx`
- `WORKLOG.md`

### 상태
- 완료

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
