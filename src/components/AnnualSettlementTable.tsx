import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import { fetchAnnualSettlement } from '../lib/api'
import { getCategories } from '../lib/categories'
import type { AnnualSettlement as AnnualSettlementData, SettlementExpenseBucket, SettlementIncomeBucket } from '../types'

const INCOME_GROUPS: (keyof SettlementIncomeBucket)[] = ['소득', '예금인출', '기타']

function currentYear(): string {
  return String(new Date().getFullYear())
}

function monthLabel(month: string): string {
  return `${parseInt(month.split('-')[1], 10)}월`
}

function cell(amount: number): string {
  return amount > 0 ? amount.toLocaleString('ko-KR') : '-'
}

function AnnualSettlementTable() {
  const [year, setYear] = useState(currentYear)
  const [settlement, setSettlement] = useState<AnnualSettlementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const expenseCategories = getCategories('expense')

  function load() {
    setLoading(true)
    setError('')
    fetchAnnualSettlement(year)
      .then(setSettlement)
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [year])

  const isThisYear = year === currentYear()

  function renderRow(key: string, label: string, income: SettlementIncomeBucket, expense: SettlementExpenseBucket, emphasize = false) {
    return (
      <tr key={key} className={emphasize ? 'bg-neutral-50 dark:bg-neutral-950 font-bold' : ''}>
        <td className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left">{label}</td>
        {INCOME_GROUPS.map((g) => (
          <td key={g} className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right text-blue-700 dark:text-blue-300">
            {cell(income[g])}
          </td>
        ))}
        <td className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-blue-800 dark:text-blue-300">
          {cell(income.total)}
        </td>
        {expenseCategories.map((c) => (
          <td key={c} className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right text-coral-600 dark:text-coral-200">
            {cell(expense[c] ?? 0)}
          </td>
        ))}
        <td className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-coral-700 dark:text-coral-200">
          {cell(expense.total ?? 0)}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-3">
      {/* 연도 네비게이션 */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setYear((y) => String(parseInt(y) - 1))}
          className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >◀</button>
        <span className="min-w-16 text-center text-sm font-bold text-neutral-800 dark:text-neutral-200">{year}년</span>
        <button
          type="button"
          onClick={() => setYear((y) => String(parseInt(y) + 1))}
          disabled={isThisYear}
          className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-100"
        >▶</button>
        {!isThisYear && (
          <button
            type="button"
            onClick={() => setYear(currentYear())}
            className="min-h-8 rounded-lg bg-coral-400 px-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-600"
          >올해</button>
        )}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-base text-neutral-500 dark:text-neutral-400">
          <LoadingSpinner size={18} /> 불러오는 중...
        </p>
      ) : error ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4">
          <p className="text-base font-semibold text-red-700 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={load}
            className="shrink-0 rounded-lg bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-red-700 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
          >
            다시 시도
          </button>
        </div>
      ) : settlement && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[780px] border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800">
                <th rowSpan={2} className="border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left align-bottom">월</th>
                <th colSpan={INCOME_GROUPS.length + 1} className="border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-blue-800 dark:text-blue-300">수입</th>
                <th colSpan={expenseCategories.length + 1} className="border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-coral-700 dark:text-coral-200">지출</th>
              </tr>
              <tr className="bg-neutral-50 dark:bg-neutral-950">
                {INCOME_GROUPS.map((g) => (
                  <th key={g} className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-300">{g}</th>
                ))}
                <th className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-blue-800 dark:text-blue-300">수입합계</th>
                {expenseCategories.map((c) => (
                  <th key={c} className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-coral-600 dark:text-coral-200">{c}</th>
                ))}
                <th className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-coral-700 dark:text-coral-200">지출합계</th>
              </tr>
            </thead>
            <tbody>
              {settlement.months.map((mo) =>
                renderRow(mo.month, monthLabel(mo.month), mo.income, mo.expense)
              )}
              {renderRow('year-total', '연계', settlement.year_total.income, settlement.year_total.expense, true)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AnnualSettlementTable
