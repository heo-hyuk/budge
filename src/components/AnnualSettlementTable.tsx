import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import { fetchAnnualSettlement } from '../lib/api'
import { getCategories } from '../lib/categories'
import { selectedExpenseCategories, selectedIncomeGroups, type IncomeGroup } from '../lib/settlementFilter'
import type { AnnualSettlement as AnnualSettlementData, SettlementExpenseBucket, SettlementIncomeBucket } from '../types'

const ALL_INCOME_GROUPS: IncomeGroup[] = ['소득', '예금인출', '기타']

function monthLabel(month: string): string {
  return `${parseInt(month.split('-')[1], 10)}월`
}

function cell(amount: number): string {
  return amount !== 0 ? amount.toLocaleString('ko-KR') : '-'
}

interface Props {
  year: string  // 'YYYY'
  categories?: string[]
}

function AnnualSettlementTable({ year, categories = [] }: Props) {
  const [settlement, setSettlement] = useState<AnnualSettlementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const expenseCategories = getCategories('expense')
  const incomeCategories = getCategories('income')

  const activeIncomeGroupSet = selectedIncomeGroups(categories, incomeCategories)
  const incomeGroups = categories.length > 0
    ? ALL_INCOME_GROUPS.filter((g) => activeIncomeGroupSet.has(g))
    : ALL_INCOME_GROUPS
  const activeExpenseCategories = categories.length > 0
    ? selectedExpenseCategories(categories, expenseCategories)
    : expenseCategories

  function load() {
    setLoading(true)
    setError('')
    fetchAnnualSettlement(year)
      .then(setSettlement)
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [year])

  function incomeSum(income: SettlementIncomeBucket): number {
    return categories.length > 0 ? incomeGroups.reduce((s, g) => s + income[g], 0) : income.total
  }
  function expenseSum(expense: SettlementExpenseBucket): number {
    return categories.length > 0 ? activeExpenseCategories.reduce((s, c) => s + (expense[c] ?? 0), 0) : (expense.total ?? 0)
  }

  function renderRow(key: string, label: string, income: SettlementIncomeBucket, expense: SettlementExpenseBucket, emphasize = false) {
    return (
      <tr key={key} className={emphasize ? 'bg-neutral-50 dark:bg-neutral-950 font-bold' : ''}>
        <td className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left">{label}</td>
        {incomeGroups.map((g) => (
          <td key={g} className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right text-blue-700 dark:text-blue-300">
            {cell(income[g])}
          </td>
        ))}
        <td className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-blue-800 dark:text-blue-300">
          {cell(incomeSum(income))}
        </td>
        {activeExpenseCategories.map((c) => (
          <td key={c} className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right text-coral-600 dark:text-coral-200">
            {cell(expense[c] ?? 0)}
          </td>
        ))}
        <td className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-coral-700 dark:text-coral-200">
          {cell(expenseSum(expense))}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-3">
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
            <caption className="sr-only">{year}년 연간 정산</caption>
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800">
                <th rowSpan={2} className="border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left align-bottom">월</th>
                <th colSpan={incomeGroups.length + 1} className="border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-blue-800 dark:text-blue-300">수입</th>
                <th colSpan={activeExpenseCategories.length + 1} className="border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-coral-700 dark:text-coral-200">지출</th>
              </tr>
              <tr className="bg-neutral-50 dark:bg-neutral-950">
                {incomeGroups.map((g) => (
                  <th key={g} className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-300">{g}</th>
                ))}
                <th className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-blue-800 dark:text-blue-300">수입합계</th>
                {activeExpenseCategories.map((c) => (
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
