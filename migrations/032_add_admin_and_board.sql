-- ============================================================
-- 032_add_admin_and_board.sql
-- 관리자 계정 + 공지/문의(Q&A) 게시판
-- ============================================================
-- 적용:
--   로컬  : npx wrangler d1 execute budget-db --local  --file=./migrations/032_add_admin_and_board.sql
--   원격  : npx wrangler d1 execute budget-db --remote --file=./migrations/032_add_admin_and_board.sql
-- ============================================================

-- ── 관리자 플래그 ────────────────────────────────────────────
-- 기존 사용자는 모두 0. 관리자만 1.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

-- ── 관리자 계정 시드 ────────────────────────────────────────
-- 관리자는 이메일 없이 로그인 아이디로만 로그인한다. users.email 컬럼(UNIQUE,
-- 형식 제약 없음)을 로그인 아이디 'db8485' 저장에 재사용.
-- password_hash 는 PBKDF2-SHA256 15000회 해시(비밀번호 자체는 저장소 밖에서 관리).
INSERT OR IGNORE INTO users (id, email, password_hash, salt, iterations, name, nickname, is_admin, created_at)
VALUES (
  'admin-db8485',
  'db8485',
  '5913262a3409d57ec07bfbbfc118535494b814510a0fbddb32c7a4bf1e05d7cc',
  '0a2c1afc-0827-46c2-ab68-e1ae8813850d',
  15000,
  '관리자',
  '관리자',
  1,
  '2026-08-31T02:26:28.083Z'
);

-- ── 공지/문의 게시판 ────────────────────────────────────────
-- 계정별 데이터가 아니라 전 사용자 공용. type 으로 공지/문의를 한 테이블에서 관리.
--   notice : 관리자만 작성. 모두에게 공개. is_pinned 로 상단 고정.
--   qna    : 로그인 사용자 누구나 작성. is_private=1 이면 작성자+관리자만 열람.
--            answer 는 관리자 답변(단일), NULL 이면 미답변.
CREATE TABLE IF NOT EXISTS board_posts (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('notice', 'qna')),
  user_id     TEXT NOT NULL,               -- 작성자(공지는 관리자 user_id)
  author_name TEXT NOT NULL,               -- 표시용 닉네임 스냅샷(작성 시점)
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_private  INTEGER NOT NULL DEFAULT 0,  -- qna 전용: 1 = 작성자+관리자만
  is_pinned   INTEGER NOT NULL DEFAULT 0,  -- notice 전용: 1 = 목록 상단 고정
  answer      TEXT,                        -- qna 관리자 답변, NULL = 미답변
  answered_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_board_posts_type ON board_posts(type, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_posts_user ON board_posts(user_id);
