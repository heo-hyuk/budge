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

// 카드 수정
export const onRequestPatch: PagesFunction<Env> = async ({ params, request, env }) => {
  const body = await request.json() as {
    name?: string
    color?: string
    billing_day?: number
    closing_day?: number
    benefits?: string
  }

  const fields: string[] = []
  const values: unknown[] = []

  if (body.name !== undefined)        { fields.push('name = ?');        values.push(body.name) }
  if (body.color !== undefined)       { fields.push('color = ?');       values.push(body.color) }
  if (body.billing_day !== undefined) { fields.push('billing_day = ?'); values.push(body.billing_day) }
  if (body.closing_day !== undefined) { fields.push('closing_day = ?'); values.push(body.closing_day) }
  if (body.benefits !== undefined)    { fields.push('benefits = ?');    values.push(body.benefits) }

  if (fields.length === 0) return json({ error: 'No fields to update' }, 400)

  values.push(params.id)
  await env.DB.prepare(
    `UPDATE cards SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run()

  return json({ ok: true })
}

// 카드 삭제 (해당 카드의 거래는 payment_method를 '현금'으로 초기화)
export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  await env.DB.prepare(
    `UPDATE transactions SET payment_method = '현금', card_id = '' WHERE card_id = ?`
  ).bind(params.id).run()

  await env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(params.id).run()
  return json({ ok: true })
}
