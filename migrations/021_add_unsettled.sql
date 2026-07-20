-- "비정산" 거래 플래그 — 가족 비용 확인용으로만 쓰는 거래를 표시.
-- 1이면 일/주/월/연 정산, 예산 집계, 홈 화면 잔액/합계, 엑셀 내보내기에서 완전히 제외되고
-- 별도의 "비정산" 탭에서만 조회/합계됨
ALTER TABLE transactions ADD COLUMN unsettled INTEGER NOT NULL DEFAULT 0;
