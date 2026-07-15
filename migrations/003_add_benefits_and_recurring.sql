-- 고정지출/수입 템플릿 테이블
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,                      -- 항목명 (예: 넷플릭스 구독)
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  merchant TEXT DEFAULT '',
  payment_method TEXT DEFAULT '현금',
  card_id TEXT DEFAULT '',
  day_of_month INTEGER NOT NULL,           -- 매월 몇 일에 발생 (1-31)
  start_date TEXT NOT NULL,               -- 시작일 (YYYY-MM-DD)
  end_date TEXT,                           -- 종료일 (NULL = 무기한)
  last_generated_date TEXT,               -- 마지막으로 거래를 생성한 날짜
  active INTEGER NOT NULL DEFAULT 1,      -- 0=비활성, 1=활성
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id);

-- transactions 테이블에 recurring_id 컬럼 추가 (자동 생성된 거래 추적용)
ALTER TABLE transactions ADD COLUMN recurring_id TEXT DEFAULT '';
