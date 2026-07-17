-- 014: 카드 정산 알림용 push 구독 + 발송 기록

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS notification_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'card_settlement'
  reference_id TEXT NOT NULL,   -- card_id
  year_month TEXT NOT NULL,     -- 어느 청구월 기준인지 (getCardBillingPeriod의 month)
  sent_at TEXT NOT NULL,
  UNIQUE(user_id, type, reference_id, year_month)  -- 같은 카드, 같은 청구월 중복 발송 방지
);
