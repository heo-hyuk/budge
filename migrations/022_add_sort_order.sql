-- 관리 모드에서 커스텀 분류/구매처 칩의 순서를 바꿀 수 있게 sort_order 추가.
-- 기본 제공 분류는 DB 행이 없어(항상 고정 배열) 순서 변경 대상에서 자동으로 제외됨
ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE note_categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
