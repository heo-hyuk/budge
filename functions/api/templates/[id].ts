/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

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

// 템플릿 수정 (필드 부분 수정 + 순서변경(sort_order) 겸용)
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, data, params }) => {
  const userId = (data as { userId: string }).userId
  const id     = params.id as string
  const body   = await request.json() as {
    label?: string
    type?: 'income' | 'expense'
    category?: string
    amount?: number
    merchant?: string
    payment_method?: string
    card_id?: string
    sort_order?: number
  }

  const sets: string[]    = []
  const values: unknown[] = []
  if (body.label          !== undefined) { sets.push('label = ?');          values.push(body.label.trim()) }
  if (body.type           !== undefined) { sets.push('type = ?');           values.push(body.type) }
  if (body.category       !== undefined) { sets.push('category = ?');       values.push(body.category) }
  if (body.amount         !== undefined) { sets.push('amount = ?');         values.push(body.amount) }
  if (body.merchant       !== undefined) { sets.push('merchant = ?');       values.push(body.merchant) }
  if (body.payment_method !== undefined) { sets.push('payment_method = ?'); values.push(body.payment_method) }
  if (body.card_id        !== undefined) { sets.push('card_id = ?');        values.push(body.card_id) }
  if (body.sort_order     !== undefined) { sets.push('sort_order = ?');     values.push(body.sort_order) }

  if (sets.length === 0) return json({ ok: true })

  values.push(id, userId)
  await env.DB.prepare(
    `UPDATE quick_templates SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run()

  return json({ ok: true })
}

// 템플릿 삭제
export const onRequestDelete: PagesFunction<Env> = async ({ env, data, params }) => {
  const userId = (data as { userId: string }).userId
  const id     = params.id as string

  await env.DB.prepare('DELETE FROM quick_templates WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()

  return json({ ok: true })
}
