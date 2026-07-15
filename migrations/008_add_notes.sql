-- 메모장(하루 1건, 카테고리+자유 텍스트) 테이블 추가
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,              -- 'YYYY-MM-DD'
  category TEXT NOT NULL DEFAULT '일상',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_notes_user_date ON notes(user_id, date);
