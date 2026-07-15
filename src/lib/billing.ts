import type { Card } from '../types'

/**
 * 특정 월(YYYY-MM)에 결제되는 카드의 거래 조회 기간을 반환
 *
 * 예) closing_day=14, billing_day=25, month='2026-07'
 *   → 2026-06-15 ~ 2026-07-14 사용분이 2026-07-25 결제
 *   → { start: '2026-06-15', end: '2026-07-14', billingDate: '2026-07-25' }
 */
export function getCardBillingPeriod(
  month: string,    // 'YYYY-MM' — 결제가 발생하는 달
  card: Card
): { start: string; end: string; billingDate: string } {
  const [y, m] = month.split('-').map(Number)

  // 당월 closing_day (마감일)
  const endYear = y
  const endMonth = m
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(card.closing_day).padStart(2, '0')}`

  // 전월 (closing_day + 1)일이 시작일
  const startDate = new Date(y, m - 2, card.closing_day + 1)
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`

  // 결제일
  const billingDate = `${y}-${String(m).padStart(2, '0')}-${String(card.billing_day).padStart(2, '0')}`

  return { start, end, billingDate }
}
