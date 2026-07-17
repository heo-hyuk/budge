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
    amount?: number | null
    merchant?: string
    payment_method?: string
    card_id?: string
    sort_order?: number
  }

  // amount를 null이 아닌 값으로 바꾸는 경우에만 부호 검증 — null은 "금액 미지정"으로 되돌리는
  // 정상 요청이라 통과시킴
  if (body.amount !== undefined && body.amount !== null) {
    if (typeof body.amount !== 'number' || body.amount === 0) {
      return json({ error: '금액을 입력해주세요' }, 400)
    }
    // type이 이번 요청에 없으면 기존 값을 조회해서 판단
    let effectiveType = body.type
    if (effectiveType === undefined) {
      const existing = await env.DB.prepare(
        'SELECT type FROM quick_templates WHERE id = ? AND user_id = ?'
      ).bind(id, userId).first<{ type: 'income' | 'expense' }>()
      effectiveType = existing?.type
    }
    if (effectiveType === 'expense' && body.amount < 0) {
      return json({ error: '지출 금액은 0보다 커야 합니다' }, 400)
    }
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
