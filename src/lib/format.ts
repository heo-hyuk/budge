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
