import { useEffect, useState } from 'react'
import CategoryBreakdown from './components/CategoryBreakdown'
import SummaryCard from './components/SummaryCard'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import { createTransaction, deleteTransaction, fetchTransactions, updateTransaction } from './lib/api'
import type { NewTransaction, Transaction, UpdateTransaction } from './types'

// 'YYYY-MM' 형식의 현재 월 반환
function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// 월을 n개월 앞뒤로 이동
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function App() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // selectedMonth가 바뀔 때마다 해당 월 데이터 다시 로드
  useEffect(() => {
    setLoading(true)
    setError('')
    fetchTransactions(selectedMonth)
      .then(setTransactions)
      .catch(() => setError('불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }, [selectedMonth])

  async function handleAdd(tx: NewTransaction) {
    await createTransaction(tx)
    setTransactions(await fetchTransactions(selectedMonth))
  }

  async function handleDelete(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    await deleteTransaction(id)
  }

  async function handleUpdate(id: string, data: UpdateTransaction) {
    await updateTransaction(id, data)
    setTransactions(await fetchTransactions(selectedMonth))
  }

  // 월 표시 레이블 (예: 2026년 7월)
  const [year, mon] = selectedMonth.split('-')
  const monthLabel = `${year}년 ${parseInt(mon)}월`
  const isCurrentMonth = selectedMonth === currentMonth()

  return (
    <div className="min-h-svh bg-neutral-50 text-neutral-900">
      <header className="border-b-2 border-neutral-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-extrabold">가계부</h1>
          {/* 월 이동 네비게이션 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              className="min-h-9 rounded-lg bg-neutral-100 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-200"
            >
              ◀
            </button>
            <span className="min-w-28 text-center text-base font-bold text-neutral-800">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              disabled={isCurrentMonth}
              className="min-h-9 rounded-lg bg-neutral-100 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-200 disabled:opacity-30"
            >
              ▶
            </button>
            {/* 이번 달로 돌아오기 */}
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth(currentMonth())}
                className="min-h-9 rounded-lg bg-neutral-900 px-3 text-sm font-semibold text-white"
              >
                오늘
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[420px_1fr] lg:items-start lg:gap-6">
        <div className="space-y-4 lg:sticky lg:top-6">
          <SummaryCard transactions={transactions} month={selectedMonth} />
          <TransactionForm onSubmit={handleAdd} />
        </div>

        <div className="mt-4 space-y-4 lg:mt-0">
          {error && <p className="rounded-xl bg-red-50 p-3 text-base font-semibold text-red-700">{error}</p>}
          {loading ? (
            <p className="text-base text-neutral-500">불러오는 중...</p>
          ) : (
            <>
              <CategoryBreakdown transactions={transactions} month={selectedMonth} />
              <TransactionList
                transactions={transactions}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
