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
 * 예산 등록 또는 기존 항목 덮어쓰기 (UNIQUE 충돌 시 REPLACE)
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
  const id        = crypto.randomUUID()

  // UNIQUE(user_id, category, year_month) 충돌 시 업데이트 (id는 기존 값 유지)
  await env.DB.prepare(`
    INSERT INTO budgets (id, user_id, category, monthly_limit, year_month, active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(user_id, category, year_month)
    DO UPDATE SET monthly_limit = excluded.monthly_limit, active = 1
  `).bind(id, userId, body.category, body.monthly_limit, yearMonth, now).run()

  // 방금 등록/수정된 행의 id 반환
  const row = await env.DB.prepare(
    'SELECT id FROM budgets WHERE user_id = ? AND category = ? AND year_month IS ?'
  ).bind(userId, body.category, yearMonth).first<{ id: string }>()

  return Response.json({ id: row?.id }, { status: 201 })
}
