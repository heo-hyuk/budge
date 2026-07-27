-- 카드 정산기를 배송 탭처럼 되돌리기 가능한 토글 방식으로 변경.
-- 확인(체크) 시 원래 결제방법을 이 컬럼에 저장해두고 payment_method를 목표
-- 결제방법으로 바꾼다. 체크 해제(되돌리기) 시 이 값으로 payment_method를
-- 복원하고 다시 NULL로 비운다(정산 집계는 payment_method로 포함/제외를
-- 판단하므로 원래 값을 몰라야 되돌릴 수 없음 — functions/lib/settlement.ts 참고)
ALTER TABLE transactions ADD COLUMN pending_source_payment_method TEXT;
