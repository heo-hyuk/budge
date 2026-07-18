-- 메모에 이미지(스크린샷) 첨부 기능 지원
-- image_key: R2 오브젝트 키('notes/{note_id}'), 이미지 없으면 NULL
ALTER TABLE notes ADD COLUMN image_key TEXT;
