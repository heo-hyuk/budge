/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

/** PATCH /api/benefits/:id — 혜택 규칙 수정 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, data, params, request } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  const body = await request.json() as Record<string, unknown>

  if ('benefit_type' in body && !['discount', 'cashback'].includes(body.benefit_type as string)) {
    return Response.json({ error: '혜택 유형이 올바르지 않습니다' }, { status: 400 })
  }

  // 그룹 지정 시 이 혜택이 속한 카드와 같은 카드 소속인지 확인
  if ('benefit_group_id' in body && body.benefit_group_id) {
    const benefit = await env.DB.prepare(
      'SELECT card_id FROM card_benefits WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first<{ card_id: string }>()
    if (!benefit) return Response.json({ error: '존재하지 않는 혜택입니다' }, { status: 404 })
    const group = await env.DB.prepare(
      'SELECT id FROM benefit_groups WHERE id = ? AND card_id = ?'
    ).bind(body.benefit_group_id, benefit.card_id).first()
    if (!group) return Response.json({ error: '존재하지 않거나 다른 카드의 혜택 그룹입니다' }, { status: 400 })
  }

  const allowed = [
    'name', 'category', 'merchant_pattern',
    'discount_type', 'discount_value',
    'monthly_cap', 'min_spend', 'memo',
    'benefit_group_id', 'benefit_type', 'active',
  ]
  const sets: string[]   = []
  const values: unknown[] = []

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = ?`)
      values.push(body[key])
    }
  }

  if (sets.length > 0) {
    values.push(id, userId)
    await env.DB.prepare(
      `UPDATE card_benefits SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...values).run()
  }

  return Response.json({ ok: true })
}

/** DELETE /api/benefits/:id — 혜택 규칙 삭제 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, data, params } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  await env.DB.prepare('DELETE FROM card_benefits WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()

  return Response.json({ ok: true })
}
