CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  memo TEXT,
  date TEXT NOT NULL,
  merchant TEXT DEFAULT '',         -- 구매처/판매처
  payment_method TEXT DEFAULT '현금', -- 결제방법 (현금 | 카드ID)
  card_id TEXT DEFAULT '',          -- 카드로 결제 시 카드 ID
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_card ON transactions(card_id);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  billing_day INTEGER NOT NULL DEFAULT 25,   -- 결제일
  closing_day INTEGER NOT NULL DEFAULT 14,   -- 청구 마감일
  benefits TEXT DEFAULT '[]',
  created_at TEXT NOT NULL
);
