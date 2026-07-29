/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

const cors = {
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

// 알림함을 열었을 때 안 읽은 알림 전체를 한 번에 읽음 처리 — 항목별 읽음 처리는
// 지금 UI에서 필요 없어(전부 열람 즉시 읽음 처리하는 방식) 단순하게 유지
export const onRequestPatch: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  await env.DB.prepare(
    "UPDATE notification_log SET read_at = ? WHERE user_id = ? AND read_at IS NULL"
  ).bind(new Date().toISOString(), userId).run()

  return json({ ok: true })
}
