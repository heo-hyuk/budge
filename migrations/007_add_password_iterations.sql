-- PBKDF2 반복횟수를 유저별로 저장 (기존 계정은 예전 반복횟수로 계속 검증되도록)
-- 기본값 10000 = 이 컬럼이 생기기 전까지 실제로 쓰이던 값
ALTER TABLE users ADD COLUMN iterations INTEGER NOT NULL DEFAULT 10000;
