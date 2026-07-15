-- budgets: 카테고리별 월 예산 설정
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,         -- '전체'면 그 달 전체 지출 예산
  monthly_limit INTEGER NOT NULL,
  year_month TEXT,                -- 'YYYY-MM' 지정 시 해당 월만 적용, NULL이면 매월 반복
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, category, year_month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
