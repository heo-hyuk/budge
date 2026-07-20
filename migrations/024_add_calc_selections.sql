-- 개인화 수익 계산기 — 사용자가 선택한 분류 칩과 그 부호(+1/-1)를 저장.
-- 선택 안 함 상태는 행이 아예 없는 것으로 표현(기본값 개념 없음)
CREATE TABLE IF NOT EXISTS calc_selections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  sign INTEGER NOT NULL CHECK (sign IN (1, -1)),
  created_at TEXT NOT NULL,
  UNIQUE(user_id, type, category)
);

CREATE INDEX IF NOT EXISTS idx_calc_selections_user ON calc_selections(user_id);
