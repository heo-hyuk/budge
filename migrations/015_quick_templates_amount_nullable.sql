-- 빠른 입력 템플릿의 amount를 NOT NULL → nullable로 완화
-- (수입 항목처럼 매일 반복되지만 금액이 매번 달라서 "금액 제외" 저장을 지원하기 위함)
-- SQLite는 ALTER COLUMN 미지원이므로 테이블 재생성 방식 사용

CREATE TABLE quick_templates_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category TEXT NOT NULL,
  amount INTEGER,
  merchant TEXT DEFAULT '',
  payment_method TEXT DEFAULT '현금',
  card_id TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

INSERT INTO quick_templates_new
  SELECT id, user_id, label, type, category, amount, merchant, payment_method, card_id, sort_order, created_at
  FROM quick_templates;

DROP TABLE quick_templates;
ALTER TABLE quick_templates_new RENAME TO quick_templates;

CREATE INDEX IF NOT EXISTS idx_quick_templates_user ON quick_templates(user_id);
