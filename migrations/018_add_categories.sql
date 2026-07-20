-- 거래 분류(카테고리) 오버라이드를 계정 단위로 서버에 저장 — 이전엔 localStorage에만
-- 저장돼 같은 계정이라도 로그인한 기기마다 분류 목록이 서로 달랐음
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  name TEXT NOT NULL,
  removed_default INTEGER NOT NULL DEFAULT 0,  -- 0 = 사용자가 추가한 커스텀 분류, 1 = 삭제한 기본 분류 표시
  created_at TEXT NOT NULL,
  UNIQUE(user_id, type, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
