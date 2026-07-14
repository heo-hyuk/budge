import { formatDateLabel, formatWon } from '../lib/format'
import type { Transaction } from '../types'

interface Props {
  transactions: Transaction[]
  onDelete: (id: string) => void
}

function TransactionList({ transactions, onDelete }: Props) {
  if (transactions.length === 0) {
    return (
      <section className="rounded-2xl border-2 border-neutral-200 bg-white p-6 text-center shadow-sm">
        <p className="text-base text-neutral-500">아직 내역이 없습니다</p>
      </section>
    )
  }

  const groups = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const list = groups.get(tx.date) ?? []
    list.push(tx)
    groups.set(tx.date, list)
  }

  function handleDelete(id: string) {
    if (window.confirm('이 내역을 삭제할까요?')) {
      onDelete(id)
    }
  }

  return (
    <section className="space-y-4">
      {Array.from(groups.entries()).map(([date, items]) => (
        <div key={date} className="rounded-2xl border-2 border-neutral-200 bg-white shadow-sm">
          <h3 className="border-b-2 border-neutral-100 px-4 py-2.5 text-sm font-bold text-neutral-500">
            {formatDateLabel(date)}
          </h3>
          <ul>
            {items.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-neutral-900">{tx.category}</p>
                  {tx.memo && <p className="mt-0.5 truncate text-sm text-neutral-500">{tx.memo}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`text-base font-bold ${
                      tx.type === 'income' ? 'text-blue-700' : 'text-red-700'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatWon(tx.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(tx.id)}
                    className="min-h-9 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold text-neutral-600"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default TransactionList
