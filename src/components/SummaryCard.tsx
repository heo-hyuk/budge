import { formatWon } from '../lib/format'
import type { Transaction } from '../types'

interface Props {
  transactions: Transaction[]
}

function SummaryCard({ transactions }: Props) {
  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthly = transactions.filter((t) => t.date.startsWith(monthPrefix))

  const income = monthly.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expense = monthly.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const balance = income - expense

  return (
    <section className="rounded-2xl border-2 border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-bold text-neutral-700">{now.getMonth() + 1}월 요약</h2>

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-blue-50 p-3">
          <dt className="text-sm font-semibold text-blue-800">수입</dt>
          <dd className="mt-1 text-xl font-bold text-blue-700">{formatWon(income)}</dd>
        </div>
        <div className="rounded-xl bg-red-50 p-3">
          <dt className="text-sm font-semibold text-red-800">지출</dt>
          <dd className="mt-1 text-xl font-bold text-red-700">{formatWon(expense)}</dd>
        </div>
      </dl>

      <div className="mt-3 rounded-xl bg-neutral-100 p-3">
        <dt className="text-sm font-semibold text-neutral-700">잔액</dt>
        <dd className="mt-1 text-2xl font-extrabold text-neutral-900">{formatWon(balance)}</dd>
      </div>
    </section>
  )
}

export default SummaryCard
