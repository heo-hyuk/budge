# 텅~ 장

개인 웹 가계부 서비스(PWA). 카드 청구 기간 기반 정산, 고정지출 자동화, 카드 혜택 매칭,
예산 관리, 메모장, 홈 화면 설치, 카드 정산 push 알림까지 지원합니다.

**배포 URL:** https://budget-3wb.pages.dev

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

### 홈 (거래 입력 / 목록)
- 수입 / 지출 구분, 금액·분류·날짜·메모·구매처 입력
- 분류 직접 추가("+ 직접입력") 및 삭제 관리(톱니 아이콘 → 기본 제공 분류 포함
  전부 삭제 가능, 이미 저장된 거래의 분류 텍스트는 그대로 유지)
- 결제 방법 선택 (현금 또는 등록된 카드) + 카드 혜택 자동 매칭 제안
- 최근 사용한 구매처 자동완성(선택 시 대표 분류 자동 채움)
- 빠른 입력 템플릿(즐겨찾기 칩으로 폼 한번에 채우기, 관리/재정렬)
- 직전 거래 복제(날짜만 오늘로 재설정)
- 저장 전 예산 반영 미리보기 ("저장 시 이번 달 '식비' 예산 68% 사용")
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

### 카드 관리
- 카드 등록·수정·삭제, 결제일 입력 시 마감일 자동 제안
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

### 메모장
- 날짜별 자유 기록(분류 태그, 하루 여러 건 가능), 목록/달력 보기 토글
- 분류 직접 추가/삭제 관리(기본 제공 분류 포함 전부 삭제 가능)
- 스크린샷/사진 첨부(메모당 1장, 5MB 이하) — 개인 구매 정보가 담길 수 있어 R2에
  비공개로 저장하고 본인 메모만 인증된 API로 조회 가능(공개 URL 없음)

### 검색
- 구매처/분류/메모 통합 검색 + 날짜·분류·결제수단·금액범위 필터(서버사이드 결합)
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
│   │   ├── benefits/                 # 카드 혜택 CRUD + match(자동 매칭)
│   │   ├── benefit-groups/           # 혜택 통합 한도 그룹 CRUD
│   │   ├── recurring/                # 고정 수입/지출 CRUD
│   │   ├── budgets/                  # 예산 CRUD + 현황 계산
│   │   ├── notes/                    # 메모장 CRUD(이미지 첨부는 multipart/form-data)
│   │   │   └── image/[id].ts         # 첨부 이미지 조회 전용(R2 스트리밍, 본인 메모만)
│   │   ├── templates/                # 빠른 입력 템플릿 CRUD
│   │   ├── settlement/               # daily/weekly/monthly/annual 정산 조회
│   │   ├── push/                     # subscribe / unsubscribe (알림 구독)
│   │   ├── merchants/recent.ts       # 최근 구매처 자동완성
│   │   └── export/                   # 엑셀 내보내기용 데이터
│   └── lib/
│       ├── auth.ts                   # PBKDF2 해싱, 쿠키 유틸, 닉네임 검증
│       ├── budget.ts                 # 예산 현황 계산
│       ├── benefitMatcher.ts         # 카드 혜택 매칭 로직
│       ├── settlement.ts             # 일/주/월/연 정산 계산
│       ├── recurring.ts              # 고정지출 자동 생성
│       └── noteImages.ts             # 메모 첨부 이미지 타입/용량 검증(5MB, JPEG/PNG/WEBP/GIF)
├── src/
│   ├── components/
│   │   ├── ui/Card.tsx               # 공통 카드형 레이아웃 컴포넌트
│   │   ├── AuthPage.tsx, MyPage.tsx, SummaryCard.tsx
│   │   ├── TransactionForm.tsx, TransactionList.tsx, CategoryBreakdown.tsx
│   │   ├── OverviewView.tsx, DailySettlement.tsx, WeeklySettlement.tsx,
│   │   │   MonthlySettlementTable.tsx, AnnualSettlementTable.tsx
│   │   ├── MonthlyReport.tsx, AnnualReport.tsx
│   │   ├── CardManager.tsx, RecurringManager.tsx, BudgetManager.tsx
│   │   ├── NotesView.tsx, SearchView.tsx, ExportButton.tsx
│   │   ├── NotificationSettings.tsx, InstallPrompt.tsx
│   │   └── Toast.tsx, LoadingSpinner.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx           # 로그인 상태 전역 관리
│   │   ├── ThemeContext.tsx          # 라이트/다크 테마
│   │   └── ToastContext.tsx          # 토스트 알림(액션 버튼 지원, Undo 등)
│   ├── lib/
│   │   ├── api.ts                    # API 호출 함수 (ApiError 공통 처리)
│   │   ├── billing.ts                # 카드 청구 기간 계산
│   │   ├── cardDateUtils.ts          # 마감일 자동 제안
│   │   ├── cardBenefitPresets.ts     # 카드 상품 프리셋(혜택 규칙 + 이미지 URL)
│   │   ├── push.ts, pushConfig.ts    # Push 구독 헬퍼 / VAPID 공개키
│   │   ├── nickname.ts               # 닉네임 검증 규칙
│   │   ├── categories.ts, noteCategories.ts
│   │   ├── exportExcel.ts
│   │   └── format.ts
│   ├── sw.ts                         # 커스텀 Service Worker(프리캐시 + push 핸들러)
│   └── types.ts                      # 공통 타입 정의
├── workers/
│   └── card-settlement-notifier/     # 별도 배포되는 Cron Worker (아래 참고)
├── migrations/                       # 001~017, schema.sql과 항상 동기화
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
                       --   cashback_amount, user_id
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
```

전체 정의는 `schema.sql` 참고. 스키마 변경 시 `migrations/`에 새 파일을 추가하고
`schema.sql`도 함께 동기화합니다.

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

```bash
# 빌드 + Cloudflare Pages 배포 (메인 앱)
npm run deploy

# 원격 D1 마이그레이션 실행
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
