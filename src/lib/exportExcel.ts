import * as XLSX from 'xlsx'
import { getCardBillingPeriod } from './billing'
import { getCategories } from './categories'
import type { Card, MonthlySettlement, Transaction } from '../types'

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
  // 헤더 — 적립예정액은 정산 계산에 영향 없는 정보성 컬럼(cashback 혜택 전용)
  const header = [
    '날짜', '구분', '분류', '구매처', '결제방법', '카드명',
    '원금액', '할인액', '실결제액', '적립예정액', '메모',
  ]

  const rows = txs.map((t) => {
    const originalAmt = t.original_amount > 0 ? t.original_amount : t.amount
    const discountAmt = t.discount_amount ?? 0
    const cashbackAmt = t.cashback_amount ?? 0

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
      cashbackAmt,                                    // 적립예정액 (숫자, 정보용)
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
    { wch: 12 },  // 적립예정액
    { wch: 24 },  // 메모
  ]

  // 금액 컬럼(G, H, I, J)을 숫자 포맷으로 지정
  const numFmt = '#,##0'
  const rowCount = rows.length
  for (let r = 1; r <= rowCount; r++) {
    for (const col of ['G', 'H', 'I', 'J']) {
      const cellRef = `${col}${r + 1}`
      if (ws[cellRef]) ws[cellRef].t = 'n'
      if (ws[cellRef] && ws[cellRef].v !== undefined) {
        ws[cellRef].z = numFmt
      }
    }
  }

  return ws
}

// ── 시트 2: 정산표 (화면의 "분류별 표"와 동일한 일별×분류 그리드) ────────

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function compactDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()}일(${WEEKDAY_LABELS[d.getDay()]})`
}

/**
 * 월간 정산 화면의 "분류별 표"를 그대로 재현하는 시트 — 월별로 날짜×분류
 * 그리드를 이어붙임. `settlements`는 화면과 동일한 계산 결과(서버
 * calculateMonthlySettlement)를 그대로 사용하므로, 특히 출금일 기준일 때
 * 카드 거래가 청구일 하루로 몰리는 로직까지 화면과 100% 일치함
 */
function buildSettlementGridSheet(
  settlements: MonthlySettlement[],
  basis: 'billing' | 'transaction',
): XLSX.WorkSheet {
  if (settlements.length === 0) {
    return XLSX.utils.aoa_to_sheet([['거래 내역이 없습니다']])
  }

  const incomeCategories = getCategories('income')
  const expenseCategories = getCategories('expense')
  const basisLabel = basis === 'billing' ? '출금일 기준' : '거래일 기준'
  const header = ['날짜', ...incomeCategories, '수입합계', ...expenseCategories, '지출합계']

  const rows: (string | number)[][] = []

  for (const s of [...settlements].sort((a, b) => a.month.localeCompare(b.month))) {
    const [y, m] = s.month.split('-')
    rows.push([`${y}년 ${parseInt(m)}월 정산표 (${basisLabel})`])
    rows.push(header)

    for (const day of s.days) {
      const incVals = incomeCategories.map((c) => day.income[c] ?? 0)
      const expVals = expenseCategories.map((c) => day.expense[c] ?? 0)
      rows.push([compactDateLabel(day.date), ...incVals, day.income.total ?? 0, ...expVals, day.expense.total ?? 0])
    }

    const totalIncVals = incomeCategories.map((c) => s.month_total.income[c] ?? 0)
    const totalExpVals = expenseCategories.map((c) => s.month_total.expense[c] ?? 0)
    rows.push(['월계', ...totalIncVals, s.month_total.income.total ?? 0, ...totalExpVals, s.month_total.expense.total ?? 0])
    rows.push([])  // 월 사이 구분용 빈 행
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const colCount = header.length
  ws['!cols'] = Array.from({ length: colCount }, (_, i) => ({ wch: i === 0 ? 12 : 11 }))

  // 숫자 컬럼 서식 지정 — 날짜/월 라벨/빈 행은 자연히 건너뜀
  const numFmt = '#,##0'
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    if (row.length < 2 || row[0] === '날짜') continue
    for (let c = 1; c < row.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c })
      if (ws[cellRef]) { ws[cellRef].t = 'n'; ws[cellRef].z = numFmt }
    }
  }

  return ws
}

// ── 시트 3: 월별요약 ────────────────────────────────────

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

// ── 시트 4: 카드별정산 ──────────────────────────────────

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
      // 체크카드(즉시결제)는 청구기간 개념이 없어 그 달 거래일 그대로 집계
      const period = card.is_debit
        ? { start: `${month}-01`, end: `${month}-31`, billingDate: '즉시결제' }
        : getCardBillingPeriod(month, card)
      // 해당 청구기간 안의 카드 거래 합계 (즉시결제는 그 달 거래 전체)
      const spent = txs
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.card_id === card.id &&
            (card.is_debit ? t.date.slice(0, 7) === month : t.date >= period.start && t.date <= period.end),
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

export function exportTransactionsToExcel(
  data: ExportData,
  settlements: MonthlySettlement[] = [],
  basis: 'billing' | 'transaction' = 'transaction',
): void {
  const { transactions: txs, cards, start_date, end_date } = data

  const wb = XLSX.utils.book_new()

  // 시트 1: 거래내역
  XLSX.utils.book_append_sheet(wb, buildTransactionsSheet(txs), '거래내역')

  // 시트 2: 정산표 (화면 "분류별 표"와 동일) — 서버에서 못 받아왔으면(오류 등) 조용히 생략
  if (settlements.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildSettlementGridSheet(settlements, basis), '정산표')
  }

  // 시트 3: 월별요약
  XLSX.utils.book_append_sheet(wb, buildMonthlySheet(txs), '월별요약')

  // 시트 4: 카드별정산
  XLSX.utils.book_append_sheet(wb, buildCardBillingSheet(txs, cards), '카드별정산')

  // 파일명 결정
  let filename: string
  if (start_date && end_date) {
    filename = `텅~ 장_${start_date.replace(/-/g, '')}_${end_date.replace(/-/g, '')}.xlsx`
  } else if (txs.length > 0) {
    const { min, max } = dateRange(txs)
    filename = `텅~ 장_${min}_${max}.xlsx`
  } else {
    filename = `텅~ 장_전체_${todayYMD()}.xlsx`
  }

  XLSX.writeFile(wb, filename)
}
