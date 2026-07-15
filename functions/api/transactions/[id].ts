/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(params.id).run()
  return json({ ok: true })
}

// 거래 수정 — 변경할 필드만 받아서 업데이트
export const onRequestPatch: PagesFunction<Env> = async ({ params, request, env }) => {
  const body = await request.json() as {
    type?: 'income' | 'expense'
    category?: string
    amount?: number
    memo?: string
    date?: string
    merchant?: string
    payment_method?: string
    card_id?: string
  }

  const fields: string[] = []
  const values: unknown[] = []

  if (body.type !== undefined)           { fields.push('type = ?');           values.push(body.type) }
  if (body.category !== undefined)       { fields.push('category = ?');       values.push(body.category) }
  if (body.amount !== undefined)         { fields.push('amount = ?');         values.push(body.amount) }
  if (body.memo !== undefined)           { fields.push('memo = ?');           values.push(body.memo) }
  if (body.date !== undefined)           { fields.push('date = ?');           values.push(body.date) }
  if (body.merchant !== undefined)       { fields.push('merchant = ?');       values.push(body.merchant) }
  if (body.payment_method !== undefined) { fields.push('payment_method = ?'); values.push(body.payment_method) }
  if (body.card_id !== undefined)        { fields.push('card_id = ?');        values.push(body.card_id) }

  if (fields.length === 0) return json({ error: 'No fields to update' }, 400)

  values.push(params.id)
  await env.DB.prepare(
    `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run()

  return json({ ok: true })
}
