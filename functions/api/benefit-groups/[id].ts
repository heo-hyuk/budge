/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

/** PATCH /api/benefit-groups/:id — 혜택 그룹 수정 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, data, params, request } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  const body = await request.json() as Record<string, unknown>

  if ('monthly_cap' in body && (typeof body.monthly_cap !== 'number' || body.monthly_cap <= 0)) {
    return Response.json({ error: '통합 월 한도는 0보다 커야 합니다' }, { status: 400 })
  }

  const allowed = ['name', 'monthly_cap']
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
      `UPDATE benefit_groups SET ${sets.join(', ')}
       WHERE id = ? AND card_id IN (SELECT id FROM cards WHERE user_id = ?)`
    ).bind(...values).run()
  }

  return Response.json({ ok: true })
}

/** DELETE /api/benefit-groups/:id — 혜택 그룹 삭제 (소속 혜택은 개별 한도(NULL 그룹)로 남음) */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, data, params } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  await env.DB.prepare(
    "UPDATE card_benefits SET benefit_group_id = NULL WHERE benefit_group_id = ?"
  ).bind(id).run()
  await env.DB.prepare(
    `DELETE FROM benefit_groups WHERE id = ? AND card_id IN (SELECT id FROM cards WHERE user_id = ?)`
  ).bind(id, userId).run()

  return Response.json({ ok: true })
}
