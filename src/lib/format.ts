export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/**
 * 금액 입력창에서 타이핑할 때마다 천단위 콤마를 붙여 단위를 헷갈리지 않게 함.
 * allowNegative가 true면(수입의 차감 항목) 선행 '-' 부호를 보존
 */
export function formatNumberInput(raw: string, allowNegative = false): string {
  const isNegative = allowNegative && raw.trim().startsWith('-')
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return isNegative ? '-' : ''
  const formatted = Number(digits).toLocaleString('ko-KR')
  return isNegative ? `-${formatted}` : formatted
}

/** formatNumberInput으로 만들어진 문자열(콤마/선행 '-' 포함)을 숫자로 되돌림 */
export function parseAmountInput(raw: string): number {
  const isNegative = raw.trim().startsWith('-')
  const digits = raw.replace(/[^0-9]/g, '')
  return isNegative ? -Number(digits) : Number(digits)
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`
}

export function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD'에 일수를 더하거나 빼서 새 날짜 문자열 반환 (월/연 경계 자동 처리) */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/** 해당 날짜가 속한 주의 월요일 반환 (이 앱에 별도 주 시작 기준이 없어 월요일 시작으로 고정) */
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay()  // 0=일 ~ 6=토
  const diff = day === 0 ? -6 : 1 - day
  return shiftDate(dateStr, diff)
}
