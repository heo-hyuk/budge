-- 빠른 입력 템플릿(즐겨찾기) 테이블 추가
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
