// 고정지출/수입 자동 생성 로직

interface RecurringRow {
  id: string
  user_id: string
  name: string
  type: 'income' | 'expense'
  category: string
  amount: number
  merchant: string
  payment_method: string
  card_id: string
  day_of_month: number
  start_date: string
  end_date: string | null
  last_generated_date: string | null
  active: number
}

// 해당 연월의 마지막 날 반환
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// 'YYYY-MM-DD' 형식의 오늘 날짜
function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 두 자리 패딩
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * fromDate 기준으로 처리해야 할 [year, month] 목록 반환
 * - last_generated_date가 있으면 그 다음 달부터
 * - 없으면 start_date의 달부터
 */
function getMonthsToProcess(
  startDate: string,
  lastGeneratedDate: string | null,
  today: string
): Array<[number, number]> {
  let y: number, m: number

  if (lastGeneratedDate) {
    // 마지막 생성 날짜의 다음 달부터
    y = parseInt(lastGeneratedDate.slice(0, 4))
    m = parseInt(lastGeneratedDate.slice(5, 7)) + 1
    if (m > 12) { m = 1; y++ }
  } else {
    // start_date의 달부터
    y = parseInt(startDate.slice(0, 4))
    m = parseInt(startDate.slice(5, 7))
  }

  const todayY = parseInt(today.slice(0, 4))
  const todayM = parseInt(today.slice(5, 7))

  const result: Array<[number, number]> = []
  while (y < todayY || (y === todayY && m <= todayM)) {
    result.push([y, m])
    m++
    if (m > 12) { m = 1; y++ }
  }
  return result
}

/**
 * 접속 시 고정지출/수입 자동 생성
 * - active=1인 항목 전부 조회
 * - 놓친 달 계산 후 transactions 테이블에 INSERT
 * - 중복 방지 (recurring_id + date 조합 체크)
 * - last_generated_date 업데이트
 */
export async function generateDueRecurringTransactions(
  db: D1Database,
  userId: string
): Promise<void> {
  const today = todayStr()

  const rows = await db.prepare(
    'SELECT * FROM recurring_transactions WHERE user_id = ? AND active = 1'
  ).bind(userId).all<RecurringRow>()

  for (const r of rows.results) {
    const months = getMonthsToProcess(r.start_date, r.last_generated_date, today)
    if (months.length === 0) continue

    let lastGenerated = r.last_generated_date

    for (const [year, month] of months) {
      // day_of_month가 해당 월 최대일을 초과하면 말일로 보정
      const day     = Math.min(r.day_of_month, daysInMonth(year, month))
      const dateStr = `${year}-${pad(month)}-${pad(day)}`

      // start_date 이전이면 스킵
      if (dateStr < r.start_date) continue

      // end_date 이후면 스킵
      if (r.end_date && dateStr > r.end_date) continue

      // 오늘 이후면 스킵 (미래 날짜는 생성 안 함)
      if (dateStr > today) continue

      // 중복 체크 — 이미 이 날짜에 이 recurring_id로 생성된 거래가 있으면 건너뜀
      const dup = await db.prepare(
        'SELECT id FROM transactions WHERE recurring_id = ? AND date = ? AND user_id = ?'
      ).bind(r.id, dateStr, userId).first()

      if (!dup) {
        const id         = crypto.randomUUID()
        const created_at = new Date().toISOString()

        await db.prepare(
          `INSERT INTO transactions
             (id, type, category, amount, memo, date, merchant, payment_method, card_id, user_id, recurring_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, r.type, r.category, r.amount,
          r.name,          // 고정지출 이름을 메모로 기록
          dateStr,
          r.merchant, r.payment_method, r.card_id,
          userId, r.id, created_at
        ).run()
      }

      lastGenerated = dateStr
    }

    // last_generated_date 갱신 (변화가 있을 때만)
    if (lastGenerated && lastGenerated !== r.last_generated_date) {
      await db.prepare(
        'UPDATE recurring_transactions SET last_generated_date = ? WHERE id = ? AND user_id = ?'
      ).bind(lastGenerated, r.id, userId).run()
    }
  }
}
