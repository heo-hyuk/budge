import * as XLSX from 'xlsx'
import { getCardBillingPeriod } from './billing'
import type { Card, Transaction } from '../types'

/** API export 응답에서 내려오는 거래 행 타입 */
export interface ExportTransaction extends Omit<Transaction, 'recurring_id'> {
  card_name: string
  card_billing_day: number
  card_closing_day: number
  card_color: string
}

export interface ExportData {
  transactions: ExportTransaction[]
  cards: Card[]
  start_date: string | null
  end_date: string | null
}

// ── 날짜 유틸 ──────────────────────────────────────────

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

/** 거래 목록에서 min/max 날짜 추출 */
function dateRange(txs: ExportTransaction[]): { min: string; max: string } {
  if (txs.length === 0) return { min: todayYMD(), max: todayYMD() }
  const dates = txs.map((t) => t.date)
  const min = dates.reduce((a, b) => (a < b ? a : b)).replace(/-/g, '')
  const max = dates.reduce((a, b) => (a > b ? a : b)).replace(/-/g, '')
  return { min, max }
}

// ── 시트 1: 거래내역 ────────────────────────────────────

function buildTransactionsSheet(txs: ExportTransaction[]): XLSX.WorkSheet {
  // 헤더
  const header = [
    '날짜', '구분', '분류', '구매처', '결제방법', '카드명',
    '원금액', '할인액', '실결제액', '메모',
  ]

  const rows = txs.map((t) => {
    const originalAmt = t.original_amount > 0 ? t.original_amount : t.amount
    const discountAmt = t.discount_amount ?? 0

    return [
      t.date,                                         // 날짜 (YYYY-MM-DD)
      t.type === 'income' ? '수입' : '지출',            // 구분
      t.category,                                     // 분류
      t.merchant ?? '',                               // 구매처
      t.card_name ? t.card_name : '현금',              // 결제방법
      t.card_name ?? '',                              // 카드명
      originalAmt,                                    // 원금액 (숫자)
      discountAmt,                                    // 할인액 (숫자)
      t.amount,                                       // 실결제액 (숫자)
      t.memo ?? '',                                   // 메모
    ]
  })

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])

  // 열 너비 설정
  ws['!cols'] = [
    { wch: 12 },  // 날짜
    { wch: 6  },  // 구분
    { wch: 12 },  // 분류
    { wch: 16 },  // 구매처
    { wch: 12 },  // 결제방법
    { wch: 16 },  // 카드명
    { wch: 12 },  // 원금액
    { wch: 10 },  // 할인액
    { wch: 12 },  // 실결제액
    { wch: 24 },  // 메모
  ]

  // 금액 컬럼(G, H, I)을 숫자 포맷으로 지정
  const numFmt = '#,##0'
  const rowCount = rows.length
  for (let r = 1; r <= rowCount; r++) {
    for (const col of ['G', 'H', 'I']) {
      const cellRef = `${col}${r + 1}`
      if (ws[cellRef]) ws[cellRef].t = 'n'
      if (ws[cellRef] && ws[cellRef].v !== undefined) {
        ws[cellRef].z = numFmt
      }
    }
  }

  return ws
}

// ── 시트 2: 월별요약 ────────────────────────────────────

function buildMonthlySheet(txs: ExportTransaction[]): XLSX.WorkSheet {
  // 월별 집계
  const monthMap = new Map<string, { income: number; expense: number }>()
  for (const tx of txs) {
    const ym = tx.date.slice(0, 7)
    const cur = monthMap.get(ym) ?? { income: 0, expense: 0 }
    if (tx.type === 'income')  cur.income  += tx.amount
    if (tx.type === 'expense') cur.expense += tx.amount
    monthMap.set(ym, cur)
  }

  const sorted = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b))

  const header = ['월', '수입', '지출', '잔액']
  const rows = sorted.map(([ym, { income, expense }]) => [
    ym,
    income,
    expense,
    income - expense,
  ])

  // 합계 행
  const totalIncome  = sorted.reduce((s, [, v]) => s + v.income,  0)
  const totalExpense = sorted.reduce((s, [, v]) => s + v.expense, 0)
  rows.push(['합계', totalIncome, totalExpense, totalIncome - totalExpense])

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]

  const numFmt = '#,##0'
  const rowCount = rows.length
  for (let r = 1; r <= rowCount; r++) {
    for (const col of ['B', 'C', 'D']) {
      const cellRef = `${col}${r + 1}`
      if (ws[cellRef]) { ws[cellRef].t = 'n'; ws[cellRef].z = numFmt }
    }
  }

  return ws
}

// ── 시트 3: 카드별정산 ──────────────────────────────────

function buildCardBillingSheet(
  txs: ExportTransaction[],
  cards: Card[],
): XLSX.WorkSheet {
  if (cards.length === 0 || txs.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['등록된 카드가 없거나 거래가 없습니다']])
    return ws
  }

  // 데이터에 포함된 모든 YYYY-MM 목록
  const months = Array.from(new Set(txs.map((t) => t.date.slice(0, 7)))).sort()

  const header = ['카드명', '청구월', '청구기간 시작', '청구기간 종료', '결제일', '청구금액']
  const rows: (string | number)[][] = []

  for (const card of cards) {
    for (const month of months) {
      const period = getCardBillingPeriod(month, card)
      // 해당 청구기간 안의 카드 거래 합계
      const spent = txs
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.card_id === card.id &&
            t.date >= period.start &&
            t.date <= period.end,
        )
        .reduce((s, t) => s + t.amount, 0)

      if (spent === 0) continue  // 해당 기간에 거래 없으면 생략

      rows.push([
        card.name,
        month,
        period.start,
        period.end,
        period.billingDate,
        spent,
      ])
    }
  }

  if (rows.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['카드 거래 내역이 없습니다']])
    return ws
  }

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = [
    { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 },
  ]

  const numFmt = '#,##0'
  for (let r = 1; r <= rows.length; r++) {
    const cellRef = `F${r + 1}`
    if (ws[cellRef]) { ws[cellRef].t = 'n'; ws[cellRef].z = numFmt }
  }

  return ws
}

// ── 메인 내보내기 함수 ──────────────────────────────────

export function exportTransactionsToExcel(data: ExportData): void {
  const { transactions: txs, cards, start_date, end_date } = data

  const wb = XLSX.utils.book_new()

  // 시트 1: 거래내역
  XLSX.utils.book_append_sheet(wb, buildTransactionsSheet(txs), '거래내역')

  // 시트 2: 월별요약
  XLSX.utils.book_append_sheet(wb, buildMonthlySheet(txs), '월별요약')

  // 시트 3: 카드별정산
  XLSX.utils.book_append_sheet(wb, buildCardBillingSheet(txs, cards), '카드별정산')

  // 파일명 결정
  let filename: string
  if (start_date && end_date) {
    filename = `텅장_${start_date.replace(/-/g, '')}_${end_date.replace(/-/g, '')}.xlsx`
  } else if (txs.length > 0) {
    const { min, max } = dateRange(txs)
    filename = `텅장_${min}_${max}.xlsx`
  } else {
    filename = `텅장_전체_${todayYMD()}.xlsx`
  }

  XLSX.writeFile(wb, filename)
}
