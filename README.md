# 가계부

개인 웹 가계부 서비스. 카드 청구 기간 기반 정산, 구매처 기록, 회원 관리를 지원합니다.

**배포 URL:** https://budget-3wb.pages.dev

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 19 + TypeScript + Tailwind CSS v4 + Vite |
| 백엔드 | Cloudflare Pages Functions (Edge) |
| 데이터베이스 | Cloudflare D1 (SQLite) |
| 인증 | 자체 이메일/비밀번호 (PBKDF2 + 세션 쿠키) |
| 배포 | Cloudflare Pages |

---

## 구현된 기능

### 인증
- 이메일 + 비밀번호 회원가입 / 로그인
- 세션 쿠키 기반 로그인 유지 (30일)
- 비밀번호 PBKDF2 해싱 (10,000회 반복 + 랜덤 salt)
- 모든 API 미들웨어에서 세션 검증, 사용자별 데이터 완전 격리

### 홈 (거래 입력 / 목록)
- 수입 / 지출 구분 입력
- 금액, 분류, 날짜, 메모 입력
- 구매처 / 판매처 기록
- 결제 방법 선택 (현금 또는 등록된 카드)
- 분류 직접 추가 (localStorage 저장)
- 날짜별 그룹 목록, 수입(파랑) / 지출(빨강) 색상 구분
- 카드 결제 시 카드 뱃지 표시
- 인라인 수정 / 삭제

### 월별 필터
- 헤더 ◀ ▶ 버튼으로 월 이동
- `오늘` 버튼으로 현재 월 복귀
- 선택 월 데이터만 API에서 조회

### 분류별 합계
- 이번 달 지출 / 수입 분류별 막대그래프
- 지출 / 수입 탭 전환

### 월별 정산
- 현금 수입 / 지출 합계
- 카드별 청구 기간 실출금 집계 (마감일 기준 자동 계산)
- 카드별 세부 내역 펼치기 / 접기
- 실지출 합계 = 현금지출 + 카드 청구액
- 최종 잔액 표시

### 연간 정산
- 12개월 수입 / 지출 바 차트
- 연 합계 (수입 / 지출 / 잔액)
- 월별 숫자 표
- ◀ ▶ 연도 이동

### 카드 관리
- 카드 등록 / 수정 / 삭제
- 카드명, 색상, 청구 마감일, 결제일 직접 입력
- 혜택 정보 여러 줄 입력
- 청구 기간 미리보기 (예: 전월 15일 ~ 당월 14일 사용분)
- 카드 삭제 시 해당 거래 결제방법 자동 초기화

### 검색
- 구매처 / 분류 / 메모 통합 검색
- 검색 결과 날짜별 그룹 표시
- 결제 방법 (카드 / 현금) 뱃지 표시

---

## 프로젝트 구조

```
budge/
├── functions/
│   ├── api/
│   │   ├── _middleware.ts          # 세션 검증 미들웨어
│   │   ├── auth/
│   │   │   ├── register.ts         # POST /api/auth/register
│   │   │   ├── login.ts            # POST /api/auth/login
│   │   │   ├── logout.ts           # POST /api/auth/logout
│   │   │   └── me.ts               # GET  /api/auth/me
│   │   ├── transactions/
│   │   │   ├── index.ts            # GET / POST /api/transactions
│   │   │   └── [id].ts             # PATCH / DELETE /api/transactions/:id
│   │   └── cards/
│   │       ├── index.ts            # GET / POST /api/cards
│   │       └── [id].ts             # PATCH / DELETE /api/cards/:id
│   └── lib/
│       └── auth.ts                 # PBKDF2 해싱, 쿠키 유틸
├── src/
│   ├── components/
│   │   ├── AuthPage.tsx            # 로그인 / 회원가입 폼
│   │   ├── SummaryCard.tsx         # 월 수입/지출/잔액 요약
│   │   ├── TransactionForm.tsx     # 거래 입력 폼
│   │   ├── TransactionList.tsx     # 거래 목록 (수정/삭제 포함)
│   │   ├── CategoryBreakdown.tsx   # 분류별 막대 그래프
│   │   ├── MonthlyReport.tsx       # 월별 정산
│   │   ├── AnnualReport.tsx        # 연간 정산
│   │   ├── CardManager.tsx         # 카드 관리
│   │   └── SearchView.tsx          # 검색
│   ├── contexts/
│   │   └── AuthContext.tsx         # 로그인 상태 전역 관리
│   ├── lib/
│   │   ├── api.ts                  # API 호출 함수
│   │   ├── billing.ts              # 카드 청구 기간 계산
│   │   ├── categories.ts           # 기본/커스텀 분류 관리
│   │   └── format.ts               # 금액/날짜 포맷
│   └── types.ts                    # 공통 타입 정의
├── migrations/
│   ├── 001_add_cards.sql           # 카드 테이블 + 거래 컬럼 추가
│   └── 002_add_auth.sql            # 인증 테이블 + user_id 추가
├── schema.sql                      # 전체 DB 스키마
└── wrangler.toml                   # Cloudflare 설정
```

---

## DB 스키마

```sql
users        -- id, email, password_hash, salt, name
sessions     -- id, user_id, expires_at
transactions -- id, type, category, amount, memo, date,
             --   merchant, payment_method, card_id, user_id
cards        -- id, name, color, billing_day, closing_day, benefits, user_id
```

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

# 타입 체크
npm run typecheck

# 린트
npm run lint
```

## 배포

```bash
# 빌드 + Cloudflare Pages 배포
npm run deploy

# 원격 D1 마이그레이션 실행
npx wrangler d1 execute budget-db --remote --file=./migrations/파일명.sql
```

---

## 카드 청구 기간 계산 방식

마감일(`closing_day`)과 결제일(`billing_day`)은 사용자가 카드별로 직접 입력합니다.

```
예) 마감일 14일, 결제일 25일인 카드의 7월 정산:

  청구 기간: 2026-06-15 ~ 2026-07-14 사용분
  실결제일:  2026-07-25
```
