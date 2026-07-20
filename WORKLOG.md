# WORKLOG

## 2026-07-20 (74차) — 수익 계산기 내역을 목록 대신 월정산과 같은 일별 표로 변경

사용자 요청(73차 결과물에 대한 수정 지시): "월정산 처럼 표로 나와야되는데
일별로 저 항목들이 매일 등록될거라". 73차에서 만든 개별 거래 카드 목록
대신, 매일 반복 등록되는 항목의 특성상 `MonthlySettlementTable`처럼
날짜를 행으로, 분류를 열로 하는 표 형태가 더 적합하다는 지시.

### 설계
- `IncomeCalculator`가 이미 `fetchMonthlySettlement(month)`로 받아오는
  `settlement.days`(일별 분류별 합계)를 그대로 재사용 — 73차에서 추가한
  `fetchTransactions({ month })` 개별 거래 조회는 더 이상 필요 없어 제거
- `MonthlySettlementTable.tsx`와 같은 표 구조(날짜 열 + 분류별 열 + 합계
  열, 마지막에 월계 행, `filterSelectedCategories`로 선택된 분류만
  표시)를 그대로 가져오되, 수입만 다루므로 지출 열은 없음
- 표 형태로 바뀌면서 일별 합계만 보이고 개별 거래를 그 자리에서
  수정/삭제할 수는 없게 됨(하루에 같은 분류로 여러 건이면 합산된 값만
  표시) — 개별 거래 수정은 기존처럼 홈/정산 탭에서 가능하므로 범위 밖으로
  판단. 이에 따라 73차에서 추가했던 `cards`/`onDuplicate` props와
  삭제/수정 핸들러, `TransactionList` 사용은 모두 제거

### 계획
- `src/components/IncomeCalculator.tsx` — `fetchTransactions`/`TransactionList`/
  `cards`/`onDuplicate`/삭제·수정 핸들러 제거, `settlement.days` 기반
  일별 표 렌더링 추가(선택된 수입 분류만 열로 표시 + 합계 열 + 월계 행)
- `src/App.tsx` — `<IncomeCalculator>`에서 더 이상 필요 없는 `cards`/
  `onDuplicate` props 제거
- `wrangler pages dev` + Playwright로 표 렌더링, 선택 분류 변경 시 열
  갱신, 일별/월계 합계 정확성 검증

## 2026-07-20 (73차) — 수익 계산기에 선택 분류의 거래 내역 목록 추가

사용자 요청: "계산기 탭에 각항목선택을 하잖아 그럼 그 내역도 밑에 월
정산에서 나오듯이 내역이 나와야된다 만들어줘". 지금은 선택된 분류의
카테고리별 합계만 보이는데, 그 합계를 구성하는 실제 개별 거래 내역도
목록으로 보고 싶다는 요청.

### 설계
- 계산기가 이미 쓰고 있는 `/api/settlement/monthly`는 카테고리별
  합계만 주고 개별 거래는 안 줌 — 개별 거래는 기존 `fetchTransactions({
  month })`로 따로 조회해서, 그중 `type === 'income'`이고 선택된
  분류에 속하는 것만 필터링해서 보여줌
- 목록 컴포넌트는 새로 만들지 않고 홈/비정산 탭에서 이미 쓰는
  `TransactionList`를 재사용 — 탭/수정/삭제/복제가 이미 다 구현돼
  있어 일관된 경험 제공. 삭제·수정 후에는 합계와 목록 둘 다 다시
  불러와야 하므로 UnsettledView와 동일하게 자체 로드/삭제/수정 상태를 둠
- 복제는 App.tsx의 기존 `handleDuplicate`(홈 탭으로 이동 + 폼 프리필)를
  그대로 props로 받아 재사용(UnsettledView와 동일 패턴)

### 계획
- `src/components/IncomeCalculator.tsx` — `cards`, `onDuplicate` props
  추가, 월 거래 목록 조회 + 선택된 수입 분류로 필터링해 합계 카드
  아래에 `TransactionList` 렌더링, 자체 삭제/수정 핸들러(재조회 포함)
- `src/App.tsx` — `<IncomeCalculator>`에 `cards`, `onDuplicate={handleDuplicate}` 전달
- `wrangler pages dev` + Playwright로 선택 시 내역 표시, 선택 해제 시
  목록도 같이 사라지는지, 삭제/수정 후 합계·목록 동기화 검증

### 완료
- [x] `src/components/IncomeCalculator.tsx` — `cards`, `onDuplicate` props
  추가, `fetchTransactions({ month })`로 월 거래를 따로 조회해 선택된
  수입 분류로 필터링, 선택이 1개 이상일 때만 "선택 분류 내역" 섹션에
  `TransactionList` 렌더링(없으면 안내 문구). 삭제/수정 후 `load()`로
  합계·목록 동시 재조회
- [x] `src/App.tsx` — `<IncomeCalculator>`에 `cards`, `onDuplicate={handleDuplicate}` 전달
- [x] **버그 발견 및 수정(2건)**:
  1. 테스트 중 발견 — `TransactionForm`의 분류 칩은 67차에서 드래그 지원을
     위해 Pointer Events 기반으로 바뀌어 순수 DOM `.click()`으로는 선택이
     안 되는데, 검증 스크립트가 이 방식을 써서 처음엔 거래가 엉뚱한
     분류로 저장되는 것처럼 보였음 — 앱 버그 아님, Playwright 마우스
     클릭(좌표 기반)으로 스크립트를 고쳐서 해결
  2. **실제 앱 버그**: `TransactionList`가 삭제 버튼 클릭 시 이미 자체
     확인 모달(`confirm('이 내역을 삭제할까요?')`)을 띄운 뒤 `onDelete`를
     호출하는데, `IncomeCalculator`(신규)와 `UnsettledView`(기존, 73차
     이전부터 있던 버그)의 `handleDelete`가 그 안에서 또 `confirm()`을
     불러 확인을 두 번 눌러야만 실제로 삭제되는 문제 발견 — 같은 문구의
     모달이 다시 뜨는 것처럼 보여 "삭제가 안 된다"는 착각을 일으킴.
     두 파일 모두 중복 `confirm()` 호출 제거로 수정(비정산 탭도 이번에
     같이 고쳐짐)
- [x] `wrangler pages dev` + Playwright로 검증: 미선택 시 내역 섹션 없음,
  분류 선택 시 해당 분류만 내역에 노출(다른 분류 제외), 복수 선택 시
  합계·내역 둘 다 정확히 합산, 삭제 시 확인 모달 한 번으로 정상 삭제되고
  합계·내역 동시 갱신, 선택 전부 해제 시 내역 섹션 사라짐, 비정산 탭
  삭제도 회귀 없이 정상 동작. `tsc -b`/`oxlint`/`npm run build` 모두 통과

## 2026-07-20 (72차) — 카드 "매달 1일~말일 마감·말일 결제" 토글 추가

사용자 요청: "카드탭에서 카드의 결제 마감을 1일부터 자동으로 해당달의
말일로 정하고 결제일도 말일로 하는 기능이 추가되어야할거같다 이거는
토글식으로 따로 만들어줘". 일부 카드(특히 법인카드 등)는 "당월 1일~말일
사용분을 그 달 말일에 결제"하는 방식이라, 매번 결제일/마감일을 숫자로
입력하지 않고 토글 하나로 이 패턴을 바로 적용하고 싶다는 요청.

### 설계
- 스키마 변경 불필요 — `getCardBillingPeriod`(`src/lib/billing.ts`)가
  이미 `closing_day`/`billing_day`를 해당 월 일수로 클램핑하는 로직을
  갖고 있어서, **`billing_day=31`, `closing_day=31`로 저장하면 어떤
  달이든 자동으로 "말일"로 클램핑**됨(2월엔 28일, 30일짜리 달엔 30일
  등). 즉 "말일 모드"는 새 필드 없이 두 값을 31로 저장하는 것만으로
  이미 표현 가능 — 토글은 이 값을 자동으로 넣어주는 UI 편의 기능
- **버그 발견 및 수정**: `getCardBillingPeriod`의 시작일 계산이
  `closing_day + 1`을 전월 일수로 클램핑하지 않고 그대로 날짜 오버플로에
  맡기고 있어서, `closing_day=31`이고 전월이 31일보다 짧은 달(4·6·9·11월,
  2월)이면 시작일이 "1일"이 아니라 "2~3일"로 밀리는 오류가 있었음(예:
  마감월이 7월이면 전월인 6월은 30일까지라 `6월 32일` → 정규화 시
  `7월 2일`이 돼버림, `7월 1일`이어야 하는데). 프리뷰 UI는 이미 이걸
  알고 항상 31일까지 있는 앵커 월(`2024-01`)로 미리보기를 계산해
  우회하고 있었지만, 실제 청구 기간 조회(월 예산·정산 등에 쓰이는
  진짜 계산)는 이 우회가 없어 실사용 시 그대로 노출되는 버그였음 →
  전월 일수로 먼저 클램핑한 뒤 +1일 하도록 수정
- 토글 상태는 별도 필드로 저장하지 않고 `billing_day === 31 &&
  closing_day === 31`인지로 판단(파생 상태) — 토글 ON 시 두 입력을
  31로 채우고 비활성화, OFF 시 토글 켜기 직전의 수동 입력값으로 복원
- 카드 목록/미리보기 문구에서도 이 모드일 땐 "31일" 대신 "말일"로 표시
  (2월에 "31일"이라고 나오면 혼란스러움)

### 계획
- `src/lib/billing.ts` — 시작일 계산을 전월 일수 클램핑 후 +1일 방식으로 수정
- `src/components/CardManager.tsx` — 결제일/마감일 입력 옆에 "매달 1일~말일
  사용분을 말일에 결제" 토글 추가, ON 시 두 입력을 31로 고정하고
  비활성화, OFF 시 이전 수동 입력값 복원. 미리보기 문구·카드 목록 표시
  둘 다 이 모드일 때 "말일"로 표기
- `wrangler pages dev` + Playwright로 토글 On/Off, 여러 달(30일/31일/2월)
  에 걸친 청구 기간 계산 정확성, 기존 수동 입력 카드에는 영향 없는지 검증
- 스키마 변경 없어 D1 마이그레이션 불필요

### 완료
- [x] `src/lib/billing.ts` — 시작일 계산을 `Math.min(closing_day, 전월
  일수) + 1`로 수정해 전월이 31일보다 짧을 때 시작일이 밀리던 버그 해결
- [x] `src/components/CardManager.tsx` — 결제일/마감일 입력 위에 "매달
  1일~말일 마감·말일 결제" 스위치 토글 추가. ON 시 두 입력을 31로 채워
  비활성화(값 표시는 "말일"), OFF 시 토글 켜기 직전의 수동 입력값으로
  복원(`lastManualDays` 상태). 새 카드 등록/기존 카드 수정 진입 시에도
  현재 값이 31/31이면 토글이 자동으로 ON 상태로 보임. 미리보기 문구와
  카드 목록 모두 이 모드일 땐 "31일" 대신 "말일"로 표기
- [x] Node 스크립트로 수정된 `getCardBillingPeriod` 로직을 1~12월 전부
  돌려 "말일 모드"에서 항상 시작일=1일, 종료일=결제일=그 달 실제 말일이
  되는지 확인(전월이 30일/31일/28일인 경우 전부 포함) + 기존 정상
  케이스(마감14일·결제25일)도 회귀 없는지 함께 확인, 전부 통과
- [x] `wrangler pages dev` + Playwright로 검증: 토글 ON 시 두 입력
  비활성화+"말일" 표시, 미리보기 문구 정상 표시, 저장 후 카드 목록에
  "매달 1일~말일 마감 · 말일 결제" 표시, 수정 화면 재진입 시 토글 ON
  유지, 토글 OFF 시 기본 제안값(25/14)으로 복원. `tsc -b`/`oxlint`/
  `npm run build` 모두 통과. 스키마 변경 없어 D1 마이그레이션 불필요

## 2026-07-20 (71차) — 수익 계산기를 수입 분류 전용 + 단순 합산으로 변경

70차에서 만든 계산기에 대한 사용자의 즉각적인 수정 지시: "이건 수입에서만
칩을 가져와야해 음수값이 들어가게 해서 지출탭 정보는 필요가 없어 그러니까
선택한 모든값을 더하면 되는거야". 지출 분류 칩과 +/- 부호 선택 자체가
불필요 — 차감할 항목(식대/담배/LPG 등)은 애초에 수입 등록 시 금액 앞에
'-'를 붙이는 기존 기능(차감 항목 입력)으로 이미 표현 가능하므로, 계산기는
수입 분류만 보여주고 선택된 값을 그냥 더하기만 하면 됨.

### 설계
- `calc_selections` 테이블/API는 스키마 그대로 재사용(마이그레이션 불필요)
  — 프론트에서 항상 `type='income'`만 쓰고 `sign`은 항상 `1`로 고정
- `src/lib/calcSelections.ts`: 3단계(미선택→+1→-1→미선택) `cycleCalcSelection`
  을 2단계(미선택↔선택) `toggleCalcSelection`/`isCalcSelected`로 교체.
  `getCalcSelections()`는 혹시 남아있을 수 있는 지출 선택(구버전 테스트
  데이터 등)을 방어적으로 걸러내도록 `type === 'income'`만 반환
- `src/components/IncomeCalculator.tsx`: 지출 분류 섹션 전체 제거, 칩은
  단일 파란색 선택 상태만 사용, 합계는 선택된 수입 분류 금액을 그대로
  더함(부호 곱셈 없음 — 음수 수입 거래가 있으면 자연히 차감됨)

### 계획
- `src/lib/calcSelections.ts` — `toggleCalcSelection`/`isCalcSelected`로 교체
- `src/components/IncomeCalculator.tsx` — 지출 분류 섹션 제거, 단순 합산으로 변경
- `wrangler pages dev` + Playwright로 지출 섹션 미노출, 음수 수입(차감
  항목) 선택 시 정상 차감, 토글 2단계 동작 검증

### 완료
- [x] `src/lib/calcSelections.ts` — `toggleCalcSelection(category)`/
  `isCalcSelected(category)`로 교체, `getCalcSelections()`가 `type ===
  'income'`만 반환하도록 방어적 필터링
- [x] `src/components/IncomeCalculator.tsx` — 지출 분류 섹션 제거, 칩
  선택 로직을 단일 색상 토글로 단순화, 합계 계산에서 부호 곱셈 제거(선택된
  수입 분류 금액을 그대로 합산)
- [x] `wrangler pages dev` + Playwright로 검증: "지출 분류" 섹션이 더 이상
  렌더링되지 않음, 영업수익(+1,000,000) 수입 등록 + 식대를 "수입" 타입
  차감 항목(-80,000)으로 등록 후 계산기에서 둘 다 선택 시 920,000원으로
  정확히 계산, 다시 탭하면 해제되어 1,000,000원으로 복귀. `tsc -b`/
  `oxlint`/`npm run build` 모두 통과. 스키마 변경 없어 D1 마이그레이션 불필요

## 2026-07-20 (70차) — 개인화 수익 계산기 탭 신설

사용자 요청: "개인화 수익 계산기 탭을 하나 만들어야해 수익이 등록된것중에서
영업수익에서 식대및 담배 LPG를 차감한 금액이 따로 정리되서 보고싶은데
이걸 항목별 선택으로 내가원하는 수익칩만 선택해서 합산결과를 보는 형태로
만들고싶어". 개인택시/자영업 등으로 짐작되는 사용 맥락 — 영업수익(수입)에서
식대/담배/LPG(지출) 같은 특정 항목을 차감한 "순수익"을 자유롭게 조합해서
보고 싶다는 요청.

### 확인한 요구사항(AskUserQuestion)
- 칩 선택 방식: **모든 칩(수입 분류 + 지출 분류 구분 없이 전부)을 개별적으로
  +/- 직접 지정** — 수입은 자동 +, 지출은 자동 - 가 아니라, 사용자가 각
  분류 칩을 탭해서 +(더하기)/-(빼기)/선택안함 3단계를 직접 고름(더 자유로움)
- 집계 기간: **다른 탭(홈/예산/메모/비정산)과 동일하게 월 단위** — App.tsx의
  전역 `selectedMonth` + 상단 ◀▶ 월 이동 재사용
- 선택 상태 저장: **계정에 저장해 기기 간 동기화**(분류/구매처와 동일 원칙)

### 설계
- 월별 분류당 합계는 이미 `/api/settlement/monthly?month=` (`calculateMonthlySettlement`)
  가 `month_total.income`/`month_total.expense`로 카테고리별 합계를
  전부 계산해서 내려주고 있음 — 새 집계 로직 불필요, 프론트에서 이 기존
  API(`fetchMonthlySettlement`)를 그대로 재사용하고 선택된 칩의 부호를
  곱해 합산만 하면 됨
- 새 테이블 `calc_selections` — `(user_id, type, category)`별로 부호(1
  또는 -1)를 저장. 선택 안 한 상태는 행이 아예 없는 것으로 표현(3단계
  중 하나가 "행 없음"과 자연히 대응)
- `functions/api/calc-selections/index.ts` — GET(전체 목록)/POST(upsert
  로 부호 설정)/DELETE(행 삭제 = 선택 해제) — categories류 API보다 단순
  (기본값 개념도, 순서도 없음)
- 프론트 칩은 `getCategories('income')`/`getCategories('expense')`
  전체 분류를 그대로 보여줌(해당 월에 금액이 0이어도 노출 — 선택 상태는
  월과 무관하게 유지되는 게 자연스러움), 탭할 때마다 미선택→+→-→미선택
  순환
- 결과 카드에 선택된 칩별 금액과 부호를 나열한 내역 + 최종 합계를 함께
  표시(사용자가 계산 근거를 바로 확인 가능하게)

### 계획
- `schema.sql`, `migrations/024_add_calc_selections.sql` — `calc_selections`
  테이블 신설
- `functions/api/calc-selections/index.ts` — GET/POST/DELETE
- `src/lib/api.ts` — `CalcSelection` 타입, `fetchCalcSelections`,
  `setCalcSelectionApi`, `removeCalcSelectionApi`
- `src/lib/calcSelections.ts` — load/reset/get/cycleCalcSelection
  (categories.ts류와 동일한 모듈 캐시 패턴)
- `src/contexts/AuthContext.tsx` 로그아웃 시 `resetCalcSelections()`,
  `src/App.tsx` 로그인 시 `loadCalcSelections()`
- `src/App.tsx` — `Tab`에 `'calculator'` 추가, 네비게이션에 계산기 탭
  추가(Calculator 아이콘), 월 네비게이션 표시 탭 목록에도 추가, 활성 탭일
  때 `<IncomeCalculator month={selectedMonth} />` 렌더링
- `src/components/IncomeCalculator.tsx` 신규 — 수입/지출 분류 칩(3단계
  토글) + 선택 내역/합계 카드
- `wrangler pages dev` + Playwright로 칩 토글, 계산 정확성, 월 이동 시
  재계산, 기기 간 선택 동기화 검증
- 검증 후 원격 D1에 마이그레이션 적용, GitHub Actions 배포 확인

### 완료
- [x] `migrations/024_add_calc_selections.sql`, `schema.sql` — `calc_selections`
  테이블 신설
- [x] `functions/api/calc-selections/index.ts` — GET/POST(upsert)/DELETE
- [x] `src/lib/api.ts` — `CalcSelection` 타입, `fetchCalcSelections`/
  `setCalcSelectionApi`/`removeCalcSelectionApi` 추가
- [x] `src/lib/calcSelections.ts` 신규 — load/reset/get/getCalcSign/
  cycleCalcSelection(미선택→+1→-1→미선택 순환, 낙관적 갱신+실패 시 롤백)
- [x] `src/contexts/AuthContext.tsx`, `src/App.tsx` — 로그인/로그아웃 시
  load/resetCalcSelections 연결
- [x] `src/App.tsx` — `'calculator'` 탭 추가(Calculator 아이콘), 월
  네비게이션 표시 탭에도 포함, `<IncomeCalculator month={selectedMonth} />`
  렌더링
- [x] `src/components/IncomeCalculator.tsx` 신규 — `/api/settlement/monthly`
  (기존 API 재사용, 새 집계 로직 없음)로 월별 분류당 합계를 가져와 선택된
  칩의 부호를 곱해 합산. 수입/지출 분류 칩 3단계 토글(미선택 회색 →
  + 파란색 → − 빨간색), 선택 내역(분류·구분·금액)과 최종 합계를 함께 표시
- [x] `wrangler pages dev` + Playwright로 검증: 영업수익(수입, 커스텀
  분류)/식대·담배·LPG(지출, 커스텀 분류) 실제 거래 등록 후 계산기에서
  +/-/-/- 선택 → 1,000,000 - 80,000 - 50,000 - 150,000 = 720,000원
  정확히 계산됨, 3번 탭하면 선택 해제되어 0원으로 복귀, 새 기기 컨텍스트
  로그인 시 동일 선택·합계로 동기화, 월 이동 시 해당 월 데이터로 재계산
  (거래 없는 달은 0원, 에러 없이 정상 동작). `tsc -b`/`oxlint`/
  `npm run build` 모두 통과
- [x] 원격 D1에 `024_add_calc_selections.sql` 적용 완료(18개 테이블)

## 2026-07-20 (69차) — 수입 화면에서 구매처/판매처 섹션 제거

사용자 요청: "수입에는 구매처 판매처가 필요없어 없애줘". 68차에서 결제
방법을 지출/수입 독립 관리로 바꾼 것과 같은 맥락 — 수입 거래엔 애초에
"구매처"라는 개념 자체가 맞지 않음(돈이 들어오는 쪽이지 어디서 구매한
게 아님).

### 설계
- 스키마/API 변경 없음 — 순수 프론트 UI 조건부 렌더링. `merchant`는
  이미 자유 텍스트 필드라 굳이 별도 목록 분리가 필요 없고, 그냥 수입
  타입일 때 입력 UI 자체를 숨기면 됨
- 지출/수입 전환 시 `merchant` 상태를 비움(입력창이 사라진 채로 이전
  값이 조용히 같이 저장되는 걸 방지) — 단, 이미 저장된 예전 수입 거래를
  수정 화면에서 열었을 때는(applyPrefill 경로) 굳이 비우지 않고 그대로
  둠. 사용자가 손대지 않은 값을 화면에 안 보인다고 매번 저장할 때마다
  지워버리는 건 과도한 파괴적 동작이라고 판단
- 68차와 동일하게 TransactionForm(신규 입력)과 TransactionList(인라인
  수정) 양쪽 다 적용

### 계획
- `src/components/TransactionForm.tsx` — "구매처/결제 카드" 안에서
  구매처 섹션(라벨/관리모드/칩목록/입력창/자동완성)만 `type ===
  'expense'`일 때만 렌더링, 결제 방법 섹션은 그대로 유지. `handleTypeChange`
  에서 수입으로 전환 시 `merchant` 비움 + 관리모드/추가폼 닫기
- `src/components/TransactionList.tsx` — 인라인 수정의 구매처 입력도
  `editState.type === 'expense'`일 때만 렌더링, 타입 전환 버튼에서
  수입 전환 시 `merchant` 비움
- `wrangler pages dev` + Playwright로 지출/수입 전환 시 섹션 표시/숨김,
  수입 거래 저장, 인라인 수정 화면 반영 검증

### 완료
- [x] `src/components/TransactionForm.tsx` — 구매처 섹션 전체를
  `{type === 'expense' && (...)}`로 감쌈, 결제 방법 섹션은 같은 카드
  안에서 그대로 유지. `handleTypeChange`에서 수입 전환 시 `merchant` 비움
  + `addingMerchant`/`manageMerchants` 닫기
- [x] `src/components/TransactionList.tsx` — 인라인 수정의 구매처 입력을
  `editState.type === 'expense'`일 때만 렌더링, 타입 전환 버튼 클릭 시
  수입이면 `merchant` 비움
- [x] `wrangler pages dev` + Playwright로 검증: 지출 화면엔 구매처 섹션
  표시, 수입 화면엔 사라지고 결제 방법은 유지, 지출로 되돌리면 다시
  표시, 수입 거래가 구매처 없이 정상 저장, 인라인 수정 화면에서도
  수입일 때 구매처 입력창이 없는 것 확인. `tsc -b`/`oxlint`/`npm run build`
  모두 통과. 스키마 변경 없어 D1 마이그레이션 불필요

## 2026-07-20 (68차) — 결제 방법 칩(현금/계좌이체) 관리 기능 추가(지출/수입 분리)

사용자 요청: "수입창에서 결제방법 칩도 수정이 되야될거같아 여기도 삭제 추가
가능하게 하자". 지금까지 결제 방법(현금/계좌이체 + 등록된 카드)은 지출/수입
공통으로 하드코딩된 고정 목록이라, 분류/구매처/메모 분류처럼 추가·삭제·순서
변경이 안 됐음.

### 확인한 요구사항(AskUserQuestion)
- 결제 방법 목록은 **지출용/수입용을 분리** 관리(지금은 지출/수입 화면에
  같은 목록이 공유돼서 보이는데, 앞으로는 각자 따로 추가/삭제 가능)
- **등록된 카드는 이 화면에서 삭제 대상이 아님** — 카드 삭제는 기존대로
  '카드 관리'에서만. 특히 수입에서는 카드 자체가 의미가 없으니 수입
  결제 방법 목록에는 카드를 아예 노출하지 않고, 커스텀 칩 직접 추가만
  가능하면 됨(수입엔 카드가 기본 제공될 필요 없음)
- **드래그 순서 변경도 포함**(분류/구매처/메모 분류와 동일하게)

### 설계
- 완전히 새 테이블 `payment_methods` 신설 — `categories` 테이블과 동일한
  구조(기본 제공 '현금'/'계좌이체' + 커스텀 추가 + `removed_default` +
  `sort_order`, `type`으로 지출/수입 분리, `UNIQUE(user_id, type, name)`).
  67차에서 정리한 "재배치 시 기본 항목도 DB 행으로 물질화" 방식을 그대로
  재사용
- `functions/api/payment-methods/index.ts` — `functions/api/categories/index.ts`와
  거의 동일한 GET(병합·정렬 최종 배열)/POST/PATCH(드래그 재배치, 물질화)/
  DELETE(ON CONFLICT DO UPDATE로 물질화된 기본 항목 삭제도 정상 반영) 구현
- 카드 목록은 이 새 시스템과 무관 — 프론트에서 결제 방법 관리 칩 목록 뒤에
  기존처럼 별도로 이어붙여 표시(지출 타입일 때만), 삭제 대상에서 제외
- `src/components/TransactionForm.tsx` — 결제 방법 섹션에 톱니바퀴(관리 모드)
  버튼 추가, `ReorderableChipList`로 드래그 재정렬 지원. 카드 칩은 그
  뒤에 지출일 때만 추가로 렌더링(관리 대상 아님)
- `src/components/TransactionList.tsx` — 인라인 수정의 결제 방법 선택도
  하드코딩된 `['현금','계좌이체',...cards]` 대신 `getPaymentMethods(type)`
  기반으로 변경(분류 선택이 이미 이렇게 동작 중이라 동일 패턴), 카드는
  지출일 때만 이어붙임. 여기는 분류와 마찬가지로 선택만 가능(관리 모드 없음)

### 계획
- `schema.sql`, `migrations/023_add_payment_methods.sql` — `payment_methods`
  테이블 신설
- `functions/lib/paymentMethods.ts` — `DEFAULT_PAYMENT_METHODS` 서버 사본
- `functions/api/payment-methods/index.ts` — GET/POST/PATCH/DELETE
- `src/lib/api.ts` — `fetchPaymentMethods`, `addPaymentMethodApi`,
  `removePaymentMethodApi`, `reorderPaymentMethodsApi`
- `src/lib/paymentMethods.ts` — `DEFAULT_PAYMENT_METHODS`, load/reset/get/
  add/remove/reorder (categories.ts와 동일 패턴)
- `src/contexts/AuthContext.tsx` — 로그아웃 시 `resetPaymentMethods()` 추가
- `src/App.tsx` — 로그인 시 `loadPaymentMethods()` 추가
- `src/components/TransactionForm.tsx`, `src/components/TransactionList.tsx` — 위 설계대로 수정
- `wrangler pages dev` + Playwright로 지출/수입 분리 관리, 드래그 재정렬,
  카드 미노출(수입), 기기 간 동기화 검증
- 검증 후 원격 D1에 마이그레이션 적용, GitHub Actions 배포 확인

### 완료
- [x] `migrations/023_add_payment_methods.sql`, `schema.sql` — `payment_methods`
  테이블 신설(구조는 `categories`와 동일, `type` CHECK로 지출/수입 분리)
- [x] `functions/lib/paymentMethods.ts` — `DEFAULT_PAYMENT_METHODS` 서버 사본
  (현금/계좌이체, 지출·수입 동일)
- [x] `functions/api/payment-methods/index.ts` — GET(병합·정렬 최종 배열)/
  POST/PATCH(드래그 재배치, 기본 항목 물질화)/DELETE(ON CONFLICT DO UPDATE로
  물질화된 기본 항목 삭제도 정상 반영) — `categories`용으로 67차에 이미
  검증한 로직을 그대로 재사용
- [x] `src/lib/api.ts` — `fetchPaymentMethods`/`addPaymentMethodApi`/
  `removePaymentMethodApi`/`reorderPaymentMethodsApi` 추가
- [x] `src/lib/paymentMethods.ts` 신규 — `categories.ts`와 동일 패턴의
  지출/수입 독립 캐시(load/reset/get/add/remove/reorder)
- [x] `src/contexts/AuthContext.tsx` 로그아웃 시 `resetPaymentMethods()`,
  `src/App.tsx` 로그인 시 `loadPaymentMethods()` 연결
- [x] `src/components/TransactionForm.tsx` — 결제 방법 섹션에 톱니바퀴
  관리 모드 + `ReorderableChipList` 드래그 재정렬 + "+ 직접입력" 추가.
  등록된 카드는 지출일 때만 관리 목록 뒤에 이어붙여 표시(관리 모드 중엔
  숨김), 수입엔 카드 자체를 노출하지 않음. 타입(지출/수입) 전환 시
  결제 방법 목록·선택값을 그 타입 것으로 재동기화
- [x] `src/components/TransactionList.tsx` — 인라인 수정의 결제 방법
  선택도 하드코딩 배열 대신 `getPaymentMethods(editState.type)` 기반으로
  변경(분류 선택과 동일 패턴), 카드는 지출일 때만 이어붙임, 타입 전환 시
  재동기화. 여기는 분류처럼 선택만 가능(관리 모드는 TransactionForm에만)
- [x] `wrangler pages dev` + Playwright로 검증: 지출 초기값(현금/계좌이체
  + 카드 안내), 수입 초기값(카드 안내 없음), 수입에서 커스텀 추가, 기본
  항목 포함 드래그 재정렬, 물질화된 기본 항목("현금") 삭제, 수입 쪽
  변경이 지출 목록에 영향 없음(분리 관리 확인), 새 기기 컨텍스트 동기화,
  커스텀 결제 방법으로 실제 거래 저장 + 인라인 수정 화면에 반영까지 확인.
  `tsc -b`/`oxlint`/`npm run build` 모두 통과
- [x] 원격 D1에 `023_add_payment_methods.sql` 적용 완료(17개 테이블)

## 2026-07-20 (67차) — 칩 순서 변경을 드래그 앤 드롭 + 기본 분류도 이동 가능하게 재설계

사용자 요청(66차 결과물에 대한 수정 지시): "드래그 방식으로 움직여야하고
기본제공 도 다 움직여야해". 66차에서 위/아래 버튼 + 커스텀 항목만 이동 가능하게
구현했는데, 이 두 가지 설계 결정을 모두 뒤집는 명확한 반려 지시.

### 설계
- **기본 분류 이동 허용**: 기본 분류(식비/교통/급여 등)는 DB에 행이 없는
  고정 배열이라 지금까지 순서를 저장할 곳이 없었음. → 재배치가 일어나는
  시점에 그 배열에 포함된 모든 이름(기본+커스텀)을 DB 행으로 "물질화"
  (upsert)하는 방식으로 해결. 아직 한 번도 재배치되지 않은 기본 분류는
  행이 없는 채로 남아있고, 이땐 `DEFAULT_CATEGORIES` 배열 순서를 그대로
  표시 순서로 사용(기존 동작과 동일) — 커스텀 항목의 `sort_order`엔 항상
  큰 오프셋(100000)을 더해 비교하므로, 손대지 않은 기본 분류가 항상
  손대지 않은 커스텀보다 앞에 오는 기존 UX가 자연히 유지되고, 실제로
  재배치가 한 번 일어나면 그 시점부터는 오프셋 없이 각자의 sort_order로만
  비교되어 완전히 자유롭게 섞임
- GET 응답 형태를 `{custom, removedDefaults}` 델타가 아니라 서버가 이미
  기본+커스텀을 병합/정렬까지 끝낸 최종 배열(`{expense: string[], income:
  string[]}`, 메모 분류는 `{data: string[]}`)로 변경 — 프론트가 병합 로직을
  가질 필요가 없어져 오히려 코드가 단순해짐
- 삭제(DELETE) 핸들러도 손봐야 함: 기존엔 기본 분류 삭제 시 `INSERT ...
  removed_default=1 ON CONFLICT DO NOTHING`이라, 이미 재배치돼 행이
  존재하는(removed_default=0) 기본 분류를 삭제하면 충돌 시 아무 것도 안
  갱신돼 삭제가 씹히는 버그가 생김 → `ON CONFLICT DO UPDATE SET
  removed_default = 1`로 변경
- **드래그 앤 드롭 UI**: 외부 라이브러리 추가 대신(월 이동 스와이프 등
  기존 코드도 순수 포인터/터치 이벤트로 직접 구현하는 관례) Pointer Events
  기반 커스텀 드래그 재정렬 컴포넌트 `ReorderableChipList`를 새로 만들어
  분류/구매처/메모 분류 3곳에서 공용으로 사용. pointerdown 시작 위치에서
  일정 거리(6px) 이상 움직이면 드래그로 간주해 실시간으로 배열을 재배열,
  거의 안 움직이고 뗀 경우(탭)는 기존처럼 선택/삭제 동작으로 처리(드래그와
  탭을 하나의 포인터 제스처에서 구분)

### 계획
- `functions/api/categories/index.ts` — GET을 병합·정렬된 `{expense,
  income}` 최종 배열로 변경, PATCH를 upsert 방식으로 변경(기본 분류
  이름도 물질화), DELETE의 ON CONFLICT를 DO UPDATE로 수정
- `functions/api/note-categories/index.ts` — 동일 패턴 적용
- `functions/api/merchants/index.ts` — 기본값 개념이 없어 변경 불필요(이미
  전체 재정렬 지원)
- `src/lib/api.ts` — `CategoriesResponse`/`CategoryOverrides` 타입을 최종
  배열 형태로 변경
- `src/lib/categories.ts`, `src/lib/noteCategories.ts` — 캐시를 델타가
  아닌 최종 배열로 변경, `getCategories()`가 병합 로직 없이 캐시를 그대로
  반환하도록 단순화, `reorderCustomCategories` → `reorderCategories`로
  이름 변경(기본 분류도 대상이 되므로)
- `src/components/ReorderableChipList.tsx` — 신규, 드래그 재정렬 공용 컴포넌트
- `src/components/TransactionForm.tsx` — 분류/구매처 관리 모드의 위/아래
  버튼 UI를 `ReorderableChipList` 기반 드래그로 교체, 기본/커스텀 구분
  로직(`customCategories` 등) 제거
- `src/components/NotesView.tsx` — 메모 분류 관리 모드도 동일하게 교체
- 스키마 변경 없음(`sort_order` 컬럼은 66차에서 이미 추가됨)
- `wrangler pages dev` + Playwright로 드래그 재정렬 및 기기 간 동기화 재검증

### 완료
- [x] `functions/api/categories/index.ts`, `functions/api/note-categories/index.ts`
  — GET을 서버에서 병합·정렬한 최종 배열로 변경, PATCH를 upsert 방식으로
  변경(기본 분류 이름 포함 물질화), DELETE의 `ON CONFLICT DO NOTHING` →
  `DO UPDATE SET removed_default = 1`로 수정(이미 물질화된 기본 분류
  삭제가 씹히던 버그 예방)
- [x] `src/lib/api.ts` — `CategoriesResponse`를 `{expense: string[], income:
  string[]}`로, `fetchNoteCategoryOverrides()`를 `string[]` 반환으로 변경.
  `CategoryOverrides` 인터페이스 제거
- [x] `src/lib/categories.ts`, `src/lib/noteCategories.ts` — 캐시를 최종
  배열로 단순화, `reorderCategories`/`reorderNoteCategories`로 개명(기본
  분류 포함), `addCustomCategory`/`removeCategory` 등은 서버 응답으로
  캐시 재조회(위치 계산을 서버 로직에 위임)
- [x] `src/components/ReorderableChipList.tsx` 신규 — Pointer Events 기반
  드래그 재정렬 공용 컴포넌트. pointerdown~move 거리 6px 이상이면 드래그로
  간주, 아니면 탭(선택/삭제)으로 처리. `setPointerCapture`로 칩 사이
  빈틈에서도 이벤트 유실 없이 추적. 관리 모드가 아닐 때는 드래그 로직 자체를
  타지 않아 기존 페이지 스크롤에 영향 없음
- [x] `src/components/TransactionForm.tsx`, `src/components/NotesView.tsx`
  — 분류/구매처/메모 분류 관리 모드의 위·아래 버튼 UI를
  `ReorderableChipList` 기반 드래그로 교체, 기본/커스텀 구분 로직
  (`customCategories`, `handleMoveCategory` 등) 전부 제거
- [x] 버그 두 건 발견·수정: (1) 드래그 재정렬 로직에서 가변 ref(`st.idx`)를
  `setOrder` 콜백 밖에서 먼저 갱신해버려, 리액트가 배칭 처리 시점에 이미
  바뀐 값을 읽어 "같은 자리에 다시 넣는" 꼴이 되어 드래그해도 아무 변화가
  없어 보이던 문제 — 지역 변수로 인덱스를 스냅샷 떠서 해결. (2) 관리
  모드가 아닐 때 `handlePointerDown`이 조기 반환해 탭-선택이 전혀 동작하지
  않던 문제 — draggable 여부와 무관하게 항상 포인터 상태를 추적하도록 수정
- [x] `wrangler pages dev` + Playwright로 검증: 분류(기본 분류 포함 드래그
  재정렬), 메모 분류, 구매처 각각 드래그 재정렬 확인, 재정렬 후 새 기기
  컨텍스트 로그인 시 동일 순서로 동기화되는지 확인, 관리 모드 탭-삭제와
  평소 모드 탭-선택 회귀 없는지 확인, 이미 물질화된 기본 분류 삭제가
  정상 반영되는지 확인. `tsc -b`/`oxlint`/`npm run build` 모두 통과
- 스키마 변경 없어 원격 D1 마이그레이션 불필요

## 2026-07-20 (66차) — 관리 모드 칩(분류/구매처/메모 분류) 순서 변경 기능

사용자 요청: "칩이 있는 모든 곳에 편집에서 칩 순서 변경할 수 있게 해줘". "칩이
있는 곳" 중 "편집(관리 모드)"이 있는 곳은 3군데: 거래 입력 폼의 분류(58차),
구매처(63차), 메모장의 분류(59차) — 전부 톱니바�퀴 아이콘으로 삭제 모드 진입하는
동일 패턴. (검색 화면의 분류/구매처 필터 칩, 결제 방법 칩은 관리 모드 자체가
없어 이번 범위 밖 — 분류/구매처 순서가 바뀌면 필터 칩도 같은 순서로 자동 반영됨)

### 설계
- 기본 제공 분류(식비/교통/급여 등, DB 행이 없는 고정 배열)는 항상 맨 앞
  고정 순서 유지 — 순서 변경 대상에서 제외. 사용자가 추가한 커스텀 분류/구매처
  끼리만 순서 변경 가능. 이유: 기본 분류까지 자유롭게 섞으려면 기본 분류를
  최초 재정렬 시점에 전부 DB 행으로 물질화해야 해서 훨씬 복잡해지고, 빠른
  입력 템플릿(sort_order + 스왑 방식)과 다른 새로운 패턴이 필요해짐. 커스텀
  항목은 이미 DB 행이 있으니 `sort_order` 컬럼만 추가하면 기존 템플릿 재정렬과
  동일한 방식 재사용 가능
- 스왑 대신 "전체 순서 배열 전송" 방식 채택(템플릿은 인접 2개 스왑이지만, 이번엔
  프론트가 개별 sort_order 값을 몰라도 되게): 위/아래 버튼 클릭 시 프론트에서
  커스텀 배열의 인접 두 이름을 바꾼 새 배열을 만들어 `PATCH .../reorder`로
  전체 순서(이름 배열)를 보내면, 백엔드가 배열 인덱스를 그대로 각 행의
  `sort_order`로 갱신

### 계획
- `schema.sql`, `migrations/022_add_sort_order.sql` — `categories`,
  `note_categories`, `merchants` 테이블에 각각 `sort_order INTEGER NOT NULL
  DEFAULT 0` 추가
- `functions/api/categories/index.ts`, `functions/api/note-categories/index.ts`,
  `functions/api/merchants/index.ts` — GET을 `ORDER BY sort_order ASC,
  created_at ASC`로 변경, POST(추가) 시 `sort_order = 현재 최대값 + 1`로 저장
  (빠른 입력 템플릿과 동일 패턴), `onRequestPatch` 신규 추가(`{order: string[]}`
  받아 배열 인덱스를 각 행의 sort_order로 일괄 갱신 — 기본 분류 이름이 섞여
  있어도 해당 행이 없으니 자동 무시됨)
- `src/lib/api.ts` — `reorderCategoriesApi(type, order)`,
  `reorderNoteCategoriesApi(order)`, `reorderMerchantsApi(order)` 추가
- `src/lib/categories.ts`, `src/lib/noteCategories.ts`, `src/lib/merchants.ts`
  — `reorderCustomCategories`/`reorderCustomNoteCategories`/
  `reorderCustomMerchants` 추가(캐시의 custom 배열 순서 갱신 + API 호출)
- `src/components/TransactionForm.tsx` — 분류/구매처 관리 모드에서 커스텀 칩에만
  위/아래 이동 버튼(맨 앞/맨 뒤는 반대쪽 버튼 비활성화) 추가
- `src/components/NotesView.tsx` — 메모 분류 관리 모드에 동일하게 위/아래 이동
  버튼 추가

### 예상 변경 파일
- `schema.sql`, `migrations/022_add_sort_order.sql`(신규),
  `functions/api/categories/index.ts`, `functions/api/note-categories/index.ts`,
  `functions/api/merchants/index.ts`, `src/lib/api.ts`, `src/lib/categories.ts`,
  `src/lib/noteCategories.ts`, `src/lib/merchants.ts`,
  `src/components/TransactionForm.tsx`, `src/components/NotesView.tsx`

### 완료
- [x] 계획대로 전 파일 작업 완료. 구매처는 기본값 개념이 없어 전부 커스텀이라
  함수명을 `reorderCustomMerchants` 대신 `reorderMerchants`로 단순화(계획과
  다른 이름이지만 동작은 동일)
- [x] `DEFAULT_CATEGORIES`/`DEFAULT_NOTE_CATEGORIES`를 각 lib 파일에서 export로
  변경(UI가 "이 분류가 기본 제공이라 순서 변경 불가"를 판단해야 해서 필요)
- [x] `README.md`에 마이그레이션 범위(001~021→001~022)·DB 스키마·기능 목록 반영
- [x] `npx tsc -b`, `npm run lint`(oxlint) 통과
- [x] `wrangler pages dev` + 로컬 D1로 브라우저 검증: 거래 분류에 커스텀 "가/나/다"
  추가 → 관리 모드에서 "가"를 한 번 아래로 이동 → 순서가 "나/가/다"로 정확히
  바뀜(기본 분류는 위/아래 버튼 자체가 안 보임) 확인 → 완전히 새로운 브라우저
  컨텍스트(다른 기기 시뮬레이션)로 같은 계정 로그인만 했더니 동일한 순서로
  동기화됨 확인. 메모 분류도 동일하게 검증(관리 모드에서 이동 → 정확히 반영).
  구매처는 별도 화면 테스트는 생략(카테고리와 100% 동일한 코드 패턴이라 위험 낮음).
  콘솔 에러 없음
- [x] 프로덕션 D1에 `022_add_sort_order.sql` 마이그레이션 적용, 커밋 push 후
  GitHub Actions 자동배포 success 확인
- [x] 미완료 항목 없음

---

## 2026-07-20 (65차) — 정산 표의 수입 열을 3그룹 대신 분류별 칩으로 표시

사용자 요청: 정산 탭(주간/월간/연간 표)의 수입이 "소득/예금인출/기타" 3그룹으로만
묶여 나오는데, 지출처럼 분류(칩) 하나하나가 열로 나와야 함. 현재는 `급여`→소득,
`예금인출`→예금인출, 나머지 전부→기타로 분류하는 `classifyIncomeGroup`이 있어서,
사용자가 기본 분류 `급여`를 삭제하고 커스텀 수입 분류(영업수익/카카오수수료 등)를
쓰면 전부 "기타" 한 열로 뭉쳐 보임 — 사용자가 지적한 "급여 칩이 없어지면서
기타로 들어간다"가 이 증상.

### 원인 및 설계
- `functions/lib/settlement.ts`의 `IncomeBucket`(소득/예금인출/기타/total 고정
  4키)이 `ExpenseBucket`(`{[category]: number}` 동적 키)과 다른 구조라 발생.
  수입도 지출과 동일하게 분류명을 키로 쓰는 동적 버킷으로 바꾸면 그대로 해결됨
  — `classifyIncomeGroup`/`IncomeBucket`/`emptyIncomeBucket`/`addIncome` 제거하고
  `ExpenseBucket`/`addExpense`(범용 버킷 함수로 이름 정리)를 수입에도 재사용
- 프론트 `src/types.ts`의 `SettlementIncomeBucket`도 `SettlementExpenseBucket`과
  동일한 동적 키 구조로 변경(타입 이름은 income/expense 구분 유지해 가독성 유지)
- `src/lib/settlementFilter.ts`의 `classifyIncomeGroup`/`selectedIncomeGroups`/
  `IncomeGroup`은 더 이상 필요 없음(수입도 지출처럼 분류명 그대로 필터링) —
  기존 `selectedExpenseCategories`를 범용 이름으로 바꿔 수입에도 재사용
- `WeeklySettlement.tsx`/`MonthlySettlementTable.tsx`/`AnnualSettlementTable.tsx`
  — `ALL_INCOME_GROUPS` 고정 3열 대신 `getCategories('income')`로 지출과 동일한
  패턴(열 렌더링, 합계 계산, 분류 필터 적용)으로 통일
- `DailySettlement.tsx`(개별 거래 목록이라 원래도 영향 없음), `CategoryFilterBar`,
  `OverviewView`는 변경 불필요

### 예상 변경 파일
- `functions/lib/settlement.ts`, `src/types.ts`, `src/lib/settlementFilter.ts`,
  `src/components/WeeklySettlement.tsx`,
  `src/components/MonthlySettlementTable.tsx`,
  `src/components/AnnualSettlementTable.tsx`

### 완료
- [x] 계획대로 전 파일 작업 완료(예상 변경 파일과 동일). `IncomeBucket`/
  `classifyIncomeGroup`/`emptyIncomeBucket`/`addIncome`을 `CategoryBucket`/
  `addAmount`로 통합(백엔드), `SettlementIncomeBucket`을 동적 키 구조로 변경
  (프론트), `settlementFilter.ts`를 `filterSelectedCategories` 하나로 단순화
- [x] DB 스키마 변경 없음(계산 로직만 변경) — 마이그레이션 파일/원격 D1 적용 불필요
- [x] `npx tsc -b`, `npm run lint`(oxlint) 통과
- [x] `wrangler pages dev` + 로컬 D1로 상희님 시나리오 재현해 검증: 기본 분류
  "급여" 삭제 + 커스텀 수입 분류(영업수익/카카오수수료) 추가 후 급여/용돈/영업수익/
  카카오수수료로 거래 등록 → 월간·연간 정산 표에서 용돈/기타수입/영업수익/
  카카오수수료가 각각 별도 열로 정확히 표시됨(더 이상 "기타" 한 열로 뭉치지
  않음) 확인. 삭제된 "급여" 분류는 열 자체는 없어지지만(지출 분류 삭제와 동일한
  기존 동작) 수입합계에는 정상적으로 포함됨 확인. 콘솔 에러 없음
- [x] 미완료 항목 없음
- [ ] 실제 프로덕션 계정(상희님)의 정산 화면에서 최종 확인은 다음에 상희님이
  접속했을 때 필요시 재확인

---

## 2026-07-20 (64차) — 결제 방법 "계좌이체" 추가 + "비정산" 거래 분리 기능

사용자 요청 2건:
1. 결제 방법에 "계좌이체" 칩 추가(기존 "현금" + 등록된 카드 목록에 이어)
2. "지출/수입" 버튼 오른쪽에 "비정산" 토글 버튼 추가 — 비정산으로 표시한
   거래는 일/주/월/연 정산과 예산 계산, 홈 화면 잔액/합계(=결제금액)에서
   완전히 제외되고, 새로 만드는 "비정산" 탭에서만 보이며 거기서 비정산
   거래만 따로 합계가 나옴("가족들 비용 확인용"). 홈 화면 "정산 보기" 버튼
   바로 아래에 "비정산 보기" 버튼을 추가해 탭으로 연결

### 설계 결정(요청 문구 기반, 명확한 부분은 재질문 없이 진행)
- 비정산은 지출/수입을 대체하는 새 타입이 아니라 기존 타입 위에 얹는 별도
  플래그(토글) — "지출 수입 버튼 오른쪽에 추가"라는 표현과 일치하고, 타입을
  대체하면 정산/예산 코드 전반의 `type==='income'|'expense'` 전제가 깨짐
- "결제금액에도 포함되지않고"를 넓게 해석해 정산(일/주/월/연) + 예산 + 엑셀
  내보내기까지 기본적으로 비정산 거래를 제외. 카드 혜택 월한도 사용량 집계는
  요청 범위 밖이라 건드리지 않음(카드사 실제 청구와는 무관한 내부 확인용
  플래그이므로 손대면 오히려 실제 혜택 계산을 왜곡할 수 있음)
- 계좌이체는 카드가 아닌 "현금"과 동급의 결제수단 문자열 — 기존에
  `payment_method`가 "카드 있으면 card.id, 없으면 무조건 '현금'"으로
  하드코딩돼 있던 곳들을 "카드 있으면 card.id, 없으면 선택한 값 그대로"로
  일반화해야 계좌이체가 다른 곳에서 "현금"으로 잘못 표시되지 않음. 영향 범위:
  TransactionForm(추가/수정), TransactionList(인라인 수정+뱃지 표시),
  SearchView(필터+결과 뱃지). RecurringManager(고정 수입/지출)는 이번
  요청 범위 밖이라 제외

### 계획
- `schema.sql`, `migrations/021_add_unsettled.sql` — `transactions`에
  `unsettled INTEGER NOT NULL DEFAULT 0` 컬럼 추가
- `functions/api/transactions/index.ts` — GET 기본 동작을 `unsettled = 0`으로
  필터(기존 모든 호출부가 코드 변경 없이 자동으로 비정산 제외), `?unsettled=1`
  쿼리로 비정산 탭 전용 조회 지원. POST에 `unsettled` 저장 추가
- `functions/api/transactions/[id].ts` — PATCH에 `unsettled` 필드 추가
- `functions/lib/settlement.ts` — 일/주/월/연 정산의 5개 쿼리 전부에
  `AND unsettled = 0` 추가
- `functions/lib/budget.ts` — 예산 지출 집계 쿼리에 `AND unsettled = 0` 추가
- `functions/api/export/index.ts` — 엑셀 내보내기 쿼리에 `AND t.unsettled = 0` 추가
- `src/types.ts` — `Transaction.unsettled: number`, `NewTransaction`/
  `UpdateTransaction`/`TransactionPrefill`에 `unsettled?: boolean` 추가
- `src/lib/api.ts` — `fetchTransactions`에 `unsettled?: boolean` 파라미터 추가
  (true일 때만 `?unsettled=1` 전송)
- `src/components/TransactionForm.tsx` — 지출/수입 버튼 옆에 "비정산" 토글 칩
  추가(상태 `unsettled`), 결제 방법에 "계좌이체" 칩 추가,
  `selectedCard ? selectedCard.id : '현금'` 패턴을
  `selectedCard ? selectedCard.id : paymentMethod`로 일반화(계좌이체 보존),
  생성/수정 payload에 `unsettled` 포함, 저장 후 초기화
- `src/components/TransactionList.tsx` — 인라인 수정에도 "계좌이체" 칩 +
  "비정산" 토글 추가(비정산 해제/설정 가능하도록), 결제방법 뱃지 표시를
  카드 없으면 `payment_method` 값을 그대로 보여주도록 일반화(하드코딩된
  "현금" 대신)
- `src/components/SearchView.tsx` — 결제 방법 필터에 "계좌이체" 추가, 결과
  뱃지도 동일하게 일반화
- `src/components/UnsettledView.tsx`(신규) — `fetchTransactions({month,
  unsettled:true})`로 조회, 수입/지출 합계 카드 + `TransactionList` 재사용(단,
  App.tsx의 Undo-delete 로직과 분리된 자체 삭제/수정 핸들러 — 3초 되돌리기 없이
  즉시 삭제, 수정은 API 직접 호출 후 재조회), "복제"는 App.tsx의
  `handleDuplicate`를 그대로 전달받아 재사용(홈으로 이동해 폼에 채움)
- `src/App.tsx` — `Tab`에 `'unsettled'` 추가, TABS에 "비정산"(Users 아이콘)
  추가, 헤더 월 네비게이션 표시 조건에 `unsettled` 추가, 홈 화면 "정산 보기"
  버튼 바로 아래 "비정산 보기 →" 버튼 추가, `activeTab === 'unsettled'`
  렌더링 분기 추가

### 예상 변경 파일
- `schema.sql`, `migrations/021_add_unsettled.sql`(신규),
  `functions/api/transactions/index.ts`, `functions/api/transactions/[id].ts`,
  `functions/lib/settlement.ts`, `functions/lib/budget.ts`,
  `functions/api/export/index.ts`, `src/types.ts`, `src/lib/api.ts`,
  `src/components/TransactionForm.tsx`, `src/components/TransactionList.tsx`,
  `src/components/SearchView.tsx`, `src/components/UnsettledView.tsx`(신규),
  `src/App.tsx`

### 완료
- [x] 계획대로 전 파일 작업 완료(예상 변경 파일과 동일), `README.md`에도
  마이그레이션 범위(001~020→001~021)·DB 스키마·기능 목록(홈/비정산 섹션 신설) 반영
- [x] 계획에 없었지만 구현 중 필요해서 같이 고친 것:
  - `applyTemplate`/`handleSaveAsTemplate`(빠른 입력 템플릿)도 `payment_method`
    하드코딩 '현금' 패턴이 있어 계좌이체가 템플릿 저장/적용 시 사라지는
    문제가 있었음 — 같은 방식으로 일반화(백엔드 `quick_templates` 테이블은
    이미 임의 문자열을 저장하므로 스키마 변경 불필요)
  - 혜택 매칭 로직(`paymentMethod !== '현금'`으로 "카드 선택됨"을 판단하던 곳
    2군데)이 계좌이체를 잘못된 card_id로 취급해 혜택 매칭을 시도하는 버그가
    될 뻔해서 `cards.some(c => c.id === paymentMethod)`로 명확화
  - SearchView의 결제 방법 필터는 서버가 현금/계좌이체를 구분 안 하고 둘 다
    "카드 미연결"로만 조회하므로(`card_id='cash'` 센티널), 클라이언트에서
    `payment_method` 값으로 한 번 더 나누는 방식으로 구현(백엔드 쿼리 변경 없음)
- [x] `npx tsc -b`, `npm run lint`(oxlint) 통과. `functions/`는 `wrangler pages
  dev`의 "Compiled Worker successfully"로 대체 확인
- [x] `wrangler pages dev` + 로컬 D1로 브라우저 전체 플로우 검증:
  - 계좌이체로 거래 저장 → 정상 표시, "현금"으로 잘못 표시되지 않음 확인
  - 비정산 토글 켜고 저장 → 홈 잔액/합계에 전혀 반영 안 됨, 일간 정산 화면에도
    안 나타남(정확히 확인 — 처음엔 테스트 스크립트의 nav 선택자가 "정산"이
    "비정산"에도 부분일치돼 잘못된 화면을 보고 있었던 걸 발견해 정확일치로
    고치고 재검증함) 확인
  - "비정산" 탭에 해당 거래만 나타나고 독립된 합계(잔액/수입/지출)가 표시됨 확인
  - 비정산 탭에서 인라인 수정으로 비정산 해제 → 탭에서 사라지고 홈 잔액에
    정확히 반영됨(80,000원으로 합산) 확인
  - 검색 화면 결제 방법 필터에 "계좌이체" 선택 시 정확히 계좌이체 거래만
    검색됨(현금 거래 제외) 확인
  - 전 과정 콘솔 에러 없음
- [x] 프로덕션 D1에 `021_add_unsettled.sql` 마이그레이션 적용, 커밋 push 후
  GitHub Actions 자동배포 success 확인
- [x] 미완료 항목 없음. 참고: 검증 스크립트 자체의 버그(has-text 부분일치로
  "정산"이 "비정산" 탭도 매칭)를 발견해 고친 경험 — 앞으로 이 앱에서 "비정산"
  같은 접두 관계 라벨이 늘어나면 텍스트 기반 선택자/검색에서 항상 부분일치
  주의가 필요함

---

## 2026-07-20 (63차) — 구매처/판매처에도 분류처럼 추가·삭제 관리 기능 + 검색 필터 추가

사용자 요청: "구매처 판매처도 분류처럼 추가 삭제 관리 기능이 필요해, 검색옵션에도
추가해야됨". 확인(AskUserQuestion) 결과 (1) 분류와 동일한 칩 리스트 UI로
구매처 관리(기존 자유입력 + 최근 구매처 자동완성은 그대로 유지, 칩은 사용자가
명시적으로 추가한 것만), (2) 검색 화면엔 분류 필터와 동일하게 드롭다운(정확일치)
방식으로 채택. 거래 분류(58차)와 달리 구매처는 "기본값" 개념이 없어(사용자마다
전혀 다른 상호명) `removed_default` 없이 단순 목록 테이블로 구현.

### 계획
- `schema.sql`, `migrations/020_add_merchants.sql` — `merchants` 테이블
  (`id, user_id, name, created_at`, `UNIQUE(user_id, name)`) 추가. 기존
  `/api/merchants/recent`(거래 이력 기반 자동완성, 별개 기능)와 공존
- `functions/api/merchants/index.ts`(신규) — GET(목록 조회)/POST(추가)/
  DELETE(`?name=`로 삭제) — `note_categories` API와 유사하지만 기본값 개념 없음
- `src/lib/api.ts` — `fetchMerchantList`/`addMerchantApi`/`removeMerchantApi` 추가
- `src/lib/merchants.ts`(신규) — 모듈 캐시 + `loadMerchants()`/`resetMerchants()`/
  `getMerchants()`/`addMerchant()`/`removeMerchant()` (58~59차 categories.ts와
  동일 패턴, 다만 커스텀 목록만 있고 기본값 삭제 개념 없음)
- `src/contexts/AuthContext.tsx` — `logout()`에 `resetMerchants()` 추가
- `src/App.tsx` — 로그인 effect에 `loadMerchants()` 추가(마이그레이션 대상
  아니므로 `migrateLegacyLocalStorage()`와는 무관하게 바로 호출)
- `src/components/TransactionForm.tsx` — "구매처 / 판매처" 라벨 옆에 분류와
  동일한 톱니바퀴 관리 버튼 + 칩 목록("+ 직접입력"으로 추가, 관리 모드에서
  ×로 삭제) 추가. 칩을 탭하면 구매처 입력칸이 채워짐. 기존 자유입력 텍스트
  필드 + 최근 구매처 자동완성 드롭다운은 그대로 유지(별개 기능으로 공존).
  마운트 시 `loadMerchants()` 완료 후 재동기화하는 effect 추가(카테고리와 동일 패턴)
- `src/components/SearchView.tsx` — `Filters`에 `merchant` 필드 추가, 분류
  필터와 동일한 칩 드롭다운(정확일치) UI 추가, 클라이언트 필터링(카테고리와
  동일하게 서버 대신 클라이언트에서 정확일치 필터)

### 예상 변경 파일
- `schema.sql`, `migrations/020_add_merchants.sql`(신규),
  `functions/api/merchants/index.ts`(신규), `src/lib/api.ts`,
  `src/lib/merchants.ts`(신규), `src/contexts/AuthContext.tsx`, `src/App.tsx`,
  `src/components/TransactionForm.tsx`, `src/components/SearchView.tsx`

### 완료
- [x] 계획대로 전 파일 작업 완료(예상 변경 파일과 동일), `README.md` 마이그레이션
  범위(001~019→001~020)·DB 스키마 목록·기능 설명(홈/검색)에 반영
- [x] SearchView의 구매처 필터 섹션은 관리 목록이 비어있으면(신규 사용자) 숨김
  처리해 빈 섹션이 노출되지 않게 함
- [x] `npx tsc -b`, `npm run lint`(oxlint) 통과
- [x] `wrangler pages dev` + 로컬 D1로 브라우저 검증: 구매처 칩 추가("스타벅스
  강남점", "이마트 죽전점") → 칩 탭 시 입력칸 자동 채움 확인 → 관리 모드로
  "스타벅스 강남점" 삭제 확인 → 거래 저장 후 검색 화면 필터 패널에 "구매처"
  섹션이 정확히 나타나고 정확일치로 필터링됨(1건 검색) 확인 → 완전히 새로운
  브라우저 컨텍스트(다른 기기 시뮬레이션)로 같은 계정 로그인만 했더니 구매처
  칩 목록이 동일하게 동기화됨 확인. 콘솔 에러 없음
- [x] 프로덕션 D1에 `020_add_merchants.sql` 마이그레이션 적용, 커밋 push 후
  GitHub Actions 자동배포 success 확인
- [x] 미완료 항목 없음

---

## 2026-07-20 (62차) — 거래 목록 메모를 카드 하단 전체 너비로 배치(61차 후속)

61차에서 메모 줄바꿈은 됐지만, `<li>`가 여전히 `flex items-center
justify-between`라 금액/복제·수정·삭제 버튼이 메모 옆에 세로 중앙 정렬돼
메모가 길어질수록 버튼이 어중간하게 떠 보임. 사용자 피드백: 금액/버튼은
상단에, 메모는 옆이 아니라 카드 맨 하단에 나와야 함.

### 계획
- `src/components/TransactionList.tsx` — `<li>`를 `flex-col`로 바꿔 상단 줄
  (제목+분류/결제 뱃지 좌측, 금액+복제/수정/삭제 버튼 우측 — 기존과 동일한
  배치)과 하단 줄(메모, 전체 너비)로 분리. 메모가 없으면 하단 줄 자체가 안
  생기므로 기존 레이아웃과 동일하게 보임

### 예상 변경 파일
- `src/components/TransactionList.tsx`

### 완료
- [x] `<li>`를 `flex-col`로 변경, 상단 줄(제목+뱃지 / 금액+버튼)과 하단 줄(메모)로
  분리
- [x] `npx tsc -b`, `npm run lint`(oxlint) 통과
- [x] `wrangler pages dev` + 로컬 D1로 브라우저 확인 — 금액/복제·수정·삭제
  버튼이 항상 상단에 고정되고, 긴 메모는 카드 맨 아래에 전체 너비로 줄바꿈되며
  표시됨. 메모 없는 항목·짧은 메모 항목 모두 기존과 동일하게 보임. 콘솔 에러 없음
- [x] 미완료 항목 없음

---

## 2026-07-20 (61차) — 거래 목록의 메모가 잘리는 문제 수정(줄바꿈 허용)

사용자가 상희님 거래 목록 스크린샷 첨부 — 메모 내용이 `truncate`로 한 줄
말줄임 처리돼 "영업..."처럼 잘려서 안 보임. 메모는 다 보여야 하고, 길면
줄바꿈해서 카드(행) 높이가 늘어나더라도 전체 내용을 표시해야 함.

### 계획
- `src/components/TransactionList.tsx` — 일반 표시(비수정) 상태의 거래 항목에서
  메모(`tx.memo`)를 분류/결제방법 뱃지와 같은 줄(`flex flex-wrap`) 안에
  `truncate` span으로 끼워넣던 걸, 뱃지 줄 아래 별도 줄로 분리하고 `truncate`
  대신 줄바꿈 허용(`whitespace-pre-wrap break-words`)으로 교체. 제목(구매처/
  분류)의 `truncate`는 이번 요청 범위 밖이라 그대로 둠

### 예상 변경 파일
- `src/components/TransactionList.tsx`

### 완료
- [x] 메모를 뱃지 줄에서 분리해 별도 `<p>`로, `truncate` → `whitespace-pre-wrap
  break-words`로 교체
- [x] `npx tsc -b`, `npm run lint`(oxlint) 통과
- [x] `wrangler pages dev` + 로컬 D1로 브라우저 확인 — 긴 메모(80자+)가 잘리지
  않고 여러 줄로 완전히 표시되며 행 높이가 늘어남, 짧은 메모는 기존처럼 한 줄로
  표시. 콘솔 에러 없음
- [x] 미완료 항목 없음

---

## 2026-07-20 (60차) — 기존 로컬 분류/설정을 서버로 끌어올리는 1회성 마이그레이션(58~59차 후속)

사용자가 실제 기존 고객("상희"님) 스크린샷을 첨부 — 지출/수입에 커스텀 분류를
아주 많이 만들어둔 헤비 유저. 58~59차에서 분류/설정을 서버(D1) 동기화로
바꿨지만, 예전에 각 기기의 `localStorage`에 이미 쌓여있던 데이터를 서버로
끌어올리는 마이그레이션은 만들지 않았음을 확인 — 이 상태로는 기존 고객이
앱을 다시 열면(새 코드가 배포된 뒤) 그 기기에 있던 커스텀 분류가 화면에서
안 보이게 됨(데이터 자체가 삭제되진 않지만 더 이상 안 읽음). 상희님처럼 이미
많은 분류를 만들어둔 기존 고객의 데이터를 지키기 위해 1회성 마이그레이션을
추가하기로 함.

### 계획
- `src/lib/legacyMigration.ts`(신규) — 기기별 로컬 스토리지에 남아있는 예전 키
  (`budget:categories:{type}`, `budget:categories:{type}:removedDefaults`,
  `budget:noteCategories`, `budget:noteCategories:removedDefaults`,
  `budget:monthlyBasis`)를 읽어 이미 만들어둔 `addCustomCategory`/
  `removeCategory`/`addCustomNoteCategory`/`removeNoteCategory`/
  `setMonthlyBasis`(58~59차, 내부적으로 서버 API 호출 + 캐시 갱신)를 통해
  서버로 밀어올림. `budget:legacyMigratedToServer` 플래그로 기기당 1회만
  실행, 완료 후 예전 키 정리. 여러 기기가 각자 다른 로컬 데이터를 갖고 있어도
  추가/삭제 오퍼레이션이 멱등이라 순서 상관없이 안전하게 합쳐짐(같은 이름
  중복 추가는 서버에서 무시, 삭제 표시는 재추가로 복원 가능)
- `src/App.tsx` — 로그인 effect에서 `loadCategories`/`loadNoteCategories`/
  `loadSettings` 호출 전에 `migrateLegacyLocalStorage()`를 먼저 실행해,
  이 기기의 예전 데이터를 서버에 반영한 뒤에 최신 상태를 불러오도록 순서 조정

### 예상 변경 파일
- `src/lib/legacyMigration.ts`(신규), `src/App.tsx`

### 완료
- [x] `src/lib/legacyMigration.ts` 계획대로 작성
- [x] 구현 중 실제로 발견한 레이스 컨디션 하나 수정: `TransactionForm`/`NotesView`/
  `MonthlyReport`도 각자 마운트 시점에 `loadCategories()`/`loadNoteCategories()`/
  `loadSettings()`를 직접 불렀는데(58~59차), 이게 App.tsx의 마이그레이션보다
  먼저 실행되면 마이그레이션 완료 *전* 상태로 캐시가 채워져버려 방금 올린
  데이터가 화면에 안 보일 수 있었음. `migrateLegacyLocalStorage()`를 모듈
  레벨 Promise로 공유(메모이즈)하고, 저 세 컴포넌트의 마운트 effect도
  `migrateLegacyLocalStorage().then(loadXxx)` 순서로 바꿔 어느 컴포넌트가
  먼저 마운트되든 항상 마이그레이션 완료 후 값을 받도록 정리
- [x] `npx tsc -b`, `npm run lint`(oxlint) 통과
- [x] `wrangler pages dev` + 로컬 D1로 실제 상희님 상황 재현해 검증: 회원가입 →
  예전 방식 localStorage 키를 실제 스크린샷과 비슷하게 주입(지출 커스텀 11개
  + 기본 3개 삭제, 수입 커스텀 4개 + 기본 1개 삭제, 메모 분류, 정산 기준) →
  새로고침 시 자동 마이그레이션 확인(주입한 분류가 그대로 화면에 나타남,
  마이그레이션 플래그 세팅 + 예전 키 정리 확인) → 완전히 새로운 브라우저
  컨텍스트(레거시 데이터 없음)로 같은 계정 로그인만 했더니 마이그레이션된
  분류가 동일하게 동기화됨. 콘솔 에러 없음
- [x] 스키마 변경 없음(기존 58~59차 테이블·API 재사용) — DB 마이그레이션
  파일/원격 적용 불필요, 코드 배포만 진행
- [x] 미완료 항목 없음

---

## 2026-07-20 (59차) — 메모 분류 + 카드 정산 집계 기준도 서버 동기화(58차 후속)

58차에서 거래 분류를 D1로 옮겨 기기 간 동기화한 뒤, 사용자가 "모든 작업은
어디서도 같은 결과를 내야한다"는 원칙을 명시. `localStorage`만 쓰는 나머지
코드를 훑어본 결과 두 곳이 같은 문제였음(순수 기기별 편의 기능인 로그인
이메일 저장/다크모드/PWA 설치배너 닫기는 제외):
- `src/lib/noteCategories.ts` — 메모장 분류. 58차 이전 `categories.ts`와 완전히
  같은 구조(커스텀 추가/기본 삭제를 localStorage에만 저장)
- `src/components/MonthlyReport.tsx`의 "카드 지출 집계 기준"(출금일 기준/거래일
  기준) 토글 — `localStorage`의 `budget:monthlyBasis` 단일 값

사용자 확인 후 둘 다 진행하기로 함.

### 계획
- 메모 분류는 58차 거래 분류와 동일 패턴으로 복제(단, 타입 구분 없이 단일
  목록이라 더 단순): `schema.sql`/`migrations/019_add_note_categories.sql`에
  `note_categories` 테이블(`id, user_id, name, removed_default, created_at`,
  `UNIQUE(user_id, name)`) 추가, `functions/lib/noteCategories.ts`(신규,
  DEFAULT_NOTE_CATEGORIES 복제) + `functions/api/note-categories/index.ts`(신규,
  GET/POST/DELETE), `src/lib/api.ts`에 fetch/add/remove 함수 추가,
  `src/lib/noteCategories.ts`를 모듈 캐시 + `loadNoteCategories()`/
  `resetNoteCategories()`로 재작성, `src/components/NotesView.tsx` 호출부(
  `handleAddCategory`/`handleDeleteCategory`)를 async로 변경 + 마운트 시
  재동기화 effect 추가
- 카드 정산 집계 기준은 계정당 값 하나뿐이라 향후 비슷한 단일값 설정이 늘어날 걸
  감안해 범용 key-value 테이블로: `schema.sql`/같은 마이그레이션에
  `user_settings`(`user_id, key, value, updated_at`, `PRIMARY KEY(user_id, key)`)
  추가, `functions/api/settings/index.ts`(신규, GET 전체 조회/PATCH `{key,value}`
  upsert, 허용된 key 화이트리스트로 검증), `src/lib/settings.ts`(신규, 모듈
  캐시 + `loadSettings()`/`resetSettings()`/`getMonthlyBasis()`/
  `setMonthlyBasis()`), `MonthlyReport.tsx`의 `loadBasis`/`changeBasis`를
  이걸로 교체
- `src/contexts/AuthContext.tsx` — `logout()`에 `resetNoteCategories()`,
  `resetSettings()` 추가
- `src/App.tsx` — 로그인 effect에 `loadNoteCategories()`, `loadSettings()` 추가
- 마이그레이션 적용 후 `npx wrangler d1 execute budget-db --remote --file=...`로
  프로덕션 D1에도 반영, GitHub Actions 자동배포 확인

### 예상 변경 파일
- `schema.sql`, `migrations/019_add_note_categories.sql`(신규),
  `functions/lib/noteCategories.ts`(신규),
  `functions/api/note-categories/index.ts`(신규),
  `functions/api/settings/index.ts`(신규), `src/lib/api.ts`,
  `src/lib/noteCategories.ts`, `src/lib/settings.ts`(신규),
  `src/contexts/AuthContext.tsx`, `src/App.tsx`, `src/components/NotesView.tsx`,
  `src/components/MonthlyReport.tsx`

### 완료
- [x] 계획대로 전 파일 작업 완료(예상 변경 파일과 동일), `README.md` 마이그레이션
  범위(001~018→001~019)와 DB 스키마 목록에 `note_categories`/`user_settings`
  설명도 반영
- [x] `npx tsc -b`, `npm run lint`(oxlint) 통과. `functions/`는 `wrangler pages dev`의
  "Compiled Worker successfully"로 대체 확인(58차와 동일 이유)
- [x] `wrangler pages dev` + 로컬 D1(스키마 재초기화)로 실제 시나리오 검증 — 두
  건 모두 브라우저 컨텍스트 A(회원가입 후 변경) → 완전히 새로운 컨텍스트
  B(= 다른 기기 시뮬레이션, 같은 계정 로그인만) 순서로 확인:
  - 메모 분류: A에서 기본 분류 "일상" 삭제 + 커스텀 "가족모임" 추가 →
    B에서도 동일하게 만남/기념일/건강/기타/가족모임으로 정확히 동기화
  - 카드 정산 집계 기준: A에서 "거래일 기준"으로 변경 → B에서도 로그인만
    했는데 "거래일 기준"이 그대로 선택된 상태로 열림
  - 두 경우 다 콘솔 에러 없음
- [x] 프로덕션 D1에 `019_add_note_categories.sql` 마이그레이션 적용
  (`wrangler d1 execute budget-db --remote`), 커밋 push 후 GitHub Actions
  자동배포 success 확인
- [x] 미완료 항목 없음

---

## 2026-07-20 (58차) — 거래 분류(카테고리)를 서버(D1)로 이전해 기기 간 동기화

사용자가 두 폰 스크린샷을 첨부 — 같은 계정으로 로그인했는데 "내역 추가" 폼의
수입 분류 목록이 기기마다 다름(한쪽은 급여/용돈/기타수입, 다른 쪽은 기타수입/
영업수익/카카오수수료/유가보조금및충전소보조). 원인 확인: `src/lib/categories.ts`가
커스텀 분류 추가·기본 분류 삭제 내역을 서버가 아니라 각 기기의 브라우저
`localStorage`에만 저장하고 있었음 — 거래 데이터 자체는 D1에 저장돼 기기 간
동일하지만, "분류 설정"만 기기별로 따로 놀았음(계정이 아니라 브라우저에 귀속).
메모(NotesView) 쪽 분류는 `noteCategories.ts`로 완전히 별개 시스템이라 이번
범위에서 제외(메모용/거래용 분류는 항상 구분해서 다뤄야 함 — 51~54차에서도 헷갈렸던 부분).

### 계획
- `schema.sql`, `migrations/018_add_categories.sql` — `categories` 테이블 추가
  (`id, user_id, type, name, removed_default, created_at`, `UNIQUE(user_id, type,
  name)`). `removed_default=0` 행 = 사용자가 추가한 커스텀 분류, `removed_default=1`
  행 = 사용자가 삭제한 기본 분류의 "삭제됨" 표시. 기존 `budgets`/`quick_templates`와
  동일 패턴
- `functions/lib/categories.ts`(신규) — `DEFAULT_CATEGORIES`를
  `src/lib/categories.ts`와 동일하게 서버 쪽에도 복제(이 repo 컨벤션 —
  `functions/`는 `src/`를 import하지 않고 필요한 상수/로직을 자체 복제,
  56차 `settlementFilter.ts` 작업에서도 동일 패턴을 썼음)
- `functions/api/categories/index.ts`(신규) — GET(현재 계정의 분류 오버라이드를
  `{expense:{custom,removedDefaults}, income:{...}}` 형태로 반환) / POST(분류
  추가 — 기본 분류였다가 삭제된 이름이면 삭제 표시 제거로 복원) / DELETE(분류
  삭제 — 기본 분류면 삭제 표시 추가, 커스텀이면 행 삭제) 구현
- `src/lib/api.ts` — `fetchCategoryOverrides`/`addCategoryApi`/`removeCategoryApi`
  추가
- `src/lib/categories.ts` — localStorage 기반을 모듈 레벨 캐시 + 서버 동기화로
  전면 교체. `getCategories()`는 계속 동기 함수로 유지(캐시 읽기, 기존 호출부
  다수를 안 건드리기 위함)하되, 새로 `loadCategories()`(로그인 후 캐시 채움)와
  `resetCategories()`(로그아웃 시 캐시 비움, 계정 전환 시 이전 계정 분류가
  새는 것 방지) 추가. `addCustomCategory`/`removeCategory`는 서버 호출이 필요해
  Promise 반환으로 시그니처 변경(호출부 갱신 필요)
- `src/contexts/AuthContext.tsx` — `logout()`에서 `resetCategories()` 호출
- `src/App.tsx` — 로그인 후 카드/고정지출 로드하는 effect(라인 84~93 부근)에
  `loadCategories()` 추가
- `src/components/TransactionForm.tsx` — `addCustomCategory`/`removeCategory`
  호출부에 `await` 추가, 마운트 시 `loadCategories()` 완료 후 `categories`/
  `category` state를 서버 값으로 재동기화하는 effect 추가(초기 렌더 시점엔
  캐시가 비어있어 기본값만 보였다가, 로드 완료 후 실제 값으로 갱신됨)
- `src/components/CardManager.tsx` — `applyPreset` 내 `addCustomCategory` 호출에
  `await` 추가
- `src/components/BudgetManager.tsx`, `src/components/SearchView.tsx` — 모듈
  최상단에서 한 번만 계산되던 `EXPENSE_CATEGORIES`/`EXPENSE_CATS`/`INCOME_CATS`를
  컴포넌트 함수 내부로 이동(렌더마다 재계산 — 캐시가 로드된 이후 값을 반영하기 위함)

### 예상 변경 파일
- `schema.sql`, `migrations/018_add_categories.sql`(신규),
  `functions/lib/categories.ts`(신규), `functions/api/categories/index.ts`(신규),
  `src/lib/api.ts`, `src/lib/categories.ts`, `src/contexts/AuthContext.tsx`,
  `src/App.tsx`, `src/components/TransactionForm.tsx`,
  `src/components/CardManager.tsx`, `src/components/BudgetManager.tsx`,
  `src/components/SearchView.tsx`

### 완료
- [x] 계획대로 전 파일 작업 완료(예상 변경 파일과 동일), 추가로 `README.md`
  마이그레이션 범위(001~017→001~018)와 DB 스키마 목록에 `categories` 테이블
  설명 반영
- [x] `BudgetManager.tsx`/`SearchView.tsx`의 모듈 최상단(import 시점) 1회성
  `getCategories()` 호출(`EXPENSE_CATEGORIES`/`EXPENSE_CATS`/`INCOME_CATS`)을
  컴포넌트 함수 내부로 이동 — 그대로 두면 서버 로드가 끝나기 전 시점(캐시가
  비어있을 때) 값이 고정돼버려서 이번 변경과 함께 반드시 고쳐야 했음
- [x] `npx tsc -b`, `npm run lint`(oxlint) 통과. `functions/`는 이 프로젝트에
  애초에 tsconfig 커버리지가 없어(기존부터 그랬음, 이번에 새로 생긴 문제 아님)
  `wrangler pages dev`의 "Compiled Worker successfully"로 대체 확인
- [x] `wrangler pages dev` + 로컬 D1(스키마 재초기화)로 실제 시나리오 검증:
  브라우저 컨텍스트 A(회원가입)에서 수입 분류 관리 모드로 기본 분류 "급여" 삭제 +
  커스텀 분류 "영업수익" 추가 → 완전히 새로운 브라우저 컨텍스트 B(= 별도
  localStorage, 다른 기기 시뮬레이션)로 같은 계정 로그인만 하고 "내역 추가"
  폼을 열어보니 A와 동일하게 급여 없음·영업수익 있음으로 정확히 동기화됨(스크린샷
  확인, 콘솔 에러 없음) — 사용자가 제보한 버그 재현 후 해결 확인
- [x] 미완료 항목 없음

---

## 2026-07-19 (57차) — GitHub Actions로 push 자동배포 설정

`budget` Cloudflare Pages 프로젝트가 Direct Upload로 생성돼 있어(`wrangler pages
project list`의 Git Provider 컬럼이 "No") 지금까지 `npm run deploy`를 수동으로
실행해야 했음. 사용자의 다른 프로젝트(wedding-admin, wedd)는 Git 연동이라 push만
하면 자동배포됨 — 같은 경험을 원함. 조사 결과 Cloudflare는 기존 Direct Upload
프로젝트를 나중에 Git 연동으로 전환하는 기능을 제공하지 않음(공식 문서·커뮤니티
확인, 새 프로젝트를 Git 연동으로 새로 만들어야 함 — 그러면 D1/R2 바인딩과 배포
URL을 처음부터 다시 설정해야 해서 지금은 보류). 대신 기존 프로젝트/바인딩/도메인을
그대로 유지하면서 GitHub Actions가 push마다 `wrangler pages deploy`를 대신
실행하도록 설정하기로 사용자와 합의. 나중에 큰 개편이 필요해지면 그때 Git 연동
새 프로젝트로 옮기기로 함(사용자 코멘트).

### 계획
- `.github/workflows/deploy.yml`(신규) — main 브랜치 push 시
  `cloudflare/wrangler-action@v4`로 빌드 후 `wrangler pages deploy dist
  --project-name=budget` 실행
- GitHub 저장소 시크릿 `CLOUDFLARE_API_TOKEN`(Pages 편집 권한 토큰), 저장소
  시크릿 `CLOUDFLARE_ACCOUNT_ID`(계정 ID: `558c8a68615e0f4d92f8d31c8816e799`,
  민감정보 아님) 등록 — 이건 사용자가 Cloudflare/GitHub 대시보드에서 직접
  진행(토큰 값은 대화에 노출하지 않는 게 안전해서 Claude가 대신 등록하지 않음)

### 예상 변경 파일
- `.github/workflows/deploy.yml`(신규)

### 완료
- [x] `.github/workflows/deploy.yml` 작성 — main push 시
  `actions/checkout` → `actions/setup-node`(22, npm 캐시) → `npm ci` →
  `npm run build` → `cloudflare/wrangler-action@v4`로
  `wrangler pages deploy dist --project-name=budget` 실행
- [x] GitHub 저장소 시크릿(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) 등록 —
  사용자가 Cloudflare 대시보드에서 Pages 편집 권한 토큰 발급 후 GitHub 저장소
  시크릿으로 직접 등록 완료
- [x] 시크릿 등록 후 실제 push로 자동배포 동작 확인 — 빈 커밋(`5e15d9b`)으로
  워크플로 재실행 트리거, GitHub Actions run `29681689255` `success`로 완료
  확인(GitHub API로 상태 조회, `gh` CLI 미설치라 `api.github.com` REST 호출로 대체).
  이제 main push마다 Cloudflare Pages 자동배포됨 — `npm run deploy` 수동 실행
  불필요

---

## 2026-07-19 (56차) — 정산 섹션 통합("정산" 탭 하나로) + 분류별 필터 조회

사용자 요청: "정산 섹션을 하나로 통합하고 거기에 선택하는 방식으로 일간 주간 월간
연간을 나누고 여기서 등록할 때 선택한 분류별로 조회가 가능하면 좋겠어". 확인 결과
현재 최상단 메뉴에 "한눈에 보기"(일간·주간·월간·연간 선택 표, `OverviewView.tsx`)와
별도로 "월정산"(카드 청구 기준 정산, `MonthlyReport.tsx`)·"연정산"(연간 차트+엑셀
내보내기, `AnnualReport.tsx`) 탭이 중복 존재. 사용자에게 확인(AskUserQuestion)한
결과: (1) 세 탭을 전부 하나로 통합(월정산/연정산 탭 제거, 기능은 통합 화면 안의
서브 기능으로 유지), (2) 분류 필터는 하나 선택 시 그 분류만, 여러 개 선택 시
합산해서 보기 — 둘 다 지원(다중 선택, 선택 0개 = 전체).

### 계획
- `src/lib/settlementFilter.ts`(신규) — 백엔드 `classifyIncomeGroup`과 동일한
  수입 분류→그룹(소득/예금인출/기타) 매핑을 클라이언트에도 복제해, 선택한 수입
  분류를 표의 그룹 열 필터링에 사용
- `src/components/CategoryFilterBar.tsx`(신규) — 지출+수입 분류 전체를 칩으로
  나열하는 다중 선택 필터 UI("전체" 버튼으로 초기화)
- `src/components/OverviewView.tsx` — 상단에 `CategoryFilterBar` 추가(선택 상태를
  서브탭 전환과 무관하게 유지), 월간/연간 서브탭에 각각 "분류별 표" ↔
  "카드별 청구"(`MonthlyReport`) / "차트·내보내기"(`AnnualReport`) 토글 추가.
  월/연도 상태를 `OverviewView`가 소유해 토글 전환 시에도 유지, 날짜 네비게이션은
  서브탭당 한 번만 렌더링
- `src/components/DailySettlement.tsx`, `WeeklySettlement.tsx`,
  `MonthlySettlementTable.tsx`, `AnnualSettlementTable.tsx` — `categories?: string[]`
  prop 추가해 선택된 분류만 필터링(선택 0개면 기존과 동일). Monthly/Annual은
  내부 월/연도 state·네비게이션 UI를 제거하고 `month`/`year`를 prop으로 받도록 변경
- `src/components/MonthlyReport.tsx`, `AnnualReport.tsx` — `categories` prop 추가해
  집계 전 거래 목록을 필터링. `month`/`year`도 계속 prop으로 받되(기존과 동일),
  자체 네비게이션 UI는 없었으므로 그대로 유지
- `src/App.tsx` — `Tab` 타입에서 `'monthly'`/`'annual'` 제거, 최상단 메뉴에서
  월정산/연정산 항목 삭제, "한눈에 보기" 탭 라벨을 "정산"으로 변경, 헤더의
  월/연도 네비게이션 중 monthly/annual 탭 전용 분기 제거(OverviewView 내부로 이동),
  `OverviewView`에 `cards` prop 전달, 홈 화면 "한눈에 보기 →" 버튼 문구 갱신
- `workers/card-settlement-notifier/src/index.ts` — 카드 정산 push 알림 딥링크
  `/?tab=monthly` → `/?tab=overview&view=monthly`로 변경(월정산 탭 삭제로 깨지는
  링크 수정), `OverviewView`가 `?view=monthly` 쿼리로 초기 서브탭을 월간+카드별
  청구 토글로 열도록 처리

### 예상 변경 파일
- `src/lib/settlementFilter.ts`(신규), `src/components/CategoryFilterBar.tsx`(신규),
  `src/components/OverviewView.tsx`, `src/components/DailySettlement.tsx`,
  `src/components/WeeklySettlement.tsx`, `src/components/MonthlySettlementTable.tsx`,
  `src/components/AnnualSettlementTable.tsx`, `src/components/MonthlyReport.tsx`,
  `src/components/AnnualReport.tsx`, `src/App.tsx`,
  `workers/card-settlement-notifier/src/index.ts`

### 완료
- [x] 계획대로 전 파일 작업 완료(예상 변경 파일과 동일)
- [x] 최상단 메뉴는 이제 홈/정산/카드/고정/예산/메모/검색 7개 — "정산" 탭 하나에
  일간·주간·월간·연간 선택 + 분류 필터 칩 바(전체/지출 8종/구분선/수입 3종) +
  월간·연간 서브탭의 "분류별 표 ↔ 카드별 청구/차트·내보내기" 토글이 모두 들어감.
  월/연도 상태는 `OverviewView`가 소유해 두 토글 화면이 같은 월/연도를 공유
- [x] 분류 필터는 순수 클라이언트 필터링(백엔드 API·스키마 변경 없음) — 일간은
  거래 목록을 직접 필터링, 주/월/연 표는 선택된 지출 분류 열 + 매핑된 수입
  그룹(소득/예금인출/기타) 열만 남기고 합계도 필터된 열 기준으로 재계산.
  전일잔액/오늘잔액 등 실제 잔액 값은 필터와 무관하게 항상 원본 유지
- [x] `npx tsc -b`, `npm run lint`(oxlint) 통과
- [x] `wrangler pages dev` + 로컬 D1으로 실제 회원가입 → 거래 시딩(여러 달·분류) →
  정산 탭의 일간/주간/월간(표·카드별 청구)/연간(표·차트+엑셀 내보내기) 전 화면과
  분류 필터(식비 단일 선택 시 지출내용·지출합계·표 열이 정확히 좁혀짐, 잔액은
  불변) 브라우저로 직접 확인, 콘솔 에러 없음
- [x] `card-settlement-notifier` 워커의 push 딥링크(`/?tab=overview&view=monthly`)는
  `OverviewView`가 `?view=monthly` 쿼리를 읽어 월간+카드별 청구로 여는 로직까지
  코드로는 연결해뒀으나, 실제 push 알림 클릭 딥링크 자체는 이번 세션에서
  브라우저로 검증하지 못함(로컬에서 VAPID push 발송까지 재현하지 않음) — 다음
  세션에서 필요하면 실제 카드 마감 알림을 받아보며 확인
- [x] 미완료 항목 없음(위 딥링크 클릭 자체 검증 제외)

---

## 2026-07-18 (55차) — README 갱신 (51~54차 기능 반영, 세션 마무리)

51~54차(메모 이미지 첨부, 메모/거래 분류 삭제 관리)가 README에 전혀 반영 안
돼 있어 사용자 요청으로 갱신. 문서만 고치는 작업이라 별도 시작 커밋 없이
한 번에 커밋.

### 완료
- [x] 기술 스택 표에 "오브젝트 스토리지(Cloudflare R2)" 행 추가
- [x] "홈" 섹션에 분류 직접 추가/삭제 관리 설명 추가
- [x] "메모장" 섹션에 분류 삭제 관리 + 스크린샷 첨부(비공개 R2) 설명 추가
- [x] 프로젝트 구조 트리에 `functions/api/notes/image/[id].ts`,
  `functions/lib/noteImages.ts` 추가
- [x] DB 스키마 블록의 `notes`에 `image_key`, `quick_templates`에 `memo`
  추가(016차에서 이미 추가됐던 컬럼인데 README에 누락돼 있던 것도 같이 수정)
- [x] `migrations/` 주석의 "001~014" → "001~017"로 최신화

### 다음 세션 시작 시 참고
- 51~54차, 이번 55차까지 전부 완료 및 배포 완료(55차는 문서만 수정, 배포 대상
  없음), 미완료 항목 없음

---

## 2026-07-18 (54차) — 거래 입력 폼의 "분류"에도 삭제 관리 기능 추가

사용자가 스크린샷(`/home/h/사진/스크린샷/스크린샷 2026-07-18 15-24-39.png`)으로 지적:
51~53차에서 작업한 건 메모(NotesView) 화면의 분류였는데, 사용자가 애초에 원했던
건 "내역 추가"(거래 입력 폼, `TransactionForm.tsx`)의 "분류" 섹션(식비/교통/
주거·공과금/의료/문화·여가/쇼핑/교육/경조사/기타)이었음. 메모 쪽 작업은 그대로 두고
(사용자 지시: "그건그냥 두고") 거래 분류 쪽에 동일한 삭제 관리 기능을 추가.

### 계획
- `src/lib/categories.ts` — `noteCategories.ts`(53차)와 동일한 패턴으로 재구성:
  기본 분류(타입별 `DEFAULT_CATEGORIES`)도 삭제 가능하도록 "삭제된 기본 분류" 목록을
  타입별 별도 localStorage 키(`budget:categories:${type}:removedDefaults`)에 저장,
  `removeCategory(type, name)` 신규 추가(기본/커스텀 구분 없이 삭제), 삭제한 기본
  분류를 같은 이름으로 재입력하면 복원
- `src/components/TransactionForm.tsx` — "분류" 라벨 옆에 톱니바퀴 아이콘(Settings2)
  전용 토글 버튼 추가(51~53차와 동일한 아이콘 전용 UI, 이 폼에 이미 있는
  "관리"/"완료" 텍스트 방식 빠른 입력 템플릿 관리 UI와는 별개로 사용자가 지정한
  아이콘 방식을 그대로 적용). 삭제 모드에서 모든 분류 칩(기본 포함)에 × 표시,
  클릭 시 확인 후 삭제. 타입 전환(지출/수입)·거래 복제/수정 프리필 시
  삭제 모드 초기화
- 영향 범위 확인: `getCategories`/`addCustomCategory`를 쓰는 다른 화면들
  (WeeklySettlement, SearchView, AnnualSettlementTable, CardManager,
  MonthlySettlementTable, BudgetManager, RecurringManager, TransactionList)은
  삭제된 분류가 목록에서 빠지는 것 외엔 영향 없음(거래에 이미 저장된 분류 텍스트는
  그대로 유지, FK 제약 없음) — 이번 삭제 관리 UI 자체는 `TransactionForm.tsx`에만 추가

### 예상 변경 파일
- `src/lib/categories.ts`, `src/components/TransactionForm.tsx`

### 완료
- [x] `src/lib/categories.ts` — `removeCategory(type, name)` 추가, 타입별
  `removedDefaults` localStorage 키로 기본 분류 삭제 지원, `addCustomCategory`에
  삭제한 기본 분류 복원 분기 추가
- [x] `src/components/TransactionForm.tsx` — "분류" 라벨 옆 톱니바퀴 아이콘 전용
  토글(`manageCategories` 상태), 삭제 모드에서 모든 칩(기본 포함)에 × 표시 +
  클릭 시 확인 모달 경유 삭제. `handleTypeChange`/`applyPrefill`(복제·수정
  프리필 공용)에 `setManageCategories(false)` 추가해 지출/수입 전환이나 다른
  거래를 불러올 때 삭제 모드가 남아있지 않도록 처리
- [x] `npx tsc -b`, `npm run lint`, `npm run build` 통과

### 검증 결과
- `wrangler pages dev` + Chrome/playwright-core(CDP)로 확인(재로드 전 서비스워커/
  캐시 정리 후 진행): 사용자가 지적한 스크린샷과 동일한 "내역 추가" 폼의 "분류"
  섹션에서 톱니 버튼이 텍스트 없이 아이콘만 있는 것 확인 → 클릭 시 기본 분류
  "기타"에도 × 표시 → 클릭 → "'기타' 분류를 삭제할까요? 이미 이 분류로 저장된
  거래는 그대로 남습니다" 확인 모달(스크린샷 직접 확인) → 확인 → 목록에서 정확히
  제거됨(남은 8개 기본 분류만 확인됨) → 지출→수입 전환 시 분류가 급여/용돈/
  기타수입으로 정확히 바뀌고 삭제 모드도 자동으로 꺼지는("+ 직접입력" 버튼 재노출)
  것 확인

### 배포
- 순수 프론트엔드(localStorage) 변경, D1/R2 작업 없음
- `npm run deploy` 완료 — https://f1ada081.budget-3wb.pages.dev

---

## 2026-07-18 (53차) — 메모 분류 삭제: 기본 분류도 삭제 가능 + UI를 톱니 아이콘으로 단순화

사용자 피드백(52차 결과물에 대해): "모든 분류를 삭제 관리가 가능해야한다 그리고
관리모드가 뭐야 그냥 톱니누르면 떠야지?" — 두 가지 지적:
1. 기본 제공 분류(일상/만남/기념일/건강/기타)는 삭제 못 하게 막아뒀는데, 전부
   삭제 가능해야 함
2. "관리"/"완료" 텍스트 토글 버튼이 불필요하게 복잡함 — 그냥 톱니바퀴 아이콘
   버튼 하나만 누르면 바로 삭제 모드가 뜨는 게 맞음(아이콘 자체가 곧 트리거)

### 계획
- `src/lib/noteCategories.ts` — 기본 분류 삭제를 지원하기 위해 저장 구조 변경:
  기존엔 커스텀 추가분만 localStorage에 저장했는데, 이제 "삭제된 기본 분류
  목록"도 별도 키(`budget:noteCategories:removedDefaults`)에 저장. 기존
  `removeCustomNoteCategory`/`isDefaultNoteCategory`를 없애고 `removeNoteCategory`
  하나로 통합(기본/커스텀 구분 없이 전부 삭제 가능). 삭제했던 기본 분류 이름을
  "+ 직접입력"으로 다시 추가하면 복원되도록 처리
- `src/components/NotesView.tsx` — 분류 칩 목록 우측의 "관리"/"완료" 텍스트 버튼을
  톱니바퀴 아이콘(Settings2) 전용 원형 버튼으로 교체(텍스트 라벨 제거, 클릭으로
  토글은 유지하되 UI는 아이콘 하나). 삭제 모드에서는 기본/커스텀 구분 없이 모든
  칩에 × 표시

### 예상 변경 파일
- `src/lib/noteCategories.ts`, `src/components/NotesView.tsx`

### 완료
- [x] `src/lib/noteCategories.ts` — `removeCustomNoteCategory`/`isDefaultNoteCategory`
  제거, `removeNoteCategory(name)`으로 통합(기본 분류는
  `budget:noteCategories:removedDefaults` 키에 삭제 목록으로 기록, 커스텀 분류는
  기존처럼 목록에서 직접 제거). `addCustomNoteCategory`에 "삭제했던 기본 분류
  이름을 다시 입력하면 복원" 분기 추가
- [x] `src/components/NotesView.tsx` — "관리"/"완료" 텍스트 버튼을 톱니바퀴
  아이콘(Settings2) 전용 원형 버튼(`aria-label="분류 삭제"`/`"분류 삭제 모드 종료"`)
  으로 교체. 삭제 모드에서는 `isDefaultNoteCategory` 분기 없이 모든 칩(기본 포함)에
  × 표시가 붙도록 단순화
- [x] `npx tsc -b`, `npm run lint`, `npm run build` 통과

### 검증 결과
- `wrangler pages dev` + Chrome/playwright-core(CDP)로 확인(이전 세션과 동일하게
  재로드 전 서비스워커/캐시 강제 정리 후 진행): 톱니 버튼이 텍스트 라벨 없이
  아이콘만 있는 것 확인(`textContent`가 빈 문자열), 클릭 시 **기본 분류("일상")
  에도 × 표시가 뜨는 것** 확인 → 기본 분류 "건강" 삭제 시도 → 확인 모달 → 확인 →
  목록에서 "건강"이 정확히 사라지는 것 확인(스크린샷으로 직접 확인)

### 배포
- 순수 프론트엔드(localStorage) 변경, D1/R2 작업 없음
- `npm run deploy` 완료 — https://92a224ed.budget-3wb.pages.dev

---

## 2026-07-18 (52차) — 메모 분류(카테고리) 삭제 기능 추가

사용자 요청: "분류 탭도 관리 버튼 만들어서 삭제가 가능해야 할거같은데?" — 메모
작성/수정 폼의 카테고리 선택 칩("일상", "만남" 등)에 "관리" 버튼을 추가해 사용자가
직접 추가한 분류를 삭제할 수 있게 함. 분류는 `src/lib/noteCategories.ts`에서
localStorage(`budget:noteCategories`)로 브라우저별 저장되고 있음(서버 API 없음,
기존 구조 그대로 유지).

### 계획
- `src/lib/noteCategories.ts` — `removeCustomNoteCategory(name)`(localStorage에서
  제거), `isDefaultNoteCategory(name)`(기본 5종은 삭제 불가하도록 판별) 추가
- `src/components/NotesView.tsx` — 카테고리 칩 목록 옆에 "관리" 토글 버튼 추가.
  관리 모드일 때 사용자 정의 분류 칩에는 우측에 삭제(×) 표시가 붙고 클릭 시
  확인 후 삭제(기본 분류는 관리 모드에서도 삭제 버튼 없이 그대로 선택만 가능).
  이미 그 분류로 저장된 기존 메모는 데이터가 그대로 남고(카테고리 텍스트만 유지),
  선택지 목록에서만 사라짐

### 예상 변경 파일
- `src/lib/noteCategories.ts`, `src/components/NotesView.tsx`

### 완료
- [x] `src/lib/noteCategories.ts` — `removeCustomNoteCategory`, `isDefaultNoteCategory`
  추가
- [x] `src/components/NotesView.tsx` — 카테고리 칩 줄 우측에 "관리"/"완료" 토글 버튼
  추가(`manageCategories` 상태). 관리 모드에서 사용자 정의 분류 칩은 클릭 동작이
  선택 대신 삭제(확인 모달 경유)로 바뀌고 우측에 빨간 × 아이콘 표시, 기본 5종
  분류는 관리 모드에서도 × 없이 그대로 선택만 가능하도록 분기. 메모 작성/수정
  시작·취소 시 관리 모드도 함께 초기화되도록 `startAdd`/`startEdit`/`cancelEdit`에
  `setManageCategories(false)` 추가
- [x] `npx tsc -b`, `npm run lint`, `npm run build` 통과

### 검증 결과
- `wrangler pages dev` + Chrome/playwright-core(CDP)로 실제 화면 확인: 메모 작성 폼에서
  "+ 직접입력"으로 커스텀 분류 2개("쇼핑", "테스트용삭제될분류") 추가 → "관리" 클릭 →
  기본 분류(일상 등 5종)에는 × 표시 없음, 커스텀 분류에만 × 표시되는 것 확인 →
  커스텀 분류 클릭 → "OO 분류를 삭제할까요? 이미 이 분류로 저장된 메모는 그대로
  남습니다" 확인 모달 노출(스크린샷으로 직접 확인) → 확인 클릭 → 목록에서 정확히
  제거됨 → "완료" 클릭 시 관리 모드 종료되고 "+ 직접입력" 버튼이 다시 노출되는 것 확인
- 재배포 후 브라우저에 남아있던 예전 서비스워커가 새 번들을 안 물고 있어서(과거
  44~46차에도 기록된 현상) 처음엔 새로 추가한 "관리" 버튼이 아예 안 보였음 —
  `navigator.serviceWorker.getRegistrations()` 전체 unregister + `caches` 전체 삭제
  후 새로고침으로 해결. 실사용자는 짧은 시간에 여러 번 재배포된 탭을 계속 붙들고
  있지 않아 정상적으로는 안 겪는 상황(과거 기록과 동일한 결론)

### 배포
- 서버 API/스키마 변경이 없는 순수 프론트엔드(localStorage) 기능이라 D1/R2 작업 없음
- `npm run deploy` 완료 — https://b022518a.budget-3wb.pages.dev

---

## 2026-07-18 (51차) — 메모에 이미지(스크린샷) 첨부 기능 추가

사용자 요청: "스크릿샷 첨부해서 지출중에 기억하고싶은 상품 기록하려고 하는데 메모에
첨부 기능 만들어줘". 지출 중 기억하고 싶은 상품의 스크린샷을 메모(NotesView)에 첨부.
메모 내용이 개인 지출/구매 정보라 사용자와 상의 후 **비공개(인증 API 경유) + 메모당
1장** 방식으로 결정(기존 카드 이미지 R2 버킷은 카드사 로고라 공개 URL이었지만 이번엔
사용자 개인 사진이라 다른 방식 필요).

### 계획
- 새 R2 버킷 `budget-note-images` 신규 생성(카드 이미지 버킷과 달리 **공개 r2.dev
  액세스는 켜지 않음** — 인증된 Function 엔드포인트로만 서빙)
- `wrangler.toml` — `[[r2_buckets]]` `NOTE_IMAGES` 바인딩 추가
- `migrations/017_add_notes_image.sql` — `notes.image_key TEXT` 컬럼 추가(R2 오브젝트
  키, 이미지 없으면 NULL), `schema.sql` 동기화, 로컬+원격 D1 적용
- `functions/api/notes/index.ts`(POST), `[id].ts`(PATCH/DELETE) — JSON 대신
  `multipart/form-data` 파싱으로 전환(이미지 파일 포함 위해). 이미지 타입(JPEG/PNG/
  WEBP/GIF)/용량(5MB) 서버 검증, R2 키는 `notes/{note_id}` 고정(메모당 1장이라 덮어쓰기
  방식), 메모 삭제/이미지 교체/제거 시 R2 오브젝트도 함께 정리
- `functions/api/notes/image/[id].ts`(신규) — `GET /api/notes/image/:id`, 본인 메모의
  이미지만 R2에서 스트리밍 응답(소유권 확인 후 서빙)
- `src/types.ts` — `Note.image_key: string | null`
- `src/lib/api.ts` — `saveNote`/`updateNote`를 FormData 기반으로 전환, `noteImageUrl(id)`
  헬퍼 추가
- `src/components/NotesView.tsx` — 메모 작성/수정 폼에 이미지 파일 선택 입력(썸네일
  미리보기, 제거 버튼) 추가, 메모 목록/달력 상세에 첨부 이미지 썸네일 표시(클릭 시 원본
  새 탭에서 열기 — `<img>` 태그라 세션 쿠키로 인증되어 정상 로드됨)

### 예상 변경/신규 파일
- `wrangler.toml`, `migrations/017_add_notes_image.sql`(신규), `schema.sql`
- `functions/api/notes/index.ts`, `functions/api/notes/[id].ts`,
  `functions/api/notes/image/[id].ts`(신규)
- `src/types.ts`, `src/lib/api.ts`, `src/components/NotesView.tsx`

### 완료
- [x] R2 버킷 `budget-note-images` 신규 생성(`wrangler r2 bucket create`, 퍼블릭 액세스
  켜지 않음). `wrangler.toml`에 `NOTE_IMAGES` 바인딩 추가
- [x] `migrations/017_add_notes_image.sql`(`notes.image_key TEXT` 컬럼) + `schema.sql`
  동기화, 로컬/원격 D1 둘 다 적용 완료
- [x] `functions/lib/noteImages.ts`(신규) — 이미지 타입(JPEG/PNG/WEBP/GIF)/용량(5MB)
  검증 로직을 index.ts/[id].ts에서 공용으로 사용
- [x] `functions/api/notes/index.ts`(POST) — `multipart/form-data`로 전환, 이미지
  첨부 시 R2에 `notes/{note_id}` 키로 업로드 후 `image_key` 저장
- [x] `functions/api/notes/[id].ts`(PATCH/DELETE) — PATCH는 이미지 교체(같은 키
  덮어쓰기)/제거(`removeImage=1`) 지원, DELETE는 메모 삭제 시 R2 오브젝트도 함께 삭제
- [x] `functions/api/notes/image/[id].ts`(신규) — 본인 메모 소유권 확인 후 R2에서
  이미지 스트리밍 응답(`Cache-Control: private`, `ETag`)
- [x] `src/types.ts`(`Note.image_key`), `src/lib/api.ts`(`saveNote`/`updateNote`
  FormData 전환, `noteImageUrl` 헬퍼)
- [x] `src/components/NotesView.tsx` — 작성/수정 폼에 파일 첨부 필드(선택 전 드래그
  아이콘 버튼 → 선택 후 미리보기+제거(X) 버튼, 수정 시 기존 첨부 이미지도 동일한
  방식으로 표시/제거), 메모 목록/달력 상세에 첨부 썸네일 표시(클릭 시 새 탭에서 원본)
- [x] `npx tsc -b`, `npm run lint`, `npm run build` 통과. Functions 코드는 애드혹
  `tsc --noEmit --ignoreConfig --lib es2022`로 별도 확인(루트 tsconfig에 안 걸림, DOM
  lib과 workers-types 충돌 방지 위해 `--lib es2022`만 지정)

### 검증 결과
- `wrangler pages dev`(로컬 D1+R2 전부 실제 바인딩) + curl로 API 전 경로 직접 검증:
  회원가입 → 이미지 포함 메모 생성(201, `image_key: notes/{id}`) → 목록 조회에 정확히
  반영 → 이미지 엔드포인트에서 원본과 바이트 단위로 동일한 파일 수신(diff 없음) →
  **인증 없이 조회 시 401**, **다른 사용자 계정으로 조회 시 404**(소유권 확인 정상) →
  PATCH로 이미지 교체 시 새 파일로 정확히 덮어써짐 → PATCH `removeImage=1`로 제거 시
  `image_key`가 null로 바뀌고 이미지 엔드포인트 404 → 메모 삭제 시 R2 오브젝트도 같이
  삭제되어 이후 조회 404 → 이미지 아닌 파일 첨부 시 400, 5MB 초과 파일 첨부 시 400
  전부 확인
- Chrome + playwright-core(CDP 직결)로 실제 브라우저 화면 확인: 로그인 → 메모 탭 →
  "메모 추가" → "스크린샷/사진 첨부" 버튼으로 파일 선택 → 저장 전 미리보기 노출 확인 →
  저장 후 목록에 썸네일이 올바른 비율(600×400 테스트 이미지 → 143×96px, `max-h-24`
  제약에 맞게 정확히 스케일)로 렌더링되는 것 시각 확인(스크린샷으로 직접 캡처).
  1×1 픽셀짜리 극단적으로 작은 테스트 이미지로는 썸네일이 거의 안 보이는 크기로
  나오는데(이건 버그가 아니라 이미지 자체가 1px이라 당연한 현상 — 실제 스크린샷은
  이 문제가 없음을 600×400 이미지로 재확인함), 실사용 시나리오에 해당하는 현실적인
  크기의 이미지로는 정상적으로 잘 보이는 것을 확인
- 이번 세션에서도 Chrome CDP 스크린샷/evaluate 호출이 간헐적으로 응답 없이 멈추는
  현상이 여러 번 발생(과거 42~46차 WORKLOG에도 동일 현상 기록됨, 이 환경 자체의
  고질적 문제로 보임) — Chrome 프로세스를 완전히 재시작하는 방식으로 우회하며 진행
- 검증에 쓴 playwright 스크립트/테스트 이미지는 세션 스크래치패드에만 있고 저장소에는
  커밋 안 함(일회성 수동 검증용). 로컬 D1의 테스트 계정/메모는 로컬 전용 dev 데이터라
  정리 없이 그대로 둠(운영 D1과 무관)

### 배포
- 원격 D1에 `migrations/017_add_notes_image.sql` 적용 완료, R2 버킷 `budget-note-images`
  원격 생성 완료(퍼블릭 액세스 미설정)
- `npm run deploy` 완료 — https://72b865f9.budget-3wb.pages.dev

---

## 2026-07-18 (50차) — 홈 화면 설치 PWA에서 삭제 확인 버튼이 반응 없는 버그 수정

사용자 리포트: "기존에 추가된 템플릿내용 삭제 하기 버튼이 반응이 없네" — 확인해보니
홈 화면에 설치한 PWA(standalone 모드)에서만 발생. 원인은 `window.confirm()`이 일부
플랫폼의 standalone 모드 PWA에서 아예 표시되지 않고 조용히 무시되는(즉시 false 반환)
잘 알려진 제약. 템플릿 삭제뿐 아니라 앱 전체에서 `window.confirm()`을 쓰는 곳 8곳이
전부 같은 문제를 겪고 있어서(거래/예산/카드/카드혜택/메모/고정지출 삭제, 카드 혜택
프리셋 재적용 확인) 전부 앱 내장 확인 모달로 교체.

### 예상 작업 항목
- `src/contexts/ConfirmContext.tsx`(신규) — `ToastContext` 패턴을 본떠
  `useConfirm(): (message: string) => Promise<boolean>` 훅 제공(Promise를 상태에
  들고 있다가 사용자가 확인/취소 누르면 resolve)
- `src/components/ConfirmDialog.tsx`(신규) — 실제 렌더되는 모달 UI
- `src/main.tsx` — `ConfirmProvider`/`<ConfirmDialog />` 연결(Toast와 동일한 위치)
- 8곳 교체: `TransactionForm.tsx`, `TransactionList.tsx`, `NotesView.tsx`,
  `CardManager.tsx`(3곳: 프리셋 재적용/카드 삭제/혜택 삭제), `RecurringManager.tsx`,
  `BudgetManager.tsx` — `window.confirm(...)` → `await confirm(...)`(동기 함수인
  `TransactionList.tsx`의 `handleDelete`는 async로 전환 필요)

### 완료
- [x] `src/contexts/ConfirmContext.tsx`, `src/components/ConfirmDialog.tsx` 신규
  작성, `src/main.tsx`에 `ConfirmProvider`/`<ConfirmDialog />` 연결
- [x] 8곳 전부 `useConfirm()`으로 교체(`TransactionList.tsx`의 `handleDelete`는
  `async function`으로 전환)
- [x] `npx tsc -b`, `npm run lint` 통과
- [x] `wrangler pages dev` + playwright-core로 실제 확인 — 특히 `window.confirm`을
  호출 시 예외를 던지도록 완전히 무력화한 상태에서도(standalone에서 무시되는 상황을
  더 강하게 재현) 삭제 플로우가 정상 동작하는지 검증: 삭제 클릭 → 커스텀 모달
  노출(네이티브 dialog 이벤트 전혀 안 뜸) → 취소 시 항목 유지 → 재시도 후 확인 시
  정상 삭제. 콘솔 에러 없음

### 배포
- `npm run deploy` 완료 — https://3a736a98.budget-3wb.pages.dev
- PWA는 `self.skipWaiting()` + `clients.claim()`이 이미 적용돼 있어 새로고침 한
  번이면 최신 SW로 갱신됨. 그래도 안 바뀌어 보이면 홈 화면 앱을 완전히 종료 후
  재실행 권장

## 2026-07-18 (49차) — 빠른 입력 템플릿 메모 저장 누락 버그 수정

사용자 리포트: "템플릿 저장하면 메모가 저장 되는게 중요한데 지금 이게 안되는데?"
확인해보니 `quick_templates` 테이블에 애초에 `memo` 컬럼 자체가 없어서(label, type,
category, amount, merchant, payment_method, card_id, sort_order만 있음)
`TransactionForm.tsx`의 템플릿 저장/적용 로직도 memo를 아예 다루지 않고 있었음.

### 예상 작업 항목
- `migrations/016_*.sql` — `quick_templates`에 `memo TEXT DEFAULT ''` 컬럼 추가
  (ALTER TABLE ADD COLUMN, 015와 달리 NOT NULL 제약 변경이 아니라 테이블 재생성
  불필요), `schema.sql` 동기화, 로컬+원격 D1 적용
- `functions/api/templates/index.ts`(POST), `[id].ts`(PATCH) — memo 필드 저장/수정
- `src/types.ts` — `QuickTemplate.memo`, `NewQuickTemplate.memo?`
- `src/components/TransactionForm.tsx` — `handleSaveAsTemplate`에서 memo 전송,
  `applyTemplate`에서 memo 복원(현재 `applyPrefill` 호출 시 `memo: ''`로 하드코딩된
  부분 수정)

### 완료
- [x] `migrations/016_quick_templates_add_memo.sql`(ALTER TABLE ADD COLUMN, 테이블
  재생성 불필요) + `schema.sql` 동기화, 로컬/원격 D1 둘 다 적용 확인
- [x] `functions/api/templates/index.ts`, `[id].ts` — memo 저장/수정 지원
- [x] `src/types.ts` — `QuickTemplate.memo: string`, `NewQuickTemplate.memo?: string`
- [x] `TransactionForm.tsx` — `applyTemplate`에서 `memo: t.memo`로 복원,
  `handleSaveAsTemplate`에서 `memo: memo.trim() || undefined` 전송
- [x] `npx tsc -b`, `npm run lint` 통과
- [x] `wrangler pages dev` + playwright-core로 실제 확인: 메모 입력 후 템플릿 저장 →
  폼에 다른 메모를 채워둔 상태에서 템플릿 재적용 → 저장했던 메모("아이스아메리카노
  2잔, 회의용")로 정확히 덮어써지는 것 확인

### 배포
- `npm run deploy` 완료 — https://2dce3f92.budget-3wb.pages.dev

## 2026-07-18 (48차) — 서비스명 "텅장" → "텅~ 장" 변경

사용자 요청으로 서비스 표기명을 "텅장"에서 "텅~ 장"으로 변경. 사용자에게 노출되는
브랜딩 위치를 전부 찾아서 교체(과거 작업 기록인 이 WORKLOG의 지난 항목들은 그
시점 기준 사실이라 그대로 둠).

### 완료
- [x] `index.html` — `<title>`, `apple-mobile-web-app-title` 메타
- [x] `public/manifest.json` — `name`, `short_name` (PWA 홈 화면 설치 시 표시되는 이름)
- [x] `src/App.tsx` — 로고 `alt` 텍스트 3곳(데스크탑 사이드바/모바일 헤더/모바일 드로어)
- [x] `src/components/AuthPage.tsx` — 로고 `alt` 텍스트 + 주석
- [x] `src/components/InstallPrompt.tsx` — "홈 화면에 ○○ 추가하기" 안내 문구
- [x] `src/lib/exportExcel.ts` — 엑셀 내보내기 파일명 접두사 3곳
- [x] `README.md` — 최상단 프로젝트명 헤딩
- [x] `npx tsc -b`, `npm run lint` 통과 확인

### 배포
- `npm run deploy` 완료 — https://0f14d19e.budget-3wb.pages.dev

## 2026-07-17 (47차) — 수입 음수 입력 + 빠른 입력 템플릿 금액 미지정

사용자 요청: 하루 수익이 여러 항목(원천별)으로 나뉘어 들어오고 그중 일부는 수익에서
"차감"되는 성격이라 음수로 입력해야 함. 또한 매일 반복되지만 금액만 매번 다른 수입
항목을 위해 "빠른 입력 템플릿"에 금액을 뺀 채로 저장하는 옵션이 필요함.

### 예상 작업 항목
1. 수입 금액 음수 입력 허용
   - `src/components/TransactionForm.tsx`: income 타입일 때 금액 입력에 음수 허용
     (expense는 기존처럼 양수만), 타입 전환 시 부호 정리
   - `src/components/TransactionList.tsx`: 인라인 수정에서도 동일하게 허용, 목록
     표시에서 +/- 접두사 로직 수정
   - `functions/api/transactions/index.ts`, `[id].ts`: 서버 검증도 type별로 분기
   - `src/lib/format.ts`: 부호 허용 입력 포맷/파싱 헬퍼 추가
   - 정산/리포트 전반(DailySettlement, WeeklySettlement, MonthlySettlementTable,
     AnnualSettlementTable, MonthlyReport, AnnualReport, CategoryBreakdown,
     SummaryCard) 음수 표시 및 막대그래프 방어 처리 점검
   - transactions 테이블은 amount에 CHECK 제약이 없어 스키마 마이그레이션 불필요
     (확인 완료)
2. 빠른 입력 템플릿 — 금액 미지정 옵션
   - `migrations/015_*.sql` — `quick_templates.amount`를 NOT NULL → nullable로
     (SQLite라 테이블 재생성 방식), `schema.sql` 동기화
   - `functions/api/templates/index.ts`, `[id].ts`: amount optional/nullable 처리
   - `src/types.ts`: `QuickTemplate.amount: number | null`
   - `TransactionForm.tsx`: 템플릿 저장 시 "금액도 저장/금액 제외" 선택, 템플릿
     적용 시 amount null이면 금액 필드 비우고 자동 포커스, 관리 목록에 "금액 직접
     입력" 표시

### 예상 변경 파일
`src/components/TransactionForm.tsx`, `src/components/TransactionList.tsx`,
`src/lib/format.ts`, `src/types.ts`, `src/components/WeeklySettlement.tsx`,
`src/components/MonthlySettlementTable.tsx`, `src/components/AnnualSettlementTable.tsx`,
`src/components/MonthlyReport.tsx`, `src/components/AnnualReport.tsx`,
`src/components/CategoryBreakdown.tsx`, `functions/api/transactions/index.ts`,
`functions/api/transactions/[id].ts`, `functions/api/templates/index.ts`,
`functions/api/templates/[id].ts`, `migrations/015_*.sql`, `schema.sql`

### 완료
- [x] 수입 음수 입력 — `TransactionForm.tsx`(금액 입력 필드 income일 때만 '-' 허용,
  타입 전환 시 부호 정리, 안내 문구 추가), `TransactionList.tsx`(인라인 수정도 동일,
  목록 +/- 접두사를 `tx.amount`의 실제 부호 기준으로 수정 — 기존엔 income이면 무조건
  '+'를 붙여서 음수 금액이 "+-1,000원"처럼 깨졌음), `format.ts`에
  `formatNumberInput(raw, allowNegative)` / `parseAmountInput(raw)` 추가
- [x] 서버 검증 — `functions/api/transactions/index.ts`, `[id].ts`: expense는 양수만,
  income은 0이 아니면 음수도 허용(PATCH는 type이 요청에 없으면 기존 행을 조회해 판단).
  transactions.amount 컬럼엔 애초에 양수 CHECK 제약이 없어서 스키마 마이그레이션은
  불필요했음
- [x] 정산/리포트 화면 음수 표시 방어 — WeeklySettlement/MonthlySettlementTable/
  AnnualSettlementTable의 `cell()`이 `amount > 0`이면 값 아니면 '-'로 표시하던 걸
  `amount !== 0`으로 수정(안 그러면 음수 수입이 그냥 '-'로 사라져 보임).
  MonthlyReport 수입 내역의 하드코딩된 '+' 접두사도 부호 기준으로 수정. AnnualReport
  막대 너비/표 셀, CategoryBreakdown 막대 너비에 음수 clamp 추가(막대는 0%로, 텍스트
  금액은 formatWon이 그대로 정확히 표시). DailySettlement/SummaryCard는 이미
  `SUM(amount)`/`reduce`로 무조건 합산하는 구조라 손댈 필요 없었음
- [x] 빠른 입력 템플릿 금액 미지정 — `migrations/015_quick_templates_amount_nullable.sql`
  (SQLite라 테이블 재생성 방식, 006 마이그레이션과 동일 패턴) + `schema.sql` 동기화.
  `functions/api/templates/index.ts`, `[id].ts`: amount optional/nullable, 부호
  검증은 transactions와 동일 규칙. `types.ts`: `QuickTemplate.amount: number | null`.
  `TransactionForm.tsx`: 템플릿 저장 폼에 "금액도 함께 저장" 체크박스(해제 시
  amount: null로 저장), 템플릿 적용 시 amount가 null이면 금액 필드를 비우고
  자동 포커스, 관리 목록에서 금액 자리에 "금액 직접 입력" 표시

### 검증
- `npm run typecheck`(`tsc -b`), `npm run lint`(oxlint) 모두 통과
- 이 머신에 Node가 18.19.1만 있어 wrangler 4.x(Node 22+ 요구) 구동이 처음엔
  안 됐는데, nvm으로 Node 22.23.1 설치 후 `~/.local/bin`에 심볼릭 링크를 걸어 해결
  (sudo/터미널 재시작 불필요 — PATH에서 `~/.local/bin`이 `/usr/bin`보다 먼저 옴)
- Node 22 환경에서 `npm run d1:init`으로 로컬 D1 초기화 성공. `PRAGMA table_info
  (quick_templates)`로 `amount` 컬럼이 `notnull: 0`(nullable)로 정상 적용된 것 직접
  확인
- `npm run build` → `wrangler pages dev`로 로컬 전체 서버(API+정적 빌드) 구동 후
  playwright-core(시스템 설치된 google-chrome을 CDP로 직결, 별도 브라우저 다운로드
  없이)로 실제 브라우저 시나리오 검증:
  - 회원가입 → 수입 타입으로 전환 → 금액 `-3000` 입력 → 저장 → 거래 목록에
    "배달수수료 차감 · -3,000원"으로 정확히 표시(과거 버그였던 "+-3,000원" 깨짐
    없음 확인), 홈 요약 카드도 "수입 -3,000원 / 잔액 -3,000원"으로 정확히 순액 반영
  - "현재 입력값을 템플릿으로 저장"에서 "금액도 함께 저장" 체크 해제 후 저장 →
    템플릿 관리 목록에 "기타수입 · 금액 직접 입력"으로 정확히 표시
  - 해당 템플릿 적용 시 금액 필드가 비워지고 자동으로 포커스됨(`document.
    activeElement.id === 'amount'` 확인)
  - 콘솔 에러 없음
- 검증에 쓴 playwright 스크립트/스크린샷은 세션 스크래치패드에만 있고 저장소에는
  커밋 안 함(일회성 수동 검증용)

### 원격 D1 마이그레이션 적용
- `wrangler login` → `npx wrangler d1 execute budget-db --remote --file=./migrations/015_quick_templates_amount_nullable.sql`
  실행 완료(기존 템플릿 22행 데이터 보존한 채 이관). `PRAGMA table_info
  (quick_templates)`로 원격 DB의 `amount` 컬럼도 `notnull: 0`으로 정상 반영된 것
  확인. 남은 미완료 항목 없음

---

## 2026-07-18 세션 마무리 (44~46차 종합)

오늘 세션에서 진행한 작업 전부 완료 및 배포 완료, 미완료 항목 없음. README.md도
현재 기능/구조에 맞게 다시 정리함(PWA·Push·정산 화면·카드 프리셋 등 그동안 누락돼
있던 내용 반영).

- [x] 44차 — PWA 전환(홈 화면 설치): manifest.json, 아이콘, InstallPrompt 배너
- [x] 45차 — 카드 정산 Push 알림: VAPID, 구독 UI/API, injectManifest SW 전환,
  별도 Cron Worker(`workers/card-settlement-notifier`) 신규 배포
- [x] 46차 — 로고 클릭 시 홈 화면 이동

### 다음 세션 시작 시 참고
- Cron Worker는 루트 `npm run deploy`에 안 걸림 — `workers/card-settlement-notifier`
  코드를 고치면 그 디렉토리에서 `wrangler deploy` 별도 실행 필요
- 카드 정산 알림 실제 수신 테스트는 네이티브 브라우저 알림 권한 승인이 필요해
  자동화로 못 함 — 사용자가 마이페이지에서 직접 켜보고 확인 필요
- 현재 남은 작업 없음

---

## 2026-07-18 (46차) — 로고 클릭 시 홈 이동

사용자 요청: "텅장" 로고 누르면 홈화면으로 이동하는 기능 추가.

### 완료
- [x] `src/App.tsx` — 로고 `<img>` 3곳(데스크탑 상시 사이드바, 모바일 헤더, 모바일
  드로어)을 전부 `<button onClick={() => setActiveTab('home')}>`으로 감쌈. 드로어
  쪽은 클릭 시 드로어도 함께 닫히도록 `setMenuOpen(false)`도 같이 호출
- [x] tsc -b / oxlint / vite build 통과

### 검증 결과
- Chrome으로 실제 배포 화면 확인 — 카드 관리 탭으로 이동한 뒤 상단 로고 클릭 →
  홈 화면("2026년 7월 요약")으로 정상 이동 확인(데스크탑 사이드바 로고 기준. 모바일
  헤더/드로어 로고는 동일한 핸들러를 쓰므로 별도 확인 없이 동일하게 동작할 것으로 판단).
  스크린샷 도구가 이번 세션에서 간헐적으로 타임아웃(기존에도 종종 있던 현상)나서
  JS로 현재 화면 제목을 읽어 확인하는 방식으로 대체

### 배포
- `npm run deploy` 완료 — https://15a9e806.budget-3wb.pages.dev

### 변경 파일
- `src/App.tsx`

---

## 2026-07-18 (45차) — 카드 정산 알림(Push) 완료

### 완료
- [x] VAPID 키 생성(`web-push generate-vapid-keys`, 로컬 1회성 실행). 공개키는
  `src/lib/pushConfig.ts` + 워커 wrangler.toml `[vars]`에 평문 기록(비밀정보 아님),
  비공개키는 `workers/card-settlement-notifier`에 `wrangler secret put`으로만 등록(커밋
  안 됨)
- [x] `migrations/014_add_push_subscriptions.sql`(요청서엔 009였지만 실제로는 이미 사용
  중이라 014로) + `schema.sql` 동기화, 로컬/원격 D1 둘 다 적용
- [x] `src/lib/push.ts` — 구독 헬퍼(`enablePush`/`disablePush`/`getCurrentSubscription`),
  `src/components/NotificationSettings.tsx`(신규, MyPage에 섹션 추가) — 토글 클릭 시
  Notification 권한 요청 → SW `pushManager.subscribe()` → 서버 저장. 권한 거부 시
  안내 문구
- [x] `functions/api/push/subscribe.ts`/`unsubscribe.ts`(신규), `src/lib/api.ts`에
  `subscribePush`/`unsubscribePush` 추가
- [x] Service Worker를 `generateSW`→**`injectManifest`로 전환**(push 핸들러를 넣으려면
  커스텀 SW 소스가 필요해서) — `src/sw.ts`(신규)에 44차와 동일한 프리캐시+`/api`
  NetworkOnly 규칙을 직접 작성 + `push`/`notificationclick` 핸들러 추가. DOM lib과
  WebWorker lib을 한 tsconfig에서 같이 못 써서 `tsconfig.sw.json`(신규, WebWorker lib
  전용) 분리 + `tsconfig.app.json`에서 `src/sw.ts` exclude + 루트 `tsconfig.json`에
  참조 추가. `workbox-precaching`/`workbox-routing`/`workbox-strategies` devDependency
  추가(이미 vite-plugin-pwa의 간접 의존성이었음)
- [x] 알림 클릭 시 월정산 화면으로 이동시키기 위해 `src/App.tsx`에 `?tab=` 쿼리파라미터
  딥링크 지원 추가(이 앱에 URL 기반 라우팅이 전혀 없었어서 최소한으로 추가) —
  `initialTabFromUrl()`이 첫 렌더 시 `activeTab` 초기값으로 사용됨
- [x] **Cron Worker**(`workers/card-settlement-notifier/`, 별도 wrangler 프로젝트,
  Pages Functions와 분리):
  - `web-push` npm 패키지는 Node `https` 모듈 의존이라 Cloudflare Workers 런타임에서
    동작 안 함 — 대신 Web Crypto 기반으로 Workers를 공식 지원하는
    `@block65/webcrypto-web-push`(MIT)로 VAPID JWT 서명(ES256) + 페이로드 암호화(RFC
    8291) 처리 후 `fetch`로 직접 발송. `node:crypto` 동적 import 폴백 경로가 있어
    `nodejs_compat` 플래그 추가(Workers엔 Web Crypto가 기본 있어 실제로 안 타는
    분기지만 번들러 경고 방지 겸 안전하게 켬)
  - `src/billing.ts` — `src/lib/billing.ts`의 `getCardBillingPeriod`/`daysInMonth`
    로직을 그대로 포팅(별도 배포 단위라 소스 공유 대신 복사)
  - `src/index.ts` — `scheduled` 핸들러: KST 기준 어제 날짜 계산 → 전체 카드 중
    (말일 클램핑된) `closing_day`가 어제와 일치하는 카드 탐지 → `getCardBillingPeriod`로
    청구기간/결제일 계산 → 해당 기간 카드 지출 합계(`transactions.amount` 기준, 이미
    할인 반영된 실결제액) → `notification_log`로 중복 발송 방지 → 사용자별로 묶어서
    발송
  - **묶음 발송 방식 결정**: 한 사용자가 같은 날 여러 카드가 마감되면 사용자가 명시한
    선호대로 **하나로 묶어서 발송**. 카드 1개면 `"{카드명} 정산 완료"` / `"이번
    청구기간({시작}~{마감}) 사용액 {합계}원, {결제일}에 결제됩니다"`, 2개 이상이면
    `"오늘 마감된 카드 N개 정산 완료"` / `"A카드 12,000원, B카드 34,500원"`(제목에
    개수, 본문에 카드별 요약을 쉼표로 나열)
  - `notification_log`는 묶음 발송이어도 **카드마다 개별 행**으로 기록(스펙의 UNIQUE
    제약이 카드+청구월 단위라서). 구독이 0개인 사용자도 로그는 남김(과거 마감 이벤트가
    나중에 구독해도 소급 발송되지 않도록)
  - 발송 시 응답 410/404면 만료 구독으로 판단해 `push_subscriptions`에서 자동 삭제
  - `.dev.vars`(로컬 전용, gitignore 추가) + 실제 VAPID_PRIVATE_KEY secret 등록 +
    `workers_dev = false`(fetch 핸들러 없는 크론 전용 워커라 공개 HTTP 엔드포인트
    불필요, 노출 면 최소화) 후 `wrangler deploy` 완료

### 검증 결과
- `wrangler dev --test-scheduled`로 로컬 D1에 테스트 카드/거래/구독을 직접 넣고
  `/__scheduled` 엔드포인트로 실제 시나리오 재현: (1) 마감일 미검출 → 재현(2) 마감일
  검출 성공 → `notification_log`에 정확한 `year_month`로 기록 확인 (3) 같은 이벤트
  재실행 시 중복 기록 안 됨(dedup) 확인 (4) 실제 P-256 키를 가진 가짜 구독을 넣고
  발송 시도 → 에러 없이 완료(=Web Crypto 기반 VAPID 서명/페이로드 암호화가 Workers
  런타임에서 정상 동작함을 확인, 실제 배송 성공 여부는 가짜 endpoint라 확인 대상 아님).
  테스트 데이터는 전부 로컬 D1에서만 사용, 정리 완료
- `tsc -b`(루트, sw.ts는 별도 tsconfig.sw.json), `tsc --noEmit --ignoreConfig`(functions/
  api/push/*.ts 애드혹), `tsc --noEmit`(워커 자체), `oxlint`, `vite build` 전부 통과.
  빌드 로그로 `dist/sw.js`가 injectManifest 모드로 정상 생성되고 push/notificationclick
  코드가 포함됐는지, `/api/` NetworkOnly 라우팅이 그대로 유지됐는지 확인
  (`registerRoute` 4회, `NavigationRoute`용 index.html 참조 등)
- Chrome으로 실제 배포 화면 확인: 새 sw.js가 active로 정상 등록됨. **다만 같은 탭에서
  이번 세션 중 여러 번 재배포한 탓에 오래된 서비스워커가 계속 옛날 index.html(옛
  JS 번들)을 캐시로 물고 있는 현상 발견** — `clients.claim()`은 열려 있는 페이지를
  바로 제어하긴 해도 이미 실행된 스크립트를 강제로 새로고침하진 않아서, 짧은 시간에
  반복 배포+같은 탭 재사용을 거듭하면 새 SW가 활성화됐는데도 오래된 청구서를 계속
  보여주는 상태가 남을 수 있음(실사용자는 이렇게 몇 분 안에 5번씩 재배포된 탭을
  들고 있지 않아 정상적으로는 안 겪는 상황). `unregister()` + 캐시 삭제 후 재확인하니
  최신 번들(`MyPage`의 "카드 정산 알림 받기" 섹션 포함) 정상 렌더링 확인
  - MyPage → 내 정보 팝업에서 "카드 정산 알림 받기" 토글 노출 확인, 클릭 시
    `Notification.requestPermission()` 호출까지 확인(네이티브 권한 팝업 자체는 자동화
    도구로 응답할 수 없는 브라우저 UI라 실제 허용/구독 완료까지는 진행 안 함 — 실사용자
    확인 필요)

### 배포
- 원격 D1에 `migrations/014_add_push_subscriptions.sql` 적용 완료
- 메인 앱: `npm run deploy` 완료 — https://54be6989.budget-3wb.pages.dev
- Cron Worker: `workers/card-settlement-notifier`에서 `wrangler deploy` 완료 —
  `budget-card-settlement-notifier`, 크론 `0 15 * * *`(UTC) = 매일 한국시간 자정

### 다음에 참고할 것
- **VAPID_PRIVATE_KEY는 이 세션에서 생성해 워커에 secret으로 등록해뒀음** — 분실 시
  `web-push generate-vapid-keys`로 재생성하고 공개키도 `src/lib/pushConfig.ts` +
  워커 `wrangler.toml`을 함께 갱신해야 함(공개키/비공개키는 항상 쌍으로 갱신)
- 실사용자가 마이페이지에서 알림을 켠 뒤, 실제 카드 마감일에 알림이 오는지는 이
  세션에서 직접 확인 못 함(네이티브 권한 승인이 필요해서) — 다음에 사용자가 직접
  테스트하거나, 요청하면 알림 권한을 미리 허용해둔 프로필로 재검증 가능
- `workers/card-settlement-notifier`는 루트 `npm run build`/`deploy`에 안 걸림 —
  코드를 고치면 그 디렉토리에서 별도로 `npm run deploy` 필요

### 변경/신규 파일
- `migrations/014_add_push_subscriptions.sql`(신규), `schema.sql`
- `src/lib/pushConfig.ts`(신규), `src/lib/push.ts`(신규), `src/lib/api.ts`
- `src/components/NotificationSettings.tsx`(신규), `src/components/MyPage.tsx`
- `functions/api/push/subscribe.ts`(신규), `functions/api/push/unsubscribe.ts`(신규)
- `vite.config.ts`, `src/sw.ts`(신규), `tsconfig.sw.json`(신규), `tsconfig.app.json`,
  `tsconfig.json`, `src/App.tsx`
- `workers/card-settlement-notifier/`(신규 디렉토리: `wrangler.toml`, `package.json`,
  `tsconfig.json`, `src/billing.ts`, `src/index.ts`)
- `.gitignore`(`.dev.vars` 추가), `package.json`/`package-lock.json`(vite-plugin-pwa
  관련 workbox-* devDependency 추가)

---

카드 청구 마감일이 지나면 그 카드의 이번 청구기간 정산액을 push 알림으로 보내는 기능.
예산 초과 알림이 아니라 "마감 완료" 알림. 설치(PWA)는 44차에서 이미 완료, 이번엔 Push까지.

### 계획
- 마이그레이션 번호 조정: 요청서엔 `009_add_push_subscriptions.sql`로 돼있지만 실제
  프로젝트는 009가 이미 `009_notes_allow_multiple_per_day.sql`로 사용 중 → **014**로 진행
- `migrations/014_add_push_subscriptions.sql` — push_subscriptions, notification_log
  테이블(요청 스펙 그대로), schema.sql 동기화
- VAPID 키: `web-push generate-vapid-keys`로 로컬 생성. 공개키는 `src/lib/pushConfig.ts`
  (민감정보 아니라 커밋 가능)+워커 wrangler.toml `[vars]`, 비공개키는 워커에
  `wrangler secret put`으로만 저장(커밋 안 함)
- 프론트: `NotificationSettings.tsx`(MyPage에 섹션 추가), `src/lib/push.ts`(구독 헬퍼),
  `functions/api/push/subscribe.ts`/`unsubscribe.ts`
- Service Worker: 44차에서 만든 `generateSW` 전략은 커스텀 push 핸들러를 못 넣어서
  `injectManifest` 전략으로 전환, `src/sw.ts` 직접 작성(precache+`/api` NetworkOnly는
  기존과 동일하게 유지 + push/notificationclick 핸들러 추가)
- 알림 클릭 시 월정산 화면 이동을 위해 `App.tsx`에 `?tab=` 쿼리파라미터 딥링크 지원 추가
  (기존엔 URL 기반 라우팅이 전혀 없어서 최소한으로 추가)
- Cron Worker: `workers/card-settlement-notifier/`에 별도 wrangler 프로젝트(Pages
  Functions와 분리). `web-push` npm 패키지는 Node의 `https` 모듈을 써서 Cloudflare
  Workers 런타임에서 동작 안 함 — 대신 Web Crypto 기반으로 Workers/Deno/Bun을 공식
  지원하는 `@block65/webcrypto-web-push`(MIT, 의존성 3개뿐)로 VAPID JWT 서명 +
  페이로드 암호화(RFC 8291)를 처리하고 `fetch`로 직접 발송
- 마감 감지: KST 기준 어제 날짜와 카드의 (말일 클램핑된) closing_day 비교. 청구기간
  계산은 `src/lib/billing.ts`의 `getCardBillingPeriod` 로직을 워커 안에 포팅
  (별도 배포 단위라 소스 공유 대신 복사, 로직은 100% 동일하게 유지)
- 한 사용자가 같은 날 여러 카드 마감 시 **하나로 묶어서 발송**(사용자가 명시적으로
  선호한 방향) — "오늘 마감된 카드 N개" 제목 + "A카드 X원, B카드 Y원" 본문
- `notification_log`는 묶음 발송이어도 카드별로 각각 기록(스펙의 UNIQUE 제약이
  카드+청구월 단위라서), 발송 실패(410/404 Gone)면 해당 구독 자동 삭제

### 예상 변경/신규 파일
- `migrations/014_add_push_subscriptions.sql`(신규), `schema.sql`
- `src/lib/pushConfig.ts`(신규), `src/lib/push.ts`(신규), `src/lib/api.ts`
- `src/components/NotificationSettings.tsx`(신규), `src/components/MyPage.tsx`
- `functions/api/push/subscribe.ts`(신규), `functions/api/push/unsubscribe.ts`(신규)
- `vite.config.ts`, `src/sw.ts`(신규), `src/App.tsx`
- `workers/card-settlement-notifier/`(신규 디렉토리 전체)

---

## 2026-07-17 (44차) — PWA 전환 (홈 화면 설치)

앱을 PWA로 전환해 홈 화면에 설치 가능하게 하는 요청. 이번 단계는 설치까지만, Push
알림은 다음 단계에서 별도 진행 예정.

### 계획
- `vite-plugin-pwa`로 service worker 생성(JS/CSS/HTML 프리캐시, `/api/*`는 항상
  NetworkOnly), `registerType: 'autoUpdate'`
- manifest는 **직접 작성해 `public/manifest.json`에 배치**(vite-plugin-pwa의 자동
  매니페스트 생성/아이콘 복사 기능은 끔) — 이유는 아래 참고
- 기존 `public/favicon.svg`(코랄 지갑 심볼, 정사각형)를 192/512/apple-touch-icon(180)
  PNG로 리사이즈해 아이콘으로 사용
- `src/components/InstallPrompt.tsx`(신규) — `beforeinstallprompt` 캡처, iOS는 UA
  감지로 공유버튼 안내 텍스트로 대체, localStorage로 닫음 상태 기억
- `index.html`에 manifest link, theme-color, apple 메타 태그 추가

### 설계 결정 — manifest를 vite-plugin-pwa가 아닌 직접 작성한 이유
`vite.config.ts`에 이미 `publicDir: false`가 설정돼 있음(WSL2 DrvFs에서
`fs.copyFileSync` EPERM 나던 문제 우회, `package.json`의 `cp -r public/. dist/`로 직접
복사). vite-plugin-pwa의 `includeAssets`/자동 매니페스트 생성 기능은 내부적으로
`viteConfig.publicDir` 값을 그대로 읽어 아이콘을 복사하는데, `publicDir`가 `false`면 이
경로가 깨짐(패키지 소스 확인함: `cwd: publicDir`로 glob). `publicDir: false`를 되돌리면
WSL2에서 쓰는 사람에게 다시 EPERM 문제가 생길 수 있어 손대지 않기로 함 — 대신
manifest.json/아이콘을 `public/`에 두고 기존 cp 스크립트가 그대로 복사하게 하고,
vite-plugin-pwa는 서비스워커 생성 역할만 담당하도록(`manifest: false`) 분리

### 완료
- [x] `npm install -D vite-plugin-pwa` (아이콘 생성용 `sharp`는 1회성 스크립트로만 쓰고
  작업 후 `npm uninstall`로 제거 — 런타임/빌드에 불필요한 의존성 남기지 않음)
- [x] `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`(180) — 기존
  `public/favicon.svg`를 sharp로 리사이즈해 생성
- [x] `public/manifest.json`(신규) — name/short_name "텅장", description, start_url "/",
  display "standalone", orientation "portrait", background_color "#0a0a0a"(다크모드
  neutral-950과 동일), theme_color "#D85A30"(coral-400), icons 2종
- [x] `vite.config.ts` — `VitePWA` 플러그인 추가: `registerType: 'autoUpdate'`,
  `manifest: false`, `workbox.globPatterns`로 JS/CSS/HTML(+아이콘류) 프리캐시,
  `runtimeCaching`으로 `/api/*` 전체 NetworkOnly 처리, `navigateFallbackDenylist`로
  `/api/*`는 SPA 폴백 대상에서 제외
- [x] `index.html` — `<link rel="manifest">`, `<meta name="theme-color">`, iOS용
  `apple-mobile-web-app-capable`/`apple-mobile-web-app-title`/`apple-touch-icon` 추가
- [x] `src/components/InstallPrompt.tsx`(신규) — `beforeinstallprompt` 이벤트를
  가로채 저장해두고 화면 우하단(모바일은 하단 전체 폭) 카드형 배너로 "추가하기"
  버튼 노출. iOS는 해당 이벤트 자체가 없어 UA로 iOS 기기 감지해 "공유 버튼 → 홈
  화면에 추가" 안내 텍스트로 대체. 이미 설치돼 실행 중이면(`display-mode:
  standalone` 또는 iOS `navigator.standalone`) 아예 표시 안 함. "나중에" 클릭 시
  `localStorage`(`budget:install-prompt-dismissed`)에 기억해 다시 안 뜨게 함,
  `appinstalled` 이벤트 발생 시에도 동일하게 처리. 아이콘 없이 텍스트 위주,
  코랄+카드형 톤 유지
- [x] `src/main.tsx` — `<InstallPrompt />`를 `<Toast />`와 함께 루트에 마운트
- [x] tsc -b / oxlint / vite build 통과. 빌드 로그로 `dist/sw.js`,
  `dist/registerSW.js`, `dist/workbox-*.js` 생성 확인 + `dist/manifest.json`,
  `dist/icons/*.png`가 기존 cp 단계로 정상 복사됐는지 직접 확인. 생성된 `sw.js`
  내용을 직접 읽어 `/api/`로 시작하는 경로가 `NetworkOnly`로 라우팅되는 것과 JS/CSS/
  index.html만 precache 리스트에 포함된 것(4 entries) 확인

### 검증 결과
- Chrome으로 실제 배포 화면 확인:
  - `fetch('/manifest.json')` → 200, `application/json`, 작성한 필드 그대로 응답
  - `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/apple-touch-icon.png` 전부 200
  - `navigator.serviceWorker.getRegistrations()` → `sw.js`가 scope `/`로 active 상태 등록
    확인
  - **Chrome이 실제로 설치 가능하다고 판단해 `beforeinstallprompt`가 발생**, 화면
    우하단에 배너가 코랄+카드 톤으로 정상 노출됨을 스크린샷으로 확인. "나중에" 클릭
    → 새로고침해도 안 뜨는 것 확인(localStorage 동작 검증) → 검증 목적으로 누른
    것이므로 실제 사용자 경험에 영향 안 주게 `localStorage.removeItem`으로 원복
  - "추가하기" 클릭은 네이티브 설치 대화상자를 띄워 CDP를 블로킹시킬 수 있어(이전
    세션들에서 `window.confirm` 때 같은 현상 확인됨) 실제 클릭은 진행하지 않음 —
    이벤트 캡처와 배너 노출까지 확인된 것으로 충분하다고 판단

### 배포
- `npm run deploy` 완료 — https://c078a91e.budget-3wb.pages.dev

### 변경 파일
- `vite.config.ts`, `index.html`, `src/main.tsx`
- `public/manifest.json`(신규), `public/icons/`(신규, 3개 PNG)
- `src/components/InstallPrompt.tsx`(신규)
- `package.json`, `package-lock.json`(vite-plugin-pwa devDependency 추가)

---

## 2026-07-17 (43차) — 메모 달력 뷰 사이즈 조정 (달력 축소 + 메모 카드 강조)

사용자 피드백: 41차에서 만든 메모 달력 뷰가 달력이 너무 크고, 아래 선택한 날짜의 메모
카드가 상대적으로 눈에 덜 띔.

### 완료
- [x] `src/components/NotesView.tsx` — 달력 그리드 컨테이너에 `max-w-[300px] mx-auto` 적용해
  폭을 좁힘(기존엔 콘텐츠 영역 전체 폭을 채워 셀이 컸음) → 셀이 작아지고 상대적으로
  아래 메모 카드가 부각됨. 그리드 gap/텍스트 크기도 소폭 축소(`gap-0.5`, `text-xs`)해
  좁아진 폭에 맞춤
- [x] 선택한 날짜의 메모 상세 패널 — `border-l-4 border-l-coral-400`(카드 관리 화면과
  동일한 액센트 패턴) + 패딩 확대(`p-4`→`p-5`), 제목 `text-sm`→`text-base font-extrabold`
- [x] `renderNoteItem`에 `card` 파라미터 추가(기본 false) — 달력 상세에서만 `true`로 호출해
  각 메모를 테두리+배경 있는 카드 박스로 감싸고 내용 텍스트도 `text-base`로 키움, 수정/삭제
  아이콘도 hover 없이 항상 노출(목록 뷰는 촘촘한 나열이 목적이라 기존 hover 방식 유지)
- [x] tsc -b / oxlint / vite build 통과

### 검증 결과
- Chrome으로 실제 배포 화면 다크모드에서 확인 — 테스트 메모를 임시로 저장해 달력 뷰에서
  카드가 이전보다 훨씬 크고 뚜렷하게(코랄 액센트 테두리, 큰 글씨) 보이는 것과 달력이
  좁아진 것(약 300px)을 직접 확인. 확인 후 fetch DELETE로 테스트 메모 정리(삭제 확인
  대화상자가 CDP를 블로킹해 UI 클릭 대신 API 직접 호출로 정리)

### 배포
- `npm run deploy` 완료 — https://0f203502.budget-3wb.pages.dev

### 변경 파일
- `src/components/NotesView.tsx`

---

## 2026-07-17 (42차) — 카드 관리 화면에 실제 카드 디자인 이미지 표시

카드 4종(삼성 taptap O, KB 쿠팡와우, 롯데 LOCA LIKIT, NH zgm.the pay)의 카드사 공식
디자인 이미지를 R2에 올려 카드 관리 화면에 실물처럼 보이게 해달라는 요청.

### 조사 및 사용자 승인
- WebSearch/WebFetch로 각 카드사 공식 홈페이지에서 카드 실물 이미지 `<img>` src 직접 확인 후
  다운로드해 Read 도구로 실제 카드 디자인이 맞는지 육안 검증(가짜/로고 이미지 아님을 확인)
  - 삼성카드 taptap O: static11.samsungcard.com/wcms/home/scard/image/personal/b_AAP1483.png
  - KB국민 쿠팡와우카드(로켓 디자인, 신용카드 페이지에서 확인 — 처음 찾은 09673 코드는
    체크카드였어서 신용카드 상세 페이지(09293)로 재조사): img1.kbcard.com/ST/img/cxc/kbcard/upload/img/product/09292_img.png
  - 롯데카드 LOCA LIKIT — 블루/옐로우 2색상 중 **옐로우(맨해튼)** 로 사용자 선택:
    image.lottecard.co.kr/webapp/pc/images/card/loca/img_card_yellow.png
  - NH농협카드 zgm.the pay: card.nonghyup.com/content/html/bridge/zgm/images/1.png
- AskUserQuestion으로 (1) LOCA LIKIT 색상 선택 (2) 4개 URL 업로드 승인 (3) R2 버킷 신규 생성
  승인을 받은 뒤에만 진행 (CLAUDE.md 지시: 무단 스크래핑 금지, 승인 후 진행)

### 완료
- [x] R2 버킷 `budget-card-images` 신규 생성 + 퍼블릭 r2.dev URL 활성화
  (`https://pub-226d8250b81644e39f63d37bbc6ab853.r2.dev`)
- [x] `wrangler.toml` — `[[r2_buckets]]` 바인딩(`CARD_IMAGES`) 추가
- [x] 4개 이미지를 `wrangler r2 object put --remote`로 `card-presets/{preset_id}.png` 경로에
  업로드(최초 `--remote` 플래그 없이 실행해 로컬 시뮬레이션 버킷에 잘못 올라간 것 발견 →
  재업로드로 수정). curl로 4개 전부 퍼블릭 URL에서 200/image/png 정상 서빙 확인
- [x] `migrations/013_add_card_image_url.sql` — `cards.image_url TEXT` 컬럼 추가, `schema.sql`
  동기화(001~013), 원격 D1에도 적용 완료
- [x] `src/lib/cardBenefitPresets.ts` — `CardPreset.imageUrl` 필드 추가, 4개 프리셋 전부에
  R2 공개 URL 채움
- [x] `functions/api/cards/index.ts`(POST)/`[id].ts`(PATCH) — `image_url` 필드 insert/update
  처리 추가
- [x] `src/types.ts` — `Card.image_url`(string | null), `NewCard.image_url`(optional) 추가
- [x] `src/components/CardManager.tsx` — 프리셋 선택 시 `handleSave`에서 `image_url`도 함께
  저장(새 카드/기존 카드 수정 둘 다). 카드 목록 각 행 좌측에 70×44 썸네일 표시
  (`object-cover`) — `image_url` 없거나 `onError` 발생 시 기존 `color` 필드 기반 그라데이션
  블록으로 자동 폴백(카드별 실패 상태를 `imageLoadFailedIds` Set으로 추적). 실제 파일
  리사이즈는 하지 않고 CSS 표시 크기만 제한(요청 스펙대로 충분한 수준)
- [x] `tsc -b`(src) / `oxlint` / `vite build` 통과, `functions/api/cards/*.ts`는 애드혹
  `tsc --noEmit --ignoreConfig`로 별도 타입 체크 통과

### 검증 결과 (1차, 정적 검증만)
- 정적 검증(tsc/lint/build)만 진행, 사용자 요청 시에만 Chrome 실동작 검증 진행하는 기존
  방침 유지(브라우저 화면 확인은 안 함)

### 배포 (1차)
- 원격 D1에 `migrations/013_add_card_image_url.sql` 적용 완료
- `npm run deploy` 완료 — https://735f6507.budget-3wb.pages.dev

### 버그 수정 — 다크모드에서 "카드 상품 선택" 드롭다운 글자가 안 보임
사용자가 Chrome 실동작 검증을 요청하며 동시에 버그 리포트: 다크모드에서 카드 등록 폼의
"카드 상품 선택" 드롭다운을 열면 옵션 글자가 하나도 안 보임.

**원인**: `<select>` 요소에 `border`/`text-base` 등은 있었지만 배경색 클래스
(`bg-white`/`dark:bg-neutral-900`)가 빠져 있었음. 일반 `<input>`은 부모 카드 컨테이너의
배경 위에 얹혀 있어 배경이 없어도 문제 없지만, `<select>`가 펼치는 네이티브 옵션
팝업은 브라우저가 **select 자신의 background-color**를 팝업 배경으로 사용함(배경이
transparent면 브라우저 기본값인 흰색 사용). 다크모드 글자색(`oklch(0.97 0 0)`, 거의
흰색)이 그 흰색 배경과 겹쳐 완전히 안 보이는 상태였음 — Chrome의 `getComputedStyle`로
`background-color: rgba(0,0,0,0)` 확인해 원인 특정
- [x] `src/components/CardManager.tsx` — select 클래스에 `bg-white dark:bg-neutral-900
  text-neutral-900 dark:text-neutral-100` 추가(앱 내 유일한 `<select>` 요소)
- [x] 배포 후 Chrome으로 재확인 — `getComputedStyle(select).backgroundColor`가
  다크모드에서 `oklch(0.205 0 0)`(neutral-900)로 바뀐 것 확인, 텍스트색과 대비 확보됨.
  네이티브 드롭다운 팝업 자체는 OS 레이어라 스크린샷에는 안 잡히지만(CDP 캡처가
  30초 타임아웃 — 이전 세션들에서도 동일 현상 기록됨), computed style로 근본 원인이
  해소됐음을 직접 확인
- [x] tsc -b / oxlint / vite build 통과

### 검증 결과 (2차)
- Chrome으로 실제 배포 화면(다크모드) 확인: 로그인 상태 유지, 카드 관리 → 카드 추가 →
  "카드 상품 선택" select 박스 자체는 다크 배경+밝은 텍스트로 정상 렌더링 확인.
  네이티브 옵션 팝업 시각 확인은 스크린샷 도구 한계로 못 했지만 backgroundColor computed
  style로 대비 문제 해소를 확인함

### 배포 (2차, 버그 수정)
- `npm run deploy` 완료 — https://16801107.budget-3wb.pages.dev

### 변경 파일
- `wrangler.toml`, `migrations/013_add_card_image_url.sql`(신규), `schema.sql`
- `src/lib/cardBenefitPresets.ts`, `functions/api/cards/index.ts`, `functions/api/cards/[id].ts`
- `src/types.ts`, `src/components/CardManager.tsx`

---

## 2026-07-17 세션 마무리 (38~41차 종합)

오늘 세션에서 진행한 작업 전부 완료 및 배포 완료, 미완료 항목 없음.

- [x] 38차 — 헤더 닉네임 분리 + "내 정보" 화면(닉네임 변경, 비밀번호 변경) 신규
- [x] 39차 — 내 정보 팝업 닫기 버튼 대비 문제 수정 + 데스크탑 상시 사이드바 추가
- [x] 40차 — 다크모드 앱 전체 적용 + 홈 화면 "한눈에 보기" 버튼 스타일 수정
- [x] 41차 — 메모 화면 목록/달력 보기 토글 추가

### 다음 세션 시작 시 참고
- Chrome 확장이 이번 세션 내내 연결 안 돼서 38~41차 전부 정적 검증(tsc/lint/build)만
  하고 실제 화면 시각 확인은 못 함. 다음에 Chrome 연결되면 한 번에 훑어볼 것:
  라이트/다크 전환, 헤더 닉네임 드롭다운·내 정보 화면, 메모 달력 뷰, 데스크탑
  사이드바
- 로컬 D1은 `migrations/012_add_nickname.sql` 미적용 상태(원격은 적용 완료) —
  로컬 테스트 전 `npm run d1:init` 필요
- 현재 남은 작업 없음

---

## 2026-07-17 (41차) — 메모 화면에 목록/달력 보기 토글 추가

메모(NotesView) 화면에서 날짜별 목록으로만 보이던 걸 달력 형태로도 볼 수 있게
요청. 목록/달력 토글 버튼 추가하고 달력 뷰를 신규 구현

### 완료
- [x] `src/components/NotesView.tsx` — 상단에 목록/달력 토글(세그먼트 버튼) 추가
- [x] 달력 뷰: 7×n 그리드, 1일의 요일만큼 앞칸을 비우고 마지막 주도 7칸을 채워
  달력 모양 유지. 메모가 있는 날짜는 코랄색 점으로 표시, 오늘/선택한 날짜는 배경
  강조
- [x] 달력에서 날짜를 클릭하면 그리드 아래에 해당 날짜의 메모 상세(추가/수정/삭제)
  패널 표시 — 기존 목록 뷰의 메모 렌더링/저장 로직을 `renderNoteItem`/
  `renderAddTrailer` 함수로 뽑아내어 목록·달력 두 뷰에서 공용으로 사용, 저장/삭제
  API 로직은 변경 없음
- [x] 월 이동 시 선택 날짜 초기화 — 이번 달이면 오늘을 기본 선택, 아니면 미선택
  상태로 시작(달력을 열자마자 클릭 없이 오늘 메모를 볼 수 있게)
- [x] tsc -b / oxlint / vite build 통과

### 검증 결과
- 이번 세션에서도 Chrome 확장 미연결로 정적 검증만 진행

### 배포
- `npm run deploy` 완료 — https://06c5eff2.budget-3wb.pages.dev

### 변경 파일
- `src/components/NotesView.tsx`

---

## 2026-07-17 (40차) — 다크모드 전체 적용 + 홈 화면 버튼 스타일 수정

피드백: 1) 홈 화면 "한눈에 보기 (일일·주간 정산) →"가 밑줄 텍스트 링크라 버튼처럼 안
보임. 2) 다크모드가 아예 없음 — 앱 전체 화면에 한 번에 적용해달라는 요청(범위 확인
질문에 "전체 화면 한번에" 응답)

### 완료
- [x] `src/App.tsx` — 홈 화면의 "한눈에 보기" 링크를 코랄톤 배경의 실제 버튼으로 변경
- [x] `src/index.css` — Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *))`
  추가(클래스 기반 토글), `:root.dark { color-scheme: dark }`
- [x] `src/contexts/ThemeContext.tsx`(신규) — theme 상태 관리, `<html>`에 `.dark`
  클래스 토글, `localStorage`(`budget:theme`)에 저장, 저장값 없으면
  `prefers-color-scheme` 폴백
- [x] `index.html` — React 마운트 전에 저장된 테마를 먼저 적용하는 인라인 스크립트
  추가(새로고침 시 밝은 화면이 잠깐 번쩍이는 것 방지)
- [x] `src/main.tsx` — `ThemeProvider`로 앱 전체를 감쌈
- [x] `src/App.tsx` — 헤더에 다크모드 토글 버튼(해/달 아이콘) 추가
- [x] **앱 전체 20여개 컴포넌트 파일**(App.tsx, AuthPage/MyPage 포함 모든
  components/*.tsx, ui/Card.tsx)에 `dark:` variant 일괄 적용 — 색상 하나하나 손으로
  고치는 대신, "라이트 모드 색상 클래스 → 대응하는 dark: 클래스" 매핑표를 만들어
  스크립트(Node, 임시 스크래치패드 파일)로 클래스 문자열에 자동 삽입 (예:
  `bg-white` → `bg-white dark:bg-neutral-900`, `text-neutral-600` → `+
  dark:text-neutral-400`, `border-neutral-200` → `+ dark:border-neutral-800`,
  코랄/레드/블루/그린/앰버 액센트 색상도 각각 다크 배경에 맞는 톤으로 매핑).
  적용 후 `dark:dark:` 같은 중복 삽입 여부와 대표 파일(CardManager.tsx 등) 결과물을
  직접 확인해 정상 삽입됐음을 검증
- [x] tsc -b / oxlint / vite build 통과 (빌드 CSS 28.45KB → 36.23KB로 증가 —
  dark: 규칙이 정상적으로 생성됐다는 신호)

### 검증 결과
- 이번 세션에서는 Chrome 확장이 연결되지 않아 실제 브라우저 시각 검증은 못 함(정적
  검증 + 코드 diff 확인만 진행). 다음 세션에서 Chrome 연결 시 라이트/다크 전환과
  주요 화면(홈, 한눈에 보기, 카드, 예산, 검색, 내 정보, 로그인)을 한 번씩 훑어보는
  걸 권장

### 배포
- `npm run deploy` 완료 — https://65b70451.budget-3wb.pages.dev

### 변경 파일
- `src/index.css`, `src/contexts/ThemeContext.tsx`(신규), `src/main.tsx`,
  `index.html`, `src/App.tsx`, `src/components/*.tsx`(전체), `src/components/ui/Card.tsx`

---

## 2026-07-17 (39차) — 내 정보 팝업 닫기 버그 + 데스크탑 상시 사이드바

38차 배포 직후 피드백: 1) 내 정보(MyPage) 팝업의 "닫기" 버튼이 반투명 검정
배경(`bg-black/40`) 위에 놓여 대비가 낮아 거의 안 보임 — 클릭 자체는 가능했지만
사실상 나가는 방법을 못 찾는 버그. 2) 데스크탑에서도 탭 이동이 매번 햄버거를
눌러야만 가능해 불편함 — "데스크탑은 사이드바 상시로 나와도 되니 항상 보여주고
누르면 들어가게, 모바일은 지금처럼 유지"로 요청

### 완료
- [x] `src/components/MyPage.tsx` — 헤더 행에 흰색 카드 배경을 줘서 "닫기" 버튼
  대비 문제 해결 + 바깥(backdrop) 클릭 시에도 닫히도록 `onClick={onClose}` 추가
  (콘텐츠 영역은 `stopPropagation`으로 보호)
- [x] `src/App.tsx` — `lg:` 이상에서만 보이는 상시 사이드바(`<aside>`) 추가(로고 +
  TABS 목록, 클릭 시 바로 탭 전환). 기존 모바일 햄버거 버튼·오버레이·드로어는
  전부 `lg:hidden` 처리해 모바일 동작은 그대로 유지
- [x] tsc -b / oxlint / vite build 통과

### 검증 결과
- 본 세션에서는 Chrome 실동작 검증 미실시(정적 검증만) — 사용자 요청 시 진행

### 배포
- `npm run deploy` 완료 — https://9808f31a.budget-3wb.pages.dev

### 변경 파일
- `src/components/MyPage.tsx`, `src/App.tsx`

---

## 2026-07-17 (38차) — 헤더 닉네임 분리 + "내 정보" 화면

헤더에서 로고명("텅장")과 사용자 실명이 붙어 보이는 게 어색하다는 피드백. 로고는
좌측 유지, 우측에 별도 닉네임을 새로 받아 표시. 닉네임/비밀번호를 직접 관리할 수
있는 "내 정보" 화면도 신규 추가.

### 완료
- [x] `migrations/012_add_nickname.sql` — `users.nickname` 컬럼 추가 (NULL 허용),
  `schema.sql` 동기화 (001~012)
- [x] `functions/lib/auth.ts` — `validateNickname` 헬퍼 추가(2~12자, 공백 불가,
  한글/영문/숫자만)
- [x] `functions/api/auth/register.ts` — nickname 필수 파라미터로 받아 저장, 서버
  검증 추가
- [x] `functions/api/auth/login.ts`, `functions/api/auth/me.ts`(GET) — 응답에
  nickname(원본값, null 가능)·created_at 포함
- [x] `functions/api/auth/me.ts` — `onRequestPatch` 추가(닉네임 변경, 세션 자체
  검증 로직 내장 — `/api/auth/*`는 `_middleware.ts`에서 인증 체크를 건너뛰므로)
- [x] `functions/api/auth/password.ts`(신규, PATCH) — 현재 비밀번호 PBKDF2 재검증 후
  변경. **세션 처리 결정: 변경한 현재 세션은 유지하고, 같은 계정의 다른 세션은 전부
  무효화**(다른 기기 탈취 세션 대응이 목적이므로 방금 본인 확인한 현재 기기까지
  로그아웃시킬 필요는 없다고 판단)
- [x] `src/lib/nickname.ts`(신규) — 닉네임 정규식/검증을 AuthPage·MyPage·App 헤더
  프롬프트 3곳에서 공유 (서버 `validateNickname`과 규칙 동일하게 유지)
- [x] `src/contexts/AuthContext.tsx` — User 타입에 nickname/created_at 추가,
  register()에 nickname 인자, updateNickname/changePassword 함수 추가
- [x] `src/components/AuthPage.tsx` — 회원가입 폼에 닉네임 입력 필드 + 클라이언트
  검증 추가
- [x] `src/App.tsx` — 헤더 좌측은 로고만 남기고 기존 `{user.name}` 표시 제거, 우측에
  닉네임 버튼(드롭다운: 내 정보/로그아웃) 배치. 사이드 드로어의 중복 로그아웃
  버튼은 헤더 드롭다운이 모든 화면 폭에서 항상 보이게 되어 제거(더 이상 필요 없는
  `sm:hidden` 전용 버튼이었음). `user.nickname`이 null인 계정은 로그인 시 닉네임
  설정 유도 모달 표시(별도 dismiss 플래그를 DB에 두지 않고 nickname null 여부로만
  판단 — 설정 완료 시 자연히 다시 안 뜸, "나중에" 누르면 이번 세션에서만 숨김)
- [x] `src/components/MyPage.tsx`(신규) — 닉네임 인라인 수정, 이메일/가입일
  읽기전용, 비밀번호 변경 섹션(3필드), Toast/인라인 에러 처리, 코랄+카드형 톤,
  아이콘 없이
- [x] tsc -b(src) 통과, oxlint 통과, vite build 통과. `functions/`는 프로젝트
  tsconfig에 포함되어 있지 않아(`tsconfig.app.json`이 `src`만 include) 별도로
  `tsc --noEmit --ignoreConfig`로 애드혹 타입 체크 통과 확인

### 참고 — 기존 가입자 대응
- `nickname`이 NULL이면 로그인 응답에서 name으로 폴백 표시(헤더 텍스트: `user.nickname
  ?? user.name`)
- 로컬 D1은 아직 `npm run d1:init`으로 마이그레이션 미적용 상태 — 로컬 테스트 시
  실행 필요. 원격 D1은 아래에서 바로 적용함
- 본 세션에서는 Chrome 실동작 검증은 미실시 (사용자 요청 시 진행)

### 배포
- 원격 D1에 `migrations/012_add_nickname.sql` 적용 완료
- `npm run deploy` 완료 — https://17914796.budget-3wb.pages.dev

### 변경 파일
`migrations/012_add_nickname.sql`, `schema.sql`, `functions/lib/auth.ts`,
`functions/api/auth/register.ts`, `functions/api/auth/login.ts`,
`functions/api/auth/me.ts`, `functions/api/auth/password.ts`(신규),
`src/lib/nickname.ts`(신규), `src/contexts/AuthContext.tsx`,
`src/components/AuthPage.tsx`, `src/App.tsx`, `src/components/MyPage.tsx`(신규)

---

## 2026-07-17 (37차) — 로그인 화면 로고도 헤더와 동일하게 통일

36차에서 헤더(상단바+드로어)에 적용한 `logo.svg`를 로그인 화면(AuthPage)에도 동일하게
적용해달라는 요청. 기존 AuthPage는 `logo.png`(구버전 `logo_color_BG.png`, 흰 배경 PNG)를
쓰고 있었음 — 헤더와 로그인 화면이 서로 다른 로고 이미지를 쓰던 상태를 통일.

### 완료
- [x] `src/components/AuthPage.tsx` — `<img src="/logo.png">` → `<img src="/logo.svg">`로 교체
- [x] `public/logo.png` — 더 이상 참조하는 곳이 없어 삭제
- [x] tsc / oxlint / vite build 통과

### 검증 결과
- Chrome에서 로그인 화면(비로그인 상태) 진입 후 JS로 로고 `<img>`의 `src`를 `fetch` →
  SHA-1 계산 → `f93773261b...`로 헤더와 완전히 동일한 파일임을 확인

### 배포
- `npm run deploy` 완료 — https://1fc969b8.budget-3wb.pages.dev

### 변경 파일
- `src/components/AuthPage.tsx`
- `public/logo.png`(삭제)

---

## 2026-07-17 (36차) — 소통 오류 발견: "로고"는 헤더의 작은 아이콘 자리를 가리키는 말이었음

35차까지 "로고"를 AuthPage(로그인 화면)의 큰 심볼로 이해하고 작업했는데, 사용자가 화면
캡처에 헤더의 작은 아이콘 부분을 동그라미로 표시하며 "내가 로고를 보고 있는 부분은
여기야"라고 지적 — 사용자가 말한 "로고"는 줄곧 **헤더(상단바+사이드 드로어)의 아이콘+
텍스트 자리**를 가리키고 있었음. 그동안 그 자리는 `favicon.svg`(아이콘)와 별도
`<h1>텅장</h1>`(실제 텍스트, Jua 폰트) 두 개를 나란히 배치해둔 상태였어서, 사용자가 준
로고 파일을 계속 AuthPage 쪽에만 반영하고 있었던 게 어긋남의 원인.

또한 `logo_color.svg`(BG 없는 버전)를 사용자 브라우저에서 열면 새 디자인(아웃라인 지갑+
텅장 두 글자)이 나온다고 했는데, 이 세션에서 Read 도구/bash `cat`/PowerShell 네이티브
읽기 세 가지 방법으로 재차 확인해도 전부 이전 디자인(솔리드 채움+ 텅 한 글자, SHA256
`B99F87EB...`)만 나와 실제로는 사용자가 화면 갱신이 안 된 탭을 보고 있었을 가능성이
높았음(파일 자체는 옛날 내용이 맞음, 재확인 결과 여전히 동일). 그런데 사용자가 "그냥
적용만 해봐"라고 재요청 — 더 이상 반박하지 않고 그대로 적용

### 완료
- [x] `public/logo.svg` — `logo_color.svg`(488×186, 사용자가 제공한 파일 원본 그대로) 내용으로
  재생성
- [x] `src/App.tsx` — 헤더 상단바 + 사이드 드로어 2곳에서 `<img favicon.svg>` +
  `<h1/h2>텅장</h1>`(Jua 폰트) 조합을 제거하고 `<img src="/logo.svg">` 하나로 통합(아이콘+
  워드마크가 이미 파일에 포함돼 있어 텍스트 별도 렌더링 불필요)
- [x] `index.html` — 더 이상 안 쓰는 Google Fonts(Jua) preconnect/stylesheet 링크 제거
- [x] `src/index.css` — 더 이상 안 쓰는 `.font-brand` 규칙 제거
- [x] tsc / oxlint / vite build 통과

### 검증 결과 — 이번에도 스크린샷 대신 바이트 해시로 1차 확인 후 스크린샷으로 재확인
- Chrome에서 로그인 후 페이지의 모든 `<img>` 엘리먼트를 순회하며 JS로 각각 `fetch` →
  SHA-1 계산 → 헤더의 이미지(상단바+드로어 2곳 모두) 해시가 로컬 `public/logo.svg`와
  **완전 일치**(`f93773261b...`) 확인. 이어서 실제 스크린샷도 정상적으로 캡처되어(이번엔
  타임아웃 없었음) 헤더에 지갑 아이콘+"텅장" 워드마크가 하나의 이미지로 합쳐져 나오는 것을
  육안으로도 확인

### 배포
- `npm run deploy` 완료 — https://9f72856b.budget-3wb.pages.dev

### 변경 파일
- `public/logo.svg`(재생성)
- `src/App.tsx`, `index.html`, `src/index.css`

---

## 2026-07-17 (35차) — 로고를 실제 최종 디자인 PNG로 교체 (SVG 파일 불일치 문제 발견)

34차에서 적용한 `logo_color_BG.svg`가 사용자 확인 결과 실제로 원하는 디자인과 다름
("이거 아닌데?" — 실제 브라우저에 열어본 화면 캡처를 보내줌). 파일을 Read 도구와 셸
`cat` 둘 다로 재확인했으나 여전히 이전과 동일한(솔리드 채움 지갑 + "텅" 글자 하나만 있는)
내용이 나와, 그 SVG 파일 자체가 사용자가 실제로 보고 있는 디자인과 다르다는 결론을 내림
(디자인 툴의 내보내기/저장 문제로 추정, 원인 특정은 안 됨). 사용자가 PNG로 대신 제공.

### 완료
- [x] `C:\Users\db848\Desktop\텅장_logo\logo_color_BG.png`(600×300, 아웃라인 지갑 아이콘 +
  "텅장" 두 글자, 흰 배경) 확인 후 `public/logo.png`로 저장, 기존 `public/logo.svg` 삭제
- [x] `src/components/AuthPage.tsx` — 로고 img src를 `/logo.svg` → `/logo.png`로 변경
- [x] tsc / oxlint / vite build 통과

### 검증 결과 — 스크린샷 도구 불안정으로 바이트 단위 검증으로 대체
- Chrome 스크린샷 캡처가 이번 확인 과정에서 반복적으로 타임아웃되거나(CDP
  `Page.captureScreenshot` 30초 타임아웃 여러 번) 축소압축된 캡처만 나와 육안으로 새
  디자인(아웃라인 스타일)인지 판단하기 어려웠음. 대신 페이지에 로드된 `<img>` 엘리먼트의
  실제 src를 `fetch`해서 바이트를 가져와 SHA-1 해시 계산 → 로컬 `public/logo.png` 파일의
  SHA-1과 **완전 일치**(`10ade74c...`) 확인. `getBoundingClientRect()`로 렌더링 크기도
  160×80(원본 600×300 비율 그대로, 잘림/왜곡 없음) 확인 — 화면 캡처가 아니라 실제 로드된
  바이트와 렌더링 치수로 정확성을 검증함

### 배포
- `npm run deploy` 완료 — https://ab53549e.budget-3wb.pages.dev

### 변경 파일
- `public/logo.png`(신규), `public/logo.svg`(삭제)
- `src/components/AuthPage.tsx`

---

## 2026-07-17 (34차) — 로고 업데이트 (logo_color_BG.svg로 재적용)

사용자가 `C:\Users\db848\Desktop\텅장_logo\logo_color_BG.svg`(흰 배경 포함 버전, 600×300)를
제공. 읽어서 이전 `public/logo.svg`(투명 배경, 488×186)와 비교 확인 후 그대로 교체.

### 완료
- [x] `public/logo.svg` — 사용자 제공 버전으로 교체
- [x] `npm run deploy` 완료
- [x] Chrome으로 로그인 화면 실제 렌더링 확인 — 정상 표시

### 배포
- https://65ff68d7.budget-3wb.pages.dev

### 변경 파일
- `public/logo.svg`

---

## 2026-07-17 (33차) — 파비콘 업데이트 (사용자가 수정한 버전으로 재적용)

사용자가 같은 경로(`favicon.svg`)의 파일을 다시 다듬어서 재적용 요청 — 아이콘 비율/여백이
조금 조정된 버전(path 좌표 갱신). 로고(logo.svg)는 이어서 별도로 다시 작업할 예정이라고 함.

### 완료
- [x] `public/favicon.svg` — 사용자가 갱신한 최신 버전으로 교체
- [x] `npm run deploy` 완료

### 배포
- https://a06e194b.budget-3wb.pages.dev

### 변경 파일
- `public/favicon.svg`

---

## 2026-07-17 (32차) — 사용자 제공 실제 벡터 로고/파비콘으로 최종 교체

29차부터 SVG 손그림 시도(2회 실패) → 원본 시안 PNG 크롭(3차, 임시 조치)까지 거친 로고
작업을, 사용자가 직접 만든 실제 벡터 파일 2개를 받아 마무리:
`C:\Users\db848\Desktop\텅장_logo\favicon.svg`(아이콘 단독), `logo_color.svg`(아이콘+
"텅장" 커스텀 레터링이 합쳐진 전체 로고). 둘 다 읽어서 내용 확인 후 그대로 적용.

### 완료
- [x] `public/favicon.svg` — 사용자 제공 파일로 교체(흰 배경 둥근 사각형 + 코랄 지갑
  아이콘 + 반짝임, 64×64 순수 벡터). 29~31차에서 임시로 썼던 `public/favicon.png`(원본
  시안 크롭) 삭제
- [x] `public/logo.svg`(신규) — 사용자 제공 전체 로고(아이콘+"텅장" 커스텀 레터링이 하나로
  합쳐진 488×186 벡터) 추가
- [x] `index.html` — favicon 링크를 `image/png` → `image/svg+xml`, `/favicon.png` →
  `/favicon.svg`로 변경
- [x] `src/App.tsx` — 헤더 + 사이드 드로어의 아이콘 `<img>` src를 `/favicon.svg`로 교체
  (좁은 공간이라 아이콘만 쓰고, 옆의 "텅장" 텍스트는 기존 Jua 폰트 그대로 유지)
- [x] `src/components/AuthPage.tsx` — 로그인 화면은 아이콘+텍스트를 따로 조합하던 구조를
  버리고 `public/logo.svg`(이미 워드마크가 포함된 전체 로고) 하나로 교체, 중복되는 별도
  `<h1>텅장</h1>` 텍스트 제거
- [x] tsc / oxlint / vite build 전부 통과

### 검증 결과
- Chrome으로 실제 배포 화면 확인: 헤더의 작은 아이콘, 로그인 화면의 전체 로고(지갑
  아이콘 + "텅장" 커스텀 레터링) 둘 다 정확히 렌더링됨을 확대 스크린샷으로 확인. 이번엔
  사용자가 준 실제 디자인 파일을 그대로 쓴 거라 형태 왜곡 문제 자체가 없음

### 배포
- `npm run deploy` 완료 — https://bd9bcf17.budget-3wb.pages.dev

### 변경 파일
- `public/favicon.svg`(교체), `public/logo.svg`(신규), `public/favicon.png`(삭제)
- `index.html`, `src/App.tsx`, `src/components/AuthPage.tsx`

---

## 2026-07-17 (31차) — "한눈에 보기"에 월간/연간 탭 추가

사용자 요청: "일간 월간 주간 연간 다 있어야됨 새로 작업해줘 있는건 나두면된다" — 27차에서
만든 "한눈에 보기"엔 일일/주간만 있었는데, 월간/연간까지 4종 전부 갖추라는 요청. 기존
월정산/연정산 탭(막대그래프+카드 요약 스타일)은 그대로 두고, "한눈에 보기" 안에 주간표와
같은 종이 다이어리 격자 스타일로 월간/연간을 추가로 만듦.

### 완료
- [x] `functions/lib/settlement.ts` — `calculateMonthlySettlement`(해당 월의 모든 날짜를
  행으로, 마지막에 월계), `calculateAnnualSettlement`(1~12월을 행으로, 마지막에 연계) 추가.
  주간 정산이 이미 갖고 있던 `IncomeBucket`/`ExpenseBucket`/`emptyIncomeBucket`/`addIncome`/
  `addExpense` 헬퍼를 그대로 재사용
- [x] `functions/api/settlement/monthly.ts`(신규 GET `?month=YYYY-MM`),
  `functions/api/settlement/annual.ts`(신규 GET `?year=YYYY`)
- [x] `src/types.ts` — `MonthlySettlement`/`MonthlySettlementDay`, `AnnualSettlement`/
  `AnnualSettlementMonth` 타입 추가(기존 `SettlementIncomeBucket`/`SettlementExpenseBucket` 재사용)
- [x] `src/lib/api.ts` — `fetchMonthlySettlement`/`fetchAnnualSettlement` 추가
- [x] `src/components/MonthlySettlementTable.tsx`(신규) — `WeeklySettlement.tsx`와 동일한
  격자 테이블 스타일로, 해당 월의 모든 날짜를 행으로(1~28/29/30/31일) + 마지막에 월계.
  월 이동 네비게이션(◀▶ + "이번 달")
- [x] `src/components/AnnualSettlementTable.tsx`(신규) — 동일 스타일로 1~12월을 행으로 +
  마지막에 연계. 연도 이동 네비게이션(◀▶ + "올해")
- [x] `src/components/OverviewView.tsx` — 서브탭을 2개(일일/주간)에서 4개(일일/주간/월간/
  연간)로 확장, `grid-cols-2` → `grid-cols-4`
- [x] tsc(functions+frontend) / oxlint / vite build 전부 통과

### 검증 결과
- Chrome으로 실제 배포 화면 확인: 4개 탭 전부 정상 표시(처음 로드 시 스크린샷이 한 번
  잘려 보였는데 재캡처하니 정상 — 실제 DOM 측정(`getBoundingClientRect`)으로도 오버플로
  없음을 확인, 캡처 타이밍 이슈였을 뿐 레이아웃 버그 아니었음)
- 월간 탭: 7월 16일(목) 행에 의료 5,000원 정확히 표시
- 연간 탭: 6월 행에 식비 20,000원, 7월 행에 의료 5,000원, 연계 행에 각각 정확히 합산되어
  표시됨을 확인 (30차에서 만들어둔 월 경계 테스트 데이터를 그대로 재사용해 검증)

### 배포
- 원격 DB 마이그레이션 불필요(기존 transactions 테이블만 조회)
- `npm run deploy` 완료 — https://a73d3df1.budget-3wb.pages.dev

### 변경 파일
- `functions/lib/settlement.ts`
- `functions/api/settlement/monthly.ts`(신규), `functions/api/settlement/annual.ts`(신규)
- `src/types.ts`, `src/lib/api.ts`
- `src/components/MonthlySettlementTable.tsx`(신규), `AnnualSettlementTable.tsx`(신규)
- `src/components/OverviewView.tsx`

---

## 2026-07-17 (30차) — 일일 정산 전일잔액이 월 경계에서 리셋되던 버그 수정

사용자 문의: "한눈에 보기가 누적금액만 나오고 이전에 작성한 내용은 연동이 안되어있네?"

### 원인
27차에서 `calculateDailySettlement`의 전일잔액을 "해당 월 1일부터 전날까지의 누적"으로
설계했었음(문서화된 의도적 결정). 근데 이 앱은 여러 달에 걸쳐 실사용 데이터가 쌓여있는
상태라, 매달 1일이 되면 전일잔액이 0으로 리셋되면서 그 이전 달까지 기록한 모든 내용이
전일잔액 계산에서 통째로 빠지는 문제였음 — 실제 종이 가계부의 "전월이월" 개념과 어긋남.

### 완료
- [x] `functions/lib/settlement.ts` — `calculateDailySettlement`의 전일잔액 계산을
  월 경계 제한 없이 **해당 날짜 이전 전체 거래 누적**으로 변경. 쿼리도 전일잔액용(전체
  기간, `type`/`amount`만)과 당일 목록용(`date = ?`, 전체 컬럼) 2개로 분리해 더 명확하게 함
- [x] 주간 정산의 "누계"(월초~해당 주)는 원래 요청 스펙에 명시된 대로 월 단위 리셋이
  맞아서 그대로 유지 — 이번 버그는 일일 정산의 전일잔액에만 해당
- [x] tsc(functions) / oxlint 통과

### 검증 결과
- Chrome으로 실사용 시나리오 재현: 테스트 계정에 6월 10일 지출 20,000원, 7월 16일 지출
  5,000원 등록 → 7월 17일(오늘) 일일 정산의 전일잔액이 정확히 **-25,000원**(월 경계를
  넘어 두 거래 모두 합산)으로 표시됨을 실제 화면에서 확인. 수정 전이었다면 6월 거래가
  무시되고 -5,000원만 표시됐을 상황

### 배포
- `npm run deploy` 완료 — https://a7a834cd.budget-3wb.pages.dev

### 변경 파일
- `functions/lib/settlement.ts`

---

## 2026-07-16 (29차) — 로고/파비콘 교체

사용자가 데스크탑에 있던 로고 시안 4개(지갑 아이콘형 1개, "텅" 글자 심볼형 3개)를 제시하고
마음에 드는 걸 골라 적용해달라고 요청.

### 결정
"텅" 글자를 굵게 살린 단색 코랄 배경 + 화이트 글자 버전(시안 3번, 좌측 variant)을 선택.
이유: (1) 지갑 아이콘(1번)은 파비콘처럼 작은 크기에서 디테일이 뭉개지기 쉬움 (2) 남색을
섞은 변형(4번)은 지금 앱이 12차에서 이미 코랄 단색 브랜드로 완전히 통일해둔 상태라 새 색을
들이면 팔레트가 다시 깨짐 (3) 아웃라인/스피커 아이콘 변형(2번의 세번째 심볼)은 서비스
성격과 무관해 보임 → 결국 기존 코랄 브랜드와 가장 잘 맞고 작은 크기에서도 읽히는 3번 선택

### 완료
- [x] `public/favicon.svg` — 기존 인디고 지갑 아이콘(21차, 12차 코랄 전환 때 놓쳤던 파일)을
  코랄(`#D85A30`, 앱의 `--color-coral-400`과 동일) 배경 + 흰색 "텅" 글자로 교체
- [x] `src/App.tsx` — 헤더 타이틀과 사이드 메뉴 드로어 타이틀 앞에 파비콘 이미지(`/favicon.svg`)
  추가해 심볼+텍스트 조합으로 표시(시안의 "심볼+텍스트" 레이아웃 참고)
- [x] `src/components/AuthPage.tsx` — 로그인 화면 상단에도 동일하게 심볼 추가
- [x] tsc -b / oxlint / vite build 전부 통과

### 재작업 (같은 날 후속) — "텅" 글자 버전이 별로라는 피드백
사용자가 "별로인데?"로 반려. 4개 시안 중 1번(지갑 아이콘) 이미지를 다시 첨부하며
구체적으로 지정: **파비콘은 1번 이미지 상단의 "심볼만"(둥근 사각+지갑+반짝임)**,
**로고는 "심볼+텍스트" 중 좌측 하단의 작은 조합(아이콘+텅장 텍스트)**, **색은 지금 것보다
조금만 낮춰서(연하게)**.
- [x] `public/favicon.svg` — "텅" 글자 버전을 폐기하고 지갑 아이콘(반짝임 3획 + 지갑
  파우치 모양 + 접힘선 + 걸쇠)으로 다시 제작. 색은 `#D85A30`(coral-400)에서 한 단계 밝힌
  `#E67A54`로 교체(사용자가 "너무 진하다"고 한 부분 반영, 완전히 옅은 코랄(coral-200 등)
  까지는 안 가고 중간 정도로 조정)
- [x] "로고"(아이콘+텅장 텍스트 조합)는 App.tsx/AuthPage.tsx에 이미 `<img favicon.svg>` +
  `<h1>텅장</h1>`을 나란히 배치해둔 구조가 요청한 "심볼+텍스트" 레이아웃과 동일해 별도
  이미지 합성 없이 그대로 유지(JSX 변경 불필요, 아이콘 내용만 교체됨)
- [x] tsc -b / oxlint / vite build 통과

### 검증 결과
- tsc/oxlint/vite build 통과. 실제 화면(Chrome) 확인은 사용자가 도구 사용을 중단시키고
  대신 구체적인 참고 이미지+지시를 줘서 그에 맞춰 바로 반영 — 추가 확인 없이 배포함.
  마음에 안 들면 다시 피드백 요청

### 2차 재작업 (같은 날, 또 반려) — 아이콘이 지갑처럼 안 보이고 글자체도 안 따라감
사용자가 실제 배포된 화면 스크린샷을 첨부하며 재반려: 1차 재작업 때 만든 지갑 아이콘이
곡선 위주 path라 지갑이 아니라 알 수 없는 뭉툭한 도형(전구/컵 비슷하게)으로 보임. 또한
"글자 모양도 따라가야지"라며 "텅장" 텍스트 폰트도 참고 이미지의 통통하고 둥근 손글씨풍
서체를 따라가야 한다고 지적 — 그동안 앱 기본 시스템 폰트(Apple SD Gothic Neo 등)로만
렌더링되던 걸 놓치고 있었음.
- [x] `public/favicon.svg` — 곡선(Q) 위주였던 지갑 path를 각진 사각형 상단 + 대각선
  옆면이 하단 한 점으로 모이는 "방패/연" 모양(직선 위주)으로 재작성해 지갑의 각진 윤곽을
  분명하게 함. 상단에 접힘선을 나타내는 가로선 + 클래스프로 모이는 대각선 2개 추가, 하단에
  걸쇠(사각+원) — 참고 이미지의 구조(사각 상단→대각선→걸쇠)를 그대로 재현
- [x] `index.html` — Google Fonts "Jua"(둥글고 통통한 무료 한글 서체, OFL 라이선스) 로드
  추가(preconnect 2개 + stylesheet 링크)
- [x] `src/index.css` — `.font-brand` 유틸리티 클래스 추가(`Jua` → 시스템 고딕 순으로 폴백)
- [x] `src/App.tsx`(헤더 h1, 사이드메뉴 드로어 h2), `src/components/AuthPage.tsx`(로그인
  h1) — 기존 `font-extrabold` 대신 `font-brand` 클래스 적용("텅장" 워드마크 3곳)
- [x] tsc -b / oxlint / vite build 통과

### 검증 결과 (2차)
- tsc/oxlint/vite build 통과. **Chrome 확장이 이번엔 연결되지 않아 실제 렌더링을 직접
  보지 못한 채 배포함** — 두 번 연속 반려된 상황이라 이 사실을 사용자에게 명확히 알리고
  재확인 요청 필요

### 3차 재작업 (같은 날, Chrome 확장 연결 후) — 손그림 벡터화를 포기하고 원본 이미지 크롭 사용
사용자가 배포 화면 스크린샷을 다시 첨부하며 재반려: 2차 지갑도 여전히 지갑처럼 안 보이고
(방패/보석 모양처럼 보임) 글자체도 안 따라간다고 지적. 직접 손으로 SVG path를 그려 원본
일러스트(비대칭으로 열린 반지갑 + 늘어진 덮개 + 걸쇠 형태, 직선/곡선이 복잡하게 섞여
있음)를 재현하는 시도를 2번 연속 실패한 뒤, 접근 자체를 변경:
- [x] 원본 시안 PNG(`C:\Users\db848\Desktop\1784209214331.png`, 1254×1254)에서 PowerShell
  `System.Drawing`으로 "심볼만" 아이콘 부분을 정확히 크롭(420,130,420,420 → 420×420,
  둥근 사각형 네 모서리가 전부 온전하게 잘리도록 여러 번 크롭 좌표를 미세조정하며 확인)
- [x] 크롭한 이미지를 256×256으로 리사이즈 후, 크롭 경계의 흰색 배경 모서리 4곳만
  BFS 플러드필로 투명화(지갑 그림 내부의 흰색 부분과 연결돼 있지 않아 안전하게 구분됨) —
  브라우저 탭 아이콘으로 쓸 때 CSS 라운딩이 안 먹으니 이미지 자체의 모서리를 투명하게
  만들어야 함
- [x] `public/favicon.png`(신규, 원본 그대로) — 기존 손으로 그린 `favicon.svg` 폐기
- [x] `index.html`의 favicon 링크, `src/App.tsx`(헤더+드로어 2곳)/`src/components/AuthPage.tsx`
  의 `<img>` src를 전부 `/favicon.svg` → `/favicon.png`로 교체
- [x] tsc -b / oxlint / vite build 통과
- [x] **Chrome으로 실제 배포 화면 확인** — 로그인 화면에서 아이콘이 참고 이미지와 동일한
  지갑 모양으로 정확히 보이고, "텅장" 텍스트도 Jua 폰트로 둥글고 통통하게 렌더링됨을
  확대 스크린샷으로 직접 확인

### 검증 결과 (3차, 최종)
- tsc/oxlint/vite build 통과
- Chrome 확장 연결 후 실제 배포 화면(로그인 페이지)을 확대해서 확인 — 아이콘/폰트 전부
  참고 이미지와 일치. 헤더/드로어는 로그인 화면과 동일한 `<img>` 엘리먼트를 크기만 다르게
  재사용하는 구조라 별도 확인 없이도 동일하게 나올 것으로 판단(테스트 계정 로그인 자체는
  이 작업과 무관한 이유로 실패해 진입은 못 함)

### 배포
- `npm run deploy` 완료 — https://9eff7bcb.budget-3wb.pages.dev (텅 글자 버전, 반려됨)
  → 지갑 아이콘 1차 재작업(곡선 위주, 또 반려): https://9bea5cd4.budget-3wb.pages.dev
  → 지갑 아이콘 2차 재작업(각진 구조, 또 반려) + Jua 폰트 적용: https://cf370d14.budget-3wb.pages.dev
  → 원본 이미지 크롭으로 3차 재작업(최종, Chrome으로 확인 완료): https://362452b7.budget-3wb.pages.dev

### 변경 파일
- `public/favicon.png`(신규, 원본 크롭), `public/favicon.svg`(삭제)
- `index.html`, `src/index.css`
- `src/App.tsx`, `src/components/AuthPage.tsx`

---

## 2026-07-16 (28차) — 기존 카드 수정 시에도 카드 프리셋 선택 가능하게 변경

사용자 요청: 25차에서 만든 "카드 상품 선택" 드롭다운이 새 카드 등록에서만 보이던 것을,
이미 등록해둔 카드를 수정할 때도 골라서 나중에 혜택 규칙을 추가할 수 있게 해달라는 요청.

### 완료
- [x] `src/components/CardManager.tsx` — 프리셋 드롭다운을 감싸던 `{!editingId && (...)}`
  조건 제거, 수정 폼에서도 항상 노출
- [x] `handleSave` — `preset` 계산에서 `!editingId` 조건 제거. 카드 수정 시에도
  `applyPreset`을 호출하도록 변경(`updateCard` 후 `cardId = editingId`로 그대로 사용).
  **기존 카드는 이미 등록된 혜택 규칙이 있을 수 있어, 수정 중 프리셋을 선택했을 때만
  `window.confirm`으로 한 번 확인**(“기존 혜택 규칙은 그대로 유지되고 새로 추가됩니다”) —
  새 카드 등록 시에는 처음이라 확인 없이 기존처럼 바로 적용. 확인을 취소해도 카드 자체의
  나머지 수정 내용(이름/색상/결제일 등)은 그대로 저장됨(프리셋 적용만 건너뜀)
- [x] `startEdit` — 수정 시작할 때 `presetId`를 항상 `''`(직접 입력)로 리셋 — 카드 자체엔
  저장된 프리셋 값이 없으므로, 사용자가 매번 명시적으로 골라야만 적용되게 함(수정 폼을
  열 때마다 의도치 않게 프리셋이 재적용되는 일이 없도록)
- [x] tsc -b / oxlint / vite build 전부 통과

### 검증 결과
- tsc/oxlint/vite build 전부 통과. 사용자 요청대로 curl/wrangler dev/Chrome 화면 검증은
  진행하지 않음(요청 시에만 진행)

### 배포
- 원격 DB 마이그레이션 불필요(코드 변경만)
- `npm run deploy` 완료 — https://60756bf3.budget-3wb.pages.dev

### 변경 파일
- `src/components/CardManager.tsx`

---

## 2026-07-16 (27차) — "한눈에 보기" 화면 신규 추가 (일일 정산 + 주간 정산)

사용자 요청: 종이 다이어리 레이아웃(일자별 카드: 전일잔액/수입/수입합계/지출/지출합계/
오늘잔액, 주간 요약표: 날짜×카테고리 격자+주계/누계)을 참고해 새 화면 추가. 시각 톤은
코랄+카드형 유지, 아이콘 없음(내용상). 카테고리는 categories.ts 기준으로 유동 구성.

### 완료
- [x] `functions/lib/settlement.ts`(신규) — `calculateDailySettlement`/`calculateWeeklySettlement`
  헬퍼. **전일잔액/누계 기준을 "해당 월 1일부터"로 결정**(계정 생성 시점부터의 전체 누적이
  아님) — SummaryCard/AnnualReport 등 기존 화면도 전부 선택 기간(월/연) 안에서만 수입-지출을
  계산하고 이전 기간에서 잔액을 이어받지 않아, 이 앱에 "평생 누적 잔액" 개념 자체가 없었음.
  기존 관례와의 일관성을 위해 월초 기준을 채택(사용자가 제시한 두 옵션 중 더 단순한 쪽)
- [x] `functions/api/settlement/daily.ts`(신규) — GET `?date=YYYY-MM-DD`, 해당 월 1일~해당일
  거래를 한 번에 조회해 전일(date 미만)/당일로 나눠 계산
- [x] `functions/api/settlement/weekly.ts`(신규) — GET `?week_start=YYYY-MM-DD`(월요일).
  수입은 `소득`(카테고리='급여')/`예금인출`(카테고리='예금인출')/`기타`(나머지 전부) 3그룹으로
  단순 분류(이 앱 기본 수입 분류엔 예금인출 개념이 없어 사용자가 그 이름으로 커스텀 분류를
  만들었을 때만 잡힘). 지출은 카테고리 문자열 그대로 키로 집계(하드코딩 없음 — 프론트가
  categories.ts로 컬럼을 결정하고 백엔드는 있는 그대로 반환). 주가 월 경계를 걸치면
  `week_start`가 속한 달을 기준으로 누계 계산(종이 다이어리의 주간표가 한 달 페이지 안에
  속한다는 전제와 동일)
- [x] `src/types.ts` — `DailySettlement`/`SettlementIncomeBucket`/`SettlementExpenseBucket`/
  `WeeklySettlementDay`/`WeeklySettlement` 타입 추가
- [x] `src/lib/api.ts` — `fetchDailySettlement`/`fetchWeeklySettlement` 추가
- [x] `src/lib/format.ts` — `shiftDate`(일수 가감)/`mondayOf`(해당 날짜가 속한 주의 월요일)
  유틸 추가 (이 앱에 별도 주 시작 기준이 없어 월요일 시작으로 고정)
- [x] `src/components/DailySettlement.tsx`(신규) — 하루 단위 카드 UI. 전일잔액/수입내용
  리스트/수입합계(파랑)/지출내용 리스트/지출합계(코랄)/오늘잔액 순서. 좌우 화살표 +
  App.tsx의 월 이동 스와이프와 동일한 순수 touch 이벤트 방식으로 하루씩 스와이프 이동.
  각 리스트 항목 탭 시 `onEditTransaction` 콜백 호출
- [x] `src/components/WeeklySettlement.tsx`(신규) — 날짜×카테고리 격자 테이블(요청대로 이
  화면만 카드형이 아닌 테두리 있는 grid/table 사용). 헤더 2단(수입/지출 그룹 + 개별 컬럼),
  지출 컬럼은 `getCategories('expense')`로 동적 구성(하드코딩 없음). 마지막 두 행 주계/누계.
  좁은 화면에서 `overflow-x-auto`로 가로 스크롤(기존 AnnualReport 월별 표와 동일 원칙)
- [x] `src/components/OverviewView.tsx`(신규) — "한눈에 보기" 탭의 일일/주간 서브탭 전환 래퍼
- [x] `src/components/TransactionForm.tsx` — **수정 모드 추가**: `editTarget`/`onEditApplied`/
  `onUpdateSubmit` prop 신규. 한눈에 보기에서 항목 탭 시 이 폼이 해당 거래로 채워지고 제출 시
  `onSubmit`(생성) 대신 `onUpdateSubmit`(수정)을 호출. 혜택 매칭/예산 미리보기/템플릿 관련
  UI는 수정 모드에서 전부 숨김(`UpdateTransaction`에 할인·적립 필드가 없고, 예산 미리보기는
  수정 중인 거래의 기존 금액이 이미 현재 사용액에 포함돼 있어 그대로 쓰면 부정확해짐 —
  TransactionList의 기존 인라인 수정과 동일하게 "혜택 재계산 없는 단순 수정"으로 통일).
  `TransactionPrefill`에 `date` 필드 추가(복제는 여전히 오늘로 재설정하지만, 수정은 원래
  날짜를 유지해야 해서 필요)
- [x] `src/App.tsx` — `overview` 탭 추가(사이드 메뉴에 "한눈에 보기"), `editTarget` 상태 +
  `handleEditRequest` 추가해 한눈에 보기 → 홈 탭 전환 + TransactionForm 수정모드 진입 연결
  (`onUpdateSubmit`은 기존 `handleUpdate` 그대로 재사용). 홈 화면 SummaryCard 아래에
  "한눈에 보기 →" 링크 추가(필수 아니지만 요청에서 고려 사항으로 언급됨)
- [x] tsc -b / oxlint / vite build 전부 통과 (functions/는 `tsc --ignoreConfig --lib es2022`로 별도 확인)

### 추가 요청 반영 — 주간표 지출합계 컬럼 (같은 날 후속)
- `src/components/WeeklySettlement.tsx` — 지출 카테고리 컬럼들 뒤에 "지출합계" 컬럼 추가.
  백엔드(`functions/lib/settlement.ts`)의 `ExpenseBucket`은 애초에 `addExpense`가 카테고리별
  합계와 함께 `total` 키도 같이 누적하고 있어서 API 응답에 이미 포함돼 있었음 — 프론트에서
  `expense.total`을 읽어 열만 추가하면 됐고 백엔드 변경은 불필요했음

### 스코프 결정 (사용자 확인 없이 판단, 다르면 이후 조정)
- 한눈에 보기 탭은 App.tsx 헤더의 월/연 네비게이션 조건에 포함시키지 않음 — 일일 정산은
  월 경계에 매이지 않는 연속적인 날짜 스크러버이고 주간 정산도 자체 주 단위 네비게이션이
  있어, 헤더의 월 이동 화살표와 이중으로 존재하면 오히려 혼란스러움. 두 하위 컴포넌트가
  각자 자기 날짜/주 상태를 독립적으로 관리(연정산 탭이 헤더에서 연도 네비게이션만 쓰는
  것과 비슷한 예외 처리)

### 검증 결과
- tsc/oxlint/vite build 전부 통과
- 사용자 요청대로 이번엔 curl/wrangler dev/Chrome 화면 검증은 진행하지 않음(요청 시에만
  진행하기로 함) — 코드 리뷰 + 타입체크만으로 확인

### 배포
- 원격 DB 마이그레이션 불필요(기존 transactions 테이블만 조회, 스키마 변경 없음)
- `npm run deploy` 완료 — https://fbbded8e.budget-3wb.pages.dev (지출합계 컬럼 추가 후
  재배포: https://68735b8b.budget-3wb.pages.dev)

### 변경 파일
- `functions/lib/settlement.ts`(신규)
- `functions/api/settlement/daily.ts`(신규), `functions/api/settlement/weekly.ts`(신규)
- `src/types.ts`, `src/lib/api.ts`, `src/lib/format.ts`
- `src/components/DailySettlement.tsx`(신규), `WeeklySettlement.tsx`(신규), `OverviewView.tsx`(신규)
- `src/components/TransactionForm.tsx`, `src/App.tsx`

---

## 2026-07-16 (26차) — 카드 프리셋 4번째 추가: NH농협카드 zgm.the pay

25차에서 만든 `src/lib/cardBenefitPresets.ts`에 4번째 프리셋만 추가하는 작은 작업.

### 완료
- [x] `src/lib/cardBenefitPresets.ts` — `nh-zgm-the-pay` 프리셋 추가. `benefit_groups`에
  "zgm.the pay 통합한도"(월 100,000원) 생성 후 discount 타입 혜택 3개를 전부 이 그룹에
  연결(개별 monthly_cap 없음, 그룹 한도로 통합 관리): 전 가맹점 1%, NH페이 온라인 1.7%,
  기타 간편결제 1.2%. 무실적 카드라 memo에 "전월실적 조건 없음"만 기록(다른 프리셋처럼
  "전월실적 N원 이상" 문구 없음)
- [x] **매칭 우선순위 처리**: 지금 거래 데이터 모델은 "카드로 결제했다"는 것만 기록하고
  그 카드가 실제 어떤 앱(NH페이/삼성페이/네이버페이 등)으로 결제됐는지는 추적하지 않아서,
  어떤 혜택이 실제로 적용될지 자동 판별이 불가능함 — 3개 혜택 전부 `category`/
  `merchant_pattern`을 비워둬서 `benefitMatcher.ts`의 `calcScore`가 셋 다 동일하게
  10점("전체 적용 규칙")을 받게 함. 이러면 자동으로 하나를 우선시키지 않고 매칭 시
  셋 다 후보로 함께 뜨며(`findMatchingBenefits`가 최고 점수 동점 전부 반환하는 기존
  로직 그대로 재사용), 사용자가 실제 결제 방식에 맞는 걸 직접 선택. NH페이 혜택에
  `merchant_pattern="NH페이"`를 넣는 방안도 검토했으나, 그러면 calcScore가 100/-1로
  갈려서 다른 두 혜택(10점)과 동점이 안 되고 오히려 자동으로 우선/배제되는 문제가 생겨
  요청한 "직접 선택" 방식과 맞지 않아 채택 안 함 — 대신 각 memo에 어떤 결제수단일 때
  해당하는지 안내 문구로만 남김
- [x] `src/components/CardManager.tsx` — **변경 불필요**: "카드 상품 선택" 드롭다운이
  이미 `CARD_BENEFIT_PRESETS` 배열을 그대로 매핑해 렌더링하고, 그룹 표시("그룹명 ·
  통합한도 N원/월")도 `benefit_group_id` 기준으로 이미 일반화돼 있어서 프리셋 데이터
  추가만으로 프론트가 자동으로 새 옵션/그룹 표시를 지원함
- [x] tsc -b / oxlint 통과

### 검증 결과
- tsc/oxlint 통과. 사용자 요청대로 이번엔 curl/wrangler dev/Chrome 화면 검증은
  진행하지 않음(요청 시에만 진행하기로 함)

### 배포
- 원격 DB 마이그레이션 불필요(기존 benefit_groups/card_benefits 스키마 그대로 사용,
  신규 프리셋은 프론트 정적 데이터 추가일 뿐)
- `npm run deploy` 완료 — https://f0cc9af5.budget-3wb.pages.dev

### 변경 파일
- `src/lib/cardBenefitPresets.ts`

---

## 2026-07-16 (25차) — 카드 혜택 그룹 공유한도 / 캐시백 적립 / 카드 프리셋 기능 추가

> 병합 메모: 이 세션과 별개로 origin/main에 12~14차(coral 컬러 시스템 적용, 카드형 레이아웃,
> 사용 편의성 개선 7종 — 빠른입력 템플릿이 `migrations/010_add_quick_templates.sql` 사용)가
> 먼저 push되어 있어 `git pull`로 병합함. 그 결과 (1) 마이그레이션 번호를 010→011로 조정,
> (2) 이번 작업의 색상 클래스는 이미 브랜드 전체가 `brand-*`→`coral-*`로 교체된 상태이므로
> `coral-*` 톤에 맞춰 작성 필요

사용자 요청 3가지:
1. 여러 혜택이 하나의 월 한도를 공유 (예: 롯데 LOCA LIKIT — 5개 혜택이 월 13,000원 통합한도)
2. "즉시 할인"이 아닌 "포인트/캐시 적립"(cashback) 방식 혜택 지원 (예: KB 쿠팡와우카드)
3. 자주 쓰는 카드 프리셋 등록 시 혜택 룰 자동 생성 (삼성 taptap O / KB 쿠팡와우 / 롯데 LOCA LIKIT)

### 완료
- [x] `migrations/011_add_benefit_groups_and_presets.sql`(신규) — `benefit_groups` 테이블,
  `card_benefits.benefit_group_id`/`benefit_type`/`active`, `transactions.cashback_amount`.
  `schema.sql` 동기화. 로컬+원격 D1 적용 완료
- [x] `functions/lib/benefitMatcher.ts` — `WHERE active = 1` 추가. 월 한도 계산을
  `benefit_group_id` 유무로 분기: 없으면 기존처럼 개별 `monthly_cap`, 있으면
  `benefit_groups.monthly_cap`에서 그룹 소속 전체 benefit_id의 이번달
  `discount_amount + cashback_amount` 합계를 뺀 잔여한도 사용. 사용액 집계 쿼리 자체를
  `discount_amount`만 보던 것에서 `discount_amount + cashback_amount`로 확장 —
  거래 하나당 두 컬럼 중 하나만 채워지므로(혜택 유형이 배타적) 합산해도 이중계산 안 됨.
  이걸 안 하면 cashback 혜택은 월한도가 영원히 안 줄어드는 버그가 생겨서 발견 후 수정
- [x] `functions/api/benefits/index.ts`,`[id].ts` — 신규 필드 처리, `benefit_group_id` 지정 시
  같은 `card_id` 소속인지 검증(POST는 body.card_id, PATCH는 기존 혜택의 card_id 조회 후 검증)
- [x] `functions/api/benefit-groups/index.ts`(신규 GET/POST), `[id].ts`(신규 PATCH/DELETE) —
  cards index/[id] 패턴과 동일 구조. DELETE 시 소속 혜택은 `benefit_group_id`만 NULL로
  되돌리고 혜택 자체는 안 지움(그룹만 해제, 개별 한도 없음 상태로 남음)
- [x] `functions/api/cards/[id].ts` — 카드 삭제 시 `benefit_groups`도 명시적 DELETE 추가
  (기존 `card_benefits`와 동일한 이유 — D1이 `ON DELETE CASCADE` 미적용)
- [x] `functions/api/transactions/index.ts`, `functions/api/export/index.ts` —
  `cashback_amount` 저장/조회 추가
- [x] `src/types.ts`, `src/lib/api.ts` — `BenefitGroup`/`NewBenefitGroup`,
  `CardBenefit`/`NewBenefit`/`BenefitMatch` 확장, `Transaction`/`NewTransaction`에
  `cashback_amount`. `createCard`가 이제 신규 카드 id를 반환하도록 변경(프리셋 적용 시
  방금 만든 카드에 혜택을 붙이려면 id가 필요해서) — 호출부가 CardManager 한 곳뿐이라 안전
- [x] `src/lib/cardBenefitPresets.ts`(신규) — 삼성 taptap O(개별 한도 5개, 택1 패키지)/
  KB 쿠팡와우(cashback 2개)/롯데 LOCA LIKIT(그룹 공유한도 5개) 프리셋 데이터, 전부
  "AI가 조사한 정보이니 확인 필요" 안내 memo 기본 포함. 이 앱 기본 분류(식비/교통/
  주거공과금/의료/문화여가/쇼핑/교육/경조사/기타)에 없는 통신비/문화비/카페는 프리셋
  적용 시 `addCustomCategory`로 자동 등록해 TransactionForm에서 바로 선택 가능하게 함
- [x] `src/components/TransactionForm.tsx` — `selectedMatch.benefit_type`으로 분기:
  discount면 기존처럼 실결제액 자동계산, cashback이면 결제 금액(amount)은 그대로 두고
  "이 결제로 예상 적립: N원" 정보 배지만 표시(파란 톤으로 discount의 초록 톤과 구분),
  제출 시 `cashback_amount`만 채우고 `discount_amount`/`original_amount`는 안 건드림.
  예산 미리보기 두 곳도 cashback이면 차감하지 않도록 수정(기존엔 무조건 estimated_discount
  를 차감해 cashback도 예산에서 깎이는 버그가 될 뻔함)
- [x] `src/components/CardManager.tsx` — 새 카드 등록 폼에 "카드 상품 선택" 드롭다운(수정
  모드에서는 안 보임), 프리셋 선택 시 저장할 때 그룹→혜택 순으로 자동 생성. 혜택 목록에서
  `benefit_group_id` 기준으로 묶어서 그룹명+통합한도+이번달 그룹 전체 사용액 표시(이번달
  사용액은 카드의 이번달 거래를 별도 조회해 그룹 소속 benefit_id들의 discount+cashback
  합산으로 계산). cashback 혜택은 "적립" 배지, 각 혜택에 활성/비활성 토글 버튼(taptap O
  같은 택1 패키지 카드용) 추가. 수동 등록 폼에도 "혜택 방식"(즉시 할인/포인트 적립) 토글 추가
- [x] `src/lib/exportExcel.ts` — 거래내역 시트에 "적립예정액" 컬럼 추가(정산 계산 미포함,
  정보 표시 전용)
- [x] tsc -b / oxlint / vite build 전부 통과 (functions/는 `tsc --ignoreConfig --lib es2022`로 별도 확인)

### 스코프 결정 (사용자 확인 없이 판단, 다르면 이후 조정)
- 수동 혜택 등록/수정 폼에는 그룹 지정 UI를 넣지 않음 — 요청에서 그룹 생성은 LOCA LIKIT
  프리셋 예시로만 언급됐고, 수동으로 그룹을 만들고 배정하는 전체 UI는 범위를 크게 늘려서
  일단 프리셋 자동생성 경로로만 그룹이 만들어지게 함(API 자체는 benefit-groups로 열려있어
  나중에 수동 UI를 추가해도 백엔드 변경 불필요)

### 검증 결과
- tsc/oxlint/vite build 전부 통과
- wrangler pages dev + curl로 실제 D1에 데이터 생성해 3개 핵심 시나리오 검증:
  - **그룹 통합한도**: LOCA LIKIT 그룹(13,000원) 생성 후 스타벅스 50% 혜택으로 6,000원
    결제(3,000원 할인) 기록 → 통신비 10% 혜택 매칭 조회 시 그룹 잔여한도가 정확히
    10,000원(13,000-3,000)으로 반영, 할인액도 그룹 잔여한도 기준으로 정확히 계산됨 확인.
    이어서 통신비 5,000원(500원 할인) 기록 후 잔여 9,500원 확인, 그 상태에서 스타벅스
    40,000원(원래 50%=20,000원이어야 함)을 매칭했더니 그룹 잔여한도(9,500원)로 정확히
    클램핑됨 확인 — 개별 한도가 아니라 그룹 합산 기준으로 동작함을 실측 확인
  - **cashback 결제액 유지**: 쿠팡 2% 적립(월한도 20,000) 혜택으로 50,000원 결제 매칭 →
    `estimated_discount=1,000`, `benefit_type=cashback` 정상 반환. 실제 거래 등록 후 저장된
    행 확인 → `amount=50,000`(원금 그대로), `discount_amount=0`, `original_amount=0`,
    `cashback_amount=1,000` — 실결제액이 전혀 안 깎이고 적립액만 별도 기록됨을 확인.
    이어서 10,000원 추가 매칭 시 `monthly_used=1,000`으로 정확히 누적 반영됨도 확인
    (cashback도 월한도가 정상적으로 줄어듦 — 위에서 발견한 버그가 실제로 고쳐졌는지 재검증)
  - **택1 패키지 active 매칭 제외**: taptap O 스타일 통신비 혜택(active=1 기본값)이
    매칭 후보에 정상적으로 뜸을 먼저 확인 → PATCH로 `active=0`으로 변경 → 동일 조건 재매칭
    시 `{"data":[]}`로 매칭 후보에서 완전히 빠짐을 확인
  - 부가로 benefit-groups GET/PATCH 확인 + 카드 삭제 시 `benefit_groups`가 명시적으로
    정리되는지(삭제 후 그룹 조회 시 빈 배열)도 확인
  - CardManager의 프리셋 드롭다운 UI, 그룹 묶음 표시, cashback/active 배지 등 React 화면
    렌더링은 최초 검증 시 Chrome 확장 미연결로 육안 확인 못했으나, **같은 날 후속 세션에서
    확장 연결 후 실제 화면으로 재검증 완료**(아래 참고)
- 테스트로 만든 카드/혜택/그룹/거래는 전부 로컬 D1에서 삭제 정리함

### 추가 검증 — Chrome 확장으로 실제 화면 확인 (같은 날 후속)
- 로컬 `wrangler pages dev` 재기동 + Chrome 확장 연결해 실제 화면으로 재검증:
  - 새 카드 등록 폼의 "카드 상품 선택" 드롭다운에서 "롯데카드 LOCA LIKIT" 선택 → 안내
    문구("저장하면 이 카드 상품의 혜택 규칙이 자동으로 등록돼요...") 정상 노출, 저장 시
    "카드를 추가했습니다" 토스트와 함께 카드 생성 확인
  - 혜택 목록에서 5개 혜택이 "LOCA LIKIT 통합한도 · 통합한도 13,000원/월 · 이번 달 0원 사용"
    박스로 정확히 묶여 표시됨을 확인. 스타벅스 항목의 "사용중" 토글 클릭 → "꺼짐" 배지 +
    행 전체 회색 흐림 처리 + 버튼이 "켜기"로 전환되는 것까지 실측 확인
  - "KB국민 쿠팡 와우카드" 프리셋 적용 → 혜택 목록에 파란 "적립" 배지 + "2% 적립"/
    "0.2% 적립" 텍스트(할인이 아님) 정상 표시 확인
  - 홈 화면에서 쿠팡 50,000원 결제 입력(카드=KB 쿠팡와우 테스트) → 파란 박스로 "적립 혜택
    감지: 쿠팡/쿠팡이츠/쿠팡플레이 2% 적립 · 이 결제로 예상 적립: 1,000원 · 이번 달 한도
    20,000원 남음" 노출, 저장 버튼도 "저장 (적립 예정 1,000원)"으로 정상 표시. 실제 저장
    후 거래 목록에서 **-50,000원 그대로(할인 없이) 기록되고 잔액도 정확히 50,000원만
    감소**함을 확인 — cashback이 실결제액에 전혀 영향을 안 준다는 설계가 화면에서도 그대로
    동작함을 확인
  - 프리셋 적용 시 이 앱 기본 분류에 없는 "문화비"/"통신비" 커스텀 분류가
    `addCustomCategory`로 자동 등록되어 분류 칩 목록에 실제로 나타남을 확인
  - 검증에 사용한 테스트 카드/거래는 전부 삭제해 로컬 D1 정리

### 배포
- 원격 D1에 `migrations/011_add_benefit_groups_and_presets.sql` 적용 완료
- `npm run deploy` 완료 — https://f1a818c6.budget-3wb.pages.dev (exportExcel 컬럼 추가
  누락분 재배포 포함, 최초 배포는 https://6d1648c8.budget-3wb.pages.dev)
- 배포 후 `/api/auth/me` 200, `{"user":null}` 정상 확인

### 변경 파일
- `migrations/011_add_benefit_groups_and_presets.sql`(신규), `schema.sql`
- `functions/lib/benefitMatcher.ts`
- `functions/api/benefits/index.ts`, `[id].ts`
- `functions/api/benefit-groups/index.ts`(신규), `[id].ts`(신규)
- `functions/api/cards/[id].ts`, `functions/api/transactions/index.ts`, `functions/api/export/index.ts`
- `src/types.ts`, `src/lib/api.ts`
- `src/lib/cardBenefitPresets.ts`(신규), `src/lib/exportExcel.ts`
- `src/components/TransactionForm.tsx`, `src/components/CardManager.tsx`

---

## 2026-07-16 (14차) — 사용 편의성 개선 7종 (완료)

사용자 요청: 아이콘 없이, 코랄 포인트 컬러 + 카드형 레이아웃 톤 유지하며 7개 기능 추가.

### 완료
- [x] **최근 구매처 자동완성** — `functions/api/merchants/recent.ts`(신규) GET: 최근
  90일 거래(20건 미만이면 최근 50건으로 폴백)에서 구매처별 사용횟수+가장 많이
  짝지어진 분류를 집계해 빈도순 반환. `TransactionForm.tsx` 구매처 입력에 커스텀
  드롭다운(최대 5개, `onMouseDown`에 `preventDefault`로 blur보다 먼저 클릭 처리)으로
  제안, 선택 시 `categoryManuallySet` 플래그가 꺼져 있을 때만(사용자가 분류를 아직
  직접 클릭하지 않았을 때) 대표 분류를 자동 채움
- [x] **빠른 입력 템플릿** — `migrations/010_add_quick_templates.sql`(신규) `quick_templates`
  테이블(요청 스키마 그대로) + `functions/api/templates/index.ts`(GET/POST, POST는
  항상 `sort_order` 마지막으로 자동 배정),`[id].ts`(PATCH로 필드/순서 둘 다 수정,
  DELETE) CRUD. `TransactionForm.tsx` 최상단에 템플릿 가로 스크롤 칩(탭하면
  `applyPrefill`로 폼 전체 채움+날짜만 오늘로, 자동저장 아님), "관리" 토글로
  삭제(✕)/순서변경(▲▼, 인접 항목과 `sort_order` 맞바꿔 PATCH 2회) 리스트 전환,
  저장 버튼 위 "현재 입력값을 템플릿으로 저장" 토글→라벨 입력 후 등록
- [x] **직전 거래 복제** — `TransactionList.tsx`에 "복제" 버튼 추가. **설계 변경**:
  요청은 모바일 롱프레스/데스크톱 우클릭이었지만, 이 앱의 다른 모든 액션(수정/삭제
  등)이 전부 평범한 버튼이라 롱프레스·우클릭은 발견성이 낮고(숨겨진 제스처) 기기별
  분기 코드가 추가 복잡도만 늘림 — 신뢰성과 기존 UI 언어 일관성을 위해 모든
  화면에서 동일한 "복제" 버튼으로 통일. `App.tsx`가 `duplicateFrom:{data,nonce}`
  상태로 받아 `TransactionForm`에 주입(`nonce`로 같은 거래 재복제도 감지),
  `TransactionForm`의 `applyPrefill`이 날짜만 오늘로 재설정한 채 폼 채움(자동저장 아님)
- [x] **월 이동 스와이프** — `App.tsx`의 `SummaryCard` 래퍼 `div`에 순수
  touchstart/touchend로 좌우 스와이프 감지(가로 60px 이상 + 세로 60px 이하일 때만
  인식해 세로 스크롤과 혼동 방지), 좌=다음달(당월이면 무시)/우=이전달, 라이브러리 추가 없음
- [x] **검색 필터 서버사이드 확장** — `functions/api/transactions/index.ts` GET에
  `min_amount`/`max_amount` 파라미터 추가(AND 결합), `card_id=cash` 센티널을
  서버에서도 해석하도록 확장(`card_id=''`인 거래만). **설계 결정**: 요청은
  `payment_method`라는 별도 파라미터였지만, 이 앱은 이미 전역적으로 결제수단을
  `card_id`(빈 값=현금, 아니면 카드 UUID)로만 표현하고 있어(`TransactionForm`,
  `CardManager` 등 전부 동일 패턴) 별도 파라미터를 새로 만들면 같은 개념이 두
  가지 방식으로 표현되는 불일치가 생김 — 기존 `card_id=cash` 센티널(이미
  `SearchView.tsx`가 UI에서 쓰던 값)을 서버가 해석하도록 확장하는 쪽을 선택.
  `SearchView.tsx`의 금액범위/현금필터를 클라이언트 후필터에서 서버 파라미터로 전환
  (type/category는 원래도 목록 자체가 짧고 카드 API 호출 없이 즉시 반응해야 해서
  클라이언트 필터 유지)
- [x] **삭제 Undo** — `ToastContext.tsx`(`ToastOptions{actionLabel,onAction,durationMs}`)
  /`Toast.tsx`(액션 버튼은 텍스트+밑줄만, 아이콘 없음)에 액션 버튼 지원 추가.
  `App.tsx`의 `handleDelete`를 `pendingDeletesRef`(Map, id별 독립 타이머+원래
  인덱스+원본 데이터)로 재작성 — 삭제 시 즉시 목록에서 제거+3초 타이머 예약, "삭제됨
  · 되돌리기" 토스트의 되돌리기 클릭 시 타이머 취소하고 원래 인덱스 부근에 복원,
  3초 지나면 실제 DELETE 호출. `TransactionList`는 이제 `onDelete`를 동기 트리거로만
  호출(자체 성공 토스트/로딩스피너 제거 — App.tsx가 이미 되돌리기 토스트를 띄우므로
  중복 방지)
- [x] **버그 수정(같은 작업 중 발견)**: `handleAdd`/`handleUpdate`/`loadHomeData`가
  전부 서버에서 그 달 거래를 통째로 다시 불러와 `setTransactions`하는데, 삭제
  Undo 대기 중(3초 창)인 거래는 서버에 아직 남아있어서 이 새로고침 때 화면에
  되살아나는 버그가 있었음(예: A를 삭제한 직후 B를 수정하면 A가 다시 나타남) —
  `withoutPending()` 헬퍼로 세 곳 모두에서 `pendingDeletesRef`에 있는 id를
  걸러내도록 수정
- [x] **예산 반영 미리보기** — `TransactionForm.tsx` 저장 버튼 바로 위에
  "저장 시 이번 달 'X' 예산 68% 사용 (기존 52% → 68%)" 한 줄 미리보기, 이미
  props로 받는 `budgetStatuses` 기준 클라이언트 계산(별도 API 호출 없음, 매칭
  카테고리 예산 없거나 금액 미입력이면 표시 안 함), 초과 시 코랄 강조
- [x] typecheck(`tsc -b`, functions는 `tsc --ignoreConfig`)/lint(oxlint)/build 전부 통과

### 검증 결과
- `wrangler pages dev` + 로컬 D1(마이그레이션 006~010 순서대로 적용 — 로컬 dev DB가
  세션 사이에 남아있던 오래된 상태라 006/007이 빠져있던 것도 이번에 같이 정리됨,
  원격 D1은 이미 006/007까지 적용된 상태였음) + curl로 실제 검증:
  - 최근 구매처 API: 거래 3건(스타벅스)+1건(쿠팡) 생성 → 사용 빈도순(스타벅스 3,
    쿠팡 1) + 대표 분류(카페/음료) 정확히 반환 확인
  - 템플릿 CRUD: 생성 시 `sort_order` 자동 증가, PATCH로 두 항목 `sort_order`
    맞바꿔 순서 뒤바뀜 확인, DELETE 후 목록에서 제거 확인
  - 검색 필터: `min_amount`/`max_amount` 단독+조합 AND 정상, `card_id=cash`가
    카드 결제 거래(이마트)는 제외하고 현금 거래만 반환, 특정 카드 `card_id`는
    반대로 그 카드 거래만 반환 확인
  - 예산 미리보기 계산식을 실제 `/api/budgets` 응답(spent=13500,
    limit=10000,percentage=135)으로 순수 함수 재현 테스트 → "저장 시 이번 달
    '카페/음료' 예산 155% 사용 (기존 135% → 155%)" 정확히 산출, 예산 없는 카테고리·
    금액 미입력 시 null(미표시) 확인
  - 거래 복제/월 스와이프/Undo 타이머는 React 클라이언트 상태 로직이라 브라우저
    도구 없이는 실제 클릭·터치로 확인 불가 — 코드 리뷰 + (Undo의 경우) 리팩터링 중
    발견한 재조회 시 되살아남 버그를 실제로 잡아 수정한 것으로 로직 실측 신뢰도 보강
  - Chrome 확장 등 브라우저/스크린샷 도구가 이번 세션에도 없어 375px 레이아웃 실측은
    못함 — 기존 카드형 레이아웃 패턴(`UiCard`, `whitespace-nowrap`, `min-w-0`+`truncate`
    조합)을 그대로 재사용해 코드 리뷰로 확인. 다음 세션에서 화면 도구 연결되면 재확인 필요

### 배포
- 원격 D1에 `migrations/010_add_quick_templates.sql` 적용 완료
- `npm run deploy` 완료 — https://d4a6fa26.budget-3wb.pages.dev
- 배포 후 `/api/auth/me` 200 정상 확인

### 변경 파일
- `functions/api/merchants/recent.ts`, `functions/api/templates/index.ts`, `functions/api/templates/[id].ts` (신규)
- `migrations/010_add_quick_templates.sql`(신규), `schema.sql`
- `functions/api/transactions/index.ts`
- `src/types.ts`, `src/lib/api.ts`
- `src/components/TransactionForm.tsx`, `TransactionList.tsx`, `SearchView.tsx`, `Toast.tsx`
- `src/contexts/ToastContext.tsx`
- `src/App.tsx`

---

## 2026-07-16 (13차) — 카드형 레이아웃 구조 개선 (완료)

### 완료
- [x] `src/components/ui/Card.tsx` — 공통 Card 컴포넌트 생성 (rounded-xl border+shadow 기본값, `noPadding` 옵션)
- [x] `src/components/TransactionForm.tsx` — 3개 Card 섹션으로 분리: (1) 강조카드=수입/지출 토글+금액, (2) 구매처/결제=구매처 입력+결제방법 칩+혜택 매칭 안내, (3) 분류/날짜/메모=분류 칩+예산 현황 인라인+날짜+메모. 기존 로직/상태는 그대로 두고 마크업만 재구성
- [x] `src/components/SummaryCard.tsx` — 공통 Card로 교체, 잔액을 상단에 크게(text-3xl) 강조하고 수입/지출은 하단 2열 보조 지표(text-lg)로 축소
- [x] `src/components/CardManager.tsx` — 카드 목록 항목의 `h-10 w-16` 색상 박스를 제거하고, 카드 컨테이너 자체에 `border-l-4`(inline `borderLeftColor`)로 좌측 컬러 스트라이프 적용
- [x] `src/components/RecurringManager.tsx` — 폼/빈 상태/목록 항목 3곳의 `rounded-2xl`→`rounded-xl` 통일 (shadow-sm은 기존에 이미 명시돼 있어 그대로 유지)
- [x] `src/components/MonthlyReport.tsx` — 카드별 청구 내역 펼침 영역에 `bg-neutral-50` 배경 추가, 내부 항목 `px-5`→`px-6`으로 헤더 대비 들여쓰기 표현
- [x] `src/components/BudgetManager.tsx` — 4곳 `rounded-2xl`→`rounded-xl` 통일
- [x] `src/components/AnnualReport.tsx` — 3곳 `rounded-2xl`→`rounded-xl` 통일
- [x] typecheck(`tsc -b`)/lint(oxlint)/build(vite build) 전부 통과

### 환경 이슈 발견 및 조치 (범위 내 필수 대응)
- `npm run lint` 최초 실행 시 oxlint 네이티브 바인딩 누락 에러 → `npm i`로 옵셔널 디펜던시 재설치해 해결 (코드 변경 아님)
- `npm run build` 시 Node의 `fs.copyFileSync`가 WSL2 DrvFs(`/mnt/c`) 마운트에서 `copy_file_range` 미지원으로 `EPERM` 발생, `public/favicon.svg`→`dist/favicon.svg` 복사 단계에서 매번 빌드 실패 확인 (일반 `cp`/read+write는 정상 동작, Node의 copyFileSync 내부 구현만 실패 — 이 세션에서 새로 생긴 게 아니라 Node 22 + WSL2 9p 마운트의 알려진 상호작용 버그로 보임). `vite.config.ts`에 `publicDir: false` 추가해 Vite의 자동 복사를 끄고, `package.json`의 `build` 스크립트 끝에 `cp -r public/. dist/`를 셸로 직접 실행하도록 변경, `deploy` 스크립트는 `npm run build`를 거치도록 수정. 부작용: `npm run dev`(Vite 개발 서버 단독 실행) 시에는 `public/` 자동 서빙도 함께 꺼지므로 로컬 개발 중 파비콘만 안 뜰 수 있음(기능에는 영향 없음) — `wrangler pages dev`는 빌드된 `dist/`를 서빙하므로 영향 없음

### 검증 결과
- `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build` 전부 통과
- `wrangler pages dev dist --port 8788` + curl로 실측: `/`(200, title "텅장" 확인), `/favicon.svg`(200), `/api/auth/me`(200) — 빌드 산출물이 정상 서빙됨을 확인
- 브라우저/스크린샷 도구가 이번 세션에서도 연결되지 않아(Chrome 확장 등 없음) 카드 레이아웃의 실제 시각적 결과(스트라이프 색상, 잔액 카드 위계, 펼침 배경 등)는 육안으로 확인하지 못함 — 코드 리뷰 + 타입체크/린트/빌드 통과 + curl 서빙 확인으로 대체. 다음 세션에서 화면 확인 도구가 연결되면 재확인 필요

### 변경 파일
- `src/components/ui/Card.tsx` (신규)
- `src/components/TransactionForm.tsx`, `SummaryCard.tsx`, `CardManager.tsx`, `RecurringManager.tsx`, `MonthlyReport.tsx`, `BudgetManager.tsx`, `AnnualReport.tsx`
- `vite.config.ts`, `package.json` (빌드 환경 이슈 대응)

### 인증 환경 구축 (이번 세션에서 처음 필요해짐)
- 이 세션에는 GitHub/Cloudflare 인증 정보가 전혀 없어 `git push`, `wrangler pages deploy` 둘 다 최초 1회 막힘 → `gh` CLI를 `~/.local/opt`에 설치(sudo 불필요, 사용자 계정 스코프)해 `gh auth login`(OAuth 디바이스 플로우, 사용자가 브라우저에서 직접 승인)으로 GitHub 인증 후 `gh auth setup-git`으로 git credential 연결, `wrangler login`(OAuth, 사용자가 브라우저에서 직접 승인)으로 Cloudflare 인증. 둘 다 사용자 계정 홈 디렉터리(`~/.config/gh`, `~/.config/.wrangler`)에 토큰이 저장되므로 다음 세션부터는 재인증 불필요할 것으로 예상
- git `--local` 설정(`git config --local`)은 `/mnt/c` 마운트에서 `.git/config.lock`에 대한 `chmod`가 거부되어(WSL2 DrvFs 권한 이슈, 아래 항목과 동일 계열) 실패 — 대신 `git config --global`로 `user.name`/`user.email`을 설정함(홈 디렉터리는 네이티브 파일시스템이라 문제없음)

---

## 2026-07-16 (12차) — 코랄 포인트 컬러 시스템 적용 (완료)

### 완료
- [x] `src/index.css` — brand 팔레트 → coral 팔레트 교체 (coral-50/100/200/400/600/800/900), `:focus-visible` outline coral-400으로 변경
- [x] `src/components/TransactionForm.tsx` — brand/red/green/amber → coral, TriangleAlert 아이콘 제거, 금액 text-2xl
- [x] `src/components/TransactionList.tsx` — brand/red → coral, 지출금액 text-lg
- [x] `src/components/SummaryCard.tsx` — red/brand → coral/neutral
- [x] `src/components/BudgetManager.tsx` — brand/red/amber/green → coral/neutral, TriangleAlert+Wallet 아이콘 제거
- [x] `src/components/CardManager.tsx` — brand → coral, border-brand → border-coral
- [x] `src/components/RecurringManager.tsx` — brand/red → coral
- [x] `src/components/MonthlyReport.tsx` — brand/red → coral, ChevronDown/Up → ▼/▲ 텍스트 span으로 교체
- [x] `src/components/AnnualReport.tsx` — brand/red → coral/neutral
- [x] `src/components/CategoryBreakdown.tsx` — barColor red-500 → coral-400
- [x] `src/components/SearchView.tsx` — brand/red → coral, SlidersHorizontal 제거
- [x] `src/App.tsx`, `src/components/AuthPage.tsx`, `src/components/ExportButton.tsx`, `src/components/NotesView.tsx` — brand 잔여 클래스 coral로 교체 (전체 brand- 0건 확인)
- [x] tsc -b + vite build 빌드 성공, oxlint 에러 없음

### 변경 파일 목록
- src/index.css
- src/components/TransactionForm.tsx
- src/components/TransactionList.tsx
- src/components/SummaryCard.tsx
- src/components/BudgetManager.tsx
- src/components/CardManager.tsx
- src/components/RecurringManager.tsx
- src/components/MonthlyReport.tsx
- src/components/AnnualReport.tsx
- src/components/CategoryBreakdown.tsx
- src/components/SearchView.tsx
- src/App.tsx
- src/components/AuthPage.tsx
- src/components/ExportButton.tsx
- src/components/NotesView.tsx

---

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
