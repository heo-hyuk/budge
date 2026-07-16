import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import { fetchMonthlySettlement } from '../lib/api'
import { getCategories } from '../lib/categories'
import type { MonthlySettlement as MonthlySettlementData, SettlementExpenseBucket, SettlementIncomeBucket } from '../types'

const INCOME_GROUPS: (keyof SettlementIncomeBucket)[] = ['소득', '예금인출', '기타']
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function compactDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()}일(${WEEKDAY_LABELS[d.getDay()]})`
}

function cell(amount: number): string {
  return amount > 0 ? amount.toLocaleString('ko-KR') : '-'
}

function MonthlySettlementTable() {
  const [month, setMonth] = useState(currentMonth)
  const [settlement, setSettlement] = useState<MonthlySettlementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const expenseCategories = getCategories('expense')

  function load() {
    setLoading(true)
    setError('')
    fetchMonthlySettlement(month)
      .then(setSettlement)
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [month])

  const isThisMonth = month === currentMonth()
  const [year, mon] = month.split('-')

  function renderRow(key: string, label: string, income: SettlementIncomeBucket, expense: SettlementExpenseBucket, emphasize = false) {
    return (
      <tr key={key} className={emphasize ? 'bg-neutral-50 font-bold' : ''}>
        <td className="whitespace-nowrap border border-neutral-200 px-3 py-2 text-left">{label}</td>
        {INCOME_GROUPS.map((g) => (
          <td key={g} className="whitespace-nowrap border border-neutral-200 px-3 py-2 text-right text-blue-700">
            {cell(income[g])}
          </td>
        ))}
        <td className="whitespace-nowrap border border-neutral-200 px-3 py-2 text-right font-semibold text-blue-800">
          {cell(income.total)}
        </td>
        {expenseCategories.map((c) => (
          <td key={c} className="whitespace-nowrap border border-neutral-200 px-3 py-2 text-right text-coral-600">
            {cell(expense[c] ?? 0)}
          </td>
        ))}
        <td className="whitespace-nowrap border border-neutral-200 px-3 py-2 text-right font-semibold text-coral-700">
          {cell(expense.total ?? 0)}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-3">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="min-h-8 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
        >◀</button>
        <span className="min-w-24 text-center text-sm font-bold text-neutral-800">
          {year}년 {parseInt(mon)}월
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={isThisMonth}
          className="min-h-8 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-neutral-100"
        >▶</button>
        {!isThisMonth && (
          <button
            type="button"
            onClick={() => setMonth(currentMonth())}
            className="min-h-8 rounded-lg bg-coral-400 px-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-600"
          >이번 달</button>
        )}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-base text-neutral-500">
          <LoadingSpinner size={18} /> 불러오는 중...
        </p>
      ) : error ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-base font-semibold text-red-700">{error}</p>
          <button
            type="button"
            onClick={load}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
          >
            다시 시도
          </button>
        </div>
      ) : settlement && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[780px] border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-100">
                <th rowSpan={2} className="border border-neutral-200 px-3 py-2 text-left align-bottom">날짜</th>
                <th colSpan={INCOME_GROUPS.length + 1} className="border border-neutral-200 px-3 py-2 text-blue-800">수입</th>
                <th colSpan={expenseCategories.length + 1} className="border border-neutral-200 px-3 py-2 text-coral-700">지출</th>
              </tr>
              <tr className="bg-neutral-50">
                {INCOME_GROUPS.map((g) => (
                  <th key={g} className="whitespace-nowrap border border-neutral-200 px-3 py-2 text-right font-semibold text-blue-700">{g}</th>
                ))}
                <th className="whitespace-nowrap border border-neutral-200 px-3 py-2 text-right font-semibold text-blue-800">수입합계</th>
                {expenseCategories.map((c) => (
                  <th key={c} className="whitespace-nowrap border border-neutral-200 px-3 py-2 text-right font-semibold text-coral-600">{c}</th>
                ))}
                <th className="whitespace-nowrap border border-neutral-200 px-3 py-2 text-right font-semibold text-coral-700">지출합계</th>
              </tr>
            </thead>
            <tbody>
              {settlement.days.map((day) =>
                renderRow(day.date, compactDateLabel(day.date), day.income, day.expense)
              )}
              {renderRow('month-total', '월계', settlement.month_total.income, settlement.month_total.expense, true)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default MonthlySettlementTable
