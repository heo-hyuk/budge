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
  const max = rows.length > 0 ? rows[0][1] : 0
  const barColor = type === 'expense' ? 'bg-red-500' : 'bg-blue-500'

  const [, mon] = month.split('-')
  const label = `${parseInt(mon)}월 분류별 합계`

  return (
    <section className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-neutral-700">{label}</h2>
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`min-h-8 rounded-md px-3 text-sm font-semibold ${
              type === 'expense' ? 'bg-white text-red-700 shadow-sm' : 'text-neutral-500'
            }`}
          >
            지출
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`min-h-8 rounded-md px-3 text-sm font-semibold ${
              type === 'income' ? 'bg-white text-blue-700 shadow-sm' : 'text-neutral-500'
            }`}
          >
            수입
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">이번 달 내역이 없습니다</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map(([cat, amount]) => (
            <li key={cat}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-neutral-800">{cat}</span>
                <span className="text-sm font-bold text-neutral-900">{formatWon(amount)}</span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${max > 0 ? (amount / max) * 100 : 0}%` }}
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
