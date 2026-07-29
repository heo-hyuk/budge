/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

// 프론트엔드는 항상 same-origin으로만 요청하므로 CORS 헤더 자체가 불필요함
const cors = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

// 카드 정산 알림(card-settlement-notifier)/세금 리포트(monthly-tax-reporter) 두 워커가
// 실제 발송한 푸시를 notification_log에 남긴 것을 그대로 인앱 알림함으로 보여줌
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const result = await env.DB.prepare(
    `SELECT id, type, title, body, url, sent_at, read_at FROM notification_log
     WHERE user_id = ? ORDER BY sent_at DESC LIMIT 50`
  ).bind(userId).all()
  const unread = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM notification_log WHERE user_id = ? AND read_at IS NULL'
  ).bind(userId).first<{ n: number }>()

  return json({ data: result.results, unread_count: unread?.n ?? 0 })
}
