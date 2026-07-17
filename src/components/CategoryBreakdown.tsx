import { useState } from 'react'
import { formatWon } from '../lib/format'
import type { Transaction, TransactionType } from '../types'

interface Props {
  transactions: Transaction[]
  month: string // 'YYYY-MM'
}

function CategoryBreakdown({ transactions, month }: Props) {
  const [type, setType] = useState<TransactionType>('expense')

  // 분류별 합계 집계 (이미 월 필터된 transactions 사용)
  const totals = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.type !== type) continue
    totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount)
  }

  const rows = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
  // 차감(음수) 항목 때문에 카테고리 합계가 음수일 수 있어 막대 기준값은 0 이상으로 clamp
  const max = rows.length > 0 ? Math.max(rows[0][1], 0) : 0
  const barColor = type === 'expense' ? 'bg-coral-400' : 'bg-blue-500'

  const [, mon] = month.split('-')
  const label = `${parseInt(mon)}월 분류별 합계`

  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-neutral-700 dark:text-neutral-300">{label}</h2>
        <div className="flex gap-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`min-h-8 rounded-md px-3 text-sm font-semibold transition-colors ${
              type === 'expense' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            지출
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`min-h-8 rounded-md px-3 text-sm font-semibold transition-colors ${
              type === 'income' ? 'bg-white dark:bg-neutral-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            수입
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">이번 달 내역이 없습니다</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map(([cat, amount]) => (
            <li key={cat}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{cat}</span>
                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{formatWon(amount)}</span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${barColor}`}
                  style={{ width: `${max > 0 && amount > 0 ? (amount / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default CategoryBreakdown
