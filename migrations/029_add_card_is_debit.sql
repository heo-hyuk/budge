-- 체크카드(즉시결제) 여부 — 켜져 있으면 청구기간(billing_day/closing_day) 계산을
-- 건너뛰고 거래일 그대로 즉시 반영한다(functions/lib에서 계산하지 않고 프론트의
-- MonthlyReport.tsx/exportExcel.ts가 이 플래그를 보고 분기함). 카드 혜택(할인/적립)
-- 매칭은 card_id 등록 여부만으로 판단해서 이 플래그와 무관하게 그대로 동작한다.
ALTER TABLE cards ADD COLUMN is_debit INTEGER NOT NULL DEFAULT 0;
