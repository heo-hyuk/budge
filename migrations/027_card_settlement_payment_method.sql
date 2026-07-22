-- 카드 정산기를 분류(category) 기준에서 결제방법(payment_method) 기준으로 변경.
-- 카드매출 정산금은 결제방법에 "예정" 같은 커스텀 항목을 만들어 등록해두고,
-- 정산 확인 시 "계좌이체"로 바꾸는 흐름이 더 자연스럽다는 피드백 반영.
-- (목표 결제방법은 user_settings의 cardSettlementTargetPaymentMethod 키로 저장 —
-- 스키마 없는 범용 테이블이라 이 마이그레이션에서 건드릴 것 없음)
ALTER TABLE card_settlement_source_categories RENAME TO card_settlement_source_payment_methods;
ALTER TABLE card_settlement_source_payment_methods RENAME COLUMN category TO payment_method;

DROP INDEX IF EXISTS idx_card_settlement_source_categories_user;
CREATE INDEX IF NOT EXISTS idx_card_settlement_source_payment_methods_user ON card_settlement_source_payment_methods(user_id);
