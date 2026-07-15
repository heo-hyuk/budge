/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

const cors = {
  'Access-Control-Allow-Origin': '*',
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

export const onRequestPatch: PagesFunction<Env> = async ({ params, request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body   = await request.json() as {
    name?: string; color?: string; billing_day?: number; closing_day?: number; benefits?: string
  }

  if (body.billing_day !== undefined && (body.billing_day < 1 || body.billing_day > 31)) {
    return json({ error: '결제일은 1~31 사이여야 합니다' }, 400)
  }
  if (body.closing_day !== undefined && (body.closing_day < 1 || body.closing_day > 31)) {
    return json({ error: '마감일은 1~31 사이여야 합니다' }, 400)
  }

  const fields: string[] = []; const values: unknown[] = []
  if (body.name !== undefined)        { fields.push('name = ?');        values.push(body.name) }
  if (body.color !== undefined)       { fields.push('color = ?');       values.push(body.color) }
  if (body.billing_day !== undefined) { fields.push('billing_day = ?'); values.push(body.billing_day) }
  if (body.closing_day !== undefined) { fields.push('closing_day = ?'); values.push(body.closing_day) }
  if (body.benefits !== undefined)    { fields.push('benefits = ?');    values.push(body.benefits) }

  if (fields.length === 0) return json({ error: 'No fields to update' }, 400)

  values.push(params.id, userId)
  await env.DB.prepare(
    `UPDATE cards SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run()

  return json({ ok: true })
}

export const onRequestDelete: PagesFunction<Env> = async ({ params, env, data }) => {
  const userId = (data as { userId: string }).userId
  // 해당 카드 거래의 결제방법 초기화
  await env.DB.prepare(
    "UPDATE transactions SET payment_method = '현금', card_id = '' WHERE card_id = ? AND user_id = ?"
  ).bind(params.id, userId).run()
  await env.DB.prepare(
    'DELETE FROM cards WHERE id = ? AND user_id = ?'
  ).bind(params.id, userId).run()
  return json({ ok: true })
}
