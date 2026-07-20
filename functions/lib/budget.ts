/// <reference types="@cloudflare/workers-types" />

export interface BudgetRow {
  id: string
  user_id: string
  category: string
  monthly_limit: number
  year_month: string | null
  active: number
  created_at: string
}

export interface BudgetStatus {
  budget: BudgetRow
  spent: number
  remaining: number
  percentage: number  // 0 ~ 100+ (초과 시 100 이상)
  exceeded: boolean
}

/**
 * 특정 월의 예산 현황 계산
 * - year_month 지정 예산이 NULL(매월 반복) 예산보다 우선
 * - category='전체'는 해당 월 전체 지출 합계로 계산
 */
export async function calculateBudgetStatus(
  db: D1Database,
  userId: string,
  yearMonth: string,  // YYYY-MM
): Promise<BudgetStatus[]> {
  // 해당 월에 적용되는 모든 활성 예산 조회 (월 지정 + 매월 반복 모두)
  const { results: budgets } = await db
    .prepare(`
      SELECT * FROM budgets
      WHERE user_id = ? AND active = 1
        AND (year_month = ? OR year_month IS NULL)
      ORDER BY year_month DESC
    `)
    .bind(userId, yearMonth)
    .all<BudgetRow>()

  if (!budgets || budgets.length === 0) return []

  // category별 우선순위 적용: year_month 지정이 NULL보다 우선
  const bestBudgetByCategory = new Map<string, BudgetRow>()
  for (const b of budgets) {
    if (!bestBudgetByCategory.has(b.category) || b.year_month !== null) {
      bestBudgetByCategory.set(b.category, b)
    }
  }
  const activeBudgets = Array.from(bestBudgetByCategory.values())

  // 해당 월 카테고리별 지출 집계
  const datePattern = `${yearMonth}-%`
  const { results: spentRows } = await db
    .prepare(`
      SELECT category, SUM(amount) AS total
      FROM transactions
      WHERE user_id = ? AND type = 'expense' AND date LIKE ? AND unsettled = 0
      GROUP BY category
    `)
    .bind(userId, datePattern)
    .all<{ category: string; total: number }>()

  // 해당 월 전체 지출 합계 (category='전체' 예산 대응)
  const totalSpent = (spentRows ?? []).reduce((sum, r) => sum + (r.total ?? 0), 0)

  const spentMap = new Map<string, number>()
  for (const row of spentRows ?? []) {
    spentMap.set(row.category, row.total ?? 0)
  }

  return activeBudgets.map((budget) => {
    const spent = budget.category === '전체'
      ? totalSpent
      : (spentMap.get(budget.category) ?? 0)
    const remaining = budget.monthly_limit - spent
    const percentage = budget.monthly_limit > 0
      ? Math.round((spent / budget.monthly_limit) * 100)
      : 0
    const exceeded = spent > budget.monthly_limit

    return { budget, spent, remaining, percentage, exceeded }
  })
}
