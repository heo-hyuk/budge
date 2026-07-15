-- transactions 테이블에 구매처·결제방법·카드ID 컬럼 추가
ALTER TABLE transactions ADD COLUMN merchant TEXT DEFAULT '';
ALTER TABLE transactions ADD COLUMN payment_method TEXT DEFAULT '현금';
ALTER TABLE transactions ADD COLUMN card_id TEXT DEFAULT '';

-- 카드 테이블 신규 생성
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                    -- 카드명
  color TEXT DEFAULT '#6366f1',          -- 카드 색상
  billing_day INTEGER NOT NULL DEFAULT 25,  -- 결제일 (1-31)
  closing_day INTEGER NOT NULL DEFAULT 14,  -- 청구 마감일 (이 날까지 사용분이 다음달 결제)
  benefits TEXT DEFAULT '[]',            -- 혜택 JSON 배열
  created_at TEXT NOT NULL
);
