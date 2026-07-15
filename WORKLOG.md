# WORKLOG

## 2026-07-16 — 고정지출 삭제 후 정산이 안 바뀌는 문제 확인 (결론: 정상 동작)

사용자 문의: 고정지출을 삭제해도 월정산 숫자가 안 바뀐다.

### 확인 결과
`functions/api/recurring/[id].ts` DELETE 핸들러가 `recurring_transactions`
규칙만 지우고, 이미 생성된 거래는 `recurring_id`만 빈 값으로 바꿔 일반 거래로
전환할 뿐 삭제하지 않음 — `RecurringManager.tsx`의 삭제 확인창도 원래
"이미 생성된 거래 내역은 유지됩니다"라고 명시하고 있어 의도된 설계. curl로
재현: 삭제 전/후 모두 7월 거래 목록에 15,000원 거래가 그대로 남아있음 확인
(recurring_id만 ''로 바뀜). 그래서 정산 숫자가 그대로인 게 정상.

### 사용자 결론
현행 유지가 맞음 — 규칙을 지우면 이미 만들어진 거래가 일반 거래로 바뀌어서
계속 남고, 원치 않으면 거래 목록에서 직접 삭제하면 되므로 문제없음. 코드
변경 없음, 버그 아님.

---

## 2026-07-15 (24차) — 월정산 카드 지출 집계 기준(출금일/거래일) 선택 옵션 추가 (완료)

사용자 요청: 지금 월정산의 카드 지출은 무조건 "출금일 기준"(카드 마감일 계산해서
실제 청구·출금될 달로 묶음, `getCardBillingPeriod` 사용)으로만 계산되는데,
사람마다 "결제한 순간(거래일) 기준"으로 보고 싶어할 수도 있으니 선택 옵션으로 달라.

### 작업 계획
- [ ] `src/components/MonthlyReport.tsx` — `basis: 'billing' | 'transaction'` 상태
  추가, localStorage(`budget:monthlyBasis`)에 저장해 기기별 선호 유지
  - `billing`(기존 기본값): 카드별로 `getCardBillingPeriod` 계산한 청구기간으로
    개별 조회 (기존 로직 그대로)
  - `transaction`: 이미 조회한 이번 달 전체 거래(`monthlyTx`)에서 카드별로
    그룹화만 해서 사용 — 별도 청구기간 조회 불필요
  - 지출정산 상단에 "출금일 기준 / 거래일 기준" 토글 UI 추가, 카드별 청구
    내역의 기간 라벨도 모드에 따라 다르게 표시("start~end 사용분·결제일" vs
    "이번 달 거래 기준")
- [ ] AnnualReport/예산은 이미 거래일(달력월) 기준만 쓰고 있어 범위에서 제외
  (사용자가 "지출 정산할 때"라고 명시했고, 연정산/예산은 애초에 청구기간
  개념이 없음)
- [x] tsc/oxlint/vite build 전부 통과
- [x] 배포

### 완료
- [x] `src/components/MonthlyReport.tsx` — `DateBasis`(`'billing'|'transaction'`)
  상태를 `localStorage('budget:monthlyBasis')`에 저장. `billing`(기본값, 기존
  동작 그대로): 카드별 `getCardBillingPeriod`로 청구기간을 계산해 개별 조회.
  `transaction`: 별도 조회 없이 이미 가져온 이번 달 전체 거래(`monthlyTx`)를
  `card_id`로 필터링만 해서 카드별 합계를 구성 — 23차에서 이미 `fetchTransactions
  ({month})`이 정확히 달력월 기준으로 거래를 반환함을 실측 확인해뒀으므로
  별도 재검증 없이 이 데이터를 그대로 재사용해도 안전
- [x] 타이틀 옆에 "출금일 기준 / 거래일 기준" 토글 추가, 카드별 청구 내역의
  기간 라벨도 모드별로 다르게 표시("start~end 사용분·결제일" vs "n월 거래 기준")
- [x] 연정산(`AnnualReport.tsx`)·예산(`budget.ts`)은 원래도 거래일(달력월) 기준만
  쓰고 청구기간 개념이 없어 범위에서 제외 — 사용자도 "지출 정산할 때"로 한정함

### 검증 결과
- tsc/oxlint/vite build 통과
- `transaction` 모드의 카드별 합계는 23차에서 이미 curl로 검증된
  `fetchTransactions({month})`(달력월 기준 반환 확인됨) 결과를 그대로
  필터링만 하는 순수 로직이라 추가 실측 없이도 정합성 보장됨
- Chrome 확장 미연결로 토글 클릭 시 실제 화면 전환은 육안 확인 못함 — 코드
  리뷰 + 기존 실측 데이터 재사용 논리로 대체

### 배포
- `npm run deploy` 완료 — https://3276ec87.budget-3wb.pages.dev
- 배포 후 `/api/auth/me` 200 정상 확인

---

## 2026-07-15 (23차) — 기능 간 상호작용 통합 시나리오 검증

사용자 요청: 개별 기능은 이미 검증됐으니 고정지출/할인혜택/예산/엑셀내보내기/
카드마감일/모바일반응형/에러처리가 "서로 얽히는 지점"에서 문제 없는지 5개
시나리오로 교차 검증. wrangler pages dev + curl로 실제 DB에 데이터를 만들어
가며 코드 리뷰와 함께 검증.

### 시나리오별 결과

**시나리오 1 (고정지출+할인+예산 동시)**
- [설계상 애매] 고정지출 자동생성(`functions/lib/recurring.ts`)은 할인 매칭을
  전혀 호출하지 않음 — `INSERT` 문에 `original_amount/discount_amount/benefit_id`
  자체가 빠져 있어 항상 원금 그대로 들어감(실측: 17,000원 그대로, 할인 0).
  버그로 보기 애매한 이유: 자동화 로직에 할인을 걸면 사용자 확인 없이 할인이
  적용되는 셈이라 오히려 예상과 다른 결과가 될 수 있음. **선택지**: (A) 현행 유지
  (원금 그대로, 사용자가 나중에 수동으로 확인/수정) — 안전하지만 매달 실제
  청구액과 어긋남 (B) 자동 매칭 적용 — 정합성은 좋아지지만 월한도 소진을
  고정지출이 먼저 가져가버려 그달 수동 결제 시 혜택이 안 뜨는 부작용 가능
  (C) 생성은 원금으로 하되 화면에 "할인 가능" 배지만 띄우고 클릭 시 적용 —
  중간 지점이지만 구현 복잡도 증가.
  → **사용자 결론(같은 날): (A) 현행 유지로 확정.** 고정지출을 등록할 때 이미
  사용자가 실제로 청구될 금액을 직접 입력하는 것이므로(예: 넷플릭스가 할인
  적용된 가격으로 청구되는 걸 알고 있으면 애초에 그 금액을 입력함), 할인 전
  "원가"라는 개념 자체가 고정지출엔 없음 — 매달 다시 할인을 계산해서 끼워
  맞추는 게 오히려 어색함. 코드 변경 불필요(현재 동작이 이미 정답), 버그 아님
- [정상 동작] `calculateBudgetStatus`는 `transactions.amount`(실결제액) 기준으로
  카테고리+월별 합산 — 자동생성된 고정지출도 정확히 해당 카테고리/월에 반영됨
  (4~7월 각각 spent=17,000 정확히 확인)
- [정상 동작] `billing.ts`의 청구기간 계산이 고정지출 거래도 동일하게 포함 —
  마감14·결제25 카드에서 7/15 거래가 8월 결제분(7/15~8/14)에만 걸리고 7월
  결제분(6/15~7/14)엔 안 걸림을 curl로 실측 확인

**시나리오 2 (예산 초과 + 엑셀 내보내기)**
- [정상 동작] 원금 20,000원짜리 10% 할인(2,000원) 거래를 추가해 문화비
  17,000+18,000=35,000원으로 예산(20,000원) 초과 상태를 만든 후 `/api/export`
  응답 확인 — `amount` 필드 합계가 화면의 `spent` 값과 정확히 일치
  (둘 다 같은 `amount` 컬럼을 쓰기 때문에 구조적으로 어긋날 수 없음)
- [정상 동작] `exportExcel.ts`의 거래내역 시트가 원금액(20,000)/할인액(2,000)/
  실결제액(18,000)을 각각 별도 열로 정확히 분리해 표시함을 확인

**시나리오 3 (카드 삭제 연쇄 영향)**
- [버그, 수정함] `CardManager.tsx`의 삭제 확인 문구가 "거래는 결제방법이
  현금으로 변경됩니다"만 안내하고, 함께 삭제되는 혜택 규칙 개수·결제수단이
  현금으로 바뀌는 고정지출 개수는 전혀 언급하지 않음 — 사용자가 모르는 사이
  혜택 규칙이 통째로 사라질 수 있어 확인 문구에 개수를 추가
- [정상 동작] `card_benefits`는 DB의 `ON DELETE CASCADE`가 D1에서 실제로는
  적용 안 되지만, `functions/api/cards/[id].ts`가 이미 명시적으로 DELETE함을
  재확인 (17차에서 수정된 내용, 여전히 정상)
- [정상 동작] `recurring_transactions.card_id`는 애초에 FK 제약 자체가 없고
  (사용자가 예상한 `ON DELETE SET NULL`은 존재하지 않음), 카드 삭제 API가
  `payment_method='현금', card_id=''`로 명시적으로 갱신함을 재확인. 삭제 후
  `GET /api/transactions` 재호출(자동생성 트리거)도 에러 없이 정상 동작
  실측 확인 — 죽은 card_id를 참조하는 문제 자체가 없음

**시나리오 4 (월경계 + 청구기간 겹침)**
- [정상 동작] 마감일 28일 카드로 3/1 거래를 tsx로 직접 계산 — 2월 청구기간
  (2025-12-29~2026-01-28)에도, 이미 끝난 3월 결제분(2026-01-29~02-28)에도
  안 걸리고 4월 결제분(2026-03-01~03-28)에만 정확히 걸림. 경계 중복/누락 없음
- [설계상 애매] `benefitMatcher.ts`의 월 한도(`monthly_cap`)는 카드 청구월이
  아니라 **거래 날짜의 달력월** 기준(`TransactionForm.tsx`가 `date.slice(0,7)`을
  그대로 넘김). 카드 청구기간과 달력월이 어긋나는 카드(마감일이 월말 근처가
  아닌 경우 흔함)에서는 "이번 달 한도"라는 표현과 실제 리셋 시점이 다르게
  느껴질 수 있음. **선택지**: (A) 현행 유지(달력월) — 사용자가 이해하기 쉽고
  구현 단순, 대부분의 실제 카드사 혜택도 달력월 기준인 경우가 많음 (B) 카드
  청구월 기준으로 변경 — 실제 카드사 정책과 더 일치할 수 있으나 카드마다
  청구주기가 달라 UI 문구("이번 달 한도")도 카드별로 다시 설명해야 하고 구현
  복잡도 상승.
  → **사용자 결론(같은 날): (A) 현행 유지로 확정.** 카드 혜택은 결제(구매)하는
  순간 적용되는 것이지 대금이 카드사에 청구·출금되는 시점과는 무관 — 그러니
  기준은 "거래가 실제 발생한 날짜(결제한 날)"가 맞고, 청구월(출금월) 기준으로
  바꾸면 오히려 틀림. 코드 변경 불필요(현재 동작이 이미 정답), 버그 아님

**시나리오 5 (밀린 고정지출 소급 생성)**
- [정상 동작] `start_date`를 3개월 전으로 등록 후 자동생성 트리거 — 4월/5월/
  6월/7월 15일에 각각 정확한 날짜로 4건 생성됨(전부 오늘 날짜로 잘못 들어가는
  문제 없음), `last_generated_date` 갱신도 정상
- [정상 동작] 4개월 각각의 예산 현황 조회 — 각 월이 자기 월의 지출만 반영
  (월별 spent=17,000, 누적/중복 없음)

### 요약
- 버그 1건 발견 → 수정 완료 (카드 삭제 확인 문구에 영향 범위 추가)
- 설계상 애매한 부분 2건 → 둘 다 같은 날 사용자가 (A) 현행 유지로 확정 지음
  (고정지출 자동할인 미반영은 의도된 동작, 혜택 월한도는 거래일 기준이 맞음)
  → 결과적으로 코드 변경 없이 전부 "정상 동작"으로 정리됨
- 나머지 전부 정상 동작 확인

### 수정 내용
- `src/App.tsx` — `CardManager`에 `recurringItems` prop 전달 추가
- `src/components/CardManager.tsx` — `handleDelete`가 삭제 전 `fetchBenefits(id)`로
  연결된 혜택 규칙 개수를 조회하고, prop으로 받은 `recurringItems`에서 해당
  카드로 등록된 고정지출 개수를 계산해 확인 문구에 동적으로 포함 (개수가
  0이면 해당 줄 생략)

### 검증 결과
- tsc/oxlint/vite build 전부 통과
- wrangler pages dev + curl로 5개 시나리오 전부 실제 데이터 생성해 검증
  (카드+혜택+고정지출(3개월 소급)+예산 등록 → 자동생성 트리거 → 각 월별
  예산/청구기간 조회 → 할인 거래 추가 → export 데이터 대조 → 카드 삭제 →
  재생성 무오류 확인 → tsx로 월경계 청구기간 직접 계산 검증)
- Chrome 확장 미연결로 삭제 확인 문구가 실제 화면에 어떻게 뜨는지는 육안
  확인 못함 — 코드 리뷰로만 확인

### 배포
- `npm run deploy` 완료 — https://a377c13e.budget-3wb.pages.dev
- 배포 후 `/api/auth/me` 200 정상 확인

## 2026-07-15 (22차) — 메모장 하루 여러 건 허용으로 수정 (완료)

21차에서 "하루 1건, 내용만 이어 씀"으로 판단했었는데, 사용자가 "하루에 여러건도
가능이 맞아"로 확인 — 스키마/API/화면을 하루 여러 건 구조로 재작업.

### 작업 계획
- [ ] `migrations/009_notes_allow_multiple_per_day.sql`(신규) — `notes` 테이블의
  `UNIQUE(user_id, date)` 제거 (SQLite는 제약 직접 DROP이 안 돼 테이블 재생성
  방식 사용: rename → 새 테이블 생성 → 데이터 복사 → old 테이블 삭제), 로컬+원격 적용
- [ ] `schema.sql` 동기화 (UNIQUE 제거)
- [ ] `functions/api/notes/index.ts` POST — 날짜별 upsert 로직 제거, 항상 새 행 생성
- [ ] `src/components/NotesView.tsx` — 날짜별로 여러 메모를 리스트로 표시,
  각 항목 개별 수정/삭제, 날짜당 "메모 추가" 버튼으로 새 항목 계속 추가 가능하게 재작성
- [ ] tsc/oxlint/build 통과, curl로 같은 날짜 여러 건 생성/개별 수정삭제 검증
- [x] 원격 D1 마이그레이션 적용 + 배포

### 완료
- [x] `migrations/009_notes_allow_multiple_per_day.sql`(신규) — SQLite는 제약을
  직접 DROP 못해 `ALTER TABLE RENAME` → 새 테이블 생성(제약 없이) → 데이터 복사
  → old 테이블 삭제 방식으로 `UNIQUE(user_id, date)` 제거. 로컬+원격 D1 적용 완료
  (원격 적용 시 기존 21차 테스트 데이터 22행 정상 이관 확인)
- [x] `schema.sql` 동기화 (UNIQUE 제거, 001~009 반영)
- [x] `functions/api/notes/index.ts` — POST에서 날짜별 upsert 로직 제거, 항상
  새 행 INSERT. GET 정렬에 `created_at ASC` 보조 정렬 추가(같은 날짜 여러 건일
  때 입력 순서 유지)
- [x] `src/components/NotesView.tsx` — 전면 재작성: 날짜별로 `Note[]` 배열로
  그룹화해 여러 건을 세로로 쌓아 표시, 각 항목 개별 수정(연필)/삭제(휴지통)
  아이콘, 날짜당 "+ 메모 추가" 버튼은 항상 노출되어 몇 건이든 계속 추가 가능.
  `editTarget: {date, note: Note|null}` 상태로 신규 추가/기존 수정 폼 통합 관리
- [x] tsc/oxlint/vite build 전부 통과

### 검증 결과
- curl로 같은 날짜에 메모 2건 생성 → 각각 별도 id로 저장되고 GET 시 둘 다
  조회됨 확인, 한쪽만 PATCH 수정 + 다른 쪽만 DELETE → 서로 영향 없이 개별
  동작함 확인
- Chrome 확장 미연결로 화면상 "+ 메모 추가"로 여러 건 쌓이는 모습은 육안 확인
  못함 — API 레벨 검증으로 대체

### 배포
- 원격 D1에 `migrations/009_notes_allow_multiple_per_day.sql` 적용 완료
- `npm run deploy` 완료 — https://3c4716a6.budget-3wb.pages.dev
- 배포 후 `/api/auth/me` 200 정상 확인

---

## 2026-07-15 (21차) — 사이트명 "텅장" 적용 + 파비콘 신규 제작 + 메모장 기능 추가 (완료)

사용자 요청 3가지:
1. 사이트명을 "텅장"으로 확정, 전체 반영 + 파비콘 신규 제작
2. 금융 기록과 별개로 "그날 있었던 일/누굴 만났는지" 등을 남기는 메모장 신규 기능
   — 달력(월 단위) 스타일, 세로로 일자가 엑셀처럼 나열되고 오른쪽에 내용 표시,
   내용이 길어지면 줄바꿈 가능, 카테고리 태그 지원
3. 질문: 고정지출이 월정산에 합쳐져서 나오는지 → 코드 확인 후 답변 완료
   (`functions/lib/recurring.ts`가 고정지출을 `transactions` 테이블에 실제 행으로
   INSERT하므로 `MonthlyReport.tsx`가 조회하는 일반 거래와 완전히 동일하게 합산됨,
   메모란에 항목명이 자동으로 들어감)

### 메모장 설계 결정 (사용자 확인 없이 합리적으로 판단, 다르면 이후 조정)
- 하루당 메모 1건(카테고리 1개 + 자유 텍스트, 길어지면 textarea가 늘어남) —
  "내용이 추가되면 줄바꿈도 가능하게"라는 표현이 여러 건이 아니라 한 칸에 계속
  이어 쓰는 형태로 해석됨
- DB: `notes` 테이블 신규, `UNIQUE(user_id, date)` — 카테고리는 기존
  `categories.ts` 패턴처럼 기본값 제공 + localStorage 커스텀 추가 가능
- UI: 새 "메모" 탭 추가, 월 선택은 기존 App.tsx의 selectedMonth 재사용, 좌측에
  해당 월 1일~말일 세로 목록(엑셀 행처럼), 우측에 카테고리 뱃지+내용, 클릭하면
  인라인 편집

### 작업 계획
- [ ] 브랜딩: `index.html` title, `public/favicon.svg` 신규 디자인, `App.tsx`/
  `AuthPage.tsx`/`exportExcel.ts`의 "가계부" 텍스트를 "텅장"으로 교체
- [ ] `migrations/008_add_notes.sql`(신규) + `schema.sql` 동기화 — notes 테이블
- [ ] `src/lib/noteCategories.ts`(신규) — categories.ts와 동일 패턴
- [ ] `functions/api/notes/index.ts`(신규) — GET(월별 목록)/POST(날짜별 upsert)
- [ ] `functions/api/notes/[id].ts`(신규) — PATCH/DELETE
- [ ] `src/types.ts` — Note, NewNote 타입 추가
- [ ] `src/lib/api.ts` — fetchNotes/saveNote/deleteNote 추가 (공통 apiRequest 헬퍼 사용)
- [ ] `src/components/NotesView.tsx`(신규) — 월별 세로 목록 + 우측 내용, 카테고리
  뱃지, 인라인 편집, 토스트/스피너 기존 패턴 적용
- [ ] `App.tsx` — "메모" 탭 추가(사이드 메뉴), 아이콘 선정
- [ ] tsc/oxlint/build 통과, wrangler pages dev + curl로 notes CRUD 검증
- [x] 원격 D1 마이그레이션 적용 + 배포(사용자 요청대로 확인 없이 진행)

### 완료
- [x] 브랜딩 — `index.html` title "텅장", `public/favicon.svg` 신규 디자인
  (인디고 브랜드 컬러의 통장/패스북 모양 아이콘), `App.tsx`(헤더+사이드메뉴
  타이틀 2곳)/`AuthPage.tsx`/`exportExcel.ts`(내보내기 파일명 접두어) 전부
  "가계부" → "텅장" 교체. `wrangler.toml`의 프로젝트 기술명(`budget`)과
  배포 도메인(`budget-3wb.pages.dev`)은 변경하지 않음 — 바꾸면 새 Cloudflare
  Pages 프로젝트를 만들거나 대시보드에서 리네임해야 하는 별개의 큰 작업이라
  "사이트명(화면에 보이는 이름)" 적용 범위를 넘어선다고 판단
- [x] `migrations/008_add_notes.sql`(신규) — `notes` 테이블(`UNIQUE(user_id, date)`
  로 하루 1건 강제) + `schema.sql` 동기화(001~008 반영), 로컬+원격 D1 적용 완료
- [x] `src/lib/noteCategories.ts`(신규) — 기본 카테고리(일상/만남/기념일/건강/기타)
  + localStorage 커스텀 추가, 기존 `categories.ts`와 동일 패턴
- [x] `functions/api/notes/index.ts`(신규) — GET(`?month=YYYY-MM`)/POST(날짜별
  upsert, 같은 날짜 재등록 시 새 행 대신 기존 행 갱신)
- [x] `functions/api/notes/[id].ts`(신규) — PATCH(카테고리/내용 부분 수정)/DELETE
- [x] `src/types.ts` — `Note`, `NewNote` 타입 추가
- [x] `src/lib/api.ts` — `fetchNotes`/`saveNote`/`updateNote`/`deleteNote` 추가
  (20차에서 만든 공통 `apiRequest` 헬퍼 그대로 사용 — 에러 처리 패턴 자동 통일)
- [x] `src/components/NotesView.tsx`(신규) — 선택 월의 1일~말일을 전부 세로로
  나열(엑셀 행 스타일), 왼쪽에 날짜+요일, 오른쪽에 카테고리 뱃지+내용
  (`whitespace-pre-wrap`이라 길어지면 자동 줄바꿈). 클릭하면 인라인 편집(카테고리
  칩+textarea), 오늘 날짜는 브랜드 톤으로 하이라이트. 저장/삭제 성공·실패 토스트,
  GET 실패 시 인라인 "다시 시도" — 20차에서 만든 공통 패턴 그대로 적용
- [x] `App.tsx` — "메모" 탭 추가(아이콘 `NotebookPen`), 월 네비게이션 헤더에
  홈/월정산/예산과 동일하게 표시되도록 조건 추가

### 검증 결과
- tsc/oxlint/vite build 전부 통과 (Functions 신규 파일 2개는 별도 tsconfig가
  없어 `tsc --ignoreConfig --lib es2022`로 직접 타입체크, 통과)
- wrangler pages dev + curl로 notes API 전체 시나리오 확인:
  - 빈 월 조회 → `{data: []}`
  - 메모 생성 → id 반환, 같은 월 조회 시 정상 포함
  - **같은 날짜에 재등록 → 새 행이 아니라 기존 id 그대로 반환, 내용만 갱신됨**
    (UNIQUE(user_id, date) + upsert 로직 정상 동작 확인)
  - 내용 빈 문자열로 등록 시도 → 400 "내용을 입력해주세요"
  - PATCH(카테고리만 변경) → 200, 조회 시 반영 확인
  - DELETE → 200, 이후 조회 시 목록에서 사라짐 확인
- Chrome 확장 미연결로 실제 화면(달력 레이아웃/인라인 편집/토스트)은 육안
  확인 못함 — 코드 레벨 + API 레벨 검증으로 대체. 다음 세션에서 확장 연결되면
  재확인 필요

### 배포
- 원격 D1에 `migrations/008_add_notes.sql` 적용 완료
- `npm run deploy` 완료 — https://53a635ff.budget-3wb.pages.dev
- 배포 후 `/api/auth/me` 200, `/api/notes`(미인증) 401 정상 확인

---

## 2026-07-15 (20차) — 에러/로딩 처리 공통 패턴 통일 (완료)

사용자 요청: 여러 기능(고정지출/할인추적/예산/엑셀내보내기)이 순차 추가되며
컴포넌트마다 로딩/에러 처리 방식이 제각각이라 하나의 공통 패턴으로 통일.

### 조사 결과 (기존 상태)
- `src/lib/api.ts` 전체 함수: 실패 시 각자 하드코딩된 한국어 `Error` 메시지를
  던짐, 서버가 내려주는 원본 `{error: "..."}` 메시지는 대부분 버려짐
  (예산 API(`createBudget`/`updateBudget`)만 409 conflict에 한해 서버 메시지 보존)
- `TransactionForm.tsx`, `TransactionList.tsx`, `CardManager.tsx`,
  `RecurringManager.tsx`: 저장/삭제 실패 시 **catch 자체가 없어 조용히 실패**
  (버튼 disabled + "저장 중..." 텍스트만 있고 실패 피드백 없음)
- `BudgetManager.tsx`: 예산 중복 등록(409)은 이미 인라인 에러로 처리됨(11차
  작업에서 완료, alert 아님) — 이 부분은 유지
- `ExportButton.tsx`: 인라인 에러 메시지 + 로딩 텍스트 있음 (양호)
- `SearchView.tsx`: 검색 실패 시 catch 없음 — 조용히 실패, 결과 영역 그대로 빈 채로 남음
- 토스트/공통 스피너 컴포넌트 전혀 없음 (`showToast`, `ToastContext`, `LoadingSpinner` 검색 0건)

### 작업 계획
- [ ] `src/lib/api.ts` — `ApiError` 클래스 + 공통 `apiFetch`/`apiRequest` 헬퍼로
  네트워크 실패("인터넷 연결을 확인해주세요")와 서버 실패(서버 메시지 우선,
  없으면 폴백 메시지)를 구분해 전체 함수에 일괄 적용. `BudgetConflictError`
  409 분기는 유지
- [ ] `src/contexts/ToastContext.tsx`(신규) + `src/components/Toast.tsx`(신규) —
  전역 `showToast(message, 'success'|'error')`, 3초 자동 소멸
- [ ] `src/components/LoadingSpinner.tsx`(신규) — 버튼 내장용 소형 스피너
- [ ] `src/main.tsx` — `ToastProvider`로 감싸기
- [ ] 각 컴포넌트 mutation 호출부(저장/수정/삭제/토글)에 try/catch +
  성공/실패 토스트 + 스피너 일괄 적용: `TransactionForm`, `TransactionList`,
  `CardManager`(카드+혜택 규칙), `RecurringManager`, `BudgetManager`(삭제/토글만,
  등록 폼은 기존 인라인 유지), `ExportButton`
- [ ] GET 조회 실패는 토스트 대신 인라인 "불러오기 실패, 다시 시도" +
  재시도 버튼: `SearchView` 검색 결과, `CardManager` 혜택 목록, `App.tsx` 홈 탭
- [ ] `TransactionList` 삭제 optimistic update — 실패 시 롤백(재조회) 확인/수정

### 검증 결과
- tsc/oxlint/vite build 전부 통과
- wrangler pages dev + curl로 서버 레벨 검증: 거래 금액 음수 POST → 400
  `{error: "금액은 0보다 커야 합니다"}`, 예산 중복 등록 → 409
  `{error: ..., conflictId}` — 둘 다 `ApiError`/`BudgetConflictError`가 그대로
  파싱해 전달함을 확인
- tsx로 `src/lib/api.ts`의 `fetch` 자체를 던지도록 모킹해 네트워크 실패 경로
  직접 검증 → `ApiError('인터넷 연결을 확인해주세요')` 발생 확인
- Chrome 확장이 이번 세션 내내 연결되지 않아 실제 토스트 렌더링(색상/위치/
  자동소멸)과 스피너 애니메이션은 육안으로 확인하지 못함 — 코드 레벨(서버 응답
  파싱, 네트워크 실패 모킹) 검증으로 대체. 다음 세션에서 Chrome 확장 연결되면
  반드시 실제 화면으로 재확인 필요

### 배포
- `npm run deploy` 완료 — https://627bfe95.budget-3wb.pages.dev
- 배포 후 `/api/auth/me` 헬스체크 200 정상 확인

### 완료
- [x] `src/lib/api.ts` — `ApiError` 클래스 + `apiFetch`/`parseErrorMessage`/
  `apiRequest` 공통 헬퍼로 전체 함수 재작성. 네트워크 실패는
  "인터넷 연결을 확인해주세요", 서버 실패는 서버가 준 `{error}` 메시지 우선
  사용(없으면 폴백). `BudgetConflictError`(409) 분기는 유지. `matchBenefit`은
  거래 입력 중 실시간 보조 기능이라 의도적으로 조용히 빈 배열 반환 유지
- [x] `src/contexts/ToastContext.tsx`(신규), `src/components/Toast.tsx`(신규) —
  전역 `showToast(message, 'success'|'error')`, 3초 자동 소멸, `src/main.tsx`에
  `ToastProvider`+`<Toast />` 연결
- [x] `src/components/LoadingSpinner.tsx`(신규) — lucide `Loader2` 기반 소형 스피너
- [x] `TransactionForm.tsx` — 저장 성공/실패 토스트, 제출 버튼 스피너+"처리 중..."
- [x] `TransactionList.tsx` — 인라인 수정 저장/삭제 성공·실패 토스트, 삭제 버튼별
  개별 로딩 상태. `App.tsx`의 `handleDelete`에 낙관적 업데이트 롤백 추가(실패 시
  삭제 전 목록으로 복원 후 에러를 다시 던져 `TransactionList`가 토스트 표시)
- [x] `CardManager.tsx` — 카드 저장/삭제, 혜택 규칙 저장/삭제 전부 토스트+개별
  로딩 스피너. 혜택 목록 GET 실패는 토스트 대신 인라인 "다시 시도" 버튼으로 변경
- [x] `RecurringManager.tsx` — 저장/토글/삭제 토스트+개별 로딩 스피너
- [x] `BudgetManager.tsx` — 예산 중복(409)은 기존대로 alert 없이 인라인 에러 +
  "기존 항목 수정하러 가기" 유지(요청대로), 저장 성공 토스트 추가, 삭제/토글은
  토스트+개별 로딩 스피너 신규 추가
- [x] `ExportButton.tsx` — 기존 인라인 에러 유지, 다운로드 성공 시 토스트 추가
- [x] `SearchView.tsx` — 검색 실패 시(기존엔 조용히 무시됨) 인라인 에러+"다시 시도"
  버튼 신규 추가, 검색 버튼에 스피너 적용
- [x] `App.tsx` — 홈 탭 거래/예산 로딩 실패 시 인라인 에러+재시도 버튼으로 변경
  (기존엔 고정 문구만 표시), 카드/고정지출 배경 로딩 실패는 토스트로 알림(기존엔
  완전히 조용히 무시됨)

---

## 2026-07-15 (19차) — UI/UX 디자인 시스템 정비 (완료)

사용자 피드백: "기능적인 부분은 잘 해결됐는데 UI/UX 디자인이 조금 부족한 느낌". 코드 리뷰로 확인한 현재 상태: 배경(neutral-50)+흰 카드+검정 텍스트 외 포인트 컬러 전무, `border-2 neutral-200` 두꺼운 테두리 반복, 탭/버튼 아이콘이 전부 이모지(OS별 렌더링 불일치), hover/active 트랜지션 거의 없음, 폰트 굵기만으로 위계 표현.

### 방향 (사용자 확인 완료)
- 범위: 전체 디자인 시스템 정비 (공통 토큰 먼저 정의 후 전 화면 일괄 적용)
- 포인트 컬러: 차분한 단색(인디고 계열) — 수입(파랑)/지출(빨강) 의미색과 안 겹치게
- 아이콘: 이모지 → lucide-react SVG 아이콘 세트로 교체

### 작업 계획
- [ ] `src/index.css` — `--color-brand-*` 토큰 정의 (완료), focus-visible 컬러 브랜드로 통일
- [ ] `npm install lucide-react` (완료)
- [ ] `src/App.tsx` — 헤더/사이드 드로어 아이콘 교체, 활성 탭/버튼 브랜드 컬러 적용, 테두리/트랜지션 정리
- [ ] `src/components/SummaryCard.tsx`, `CategoryBreakdown.tsx`, `TransactionForm.tsx`, `TransactionList.tsx` — 홈 화면 우선 정비
- [ ] `src/components/CardManager.tsx`, `RecurringManager.tsx`, `BudgetManager.tsx`, `MonthlyReport.tsx`, `AnnualReport.tsx`, `SearchView.tsx`, `AuthPage.tsx`, `ExportButton.tsx` — 나머지 화면에 동일 토큰/아이콘/버튼 스타일 일괄 적용
- [ ] tsc/oxlint/build 검증
- [ ] Chrome 확장 미연결 상태라 육안 검증 불가 — 코드 리뷰 + 빌드 통과로만 확인 예정임을 사용자에게 고지

### 완료
- [x] `src/index.css` — `--color-brand-*`(인디고 계열) 토큰 정의, focus-visible 컬러 브랜드로 통일
- [x] `npm install lucide-react`
- [x] `src/App.tsx` — 탭/햄버거/닫기/로그아웃 아이콘 lucide로 교체, 활성 탭·"오늘" 버튼·예산초과 배너 브랜드 컬러/아이콘 적용, 헤더 `border-2`→`border`+`shadow-sm`, 모든 버튼에 `transition-colors`+hover 상태 추가
- [x] `src/components/SummaryCard.tsx` — 잔액 박스 neutral→brand 톤
- [x] `src/components/CategoryBreakdown.tsx` — 탭/막대 트랜지션 추가, 테두리 정리
- [x] `src/components/TransactionForm.tsx` — 포커스 컬러 blue→brand, 결제방법/분류 칩 선택색 brand, 예산 경고 이모지→lucide 아이콘, 제출 버튼 brand
- [x] `src/components/TransactionList.tsx` — 입력창 포커스 brand, 분류 칩 brand, 행 hover, 삭제 버튼 hover 시 red 강조
- [x] `src/components/CardManager.tsx` — 기존 indigo 하드코딩을 brand 토큰으로 통일, 모든 버튼 hover/transition 추가, 테두리 정리
- [x] `src/components/RecurringManager.tsx`, `BudgetManager.tsx` — 동일 패턴 적용, 이모지(💰⚠)를 lucide 아이콘으로 교체
- [x] `src/components/MonthlyReport.tsx` — 카드별 청구 내역 펼치기 화살표(▲▼)를 ChevronUp/Down 아이콘으로 교체, 테두리/트랜지션 정리
- [x] `src/components/AnnualReport.tsx` — 연 잔액 박스 brand 톤, 표 행 hover, 막대 그래프 트랜지션
- [x] `src/components/SearchView.tsx` — 필터 아이콘(⚙→SlidersHorizontal), 칩/버튼 brand 컬러, 결과 행 hover
- [x] `src/components/ExportButton.tsx` — 아이콘(📥→Download, ⏳→Loader2 스핀), 버튼 brand 컬러
- [x] `src/components/AuthPage.tsx` — 로그인 첫 화면 타이틀/탭/버튼 brand 톤, 체크박스 accent 컬러
- [x] tsc --noEmit / oxlint / vite build 전부 통과

### 검증 관련 특이사항
Chrome 확장이 이번 세션 내내 연결되지 않아(`tabs_context_mcp` 반복 실패) 육안 스크린샷 검증을 하지 못함. wrangler pages dev + vite 로컬 서버는 정상 기동 확인(`http://localhost:8788` 200 응답)했으나 브라우저로 실제 렌더링을 보지는 못했음 — 코드 리뷰 + 타입체크/린트/빌드 통과로만 확인. 다음 세션에서 Chrome 확장이 연결되면 반드시 실제 화면으로 배색/hover/레이아웃 재확인 필요.

### 배포
- `npm run deploy` 완료 — https://c45e9d9a.budget-3wb.pages.dev
- 배포 후 `/api/auth/me` 헬스체크 200 정상 확인
- Chrome 확장 미연결로 육안 검증은 여전히 못한 채 사용자 요청으로 배포함 (다음 세션에서 재확인 필요)

### 변경 파일
- `src/index.css`, `package.json`, `package-lock.json`
- `src/App.tsx`
- `src/components/SummaryCard.tsx`, `CategoryBreakdown.tsx`, `TransactionForm.tsx`, `TransactionList.tsx`
- `src/components/CardManager.tsx`, `RecurringManager.tsx`, `BudgetManager.tsx`
- `src/components/MonthlyReport.tsx`, `AnnualReport.tsx`, `SearchView.tsx`, `ExportButton.tsx`, `AuthPage.tsx`

---

## 2026-07-15 (18차) — 모바일 레이아웃 전체 점검 (375/390/414px)

Chrome 창 크기 조절이 이 환경에서 실제 뷰포트에 반영되지 않아(가상 디스플레이 고정폭), `about:blank`에 정확한 폭의 `<iframe>`을 띄우는 방식으로 375/390/414px를 정밀 재현해 점검. 큰 금액·긴 카드명·긴 혜택명 등 스트레스 테스트 데이터를 실제로 넣고 확인.

### 발견 및 수정한 문제
- [x] **[App.tsx]** 헤더 — 이전 달로 이동해 "오늘" 버튼이 뜨면 375px에서 헤더가 넘쳐 "로그아웃" 버튼이 화면 밖으로 밀리고 가로 스크롤 발생. → 로그아웃 버튼을 `sm:` 미만에서 숨기고, 이미 있는 사이드 드로어 하단으로 이동(`hidden sm:inline-flex` + 드로어에 로그아웃 항목 추가)
- [x] **[SummaryCard.tsx, MonthlyReport.tsx]** 수입/지출(잔액 요약) 2열 그리드 — 큰 금액이 "4,850,000" / "원"처럼 숫자 뒤 단위만 다음 줄로 떨어짐 → `grid-cols-1 sm:grid-cols-2`로 모바일에서 세로로 쌓음
- [x] **[AnnualReport.tsx]** 연수입/연지출/연잔액 3열 그리드 — 동일 문제 → `grid-cols-1 sm:grid-cols-3`. 월별 숫자 표는 "1월"조차 "1"/"월"로 쪼개질 정도로 셀이 눌림 → `overflow-x-auto` 래퍼 추가해 표 자체가 가로 스크롤되게 하고 각 셀에 `whitespace-nowrap` 추가
- [x] **[CardManager.tsx]** 카드 목록의 "혜택/수정/삭제" 버튼이 CJK 텍스트 특성상(공백 없어도 글자 단위로 줄바꿈 가능) "혜/택"처럼 쪼개지는 버그 발견 → `whitespace-nowrap` 추가만으로는 카드명이 "테스..."로 과도하게 truncate되는 부작용이 있어, 모바일에서는 이름 줄과 버튼 줄을 분리(`flex-col gap-3 sm:flex-row`)하는 구조로 재수정. 혜택 규칙 목록의 수정/삭제 버튼도 동일하게 `whitespace-nowrap` 보강
- [x] **[MonthlyReport.tsx]** 카드별 청구 내역 헤더 — `min-w-0`/`shrink-0` 누락으로 긴 청구기간 문구에 밀려 "0원"조차 글자 단위로 쪼개짐 → 좌측 이름 블록에 `min-w-0`+`truncate`, 우측 금액 블록에 `shrink-0`+`whitespace-nowrap` 추가. 같은 위험이 있던 현금수입/카드입금/청구세부내역/현금지출 리스트 4곳도 동일하게 예방 수정
- [x] **[TransactionList.tsx]** 수정/삭제 버튼 CJK 줄바꿈 방지(`whitespace-nowrap`), 거래명에 `truncate` 추가(원래 `min-w-0`만 있고 truncate가 없어 긴 이름이 좁은 공간에서 줄바꿈되던 걸 방지)
- [x] **[BudgetManager.tsx, RecurringManager.tsx]** 비활성화/활성화/수정/삭제 버튼에 `whitespace-nowrap` 예방적 추가 (이미 `min-w-0`+`shrink-0` 구조가 있어 실제 깨짐은 없었지만 안전장치로 보강)
- [x] **[TransactionForm.tsx]** 혜택 자동 적용 안내 박스에 `min-w-0` 추가 (긴 혜택 이름 대응, 예방적)
- [x] **[AuthPage.tsx]** "아이디 저장"/"자동 로그인" 체크박스 터치 영역이 16px로 44px 권장 기준에 크게 못 미침 → 라벨 전체를 `min-h-11` 터치 영역으로 확장

### 문제없이 확인된 컴포넌트
CategoryBreakdown, ExportButton(기간 선택 모달), SearchView(필터 패널 + 검색 결과), AuthPage 폼 구조, 카드/예산/혜택 등록 폼들의 grid-cols-2 필드(라벨 텍스트라 짧아서 문제 없음)

### 의도적으로 손대지 않은 것
앱 전반의 수정/삭제/토글 등 보조 버튼 다수가 32~40px(min-h-7~10)로 44px 권장에 못 미치지만, 이는 앱 전체에 걸친 기존 디자인 언어라 이번 "레이아웃 깨짐 점검·수정" 범위를 넘어서는 대규모 리디자인이 필요해 손대지 않음. 명백히 너무 작았던 체크박스만 개선

### 검증 결과
- tsc --noEmit / oxlint 통과
- wrangler pages dev + Chrome 확장(about:blank에 정확한 폭의 iframe 삽입)으로 375/390/414px 3개 너비 전부 실측: 모든 탭에서 body-level 가로 오버플로우 0 확인(자동 스캔), 위 발견 항목은 수정 전/후 스크린샷으로 직접 대조
- 큰 금액(4,850,000원), 긴 카드명 아님이지만 긴 혜택명("스타벅스 및 카페 전용 15% 특별 할인 혜택"), 긴 고정지출명("넷플릭스 프리미엄 정기구독료"), 긴 구매처명("백화점 명품관 정기 세일 구매") 등 실제 스트레스 데이터로 검증

### 변경 파일
- `src/App.tsx`, `src/components/SummaryCard.tsx`, `src/components/MonthlyReport.tsx`, `src/components/AnnualReport.tsx`
- `src/components/CardManager.tsx`, `src/components/TransactionList.tsx`, `src/components/BudgetManager.tsx`, `src/components/RecurringManager.tsx`
- `src/components/TransactionForm.tsx`, `src/components/AuthPage.tsx`

---

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

### 배포
- 원격 D1에 `migrations/007_add_password_iterations.sql` 적용 완료 (기존 운영 계정 2개 확인, 전부 iterations=10000으로 보존되어 다음 로그인 때 정상 검증 후 자동 재해싱됨)
- `npm run deploy` 완료 — https://dedf628f.budget-3wb.pages.dev
- 배포 후 `/api/auth/me` 헬스체크 200 정상 확인

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
