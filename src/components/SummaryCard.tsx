import { formatWon } from '../lib/format'
import type { Transaction } from '../types'

interface Props {
  transactions: Transaction[]
  month: string // 'YYYY-MM'
}

function SummaryCard({ transactions, month }: Props) {
  // 선택된 월의 수입/지출/잔액 계산
  const income  = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense

  const [year, mon] = month.split('-')
  const label = `${year}년 ${parseInt(mon)}월 요약`

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-bold text-neutral-700">{label}</h2>

      {/* 좁은 화면에서는 큰 금액이 "원"만 다음 줄로 떨어지며 어색해지므로 세로로 쌓고, sm 이상에서 2열로 */}
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-blue-50 p-3">
          <dt className="text-sm font-semibold text-blue-800">수입</dt>
          <dd className="mt-1 text-xl font-bold text-blue-700">{formatWon(income)}</dd>
        </div>
        <div className="rounded-xl bg-red-50 p-3">
          <dt className="text-sm font-semibold text-red-800">지출</dt>
          <dd className="mt-1 text-xl font-bold text-red-700">{formatWon(expense)}</dd>
        </div>
      </dl>

      <div className="mt-3 rounded-xl bg-brand-50 p-3">
        <dt className="text-sm font-semibold text-brand-800">잔액</dt>
        <dd className="mt-1 text-2xl font-extrabold text-brand-900">{formatWon(balance)}</dd>
      </div>
    </section>
  )
}

export default SummaryCard
