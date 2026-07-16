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
 * 전일잔액 기준 = 이 날짜 이전 전체 거래 누적(수입-지출) — 실제 종이 가계부의 "전월이월"
 * 개념과 동일하게 월 경계에서 리셋되지 않고 이어짐. (이전 버전은 "해당 월 1일부터"로
 * 매달 0에서 다시 시작하게 만들어뒀었는데, 이전 달까지 기록한 내용이 전일잔액에 전혀
 * 반영되지 않는 버그였음 — 실사용 계정에서 발견되어 전체 누적으로 수정)
 */
export async function calculateDailySettlement(
  db: D1Database,
  userId: string,
  date: string,  // 'YYYY-MM-DD'
): Promise<DailySettlementResult> {
  const { results: priorResults } = await db
    .prepare('SELECT type, amount FROM transactions WHERE user_id = ? AND date < ?')
    .bind(userId, date)
    .all<{ type: 'income' | 'expense'; amount: number }>()

  const prev_balance = (priorResults ?? [])
    .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)

  const { results: todayResults } = await db
    .prepare('SELECT * FROM transactions WHERE user_id = ? AND date = ? ORDER BY created_at ASC')
    .bind(userId, date)
    .all<SettlementTransaction>()

  const todayRows = todayResults ?? []
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

// ── 월간 정산 ────────────────────────────────────────

export interface MonthlySettlementDay {
  date: string
  income: IncomeBucket
  expense: ExpenseBucket
}

export interface MonthlySettlementResult {
  month: string  // 'YYYY-MM'
  days: MonthlySettlementDay[]
  month_total: { income: IncomeBucket; expense: ExpenseBucket }
}

/** 월간 정산 계산 — 해당 월의 모든 날짜를 행으로, 마지막에 월계 */
export async function calculateMonthlySettlement(
  db: D1Database,
  userId: string,
  month: string,  // 'YYYY-MM'
): Promise<MonthlySettlementResult> {
  const [y, m] = month.split('-').map(Number)
  const totalDays = new Date(y, m, 0).getDate()
  const monthStart = `${month}-01`
  const monthEnd = `${month}-${String(totalDays).padStart(2, '0')}`

  const { results } = await db
    .prepare('SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC')
    .bind(userId, monthStart, monthEnd)
    .all<SettlementTransaction>()

  const rows = results ?? []

  const dayDates = Array.from({ length: totalDays }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  const days: MonthlySettlementDay[] = dayDates.map((date) => ({
    date, income: emptyIncomeBucket(), expense: {},
  }))
  const dayIndexByDate = new Map(days.map((d, i) => [d.date, i]))

  const monthTotal = { income: emptyIncomeBucket(), expense: {} as ExpenseBucket }

  for (const tx of rows) {
    const dayIdx = dayIndexByDate.get(tx.date)
    if (dayIdx === undefined) continue
    const bucket = days[dayIdx]
    if (tx.type === 'income') {
      addIncome(bucket.income, tx.category, tx.amount)
      addIncome(monthTotal.income, tx.category, tx.amount)
    } else {
      addExpense(bucket.expense, tx.category, tx.amount)
      addExpense(monthTotal.expense, tx.category, tx.amount)
    }
  }

  return { month, days, month_total: monthTotal }
}

// ── 연간 정산 ────────────────────────────────────────

export interface AnnualSettlementMonth {
  month: string  // 'YYYY-MM'
  income: IncomeBucket
  expense: ExpenseBucket
}

export interface AnnualSettlementResult {
  year: string  // 'YYYY'
  months: AnnualSettlementMonth[]
  year_total: { income: IncomeBucket; expense: ExpenseBucket }
}

/** 연간 정산 계산 — 1~12월을 행으로, 마지막에 연계 */
export async function calculateAnnualSettlement(
  db: D1Database,
  userId: string,
  year: string,  // 'YYYY'
): Promise<AnnualSettlementResult> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const { results } = await db
    .prepare('SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC')
    .bind(userId, yearStart, yearEnd)
    .all<SettlementTransaction>()

  const rows = results ?? []

  const monthKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const months: AnnualSettlementMonth[] = monthKeys.map((month) => ({
    month, income: emptyIncomeBucket(), expense: {},
  }))
  const monthIndexByKey = new Map(months.map((mo, i) => [mo.month, i]))

  const yearTotal = { income: emptyIncomeBucket(), expense: {} as ExpenseBucket }

  for (const tx of rows) {
    const idx = monthIndexByKey.get(tx.date.slice(0, 7))
    if (idx === undefined) continue
    const bucket = months[idx]
    if (tx.type === 'income') {
      addIncome(bucket.income, tx.category, tx.amount)
      addIncome(yearTotal.income, tx.category, tx.amount)
    } else {
      addExpense(bucket.expense, tx.category, tx.amount)
      addExpense(yearTotal.expense, tx.category, tx.amount)
    }
  }

  return { year, months, year_total: yearTotal }
}
