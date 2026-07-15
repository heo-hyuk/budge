/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

interface BudgetRow {
  category: string
  year_month: string | null
  active: number
}

/** PATCH /api/budgets/:id — 예산 수정 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, data, params, request } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  const body = await request.json() as Record<string, unknown>
  const allowed = ['category', 'monthly_limit', 'year_month', 'active']
  const sets: string[]    = []
  const values: unknown[] = []

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = ?`)
      values.push(body[key])
    }
  }
  if (sets.length === 0) return Response.json({ ok: true })

  const current = await env.DB.prepare(
    'SELECT category, year_month, active FROM budgets WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<BudgetRow>()
  if (!current) return Response.json({ error: '예산을 찾을 수 없습니다' }, { status: 404 })

  // category/year_month 변경 또는 재활성화 시 다른 항목과 중복되는지 확인
  // (year_month가 NULL인 경우 DB UNIQUE 제약이 중복을 못 잡으므로 여기서도 직접 검사)
  const nextCategory  = 'category' in body ? body.category as string : current.category
  const nextYearMonth = 'year_month' in body ? body.year_month as string | null : current.year_month
  const nextActive    = 'active' in body ? body.active as number : current.active

  if (nextActive === 1) {
    const dup = nextYearMonth === null
      ? await env.DB.prepare(
          'SELECT id FROM budgets WHERE user_id = ? AND category = ? AND year_month IS NULL AND active = 1 AND id != ?'
        ).bind(userId, nextCategory, id).first<{ id: string }>()
      : await env.DB.prepare(
          'SELECT id FROM budgets WHERE user_id = ? AND category = ? AND year_month = ? AND active = 1 AND id != ?'
        ).bind(userId, nextCategory, nextYearMonth, id).first<{ id: string }>()

    if (dup) {
      return Response.json(
        { error: `"${nextCategory}" 카테고리는 이미 예산이 설정되어 있습니다`, conflictId: dup.id },
        { status: 409 },
      )
    }
  }

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
  const id     = params.id as string

  await env.DB.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()

  return Response.json({ ok: true })
}
