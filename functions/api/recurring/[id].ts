/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

// 프론트엔드는 항상 same-origin으로만 요청하므로 CORS 헤더 자체가 불필요함
const cors = {
  'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

// 고정지출 수정 (active 토글 포함)
export const onRequestPatch: PagesFunction<Env> = async ({ params, request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body   = await request.json() as {
    name?: string
    type?: 'income' | 'expense'
    category?: string
    amount?: number
    merchant?: string
    payment_method?: string
    card_id?: string
    day_of_month?: number
    start_date?: string
    end_date?: string | null
    active?: number  // 0 or 1
  }

  const fields: string[] = []
  const values: unknown[] = []

  if (body.name !== undefined)           { fields.push('name = ?');           values.push(body.name) }
  if (body.type !== undefined)           { fields.push('type = ?');           values.push(body.type) }
  if (body.category !== undefined)       { fields.push('category = ?');       values.push(body.category) }
  if (body.amount !== undefined)         { fields.push('amount = ?');         values.push(body.amount) }
  if (body.merchant !== undefined)       { fields.push('merchant = ?');       values.push(body.merchant) }
  if (body.payment_method !== undefined) { fields.push('payment_method = ?'); values.push(body.payment_method) }
  if (body.card_id !== undefined)        { fields.push('card_id = ?');        values.push(body.card_id) }
  if (body.day_of_month !== undefined)   { fields.push('day_of_month = ?');   values.push(body.day_of_month) }
  if (body.start_date !== undefined)     { fields.push('start_date = ?');     values.push(body.start_date) }
  if (body.end_date !== undefined)       { fields.push('end_date = ?');       values.push(body.end_date) }
  if (body.active !== undefined)         { fields.push('active = ?');         values.push(body.active) }

  if (fields.length === 0) return json({ error: 'No fields to update' }, 400)

  values.push(params.id, userId)
  await env.DB.prepare(
    `UPDATE recurring_transactions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run()

  return json({ ok: true })
}

// 고정지출 삭제 (생성된 거래는 유지, recurring_id만 초기화)
export const onRequestDelete: PagesFunction<Env> = async ({ params, env, data }) => {
  const userId = (data as { userId: string }).userId
  await env.DB.prepare(
    "UPDATE transactions SET recurring_id = '' WHERE recurring_id = ? AND user_id = ?"
  ).bind(params.id, userId).run()
  await env.DB.prepare(
    'DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?'
  ).bind(params.id, userId).run()
  return json({ ok: true })
}
