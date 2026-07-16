/// <reference types="@cloudflare/workers-types" />

export interface SettlementTransaction {
  id: string
  type: 'income' | 'expense'
  category: string
  amount: number
  memo: string
  date: string
  merchant: string
  payment_method: string
  card_id: string
  benefit_id: string
  created_at: string
}

export interface DailySettlementResult {
  date: string
  prev_balance: number
  incomes: SettlementTransaction[]
  income_total: number
  expenses: SettlementTransaction[]
  expense_total: number
  today_balance: number
}

/**
 * 일일 정산 계산
 * 전일잔액 기준 = 해당 월 1일부터 전날까지의 누적(수입-지출).
 * 이 앱은 SummaryCard/AnnualReport 등 다른 화면도 전부 선택 기간(월/연) 안에서만
 * 수입-지출을 계산하고 그 이전 기간에서 잔액을 이어받지 않으므로, 일관성을 위해
 * "월초부터"를 기준으로 삼음(계정 생성 시점부터의 전체 누적이 아님)
 */
export async function calculateDailySettlement(
  db: D1Database,
  userId: string,
  date: string,  // 'YYYY-MM-DD'
): Promise<DailySettlementResult> {
  const monthStart = `${date.slice(0, 7)}-01`

  const { results } = await db
    .prepare('SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, created_at ASC')
    .bind(userId, monthStart, date)
    .all<SettlementTransaction>()

  const rows = results ?? []
  const priorRows = rows.filter((t) => t.date < date)
  const todayRows  = rows.filter((t) => t.date === date)

  const prev_balance = priorRows.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
  const incomes  = todayRows.filter((t) => t.type === 'income')
  const expenses = todayRows.filter((t) => t.type === 'expense')
  const income_total  = incomes.reduce((s, t) => s + t.amount, 0)
  const expense_total = expenses.reduce((s, t) => s + t.amount, 0)
  const today_balance = prev_balance + income_total - expense_total

  return { date, prev_balance, incomes, income_total, expenses, expense_total, today_balance }
}

// ── 주간 정산 ────────────────────────────────────────

export interface IncomeBucket {
  소득: number
  예금인출: number
  기타: number
  total: number
}

export interface ExpenseBucket {
  [category: string]: number  // 카테고리별 합계 + total 키
}

export interface WeeklySettlementDay {
  date: string
  income: IncomeBucket
  expense: ExpenseBucket
}

export interface WeeklySettlementResult {
  week_start: string
  week_end: string
  days: WeeklySettlementDay[]
  week_total: { income: IncomeBucket; expense: ExpenseBucket }
  month_cumulative_total: { income: IncomeBucket; expense: ExpenseBucket }
}

/**
 * 수입 카테고리를 소득/예금인출/기타 3그룹으로 단순 분류.
 * 이 앱 기본 수입 분류(급여/용돈/기타수입)엔 '예금인출' 개념이 없어, 사용자가 직접
 * 그 이름으로 커스텀 분류를 만들었을 때만 잡히고 나머지는 전부 '기타'로 묶임
 */
function classifyIncomeGroup(category: string): '소득' | '예금인출' | '기타' {
  if (category === '급여') return '소득'
  if (category === '예금인출') return '예금인출'
  return '기타'
}

function emptyIncomeBucket(): IncomeBucket {
  return { 소득: 0, 예금인출: 0, 기타: 0, total: 0 }
}

function addIncome(bucket: IncomeBucket, category: string, amount: number) {
  bucket[classifyIncomeGroup(category)] += amount
  bucket.total += amount
}

function addExpense(bucket: ExpenseBucket, category: string, amount: number) {
  bucket[category] = (bucket[category] ?? 0) + amount
  bucket.total = (bucket.total ?? 0) + amount
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/**
 * 주간 정산 계산 (week_start부터 7일)
 * 누계 = 그 주가 속한 달의 1일부터 week_end까지의 누적(주가 월 경계를 걸치면
 * week_start가 속한 달 기준으로 판단 — 종이 다이어리의 주간표가 한 달 페이지
 * 안에 속한다는 전제와 동일)
 */
export async function calculateWeeklySettlement(
  db: D1Database,
  userId: string,
  weekStart: string,  // 'YYYY-MM-DD', 월요일
): Promise<WeeklySettlementResult> {
  const weekEnd = shiftDate(weekStart, 6)
  const monthStart = `${weekStart.slice(0, 7)}-01`

  const { results } = await db
    .prepare('SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC')
    .bind(userId, monthStart, weekEnd)
    .all<SettlementTransaction>()

  const rows = results ?? []

  const dayDates = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i))
  const days: WeeklySettlementDay[] = dayDates.map((date) => ({
    date, income: emptyIncomeBucket(), expense: {},
  }))
  const dayIndexByDate = new Map(days.map((d, i) => [d.date, i]))

  const weekTotal = { income: emptyIncomeBucket(), expense: {} as ExpenseBucket }
  const monthCumulative = { income: emptyIncomeBucket(), expense: {} as ExpenseBucket }

  for (const tx of rows) {
    // 누계는 monthStart~weekEnd 전체(조회 범위 그대로)에 누적
    if (tx.type === 'income') addIncome(monthCumulative.income, tx.category, tx.amount)
    else addExpense(monthCumulative.expense, tx.category, tx.amount)

    const dayIdx = dayIndexByDate.get(tx.date)
    if (dayIdx === undefined) continue  // 이번 주 이전의 그 달 거래 — 누계에만 반영
    const bucket = days[dayIdx]
    if (tx.type === 'income') {
      addIncome(bucket.income, tx.category, tx.amount)
      addIncome(weekTotal.income, tx.category, tx.amount)
    } else {
      addExpense(bucket.expense, tx.category, tx.amount)
      addExpense(weekTotal.expense, tx.category, tx.amount)
    }
  }

  return { week_start: weekStart, week_end: weekEnd, days, week_total: weekTotal, month_cumulative_total: monthCumulative }
}
