-- 011: 혜택 그룹(통합 월한도 공유) + 혜택 유형(할인/적립) + 활성 토글 + 적립액 기록

CREATE TABLE benefit_groups (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  name TEXT NOT NULL,              -- 예: "LOCA LIKIT 통합한도"
  monthly_cap INTEGER NOT NULL,    -- 그룹 전체가 공유하는 월 한도
  created_at TEXT NOT NULL,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE INDEX idx_benefit_groups_card ON benefit_groups(card_id);

ALTER TABLE card_benefits ADD COLUMN benefit_group_id TEXT;
-- NULL이면 기존처럼 개별 monthly_cap 사용, 값 있으면 benefit_groups 참조

ALTER TABLE card_benefits ADD COLUMN benefit_type TEXT NOT NULL DEFAULT 'discount'
  CHECK (benefit_type IN ('discount', 'cashback'));
-- discount: 즉시 할인 (기존 방식), cashback: 나중에 적립되는 포인트/캐시

ALTER TABLE card_benefits ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
-- 삼성 taptap O처럼 "매달 패키지 하나만 선택"하는 카드용 —
-- 선택 안 한 패키지의 혜택 행들은 active=0으로 꺼둠

ALTER TABLE transactions ADD COLUMN cashback_amount INTEGER DEFAULT 0;
-- cashback 혜택 매칭 시 예상 적립액 기록용 (정산/예산 계산에는 포함 안 함, 정보 표시 전용)
