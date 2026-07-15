-- budgets.id를 INTEGER AUTOINCREMENT → TEXT UUID로 변경
-- SQLite는 ALTER COLUMN 미지원이므로 테이블 재생성 방식 사용

CREATE TABLE budgets_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  monthly_limit INTEGER NOT NULL,
  year_month TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, category, year_month)
);

-- 기존 데이터 이관 (id는 hex(randomblob(16))으로 임시 UUID 생성)
INSERT INTO budgets_new
  SELECT hex(randomblob(16)), user_id, category, monthly_limit, year_month, active, created_at
  FROM budgets;

DROP TABLE budgets;
ALTER TABLE budgets_new RENAME TO budgets;

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
