-- 빠른 입력 템플릿에 memo 컬럼 추가
-- (템플릿 저장 시 메모도 함께 저장/복원되도록 — 이전엔 컬럼 자체가 없어 항상 누락됐음)
-- NOT NULL 제약 변경이 아니라 컬럼 추가라 015와 달리 테이블 재생성 불필요

ALTER TABLE quick_templates ADD COLUMN memo TEXT DEFAULT '';
