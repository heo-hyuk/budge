-- 결제 방법(현금/계좌이체 + 커스텀) 관리 목록 — categories와 동일한 구조,
-- type으로 지출/수입을 분리 관리(같은 이름이어도 지출/수입 각자 독립적으로 추가/삭제)
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
