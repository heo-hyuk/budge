import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import UiCard from './ui/Card'
import { fetchMonthlySettlement } from '../lib/api'
import { cycleCalcSelection, getCalcSelections, getCalcSign, loadCalcSelections } from '../lib/calcSelections'
import { getCategories, loadCategories } from '../lib/categories'
import { formatWon } from '../lib/format'
import type { MonthlySettlement, TransactionType } from '../types'

interface Props {
  month: string  // 'YYYY-MM'
}

/**
 * "계산기" 탭 — 원하는 분류 칩만 +/- 로 골라 합산한 "개인화 순수익"을 보는 화면.
 * 예: 영업수익(+) - 식대(-) - 담배(-) - LPG(-) = 순수익.
 * 분류별 월 합계는 이미 계산되는 /api/settlement/monthly를 그대로 재사용하고,
 * 선택된 칩의 부호를 곱해 합산만 이 화면에서 수행한다.
 */
function IncomeCalculator({ month }: Props) {
  const [settlement, setSettlement] = useState<MonthlySettlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [, forceRerender] = useState(0)  // calcSelections 캐시(모듈 전역) 변경을 반영하기 위한 트리거

  function load() {
    setLoading(true)
    setError('')
    fetchMonthlySettlement(month)
      .then(setSettlement)
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [month])

  // 마운트 시점엔 서버 선택 목록이 아직 로드되기 전일 수 있어 로드 후 재렌더
  useEffect(() => {
    loadCalcSelections().then(() => forceRerender((n) => n + 1))
  }, [])
  useEffect(() => {
    loadCategories().then(() => forceRerender((n) => n + 1))
  }, [])

  async function handleTapChip(type: TransactionType, category: string) {
    await cycleCalcSelection(type, category)
    forceRerender((n) => n + 1)
  }

  const incomeBucket = settlement?.month_total.income ?? {}
  const expenseBucket = settlement?.month_total.expense ?? {}

  function amountFor(type: TransactionType, category: string): number {
    return (type === 'income' ? incomeBucket : expenseBucket)[category] ?? 0
  }

  const selections = getCalcSelections()
  const breakdown = selections.map((s) => ({ ...s, amount: amountFor(s.type, s.category) }))
  const total = breakdown.reduce((sum, s) => sum + s.sign * s.amount, 0)

  function renderChipGroup(type: TransactionType, title: string) {
    const categories = getCategories(type)
    return (
      <div>
        <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">{title}</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {categories.map((c) => {
            const sign = getCalcSign(type, c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => handleTapChip(type, c)}
                className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                  sign === 1
                    ? 'bg-blue-600 text-white'
                    : sign === -1
                    ? 'bg-red-500 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {sign === 1 ? '+ ' : sign === -1 ? '− ' : ''}{c}
              </button>
            )
          })}
          {categories.length === 0 && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">등록된 분류가 없습니다</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <UiCard>
        <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-200">개인화 수익 계산기</h2>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          원하는 분류 칩을 탭해서 더하거나(+) 뺄(−) 항목을 직접 골라보세요. 다시 탭하면 선택이 해제됩니다.
        </p>
      </UiCard>

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
      ) : (
        <>
          <UiCard>
            <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">선택 합계</p>
            <p className={`mt-1 text-3xl font-bold ${total < 0 ? 'text-red-500' : 'text-neutral-900 dark:text-neutral-100'}`}>
              {formatWon(total)}
            </p>
            {breakdown.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-400 dark:text-neutral-500">아래에서 계산에 포함할 분류 칩을 선택하세요.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {breakdown.map((s) => (
                  <li key={`${s.type}-${s.category}`} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {s.sign === 1 ? '+' : '−'} {s.category}
                      <span className="ml-1 text-xs text-neutral-400 dark:text-neutral-500">
                        ({s.type === 'income' ? '수입' : '지출'})
                      </span>
                    </span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">{formatWon(s.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </UiCard>

          <UiCard>
            <div className="space-y-4">
              {renderChipGroup('income', '수입 분류')}
              {renderChipGroup('expense', '지출 분류')}
            </div>
          </UiCard>
        </>
      )}
    </div>
  )
}

export default IncomeCalculator
