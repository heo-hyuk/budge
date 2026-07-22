-- 배송 탭 — 지출 거래에 배송완료 체크 여부를 저장
ALTER TABLE transactions ADD COLUMN delivery_done INTEGER NOT NULL DEFAULT 0;

-- 배송 탭 전용 분류 제외 선택(지출계산기의 calc_selections와는 완전히 독립된 상태) —
-- exclude 전용이라 sign/type 개념 없이 제외된 분류명만 저장
CREATE TABLE IF NOT EXISTS delivery_excluded_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_delivery_excluded_categories_user ON delivery_excluded_categories(user_id);
