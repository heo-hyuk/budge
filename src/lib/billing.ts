import type { Card } from '../types'

/** 해당 연월의 마지막 날 반환 (month는 1-based) */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** 'YYYY-MM-DD' 형식 문자열 생성 (Date의 월 오버플로 자동 보정을 그대로 활용) */
function toDateStr(year: number, month: number, day: number): string {
  const d = new Date(year, month - 1, day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 특정 월(YYYY-MM)에 결제되는 카드의 거래 조회 기간을 반환
 *
 * 결제일이 마감일보다 같거나 늦으면(예: 마감 14일·결제 25일) 같은 달 안에서
 * 마감 → 결제가 이루어짐. 결제일이 마감일보다 빠르면(예: 마감 25일·결제 14일,
 * 실제 카드사에서 흔한 패턴) 마감은 전달에 이미 끝나 있고 그 청구가 이번 달
 * 결제일에 나가는 것이므로 사용 기간 전체를 한 달 앞으로 당겨서 계산한다.
 *
 * 예) closing_day=14, billing_day=25, month='2026-07' (결제일 ≥ 마감일)
 *   → 2026-06-15 ~ 2026-07-14 사용분이 2026-07-25 결제
 * 예) closing_day=25, billing_day=14, month='2026-07' (결제일 < 마감일)
 *   → 2026-05-26 ~ 2026-06-25 사용분이 2026-07-14 결제
 *
 * 2월처럼 실제 일수보다 큰 마감일/결제일은 말일로 클램핑
 * 예) closing_day=31, month='2026-02' → end='2026-02-28'
 */
export function getCardBillingPeriod(
  month: string,    // 'YYYY-MM' — 결제가 발생하는 달
  card: Card
): { start: string; end: string; billingDate: string } {
  const [y, m] = month.split('-').map(Number)

  // 결제일이 마감일보다 빠르면 마감월이 결제월보다 한 달 앞선다
  const closingMonthOffset = card.billing_day < card.closing_day ? -1 : 0
  const closingYear  = new Date(y, m - 1 + closingMonthOffset, 1).getFullYear()
  const closingMonth = new Date(y, m - 1 + closingMonthOffset, 1).getMonth() + 1

  // 마감월 closing_day — 해당 월 말일을 초과하지 않도록 클램핑
  const endDay = Math.min(card.closing_day, daysInMonth(closingYear, closingMonth))
  const end = toDateStr(closingYear, closingMonth, endDay)

  // 마감월 전월의 (closing_day + 1)일이 시작일
  const start = toDateStr(closingYear, closingMonth - 1, card.closing_day + 1)

  // 결제일 — 결제월 말일을 초과하지 않도록 클램핑
  const billingDay = Math.min(card.billing_day, daysInMonth(y, m))
  const billingDate = toDateStr(y, m, billingDay)

  return { start, end, billingDate }
}
