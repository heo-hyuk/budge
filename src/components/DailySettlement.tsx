import { useEffect, useRef, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import UiCard from './ui/Card'
import { fetchDailySettlement } from '../lib/api'
import { formatDateLabel, formatWon, shiftDate, todayStr } from '../lib/format'
import type { DailySettlement as DailySettlementData, Transaction } from '../types'

interface Props {
  onEditTransaction: (tx: Transaction) => void
  categories?: string[]
}

function DailySettlement({ onEditTransaction, categories = [] }: Props) {
  const [date, setDate] = useState(todayStr)
  const [settlement, setSettlement] = useState<DailySettlementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    fetchDailySettlement(date)
      .then(setSettlement)
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [date])

  // 하루 단위 좌우 스와이프 — App.tsx의 월 이동 스와이프와 동일한 방식(순수 touch 이벤트, 라이브러리 없음)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  function handleSwipeStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }
  function handleSwipeEnd(e: React.TouchEvent) {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dy) > 60) return
    setDate((d) => shiftDate(d, dx < 0 ? 1 : -1))
  }

  const isToday = date === todayStr()

  // 분류 필터 — 선택된 분류가 있으면 목록/합계만 필터링(전일·오늘 잔액은 실제 잔액이므로 그대로 유지)
  const incomes = settlement && categories.length > 0 ? settlement.incomes.filter((tx) => categories.includes(tx.category)) : settlement?.incomes ?? []
  const expenses = settlement && categories.length > 0 ? settlement.expenses.filter((tx) => categories.includes(tx.category)) : settlement?.expenses ?? []
  const incomeTotal = categories.length > 0 ? incomes.reduce((s, t) => s + t.amount, 0) : settlement?.income_total ?? 0
  const expenseTotal = categories.length > 0 ? expenses.reduce((s, t) => s + t.amount, 0) : settlement?.expense_total ?? 0

  return (
    <div className="space-y-3" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
      {/* 날짜 네비게이션 */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setDate((d) => shiftDate(d, -1))}
          className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >◀</button>
        <span className="min-w-40 text-center text-sm font-bold text-neutral-800 dark:text-neutral-200">
          {formatDateLabel(date)}
        </span>
        <button
          type="button"
          onClick={() => setDate((d) => shiftDate(d, 1))}
          disabled={isToday}
          className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-100"
        >▶</button>
        {!isToday && (
          <button
            type="button"
            onClick={() => setDate(todayStr())}
            className="min-h-8 rounded-lg bg-coral-400 px-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-600"
          >오늘</button>
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
        <UiCard>
          {/* 전일잔액 */}
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">전일잔액</span>
            <span className="text-base font-bold text-neutral-700 dark:text-neutral-300">{formatWon(settlement.prev_balance)}</span>
          </div>

          {/* 수입내용 */}
          <div className="mt-3">
            <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">수입내용</p>
            {incomes.length === 0 ? (
              <p className="mt-1.5 text-sm text-neutral-400 dark:text-neutral-500">내역 없음</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {incomes.map((tx) => (
                  <li key={tx.id}>
                    <button
                      type="button"
                      onClick={() => onEditTransaction(tx)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      <span className="min-w-0 truncate text-sm text-neutral-700 dark:text-neutral-300">
                        {tx.merchant || tx.category}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-blue-700 dark:text-blue-300">{formatWon(tx.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 수입합계 */}
          <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2">
            <span className="text-sm font-bold text-blue-800 dark:text-blue-300">수입합계</span>
            <span className="text-base font-bold text-blue-700 dark:text-blue-300">{formatWon(incomeTotal)}</span>
          </div>

          {/* 지출내용 */}
          <div className="mt-4">
            <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">지출내용</p>
            {expenses.length === 0 ? (
              <p className="mt-1.5 text-sm text-neutral-400 dark:text-neutral-500">내역 없음</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {expenses.map((tx) => (
                  <li key={tx.id}>
                    <button
                      type="button"
                      onClick={() => onEditTransaction(tx)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      <span className="min-w-0 truncate text-sm text-neutral-700 dark:text-neutral-300">
                        {tx.merchant || tx.category}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-coral-600 dark:text-coral-200">{formatWon(tx.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 지출합계 */}
          <div className="mt-2 flex items-center justify-between rounded-lg bg-coral-50 dark:bg-coral-900/30 px-3 py-2">
            <span className="text-sm font-bold text-coral-800 dark:text-coral-200">지출합계</span>
            <span className="text-base font-bold text-coral-600 dark:text-coral-200">{formatWon(expenseTotal)}</span>
          </div>

          {/* 오늘잔액 */}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-neutral-50 dark:bg-neutral-950 px-3 py-3">
            <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">오늘잔액</span>
            <span className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100">{formatWon(settlement.today_balance)}</span>
          </div>
        </UiCard>
      )}
    </div>
  )
}

export default DailySettlement
