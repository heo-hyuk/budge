// src/lib/billing.ts(메인 앱)의 청구기간 계산 로직을 그대로 포팅.
// 별도 배포 단위(wrangler 프로젝트)라 소스 공유 대신 복사 — 로직은 100% 동일하게 유지할 것

export interface BillingCard {
  billing_day: number
  closing_day: number
}

/** 해당 연월의 마지막 날 반환 (month는 1-based) */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** 'YYYY-MM-DD' 형식 문자열 생성 (Date의 월 오버플로 자동 보정을 그대로 활용) */
function toDateStr(year: number, month: number, day: number): string {
  const d = new Date(year, month - 1, day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 특정 월(YYYY-MM)에 결제되는 카드의 거래 조회 기간을 반환.
 * src/lib/billing.ts의 getCardBillingPeriod와 동일한 로직 (설명은 원본 참고)
 */
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

  const start = toDateStr(closingYear, closingMonth - 1, card.closing_day + 1)

  const billingDay = Math.min(card.billing_day, daysInMonth(y, m))
  const billingDate = toDateStr(y, m, billingDay)

  return { start, end, billingDate }
}

/** UTC epoch ms를 한국시간(KST, UTC+9) 기준 'YYYY-MM-DD'로 변환 */
export function toKstDateStr(utcMs: number): string {
  const kst = new Date(utcMs + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/** 'YYYY-MM-DD' 문자열에서 days만큼 이동한 날짜 문자열 반환 */
export function shiftDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
