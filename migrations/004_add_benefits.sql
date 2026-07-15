-- card_benefits: 카드별 혜택 규칙 테이블
CREATE TABLE IF NOT EXISTS card_benefits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',            -- 혜택 이름 (예: "편의점 10% 할인")
  category TEXT DEFAULT '',                 -- 적용 분류 (빈 값 = 전체)
  merchant_pattern TEXT DEFAULT '',         -- 구매처 키워드 (빈 값 = 전체)
  discount_type TEXT NOT NULL,              -- 'percent' | 'fixed'
  discount_value REAL NOT NULL,             -- percent: 비율(10=10%), fixed: 금액(1000원)
  monthly_cap INTEGER DEFAULT 0,            -- 월 최대 할인 한도 (0 = 무제한)
  min_spend INTEGER DEFAULT 0,              -- 최소 결제 금액 (0 = 무조건 적용)
  memo TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_benefits_card ON card_benefits(card_id);
CREATE INDEX IF NOT EXISTS idx_benefits_user ON card_benefits(user_id);

-- transactions: 할인 추적 컬럼 추가
ALTER TABLE transactions ADD COLUMN original_amount INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN discount_amount INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN benefit_id TEXT DEFAULT '';
