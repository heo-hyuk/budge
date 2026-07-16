-- 012: 사용자 표시용 닉네임 추가 (헤더에는 실명 대신 닉네임 표시)

ALTER TABLE users ADD COLUMN nickname TEXT;
-- 기존 가입자는 NULL — 로그인 응답에서 name으로 폴백 표시, 최초 로그인 시 설정 유도
