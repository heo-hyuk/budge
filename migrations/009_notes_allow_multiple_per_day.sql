-- 메모장: 하루 1건 제약(UNIQUE(user_id, date))을 제거해 하루 여러 건 허용
-- SQLite는 제약 조건을 직접 DROP할 수 없어 테이블 재생성 방식 사용
ALTER TABLE notes RENAME TO notes_old;

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,              -- 'YYYY-MM-DD'
  category TEXT NOT NULL DEFAULT '일상',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO notes (id, user_id, date, category, content, created_at, updated_at)
  SELECT id, user_id, date, category, content, created_at, updated_at FROM notes_old;

DROP TABLE notes_old;

CREATE INDEX IF NOT EXISTS idx_notes_user_date ON notes(user_id, date);
