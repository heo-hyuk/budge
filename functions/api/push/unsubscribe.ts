/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

/** POST /api/push/unsubscribe — 구독 삭제 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body   = await request.json() as { endpoint: string }

  if (!body.endpoint) {
    return Response.json({ error: 'endpoint가 필요합니다' }, { status: 400 })
  }

  await env.DB.prepare(
    'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
  ).bind(userId, body.endpoint).run()

  return Response.json({ ok: true })
}
