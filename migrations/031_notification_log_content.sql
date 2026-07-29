-- 인앱 알림함 기능의 기반 스키마.
-- notification_log는 지금까지 발송 여부(중복 방지)만 기록하고 실제 문구는
-- 저장하지 않아서 화면에 보여줄 게 없었음 — 발송 시점의 제목/본문/딥링크와
-- 읽음 여부를 함께 저장하도록 확장한다.

ALTER TABLE notification_log ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE notification_log ADD COLUMN body TEXT NOT NULL DEFAULT '';
ALTER TABLE notification_log ADD COLUMN url TEXT NOT NULL DEFAULT '/';
ALTER TABLE notification_log ADD COLUMN read_at TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id, sent_at);
