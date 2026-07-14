import { useEffect, useState } from 'react'
import CategoryBreakdown from './components/CategoryBreakdown'
import SummaryCard from './components/SummaryCard'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import { createTransaction, deleteTransaction, fetchTransactions } from './lib/api'
import type { NewTransaction, Transaction } from './types'

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTransactions()
      .then(setTransactions)
      .catch(() => setError('불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(tx: NewTransaction) {
    await createTransaction(tx)
    setTransactions(await fetchTransactions())
  }

  async function handleDelete(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    await deleteTransaction(id)
  }

  return (
    <div className="min-h-svh bg-neutral-50 text-neutral-900">
      <header className="border-b-2 border-neutral-200 bg-white px-6 py-4">
        <h1 className="mx-auto max-w-5xl text-xl font-extrabold">가계부</h1>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[420px_1fr] lg:items-start lg:gap-6">
        <div className="space-y-4 lg:sticky lg:top-6">
          <SummaryCard transactions={transactions} />
          <TransactionForm onSubmit={handleAdd} />
        </div>

        <div className="mt-4 space-y-4 lg:mt-0">
          {error && <p className="rounded-xl bg-red-50 p-3 text-base font-semibold text-red-700">{error}</p>}
          {loading ? (
            <p className="text-base text-neutral-500">불러오는 중...</p>
          ) : (
            <>
              <CategoryBreakdown transactions={transactions} />
              <TransactionList transactions={transactions} onDelete={handleDelete} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
