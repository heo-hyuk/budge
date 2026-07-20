-- 구매처/판매처 관리 목록 — 분류처럼 사용자가 직접 추가/삭제하는 칩 목록.
-- 분류와 달리 기본값 개념이 없어(사용자마다 상호명이 전혀 다름) 단순 커스텀 목록.
-- 기존 /api/merchants/recent(거래 이력 기반 자동완성)와는 별개 기능으로 공존
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_merchants_user ON merchants(user_id);
