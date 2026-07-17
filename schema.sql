-- ============================================================
-- schema.sql — 최종 상태 (모든 마이그레이션 001~013 포함)
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
  amount INTEGER NOT NULL,
  merchant TEXT DEFAULT '',
  payment_method TEXT DEFAULT '현금',
  card_id TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quick_templates_user ON quick_templates(user_id);
