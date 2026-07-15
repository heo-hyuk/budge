/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const result = await env.DB.prepare(
    'SELECT * FROM cards WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(userId).all()
  return json({ data: result.results })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body   = await request.json() as {
    name: string; color?: string; billing_day: number; closing_day: number; benefits?: string
  }

  if (!body.name || !body.billing_day || !body.closing_day) {
    return json({ error: 'Missing required fields' }, 400)
  }
  if (
    body.billing_day < 1 || body.billing_day > 31 ||
    body.closing_day < 1 || body.closing_day > 31
  ) {
    return json({ error: '결제일과 마감일은 1~31 사이여야 합니다' }, 400)
  }

  const id         = crypto.randomUUID()
  const created_at = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO cards (id, name, color, billing_day, closing_day, benefits, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.name, body.color ?? '#6366f1', body.billing_day, body.closing_day, body.benefits ?? '[]', userId, created_at).run()

  return json({ ok: true, id }, 201)
}
