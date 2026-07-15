import { useEffect, useState } from 'react'
import AnnualReport from './components/AnnualReport'
import AuthPage from './components/AuthPage'
import BudgetManager from './components/BudgetManager'
import CardManager from './components/CardManager'
import CategoryBreakdown from './components/CategoryBreakdown'
import MonthlyReport from './components/MonthlyReport'
import RecurringManager from './components/RecurringManager'
import SearchView from './components/SearchView'
import SummaryCard from './components/SummaryCard'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import { useAuth } from './contexts/AuthContext'
import { createTransaction, deleteTransaction, fetchBudgetStatus, fetchCards, fetchRecurring, fetchTransactions, updateTransaction } from './lib/api'
import type { BudgetStatus, Card, NewTransaction, RecurringTransaction, Transaction, UpdateTransaction } from './types'

// 탭 정의
type Tab = 'home' | 'monthly' | 'annual' | 'cards' | 'recurring' | 'budget' | 'search'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',      label: '홈',     icon: '🏠' },
  { id: 'monthly',   label: '월정산', icon: '📊' },
  { id: 'annual',    label: '연정산', icon: '📈' },
  { id: 'cards',     label: '카드',   icon: '💳' },
  { id: 'recurring', label: '고정',   icon: '🔁' },
  { id: 'budget',    label: '예산',   icon: '📋' },
  { id: 'search',    label: '검색',   icon: '🔍' },
]

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentYear() {
  return String(new Date().getFullYear())
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function App() {
  const { user, loading: authLoading, logout } = useAuth()
  const [activeTab, setActiveTab]       = useState<Tab>('home')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedYear, setSelectedYear]   = useState(currentYear)
  const [transactions, setTransactions]   = useState<Transaction[]>([])
  const [cards, setCards]                 = useState<Card[]>([])
  const [recurringItems, setRecurringItems] = useState<RecurringTransaction[]>([])
  const [budgetStatuses, setBudgetStatuses] = useState<BudgetStatus[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')

  // 로그인 상태일 때 카드 + 고정지출 로드
  useEffect(() => {
    if (!user) return
    fetchCards().then(setCards).catch(() => {})
    fetchRecurring().then(setRecurringItems).catch(() => {})
  }, [user])

  // 홈 탭: 선택 월 데이터 로드 (로그인 후에만)
  useEffect(() => {
    if (!user || activeTab !== 'home') return
    setLoading(true)
    setError('')
    Promise.all([
      fetchTransactions({ month: selectedMonth }),
      fetchBudgetStatus(selectedMonth).catch(() => []),
    ])
      .then(([txs, budgets]) => {
        setTransactions(txs)
        setBudgetStatuses(budgets)
      })
      .catch(() => setError('불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }, [selectedMonth, activeTab, user])

  // 예산 탭 전환 시 현재 월 예산 새로고침
  useEffect(() => {
    if (!user || activeTab !== 'budget') return
    fetchBudgetStatus(selectedMonth).then(setBudgetStatuses).catch(() => {})
  }, [activeTab, selectedMonth, user])

  async function handleAdd(tx: NewTransaction) {
    await createTransaction(tx)
    const [txs, budgets] = await Promise.all([
      fetchTransactions({ month: selectedMonth }),
      fetchBudgetStatus(selectedMonth).catch(() => budgetStatuses),
    ])
    setTransactions(txs)
    setBudgetStatuses(budgets)
  }

  async function refreshBudgets() {
    setBudgetStatuses(await fetchBudgetStatus(selectedMonth).catch(() => []))
  }

  async function handleDelete(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    await deleteTransaction(id)
  }

  async function handleUpdate(id: string, data: UpdateTransaction) {
    await updateTransaction(id, data)
    setTransactions(await fetchTransactions({ month: selectedMonth }))
  }

  async function refreshCards() {
    setCards(await fetchCards())
  }

  async function refreshRecurring() {
    setRecurringItems(await fetchRecurring())
  }

  const isCurrentMonth = selectedMonth === currentMonth()
  const [y, mon] = selectedMonth.split('-')
  const monthLabel = `${y}년 ${parseInt(mon)}월`

  // 인증 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-svh bg-neutral-50 flex items-center justify-center">
        <p className="text-base text-neutral-500">불러오는 중...</p>
      </div>
    )
  }

  // 미로그인 → 로그인 페이지
  if (!user) return <AuthPage />

  return (
    <div className="min-h-svh bg-neutral-50 text-neutral-900 pb-16">
      {/* 헤더 */}
      <header className="border-b-2 border-neutral-200 bg-white px-4 py-3 sticky top-0 z-10">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-lg font-extrabold">가계부</h1>
            <span className="hidden sm:inline text-xs text-neutral-400 font-medium">{user.name}</span>
          </div>

          {/* 월/연도 네비게이션 (홈·월정산·예산 탭에서 표시) */}
          {(activeTab === 'home' || activeTab === 'monthly' || activeTab === 'budget') && (
            <div className="flex items-center gap-1">
              <button onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
                className="min-h-8 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold text-neutral-700"
              >◀</button>
              <span className="min-w-24 text-center text-sm font-bold text-neutral-800">
                {monthLabel}
              </span>
              <button onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
                disabled={isCurrentMonth}
                className="min-h-8 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold text-neutral-700 disabled:opacity-30"
              >▶</button>
              {!isCurrentMonth && (
                <button onClick={() => setSelectedMonth(currentMonth())}
                  className="min-h-8 rounded-lg bg-neutral-900 px-2.5 text-sm font-semibold text-white"
                >오늘</button>
              )}
            </div>
          )}

          {/* 연도 네비게이션 (연정산 탭) */}
          {activeTab === 'annual' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setSelectedYear((y) => String(parseInt(y) - 1))}
                className="min-h-8 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold"
              >◀</button>
              <span className="min-w-16 text-center text-sm font-bold">{selectedYear}년</span>
              <button
                onClick={() => setSelectedYear((y) => String(parseInt(y) + 1))}
                disabled={selectedYear === currentYear()}
                className="min-h-8 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold disabled:opacity-30"
              >▶</button>
            </div>
          )}

          {/* 로그아웃 */}
          <button
            type="button"
            onClick={logout}
            className="shrink-0 min-h-8 rounded-lg bg-neutral-100 px-2.5 text-xs font-semibold text-neutral-600"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {/* 홈 탭 */}
        {activeTab === 'home' && (
          <div className="lg:grid lg:grid-cols-[420px_1fr] lg:items-start lg:gap-6">
            <div className="space-y-4 lg:sticky lg:top-20">
              <SummaryCard transactions={transactions} month={selectedMonth} />
              {/* 예산 초과 카테고리 요약 배너 */}
              {(() => {
                const exceeded = budgetStatuses.filter((s) => s.exceeded && s.budget.active === 1)
                if (exceeded.length === 0) return null
                return (
                  <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-bold text-red-800">⚠ 예산 초과 {exceeded.length}건</p>
                    <ul className="mt-1 space-y-0.5">
                      {exceeded.map((s) => (
                        <li key={s.budget.id} className="text-xs text-red-700">
                          • {s.budget.category}: {s.percentage}% 사용
                          ({s.budget.monthly_limit > 0
                            ? `${Math.abs(s.remaining).toLocaleString()}원 초과`
                            : '초과'})
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}
              <TransactionForm onSubmit={handleAdd} cards={cards} budgetStatuses={budgetStatuses} />
            </div>
            <div className="mt-4 space-y-4 lg:mt-0">
              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-base font-semibold text-red-700">{error}</p>
              )}
              {loading ? (
                <p className="text-base text-neutral-500">불러오는 중...</p>
              ) : (
                <>
                  <CategoryBreakdown transactions={transactions} month={selectedMonth} />
                  <TransactionList
                    transactions={transactions}
                    cards={cards}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* 월별 정산 탭 */}
        {activeTab === 'monthly' && (
          <MonthlyReport month={selectedMonth} cards={cards} />
        )}

        {/* 연간 정산 탭 */}
        {activeTab === 'annual' && (
          <AnnualReport year={selectedYear} />
        )}

        {/* 카드 관리 탭 */}
        {activeTab === 'cards' && (
          <CardManager cards={cards} onRefresh={refreshCards} />
        )}

        {/* 고정 수입/지출 탭 */}
        {activeTab === 'recurring' && (
          <RecurringManager
            items={recurringItems}
            cards={cards}
            onRefresh={refreshRecurring}
          />
        )}

        {/* 예산 관리 탭 */}
        {activeTab === 'budget' && (
          <BudgetManager
            statuses={budgetStatuses}
            month={selectedMonth}
            onRefresh={refreshBudgets}
          />
        )}

        {/* 검색 탭 */}
        {activeTab === 'search' && (
          <SearchView cards={cards} />
        )}
      </main>

      {/* 하단 탭 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t-2 border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl grid grid-cols-7">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'text-neutral-900'
                  : 'text-neutral-400'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default App
