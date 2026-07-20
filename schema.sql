-- ============================================================
-- schema.sql — 최종 상태 (모든 마이그레이션 001~023 포함)
-- ============================================================
-- 주의: 마이그레이션 파일 추가 시 반드시 이 파일도 동기화할 것
-- 로컬 초기화: npm run d1:init (wrangler d1 execute --local --file=./schema.sql)
-- ============================================================

-- ── 인증 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT NOT NULL,
  iterations INTEGER NOT NULL DEFAULT 10000,  -- PBKDF2 반복횟수 (migration 007)
  nickname TEXT,  -- 헤더 표시용 (migration 012), NULL이면 name으로 폴백
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ── 카드 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  billing_day INTEGER NOT NULL DEFAULT 25,   -- 결제일 (1~31)
  closing_day INTEGER NOT NULL DEFAULT 14,   -- 청구 마감일
  benefits TEXT DEFAULT '[]',
  user_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  image_url TEXT  -- 카드 실물 디자인 이미지 URL (migration 013), NULL이면 color 기반 표시로 폴백
);

CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);

-- ── 거래 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  memo TEXT DEFAULT '',
  date TEXT NOT NULL,
  merchant TEXT DEFAULT '',
  payment_method TEXT DEFAULT '현금',
  card_id TEXT DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  recurring_id TEXT DEFAULT '',          -- 고정지출/수입 연결 ID
  original_amount INTEGER DEFAULT 0,     -- 할인 전 원래 금액
  discount_amount INTEGER DEFAULT 0,     -- 적용된 할인액
  benefit_id TEXT DEFAULT '',            -- 적용된 카드 혜택 규칙 ID
  cashback_amount INTEGER DEFAULT 0,     -- 적립형(cashback) 혜택 예상 적립액 (정산 계산엔 미포함, migration 011)
  unsettled INTEGER NOT NULL DEFAULT 0,  -- 1 = 비정산(가족 비용 확인용, 정산·예산·잔액·내보내기에서 완전히 제외, migration 021)
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date      ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_card      ON transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user      ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON transactions(recurring_id);

-- ── 고정 수입/지출 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  merchant TEXT DEFAULT '',
  payment_method TEXT DEFAULT '현금',
  card_id TEXT DEFAULT '',
  day_of_month INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  last_generated_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id);

-- ── 카드 혜택 규칙 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_benefits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',              -- 빈 문자열 = 전체 분류
  merchant_pattern TEXT DEFAULT '',      -- 빈 문자열 = 전체 가맹점
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value REAL NOT NULL,          -- percent: %, fixed: 원
  monthly_cap INTEGER DEFAULT 0,         -- 0 = 월 한도 없음 (benefit_group_id가 있으면 무시되고 그룹 한도 사용)
  min_spend INTEGER DEFAULT 0,           -- 0 = 최소 결제금액 없음
  memo TEXT DEFAULT '',
  benefit_group_id TEXT,                 -- NULL = 개별 한도, 값 있으면 benefit_groups 참조 (migration 011)
  benefit_type TEXT NOT NULL DEFAULT 'discount' CHECK (benefit_type IN ('discount', 'cashback')),  -- migration 011
  active INTEGER NOT NULL DEFAULT 1,     -- 0 = 비활성 (택1 패키지 카드에서 미선택 항목, migration 011)
  created_at TEXT NOT NULL,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_benefits_card ON card_benefits(card_id);
CREATE INDEX IF NOT EXISTS idx_benefits_user ON card_benefits(user_id);

-- ── 혜택 그룹 (통합 월한도 공유, migration 011) ──────────────────
CREATE TABLE IF NOT EXISTS benefit_groups (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  name TEXT NOT NULL,              -- 예: "LOCA LIKIT 통합한도"
  monthly_cap INTEGER NOT NULL,    -- 그룹 전체가 공유하는 월 한도
  created_at TEXT NOT NULL,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_benefit_groups_card ON benefit_groups(card_id);

-- ── 예산 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,                   -- UUID (TEXT, migration 006에서 변경됨)
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,               -- '전체' = 해당 달 전체 지출 예산
  monthly_limit INTEGER NOT NULL,
  year_month TEXT,                      -- 'YYYY-MM' 지정 시 해당 월만 적용, NULL = 매월 반복
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, category, year_month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);

-- ── 메모장 (하루 여러 건 가능, 카테고리+자유 텍스트) ─────────────
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,              -- 'YYYY-MM-DD'
  category TEXT NOT NULL DEFAULT '일상',
  content TEXT NOT NULL,
  image_key TEXT,                  -- R2 오브젝트 키('notes/{note_id}'), migration 017
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_user_date ON notes(user_id, date);

-- ── 빠른 입력 템플릿(즐겨찾기) ────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,        -- 예: "아메리카노"
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category TEXT NOT NULL,
  amount INTEGER,              -- NULL = 금액 미지정(적용 시 매번 금액만 새로 입력, migration 015)
  merchant TEXT DEFAULT '',
  payment_method TEXT DEFAULT '현금',
  card_id TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  memo TEXT DEFAULT ''         -- migration 016
);

CREATE INDEX IF NOT EXISTS idx_quick_templates_user ON quick_templates(user_id);

-- ── 카드 정산 알림 (Push, migration 014) ───────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS notification_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'card_settlement'
  reference_id TEXT NOT NULL,   -- card_id
  year_month TEXT NOT NULL,     -- 어느 청구월 기준인지 (getCardBillingPeriod의 month)
  sent_at TEXT NOT NULL,
  UNIQUE(user_id, type, reference_id, year_month)  -- 같은 카드, 같은 청구월 중복 발송 방지
);

-- ── 거래 분류(카테고리) 오버라이드 (migration 018) ─────────────────
-- 계정별로 저장해 기기 간 동기화(이전엔 localStorage에만 저장돼 기기마다 달랐음)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  name TEXT NOT NULL,
  removed_default INTEGER NOT NULL DEFAULT 0,  -- 0 = 사용자가 추가한 커스텀 분류, 1 = 삭제한 기본 분류 표시
  sort_order INTEGER NOT NULL DEFAULT 0,  -- 커스텀 분류끼리의 순서(기본 분류는 항상 앞에 고정, migration 022)
  created_at TEXT NOT NULL,
  UNIQUE(user_id, type, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

-- ── 메모 분류 오버라이드 (migration 019) ────────────────────────
-- 거래 분류(categories)와 동일 구조, 메모장은 수입/지출 구분이 없어 타입 없이 단일 목록
CREATE TABLE IF NOT EXISTS note_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  removed_default INTEGER NOT NULL DEFAULT 0,  -- 0 = 커스텀 분류, 1 = 삭제한 기본 분류 표시
  sort_order INTEGER NOT NULL DEFAULT 0,  -- 커스텀 분류끼리의 순서(기본 분류는 항상 앞에 고정, migration 022)
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_note_categories_user ON note_categories(user_id);

-- ── 계정별 단일값 설정 (migration 019) ───────────────────────────
-- 카드 지출 집계 기준(출금일/거래일) 등, 계정당 값 하나뿐인 설정을 위한 범용 key-value.
-- 새 설정이 늘어나도 스키마 변경 없이 API의 허용 key 목록만 늘리면 됨
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- ── 구매처/판매처 관리 목록 (migration 020) ─────────────────────
-- 분류와 달리 기본값 개념이 없음(사용자마다 상호명이 전혀 다름) — 단순 커스텀 목록.
-- /api/merchants/recent(거래 이력 기반 자동완성)와는 별개 기능
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,  -- 구매처끼리의 순서 (migration 022)
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_merchants_user ON merchants(user_id);

-- ── 결제 방법(현금/계좌이체 + 커스텀) 관리 목록 (migration 023) ──────
-- categories와 동일한 구조. type으로 지출/수입을 분리 관리(같은 이름이어도
-- 지출/수입 각자 독립적으로 추가/삭제). 등록된 카드는 이 테이블과 무관(cards 테이블 별도)
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  name TEXT NOT NULL,
  removed_default INTEGER NOT NULL DEFAULT 0,  -- 0 = 사용자가 추가한 커스텀, 1 = 삭제한 기본 항목 표시
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, type, name)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
