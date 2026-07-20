-- 메모 분류 오버라이드를 계정 단위로 서버에 저장(거래 분류와 동일한 이유, 018 참고) +
-- 계정별 단일값 설정(카드 지출 집계 기준 등)을 위한 범용 key-value 테이블

CREATE TABLE IF NOT EXISTS note_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  removed_default INTEGER NOT NULL DEFAULT 0,  -- 0 = 커스텀 분류, 1 = 삭제한 기본 분류 표시
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_note_categories_user ON note_categories(user_id);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
