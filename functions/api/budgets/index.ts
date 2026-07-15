/// <reference types="@cloudflare/workers-types" />
import { calculateBudgetStatus } from '../../lib/budget'

interface Env { DB: D1Database }

/**
 * GET /api/budgets?year_month=YYYY-MM
 * 해당 월에 적용되는 예산 목록 + 현재까지 지출 합계 + 초과 여부 반환
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context
  const userId    = (data as Record<string, string>).userId
  const url       = new URL(context.request.url)
  const yearMonth = url.searchParams.get('year_month') ??
    new Date().toISOString().slice(0, 7)

  const statuses = await calculateBudgetStatus(env.DB, userId, yearMonth)
  return Response.json({ data: statuses })
}

interface BudgetBody {
  category: string
  monthly_limit: number
  year_month?: string | null  // 'YYYY-MM' 또는 null(매월 반복)
}

/**
 * POST /api/budgets
 * 예산 등록
 *
 * 주의: SQLite의 UNIQUE(user_id, category, year_month)는 NULL을 서로 다른 값으로
 * 취급하므로 year_month가 NULL(매월 반복)인 경우 DB 제약만으로는 중복을 막지 못한다.
 * 그래서 두 케이스 모두 애플리케이션 레벨에서 직접 중복을 검사한다.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, data, request } = context
  const userId = (data as Record<string, string>).userId
  const body   = await request.json() as BudgetBody

  if (!body.category || !body.monthly_limit) {
    return Response.json({ error: '카테고리와 금액은 필수입니다' }, { status: 400 })
  }

  const yearMonth = body.year_month ?? null
  const now       = new Date().toISOString()

  const dup = yearMonth === null
    ? await env.DB.prepare(
        'SELECT id, active FROM budgets WHERE user_id = ? AND category = ? AND year_month IS NULL'
      ).bind(userId, body.category).first<{ id: string; active: number }>()
    : await env.DB.prepare(
        'SELECT id, active FROM budgets WHERE user_id = ? AND category = ? AND year_month = ?'
      ).bind(userId, body.category, yearMonth).first<{ id: string; active: number }>()

  if (dup) {
    if (dup.active === 1) {
      return Response.json(
        { error: `"${body.category}" 카테고리는 이미 예산이 설정되어 있습니다`, conflictId: dup.id },
        { status: 409 },
      )
    }
    // 비활성 상태였던 기존 항목이면 재활성화 + 금액 갱신 (신규 행 만들지 않음)
    await env.DB.prepare(
      'UPDATE budgets SET monthly_limit = ?, active = 1 WHERE id = ?'
    ).bind(body.monthly_limit, dup.id).run()
    return Response.json({ id: dup.id }, { status: 201 })
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(`
    INSERT INTO budgets (id, user_id, category, monthly_limit, year_month, active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).bind(id, userId, body.category, body.monthly_limit, yearMonth, now).run()

  return Response.json({ id }, { status: 201 })
}
