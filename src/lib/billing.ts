import type { Card } from '../types'

/** 해당 연월의 마지막 날 반환 (month는 1-based) */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * 특정 월(YYYY-MM)에 결제되는 카드의 거래 조회 기간을 반환
 *
 * 예) closing_day=14, billing_day=25, month='2026-07'
 *   → 2026-06-15 ~ 2026-07-14 사용분이 2026-07-25 결제
 *   → { start: '2026-06-15', end: '2026-07-14', billingDate: '2026-07-25' }
 *
 * 2월처럼 실제 일수보다 큰 마감일/결제일은 말일로 클램핑
 * 예) closing_day=31, month='2026-02' → end='2026-02-28'
 */
export function getCardBillingPeriod(
  month: string,    // 'YYYY-MM' — 결제가 발생하는 달
  card: Card
): { start: string; end: string; billingDate: string } {
  const [y, m] = month.split('-').map(Number)

  // 당월 closing_day — 해당 월 말일을 초과하지 않도록 클램핑
  const endDay = Math.min(card.closing_day, daysInMonth(y, m))
  const end = `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

  // 전월 (closing_day + 1)일이 시작일
  // new Date()의 날짜 오버플로 자동 보정을 활용 (e.g. 2월 32일 → 3월 4일)
  const startDate = new Date(y, m - 2, card.closing_day + 1)
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`

  // 결제일 — 해당 월 말일을 초과하지 않도록 클램핑
  const billingDay = Math.min(card.billing_day, daysInMonth(y, m))
  const billingDate = `${y}-${String(m).padStart(2, '0')}-${String(billingDay).padStart(2, '0')}`

  return { start, end, billingDate }
}
