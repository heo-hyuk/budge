-- 카드 정산기 — 카드매출(정산 대기)로 추적할 수입 분류 선택(옵트인, 기본 전체 미선택).
-- 배송 탭(delivery_excluded_categories)과 완전히 독립된 상태. 목표 분류(체크 시
-- 바뀔 분류)는 계정당 값 하나뿐이라 기존 user_settings 테이블을 재사용(스키마 변경 불필요)
CREATE TABLE IF NOT EXISTS card_settlement_source_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_card_settlement_source_categories_user ON card_settlement_source_categories(user_id);
