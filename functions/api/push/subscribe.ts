/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

interface SubscribeBody {
  endpoint: string
  p256dh: string
  auth: string
}

/** POST /api/push/subscribe — 구독 정보 저장 (endpoint 중복 시 키 갱신) */
export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body   = await request.json() as SubscribeBody

  if (!body.endpoint || !body.p256dh || !body.auth) {
    return Response.json({ error: '구독 정보가 올바르지 않습니다' }, { status: 400 })
  }

  const existing = await env.DB.prepare(
    'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
  ).bind(userId, body.endpoint).first<{ id: string }>()

  if (existing) {
    await env.DB.prepare(
      'UPDATE push_subscriptions SET p256dh = ?, auth = ? WHERE id = ?'
    ).bind(body.p256dh, body.auth, existing.id).run()
  } else {
    await env.DB.prepare(`
      INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), userId, body.endpoint, body.p256dh, body.auth, new Date().toISOString()).run()
  }

  return Response.json({ ok: true })
}
