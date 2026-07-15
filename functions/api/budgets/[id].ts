/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

/** PATCH /api/budgets/:id — 예산 수정 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, data, params, request } = context
  const userId = (data as Record<string, string>).userId
  const id     = parseInt(params.id as string, 10)

  const body = await request.json() as Record<string, unknown>
  const allowed = ['monthly_limit', 'year_month', 'active']
  const sets: string[]    = []
  const values: unknown[] = []

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = ?`)
      values.push(body[key])
    }
  }
  if (sets.length === 0) return Response.json({ ok: true })

  values.push(id, userId)
  await env.DB.prepare(
    `UPDATE budgets SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run()

  return Response.json({ ok: true })
}

/** DELETE /api/budgets/:id — 예산 삭제 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, data, params } = context
  const userId = (data as Record<string, string>).userId
  const id     = parseInt(params.id as string, 10)

  await env.DB.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()

  return Response.json({ ok: true })
}
