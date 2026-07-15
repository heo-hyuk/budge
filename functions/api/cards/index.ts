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

// 카드 목록 조회
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const result = await env.DB.prepare(
    'SELECT * FROM cards ORDER BY created_at ASC'
  ).all()
  return json({ data: result.results })
}

// 카드 등록
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json() as {
    name: string
    color?: string
    billing_day: number
    closing_day: number
    benefits?: string
  }

  if (!body.name || !body.billing_day || !body.closing_day) {
    return json({ error: 'Missing required fields' }, 400)
  }

  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO cards (id, name, color, billing_day, closing_day, benefits, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.name, body.color ?? '#6366f1',
    body.billing_day, body.closing_day,
    body.benefits ?? '[]', created_at
  ).run()

  return json({ ok: true, id }, 201)
}
