/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

/** PATCH /api/benefits/:id — 혜택 규칙 수정 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, data, params, request } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  const body = await request.json() as Record<string, unknown>

  const allowed = [
    'name', 'category', 'merchant_pattern',
    'discount_type', 'discount_value',
    'monthly_cap', 'min_spend', 'memo',
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
