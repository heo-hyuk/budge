// src/lib/billing.ts의 getCardBillingPeriod와 항상 동일하게 유지할 것 —
// 프론트(카드별 청구 리포트)와 백엔드(월간 정산 "출금일 기준" 집계)가 같은
// 청구기간 계산 결과를 내야 두 화면의 합계가 일치함

export interface BillingCard {
  billing_day: number
  closing_day: number
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function toDateStr(year: number, month: number, day: number): string {
  const d = new Date(year, month - 1, day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getCardBillingPeriod(
  month: string,    // 'YYYY-MM' — 결제가 발생하는 달
  card: BillingCard
): { start: string; end: string; billingDate: string } {
  const [y, m] = month.split('-').map(Number)

  const closingMonthOffset = card.billing_day < card.closing_day ? -1 : 0
  const closingYear  = new Date(y, m - 1 + closingMonthOffset, 1).getFullYear()
  const closingMonth = new Date(y, m - 1 + closingMonthOffset, 1).getMonth() + 1

  const endDay = Math.min(card.closing_day, daysInMonth(closingYear, closingMonth))
  const end = toDateStr(closingYear, closingMonth, endDay)

  const startMonthDays = daysInMonth(closingYear, closingMonth - 1)
  const start = toDateStr(closingYear, closingMonth - 1, Math.min(card.closing_day, startMonthDays) + 1)

  const billingDay = Math.min(card.billing_day, daysInMonth(y, m))
  const billingDate = toDateStr(y, m, billingDay)

  return { start, end, billingDate }
}
