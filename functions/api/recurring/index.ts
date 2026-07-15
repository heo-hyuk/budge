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

// 고정지출 목록 조회
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const result = await env.DB.prepare(
    'SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(userId).all()
  return json({ data: result.results })
}

// 고정지출 등록
export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body   = await request.json() as {
    name: string
    type: 'income' | 'expense'
    category: string
    amount: number
    merchant?: string
    payment_method?: string
    card_id?: string
    day_of_month: number
    start_date: string
    end_date?: string
  }

  if (!body.name || !body.type || !body.category || !body.amount || !body.day_of_month || !body.start_date) {
    return json({ error: 'Missing required fields' }, 400)
  }

  const id         = crypto.randomUUID()
  const created_at = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO recurring_transactions
       (id, user_id, name, type, category, amount, merchant, payment_method, card_id,
        day_of_month, start_date, end_date, last_generated_date, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?)`
  ).bind(
    id, userId, body.name, body.type, body.category, body.amount,
    body.merchant ?? '', body.payment_method ?? '현금', body.card_id ?? '',
    body.day_of_month, body.start_date, body.end_date ?? null,
    created_at
  ).run()

  return json({ ok: true, id }, 201)
}
