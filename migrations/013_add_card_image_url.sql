-- 013: 카드 실물 디자인 이미지 URL 추가 (R2 공개 URL)

ALTER TABLE cards ADD COLUMN image_url TEXT;
-- 프리셋 선택 시 해당 카드 디자인 이미지 URL 저장, 직접 입력한 카드는 NULL(color 기반 표시로 폴백)
