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

export const onRequestGet: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const url    = new URL(request.url)
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '500', 10), 1000)
  const month      = url.searchParams.get('month')
  const year       = url.searchParams.get('year')
  const q          = url.searchParams.get('q')
  const cardId     = url.searchParams.get('card_id')
  const dateStart  = url.searchParams.get('date_start')
  const dateEnd    = url.searchParams.get('date_end')

  let query = 'SELECT * FROM transactions WHERE user_id = ?'
  const binds: unknown[] = [userId]

  if (month && /^\d{4}-\d{2}$/.test(month)) { query += ' AND date LIKE ?'; binds.push(`${month}-%`) }
  else if (year && /^\d{4}$/.test(year))      { query += ' AND date LIKE ?'; binds.push(`${year}-%`) }

  if (q)         { query += ' AND (category LIKE ? OR merchant LIKE ? OR memo LIKE ?)'; const l = `%${q}%`; binds.push(l, l, l) }
  if (cardId)    { query += ' AND card_id = ?';   binds.push(cardId) }
  if (dateStart) { query += ' AND date >= ?';     binds.push(dateStart) }
  if (dateEnd)   { query += ' AND date <= ?';     binds.push(dateEnd) }

  query += ' ORDER BY date DESC, created_at DESC LIMIT ?'
  binds.push(limit)

  const result = await env.DB.prepare(query).bind(...binds).all()
  return json({ data: result.results })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body   = await request.json() as {
    type: 'income' | 'expense'; category: string; amount: number
    memo?: string; date: string; merchant?: string; payment_method?: string; card_id?: string
  }

  if (!body.type || !body.category || !body.amount || !body.date) {
    return json({ error: 'Missing required fields' }, 400)
  }

  const id         = crypto.randomUUID()
  const created_at = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, category, amount, memo, date, merchant, payment_method, card_id, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.type, body.category, body.amount,
    body.memo ?? '', body.date,
    body.merchant ?? '', body.payment_method ?? '현금', body.card_id ?? '',
    userId, created_at
  ).run()

  return json({ ok: true, id }, 201)
}
