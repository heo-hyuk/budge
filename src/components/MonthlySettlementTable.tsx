import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import { useToast } from '../contexts/ToastContext'
import { fetchMonthlySettlement } from '../lib/api'
import { getCategories } from '../lib/categories'
import { migrateLegacyLocalStorage } from '../lib/legacyMigration'
import { getMonthlyBasis, loadSettings, setMonthlyBasis } from '../lib/settings'
import { filterSelectedCategories } from '../lib/settlementFilter'
import type { MonthlySettlement as MonthlySettlementData, SettlementExpenseBucket, SettlementIncomeBucket } from '../types'

type DateBasis = 'billing' | 'transaction'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function compactDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()}일(${WEEKDAY_LABELS[d.getDay()]})`
}

function cell(amount: number): string {
  return amount !== 0 ? amount.toLocaleString('ko-KR') : '-'
}

interface Props {
  month: string  // 'YYYY-MM'
  categories?: string[]
}

function MonthlySettlementTable({ month, categories = [] }: Props) {
  const { showToast } = useToast()
  const [settlement, setSettlement] = useState<MonthlySettlementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [basis, setBasis] = useState<DateBasis>(getMonthlyBasis)
  const expenseCategories = getCategories('expense')
  const incomeCategories = getCategories('income')

  const activeIncomeCategories = categories.length > 0
    ? filterSelectedCategories(categories, incomeCategories)
    : incomeCategories
  const activeExpenseCategories = categories.length > 0
    ? filterSelectedCategories(categories, expenseCategories)
    : expenseCategories

  // 마운트 시점엔 서버 설정이 아직 로드되기 전이라 기본값(billing)일 수 있음 —
  // 로드가 끝나면 실제 값으로 재동기화(MonthlyReport와 동일한 패턴)
  useEffect(() => {
    migrateLegacyLocalStorage().then(loadSettings).then(() => setBasis(getMonthlyBasis()))
  }, [])

  async function changeBasis(next: DateBasis) {
    setBasis(next)
    try {
      await setMonthlyBasis(next)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '설정을 저장하지 못했습니다', 'error')
    }
  }

  function load() {
    setLoading(true)
    setError('')
    fetchMonthlySettlement(month, basis)
      .then(setSettlement)
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [month, basis])

  const [year, mon] = month.split('-')

  function incomeSum(income: SettlementIncomeBucket): number {
    return categories.length > 0 ? activeIncomeCategories.reduce((s, c) => s + (income[c] ?? 0), 0) : (income.total ?? 0)
  }
  function expenseSum(expense: SettlementExpenseBucket): number {
    return categories.length > 0 ? activeExpenseCategories.reduce((s, c) => s + (expense[c] ?? 0), 0) : (expense.total ?? 0)
  }

  function renderRow(key: string, label: string, income: SettlementIncomeBucket, expense: SettlementExpenseBucket, emphasize = false) {
    return (
      <tr key={key} className={emphasize ? 'bg-neutral-50 dark:bg-neutral-950 font-bold' : ''}>
        <td className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left">{label}</td>
        {activeIncomeCategories.map((c) => (
          <td key={c} className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right text-blue-700 dark:text-blue-300">
            {cell(income[c] ?? 0)}
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
      {/* 카드 지출 집계 기준 — 카드별 청구(MonthlyReport)와 동일한 서버 설정을 공유해
          두 화면의 합계가 항상 일치하게 함 */}
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">카드 지출 집계</span>
        <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5">
          <button
            type="button"
            onClick={() => changeBasis('billing')}
            className={`min-h-7 rounded-md px-2.5 text-xs font-semibold transition-colors ${
              basis === 'billing' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            출금일 기준
          </button>
          <button
            type="button"
            onClick={() => changeBasis('transaction')}
            className={`min-h-7 rounded-md px-2.5 text-xs font-semibold transition-colors ${
              basis === 'transaction' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            거래일 기준
          </button>
        </div>
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
            <caption className="sr-only">{year}년 {parseInt(mon)}월 정산</caption>
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800">
                <th rowSpan={2} className="border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left align-bottom">날짜</th>
                <th colSpan={activeIncomeCategories.length + 1} className="border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-blue-800 dark:text-blue-300">수입</th>
                <th colSpan={activeExpenseCategories.length + 1} className="border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-coral-700 dark:text-coral-200">지출</th>
              </tr>
              <tr className="bg-neutral-50 dark:bg-neutral-950">
                {activeIncomeCategories.map((c) => (
                  <th key={c} className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-300">{c}</th>
                ))}
                <th className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-blue-800 dark:text-blue-300">수입합계</th>
                {activeExpenseCategories.map((c) => (
                  <th key={c} className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-coral-600 dark:text-coral-200">{c}</th>
                ))}
                <th className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold text-coral-700 dark:text-coral-200">지출합계</th>
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
