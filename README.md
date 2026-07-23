# 텅~ 장

개인 웹 가계부 서비스(PWA). 카드 청구 기간 기반 정산, 고정지출 자동화, 카드 혜택 매칭,
예산 관리, 메모장, 홈 화면 설치, 카드 정산 push 알림에 더해 배송 조회·수입/지출
개인화 계산기·자영업자용 카드매출 정산기까지 지원합니다.

**배포 URL:** https://budget-3wb.pages.dev

> 전체 개발 과정(요청 배경 → 설계 → 구현 → 로컬 실기기 검증)은
> [`WORKLOG.md`](./WORKLOG.md)에 세션별로 그대로 기록되어 있습니다 —
> 2026-07-14 ~ 2026-07-23, 102개 작업 로그(93차까지 진행), 197개 커밋 중
> 버그 수정(`fix:`) 36건. 아래 "개발 / 검증 프로세스" 절은 그중 실제
> 검증 과정에서 잡아낸 버그 몇 가지를 발췌한 것입니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 19 + TypeScript + Tailwind CSS v4 + Vite |
| 백엔드 | Cloudflare Pages Functions (Edge) |
| 데이터베이스 | Cloudflare D1 (SQLite) |
| 오브젝트 스토리지 | Cloudflare R2 — 카드 상품 이미지(공개), 메모 첨부 이미지(비공개, 인증 API 경유) |
| 인증 | 자체 이메일/비밀번호 (PBKDF2 + 세션 쿠키) |
| PWA | vite-plugin-pwa(injectManifest) + 커스텀 Service Worker |
| Push 알림 | Web Push(VAPID) — `@block65/webcrypto-web-push`(Workers 런타임용) |
| 정기 실행 | Cloudflare Workers Cron Triggers (별도 워커, `workers/`) |
| 아이콘 | lucide-react |
| 엑셀 내보내기 | xlsx |
| 배포 | Cloudflare Pages / Cloudflare Workers |

---

## 구현된 기능

### 인증 / 내 정보
- 이메일 + 비밀번호 회원가입 / 로그인, 세션 쿠키 기반 로그인 유지(30일)
- 비밀번호 PBKDF2 해싱(유저별 반복횟수 저장, 로그인 시 자동 재해싱)
- 모든 API 미들웨어에서 세션 검증, 사용자별 데이터 완전 격리
- 헤더 닉네임 표시/변경, "내 정보" 화면(닉네임 인라인 수정, 비밀번호 변경)

### 다크모드 / 화면
- 라이트/다크 테마 토글(헤더), `localStorage` 저장 + 시스템 설정 폴백
- 데스크탑은 상시 사이드바, 모바일은 햄버거+드로어 메뉴 — 로고 클릭 시 홈으로 이동
- 로고 파비콘 기반 PWA 아이콘, 홈 화면에 추가 유도 배너(iOS는 공유 버튼 안내로 대체)
- 목록이 긴 화면에서 맨 위로/맨 아래로 스크롤 이동 버튼
- 홈 화면 설치 PWA(standalone)에서는 `window.confirm()`이 무시되는 환경이 있어
  앱 내 렌더링 확인 다이얼로그(`ConfirmDialog`)로 대체

### 홈 (거래 입력 / 목록)
- 수입 / 지출 구분, 금액·분류·날짜·메모·구매처 입력
- 분류 직접 추가("+ 직접입력") 및 삭제 관리(톱니 아이콘 → 기본 제공 분류 포함
  전부 삭제 가능, 이미 저장된 거래의 분류 텍스트는 그대로 유지). 관리 모드에서
  커스텀 분류끼리 순서 변경 가능(기본 제공 분류는 항상 앞에 고정)
- 구매처/판매처 직접 추가("+ 직접입력") 및 삭제 관리(톱니 아이콘, 분류와 동일
  방식, 순서 변경 포함) — 자유 입력 텍스트 필드 및 최근 사용 구매처
  자동완성과 별개로 공존
- 결제 방법 선택 (현금 / 계좌이체 / 등록된 카드) + 카드 혜택 자동 매칭 제안
- 결제 방법(현금·계좌이체 등) 직접 추가("+ 직접입력") 및 삭제 관리(톱니 아이콘,
  분류와 동일 방식) — 지출/수입 각자 독립적으로 관리, 순서 변경 포함
- 최근 사용한 구매처 자동완성(선택 시 대표 분류 자동 채움)
- 빠른 입력 템플릿(즐겨찾기 칩으로 폼 한번에 채우기, 관리/재정렬)
- 직전 거래 복제(날짜만 오늘로 재설정)
- 저장 전 예산 반영 미리보기 ("저장 시 이번 달 '식비' 예산 68% 사용")
- "비정산" 토글 — 가족 비용 확인 등 개인 정산과 분리하고 싶은 거래 표시.
  일/주/월/연 정산·예산·홈 잔액·엑셀 내보내기에서 완전히 제외되고 별도
  "비정산" 탭에서만 조회/합계됨
- 날짜별 그룹 목록, 인라인 수정 / 삭제(3초 내 되돌리기 가능한 Undo)
- 모바일에서 좌우 스와이프로 월 이동

### 월별 필터
- 헤더 ◀ ▶ 버튼 또는 스와이프로 월 이동, `오늘` 버튼으로 복귀

### 한눈에 보기 (일일 · 주간 · 월간 · 연간 정산)
- 종이 다이어리 스타일: 일일(전일잔액/수입/지출/오늘잔액), 주간(날짜×분류 격자 +
  주계/누계), 월간/연간(해당 기간 전체를 행으로 + 합계) 4개 서브탭
- 일일 정산은 스와이프로 하루씩 이동, 항목 탭으로 바로 수정

### 분류별 합계 / 월정산 / 연정산
- 이번 달 지출·수입 분류별 막대그래프
- 카드별 청구 기간(마감일 기준) 실출금 집계, 출금일/거래일 기준 선택
- 12개월 수입·지출 바 차트 및 월별 숫자 표

### 수입계산기 / 지출계산기
- 원하는 분류만 골라 합산한 "개인화" 월 합계를 보는 화면(분류별 합계와 별개로,
  일부 분류만 뽑아 따로 보고 싶을 때 사용)
- 수입계산기: 기본 전부 미선택 상태에서 포함할 수입 분류 칩만 골라 켬(예:
  영업수익 + 급여). 차감할 항목은 수입 등록 시 금액 앞에 `-`를 붙이면 자동 반영
- 지출계산기: 기본 전부 포함 상태에서 제외하고 싶은 지출 분류만 꺼서 뺌(전체
  선택 후 제외 방식)
- 선택된 분류의 합계 요약 + 월정산과 동일한 날짜별 표(분류별 열 + 일별 합계)
- 비정산 거래는 이미 서버 집계에서 제외되므로 이 화면에서 별도 처리 불필요

### 배송
- 택배 등 배송 여부를 추적하고 싶은 지출 거래만 모아보는 목록(기본 전체 지출
  분류 포함, 지출계산기와 같은 방식으로 원치 않는 분류는 칩으로 제외)
- 홈 탭과 동일한 날짜별 개별 거래 목록 + 거래마다 "배송완료" 체크박스 — 체크해도
  목록에서 사라지지 않고 흐리게/취소선으로만 표시되어 오는 중인 항목과 구분
- 메모(구매처 아래)도 함께 표시해 어떤 주문인지 바로 확인 가능

### 카드 정산기 (자영업자용)
- 카드매출을 별도 결제 방법(예: "예정")으로 등록해두면, 등록일 + 2일 뒤 예상
  입금일과 함께 정산 대기 목록에 날짜별로 표시
- "카드매출 결제방법"(추적 대상, 복수 선택 가능)과 "확인 시 변경할 결제방법"
  (예: 계좌이체)을 화면에서 직접 선택 — 결제 방법은 미리 결제 방법 관리에서
  만들어둠
- 통장 입금을 확인하고 체크하면 해당 거래의 결제 방법이 목표 결제방법으로 즉시
  바뀌며(홈 탭 수입에도 반영) 메모에 "입금완료"가 자동으로 남고 정산 대기
  목록에서는 빠짐
- 카드매출 결제방법으로 등록된 수입은 정산 전엔 홈 탭 거래 목록엔 그대로
  보이지만, 잔액/정산(일·주·월·연)/예산/계산기/엑셀 내보내기 등 모든 합산에서는
  완전히 제외됨(체크 전까지는 "미확정 매출"로 취급)

### 카드 관리
- 카드 등록·수정·삭제, 결제일 입력 시 마감일 자동 제안
- "매달 1일~말일 마감·말일 결제" 토글 — 청구 기간이 달력월과 그대로 일치하는
  카드(체크카드, 일부 후불 결제 등)는 마감일/결제일을 매번 31로 입력할 필요 없이
  한 번에 설정. 끄면 직전에 입력했던 수동 값으로 복원
- 카드 상품 프리셋 선택(삼성 taptap O / KB 쿠팡와우 / 롯데 LOCA LIKIT / NH zgm.the
  pay) — 혜택 규칙 자동 등록 + 카드사 공식 디자인 이미지(R2) 표시, 미선택 시 색상
  기반 비주얼로 폴백
- 카드별 혜택 규칙(정률/정액 할인, 분류·구매처 조건, 월 한도) 등록, 여러 혜택을
  하나의 통합 한도로 묶는 혜택 그룹 지원
- 카드 삭제 시 연결된 고정지출/혜택 영향 범위 안내 후 정리

### 카드 정산 Push 알림
- 마이페이지에서 알림 구독 토글(브라우저 Notification 권한 + Service Worker
  구독), 카드 청구 마감일이 지나면 그날 마감된 카드의 청구기간 사용액을 요약해
  알림 발송(여러 카드가 같은 날 마감되면 하나로 묶어서 발송)
- 별도 Cloudflare Workers Cron(`workers/card-settlement-notifier`)이 매일
  실행하며 중복 발송 방지, 만료 구독 자동 정리

### 고정 수입/지출
- 매월 특정일에 자동으로 거래 생성(밀린 달 소급 생성 포함)
- 활성/비활성 토글, 카드 연결

### 예산 관리
- 카테고리별(또는 전체) 월 예산 설정, 매월 반복 또는 특정 월 한정
- 초과 시 홈 화면 배너 + 입력 폼 인라인 경고

### 비정산
- "비정산" 표시한 거래만 모아보는 별도 탭(홈의 "정산 보기" 바로 아래 "비정산
  보기" 버튼으로 연결) — 월별 수입/지출/합계와 목록, 수정/삭제/복제 가능
- 정산·예산·홈 잔액·엑셀 내보내기 등 일반적인 재무 계산에서는 전부 제외

### 메모장
- 날짜별 자유 기록(분류 태그, 하루 여러 건 가능), 목록/달력 보기 토글
- 분류 직접 추가/삭제 관리(기본 제공 분류 포함 전부 삭제 가능), 커스텀 분류
  순서 변경 가능
- 스크린샷/사진 첨부(메모당 1장, 5MB 이하) — 개인 구매 정보가 담길 수 있어 R2에
  비공개로 저장하고 본인 메모만 인증된 API로 조회 가능(공개 URL 없음)

### 검색
- 구매처/분류/메모 통합 검색 + 날짜·분류·구매처·결제수단·금액범위 필터(서버사이드 결합)
- 결과 요약(수입/지출 합계), 엑셀 내보내기

### 엑셀 내보내기
- 기간 지정 후 거래 내역(원금/할인/실결제 분리) 엑셀 다운로드

---

## 프로젝트 구조

```
budget/
├── functions/                        # Cloudflare Pages Functions (API)
│   ├── api/
│   │   ├── _middleware.ts            # 세션 검증 미들웨어 (userId 주입)
│   │   ├── auth/                     # register / login / logout / me / password
│   │   ├── transactions/             # GET(검색·필터)/POST, PATCH/DELETE
│   │   ├── cards/                    # 카드 CRUD
│   │   ├── benefits/                 # 카드 혜택 CRUD([id].ts) + match.ts(자동 매칭)
│   │   ├── benefit-groups/           # 혜택 통합 한도 그룹 CRUD
│   │   ├── recurring/                # 고정 수입/지출 CRUD
│   │   ├── budgets/                  # 예산 CRUD + 현황 계산
│   │   ├── notes/                    # 메모장 CRUD(이미지 첨부는 multipart/form-data)
│   │   │   └── image/[id].ts         # 첨부 이미지 조회 전용(R2 스트리밍, 본인 메모만)
│   │   ├── templates/                # 빠른 입력 템플릿 CRUD
│   │   ├── settlement/                          # daily/weekly/monthly/annual 정산 조회
│   │   ├── categories/, note-categories/         # 거래/메모 분류 오버라이드 CRUD
│   │   ├── merchants/                            # index.ts(구매처 관리 CRUD) + recent.ts(자동완성)
│   │   ├── payment-methods/                      # 결제 방법 관리 CRUD
│   │   ├── calc-selections/                      # 수입/지출 계산기 선택 칩 CRUD
│   │   ├── delivery-excluded-categories/         # 배송 탭 제외 분류 CRUD
│   │   ├── card-settlement-payment-methods/      # 카드 정산기 소스 결제방법 CRUD
│   │   ├── settings/                             # 계정별 단일값 설정(정산 기준 등)
│   │   ├── push/                     # subscribe / unsubscribe (알림 구독)
│   │   └── export/                   # 엑셀 내보내기용 데이터
│   └── lib/
│       ├── auth.ts                   # PBKDF2 해싱, 쿠키 유틸, 닉네임 검증
│       ├── budget.ts                 # 예산 현황 계산
│       ├── benefitMatcher.ts         # 카드 혜택 매칭 로직
│       ├── settlement.ts             # 일/주/월/연 정산 계산
│       ├── recurring.ts              # 고정지출 자동 생성
│       ├── categories.ts, noteCategories.ts, paymentMethods.ts  # 분류/결제방법 오버라이드 공통 로직
│       └── noteImages.ts             # 메모 첨부 이미지 타입/용량 검증(5MB, JPEG/PNG/WEBP/GIF)
├── src/
│   ├── components/
│   │   ├── ui/Card.tsx               # 공통 카드형 레이아웃 컴포넌트
│   │   ├── AuthPage.tsx, MyPage.tsx, SummaryCard.tsx
│   │   ├── TransactionForm.tsx, TransactionList.tsx, CategoryBreakdown.tsx
│   │   ├── OverviewView.tsx, DailySettlement.tsx, WeeklySettlement.tsx,
│   │   │   MonthlySettlementTable.tsx, AnnualSettlementTable.tsx
│   │   ├── MonthlyReport.tsx, AnnualReport.tsx
│   │   ├── UnsettledView.tsx, CategoryCalculator.tsx(수입/지출계산기 공용)
│   │   ├── DeliveryView.tsx, CardSettlementView.tsx
│   │   ├── CardManager.tsx, RecurringManager.tsx, BudgetManager.tsx
│   │   ├── NotesView.tsx, SearchView.tsx, ExportButton.tsx
│   │   ├── NotificationSettings.tsx, InstallPrompt.tsx
│   │   ├── ReorderableChipList.tsx   # 분류/구매처/결제방법/메모분류 공용 칩 관리 UI(드래그 재정렬)
│   │   ├── ScrollButtons.tsx, ConfirmDialog.tsx
│   │   └── Toast.tsx, LoadingSpinner.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx           # 로그인 상태 전역 관리
│   │   ├── ThemeContext.tsx          # 라이트/다크 테마
│   │   ├── ToastContext.tsx          # 토스트 알림(액션 버튼 지원, Undo 등)
│   │   └── ConfirmContext.tsx        # PWA standalone용 커스텀 confirm 다이얼로그
│   ├── lib/
│   │   ├── api.ts                    # API 호출 함수 (ApiError 공통 처리)
│   │   ├── billing.ts                # 카드 청구 기간 계산
│   │   ├── cardDateUtils.ts          # 마감일 자동 제안
│   │   ├── cardBenefitPresets.ts     # 카드 상품 프리셋(혜택 규칙 + 이미지 URL)
│   │   ├── push.ts, pushConfig.ts    # Push 구독 헬퍼 / VAPID 공개키
│   │   ├── nickname.ts               # 닉네임 검증 규칙
│   │   ├── categories.ts, noteCategories.ts, merchants.ts, paymentMethods.ts  # 서버 동기화 분류/구매처/결제방법 캐시
│   │   ├── calcSelections.ts         # 수입/지출계산기 선택 칩 캐시
│   │   ├── deliveryCategories.ts     # 배송 탭 제외 분류 캐시
│   │   ├── cardSettlementPaymentMethods.ts  # 카드 정산기 소스 결제방법 캐시
│   │   ├── settings.ts               # 계정별 단일값 설정 캐시(정산 기준, 카드 정산기 목표 결제방법)
│   │   ├── settlementFilter.ts       # 정산 표 분류 필터 헬퍼
│   │   ├── legacyMigration.ts        # 구버전 localStorage 분류/설정 → 서버 1회성 이전
│   │   ├── exportExcel.ts
│   │   └── format.ts
│   ├── sw.ts                         # 커스텀 Service Worker(프리캐시 + push 핸들러)
│   └── types.ts                      # 공통 타입 정의
├── workers/
│   └── card-settlement-notifier/     # 별도 배포되는 Cron Worker (아래 참고)
├── migrations/                       # 001~027, schema.sql과 항상 동기화
├── schema.sql                        # 전체 DB 스키마(모든 마이그레이션 반영된 최종 상태)
├── public/manifest.json, public/icons/  # PWA manifest + 아이콘
└── wrangler.toml                     # Cloudflare Pages 설정
```

---

## DB 스키마

```sql
users                 -- id, email, password_hash, salt, name, nickname, iterations
sessions              -- id, user_id, expires_at
cards                 -- id, name, color, billing_day, closing_day, benefits,
                       --   image_url, user_id
transactions           -- id, type, category, amount, memo, date, merchant,
                       --   payment_method, card_id, recurring_id,
                       --   original_amount, discount_amount, benefit_id,
                       --   cashback_amount, unsettled, delivery_done, user_id
recurring_transactions -- id, user_id, name, type, category, amount, ...,
                       --   day_of_month, start_date, end_date, last_generated_date, active
card_benefits          -- id, user_id, card_id, name, category, merchant_pattern,
                       --   discount_type, discount_value, monthly_cap, min_spend,
                       --   benefit_group_id, benefit_type, active
benefit_groups         -- id, card_id, name, monthly_cap (혜택 통합 한도)
budgets                -- id, user_id, category, monthly_limit, year_month, active
notes                  -- id, user_id, date, category, content,
                       --   image_key (R2 오브젝트 키, 첨부 이미지 없으면 NULL)
quick_templates        -- id, user_id, label, type, category, amount, merchant,
                       --   payment_method, card_id, sort_order, memo
push_subscriptions      -- id, user_id, endpoint, p256dh, auth (Web Push 구독)
notification_log       -- id, user_id, type, reference_id, year_month, sent_at
                       --   (같은 카드·같은 청구월 중복 알림 방지)
categories             -- id, user_id, type, name, removed_default, sort_order
                       --   (거래 분류 커스텀 추가/기본 삭제/순서를 계정 단위로 저장, 기기 간 동기화)
note_categories        -- id, user_id, name, removed_default, sort_order (메모 분류, categories와 동일 구조)
user_settings          -- user_id, key, value (계정별 단일값 설정 — 카드 지출 집계
                       --   기준 등, PRIMARY KEY(user_id, key))
merchants              -- id, user_id, name, sort_order (구매처/판매처 관리 목록, 기본값 없는 단순 커스텀 목록)
payment_methods        -- id, user_id, type, name, removed_default, sort_order
                       --   (결제 방법 커스텀 추가/기본 삭제/순서, categories와 동일 구조, 지출/수입 독립)
calc_selections        -- id, user_id, type, category, sign (수입/지출계산기에서 선택("탭")한
                       --   분류 칩만 행으로 저장, 기본값 없음)
delivery_excluded_categories        -- id, user_id, category (배송 탭에서 제외한 지출 분류,
                       --   기본 전체 포함 · exclude 전용)
card_settlement_source_payment_methods  -- id, user_id, payment_method (카드 정산기에서
                       --   추적 대상으로 선택한 수입 결제방법, 기본 전체 미선택)
```

전체 정의는 `schema.sql` 참고. 스키마 변경 시 `migrations/`에 새 파일을 추가하고
`schema.sql`도 함께 동기화합니다.

---

## 개발 / 검증 프로세스

기능 추가나 수정마다 배포 전에 `wrangler pages dev`로 API+프론트를 로컬에
동시에 띄운 뒤 Playwright로 실제 브라우저 동작을 검증합니다(정상 케이스뿐
아니라 새로고침 후 서버 동기화, 터치 기기 에뮬레이션, 월/연 경계 같은 엣지
케이스도 포함). `tsc -b` 타입체크와 `oxlint`는 기본이고, 그 위에서 이
Playwright 검증 과정 중 실제로 발견되어 배포 전에 고친 버그들이 다수
있습니다(각 세션의 상세 기록은 `WORKLOG.md` 참고):

- 카드 청구 기간 계산(`getCardBillingPeriod`)이 마감일 다음날을 전월 일수로
  클램핑하지 않아, 전월이 31일보다 짧은 달(4·6·9·11월, 2월)엔 청구 시작일이
  1일이 아니라 2~3일로 밀리던 계산 오류
- "계좌이체"(카드 미연결 결제 방법)를 혜택 매칭 로직이 `card_id`로 오인해
  불필요한 카드 혜택 매칭을 시도할 뻔한 문제(판별 방식을
  `cards.some(c => c.id === paymentMethod)`로 명확화)
- 분류/구매처 삭제 API가 이미 재배치된 기본 분류를 다시 삭제할 때
  `INSERT ... ON CONFLICT DO NOTHING`이라 아무 것도 갱신되지 않아 삭제가
  씹히던 문제(`ON CONFLICT DO UPDATE`로 수정)
- 수입계산기·비정산 탭에서 거래 목록(`TransactionList`)이 이미 자체 확인
  모달을 띄우는데 호출부가 그 안에서 또 `confirm()`을 호출해, 확인을 두 번
  눌러야만 실제로 삭제되던 문제(안 지워지는 것처럼 보이는 버그)
- 일일 정산 화면의 "전일잔액"이 월 경계(매달 1일)에서 실제 전날 잔액이
  아니라 0으로 리셋되던 문제
- 홈 화면에 설치한 PWA(standalone 모드)에서 `window.confirm()`이 아예
  무시되어 삭제 확인 버튼이 반응하지 않던 문제 → 앱 내 렌더링 커스텀 확인
  다이얼로그(`ConfirmDialog`)로 대체
- 다크모드에서 "카드 상품 선택" 드롭다운 글자색이 배경과 겹쳐 안 보이던 문제
- 빠른 입력 템플릿에 메모가 저장되지 않던 문제, 계좌이체 결제방법이 템플릿
  저장/적용 시 "현금"으로 하드코딩되어 사라지던 문제

이 목록은 일부 발췌이며, 세션마다의 요청 배경·설계 고민·실기기 검증 결과
전체는 [`WORKLOG.md`](./WORKLOG.md)에서 확인할 수 있습니다.

---

## 로컬 개발

```bash
# 의존성 설치
npm install

# Vite 개발 서버 (API 없음, UI만)
npm run dev

# 로컬 전체 서버 (API + Vite 동시)
wrangler pages dev

# 로컬 D1 스키마 초기화
npm run d1:init

# 타입 체크 (빌드에 포함되어 있음, 단독 실행 시)
npx tsc -b

# 린트
npm run lint
```

> `functions/**`는 `tsconfig.app.json`(src만 include)에 포함되지 않아 `tsc -b`가
> 검사하지 않습니다. 별도로 확인하려면:
> `npx tsc --noEmit --ignoreConfig --skipLibCheck --target es2022 --moduleResolution bundler --module esnext functions/api/**/*.ts`

## 배포

`main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가
자동으로 빌드 후 Cloudflare Pages에 배포합니다(`CLOUDFLARE_API_TOKEN` /
`CLOUDFLARE_ACCOUNT_ID` 레포 시크릿 필요). 수동 배포도 가능:

```bash
# 빌드 + Cloudflare Pages 배포 (메인 앱, 수동)
npm run deploy

# 원격 D1 마이그레이션 실행 (스키마 변경 시 push와 별개로 직접 실행 필요)
npx wrangler d1 execute budget-db --remote --file=./migrations/파일명.sql
```

> WSL2에서 `/mnt/c` 아래 작업할 경우 Node의 `fs.copyFileSync`가 `EPERM`으로
> 실패하는 환경 이슈가 있어, `vite.config.ts`에서 `publicDir: false`로 끄고
> `build` 스크립트가 `cp -r public/. dist/`로 직접 복사합니다.

### Cron Worker (카드 정산 알림) 배포

`workers/card-settlement-notifier`는 Pages Functions와 분리된 별도 Cloudflare
Workers 프로젝트라 **루트 `npm run deploy`에 포함되지 않고 따로 배포해야 합니다.**

```bash
cd workers/card-settlement-notifier
npm install
npx wrangler secret put VAPID_PRIVATE_KEY   # 최초 1회, 값 분실 시 재발급 필요
npm run deploy                              # = wrangler deploy
```

- 크론: 매일 UTC 15시(한국시간 자정) — 어제 마감된 카드를 찾아 청구기간 사용액을
  Web Push로 발송
- VAPID 공개키/subject는 `wrangler.toml`의 `[vars]`(비밀 아님), 비공개키는
  `wrangler secret put`으로만 등록(레포에는 없음). 키를 재발급하면
  `src/lib/pushConfig.ts`(프론트 공개키)도 함께 갱신해야 함
- 같은 D1 데이터베이스(`budget-db`)를 메인 앱과 공유 바인딩

---

## 카드 청구 기간 계산 방식

마감일(`closing_day`)과 결제일(`billing_day`)은 사용자가 카드별로 직접 입력합니다.
(결제일 입력 시 "마감일 = 결제일 - 11일" 패턴으로 자동 제안, 직접 수정 가능)

```
예) 마감일 14일, 결제일 25일인 카드의 7월 정산:

  청구 기간: 2026-06-15 ~ 2026-07-14 사용분
  실결제일:  2026-07-25
```

월정산 화면에서는 이 "출금일 기준" 외에 "거래일 기준"(달력월 그대로 집계)도
선택할 수 있습니다. 마감일이 해당 월 말일보다 크면(예: 31일) 말일로 클램핑됩니다.
