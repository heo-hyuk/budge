-- 포인트/할인 사용액을 카드 혜택 할인(discount_amount)과 분리해서 저장.
-- 146차에서 카드 결제에도 포인트 사용을 허용하면서 discount_amount에
-- 혜택분+포인트분을 합쳐 저장했는데, 두 가지 부작용이 있었음:
-- 1) 수정 시 할인액을 혜택분/포인트분으로 되돌릴 수 없어 포인트 입력 복원 불가
-- 2) benefitMatcher.ts의 월 한도 집계(discount_amount+cashback_amount)가
--    포인트 금액까지 그 혜택 사용량으로 잘못 집계함
-- point_discount를 따로 둬서 discount_amount는 다시 "카드 혜택 할인만"을
-- 의미하게 되돌리고, 실결제액 계산 시에만 두 값을 더한다.
ALTER TABLE transactions ADD COLUMN point_discount INTEGER NOT NULL DEFAULT 0;
