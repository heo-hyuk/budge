export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 금액 입력창에서 타이핑할 때마다 천단위 콤마를 붙여 단위를 헷갈리지 않게 함 */
export function formatNumberInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('ko-KR')
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
