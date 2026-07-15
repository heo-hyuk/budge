import { BarChart3, ClipboardList, CreditCard, Home, LogOut, Menu, NotebookPen, Repeat, RotateCw, Search, TrendingUp, TriangleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import AnnualReport from './components/AnnualReport'
import AuthPage from './components/AuthPage'
import BudgetManager from './components/BudgetManager'
import CardManager from './components/CardManager'
import CategoryBreakdown from './components/CategoryBreakdown'
import LoadingSpinner from './components/LoadingSpinner'
import MonthlyReport from './components/MonthlyReport'
import NotesView from './components/NotesView'
import RecurringManager from './components/RecurringManager'
import SearchView from './components/SearchView'
import SummaryCard from './components/SummaryCard'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import { useAuth } from './contexts/AuthContext'
import { useToast } from './contexts/ToastContext'
import { createTransaction, deleteTransaction, fetchBudgetStatus, fetchCards, fetchRecurring, fetchTransactions, updateTransaction } from './lib/api'
import type { BudgetStatus, Card, NewTransaction, RecurringTransaction, Transaction, UpdateTransaction } from './types'

// 탭 정의
type Tab = 'home' | 'monthly' | 'annual' | 'cards' | 'recurring' | 'budget' | 'search' | 'notes'

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home',      label: '홈',     icon: Home },
  { id: 'monthly',   label: '월정산', icon: BarChart3 },
  { id: 'annual',    label: '연정산', icon: TrendingUp },
  { id: 'cards',     label: '카드',   icon: CreditCard },
  { id: 'recurring', label: '고정',   icon: Repeat },
  { id: 'budget',    label: '예산',   icon: ClipboardList },
  { id: 'notes',     label: '메모',   icon: NotebookPen },
  { id: 'search',    label: '검색',   icon: Search },
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
  const { showToast } = useToast()
  const [activeTab, setActiveTab]       = useState<Tab>('home')
  const [menuOpen, setMenuOpen]         = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedYear, setSelectedYear]   = useState(currentYear)
  const [transactions, setTransactions]   = useState<Transaction[]>([])
  const [cards, setCards]                 = useState<Card[]>([])
  const [recurringItems, setRecurringItems] = useState<RecurringTransaction[]>([])
  const [budgetStatuses, setBudgetStatuses] = useState<BudgetStatus[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')

  // 로그인 상태일 때 카드 + 고정지출 로드 (배경 로드라 인라인 재시도 UI가 없어 토스트로 알림)
  useEffect(() => {
    if (!user) return
    fetchCards().then(setCards).catch((err) => {
      showToast(err instanceof Error ? err.message : '카드 목록을 불러오지 못했습니다', 'error')
    })
    fetchRecurring().then(setRecurringItems).catch((err) => {
      showToast(err instanceof Error ? err.message : '고정지출 목록을 불러오지 못했습니다', 'error')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // 홈 탭: 선택 월 데이터 로드 (로그인 후에만)
  function loadHomeData() {
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
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!user || activeTab !== 'home') return
    loadHomeData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const backup = transactions
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    try {
      await deleteTransaction(id)
    } catch (err) {
      setTransactions(backup)  // 삭제 실패 시 낙관적 업데이트 롤백
      throw err
    }
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
    <div className="min-h-svh bg-neutral-50 text-neutral-900">
      {/* 헤더 */}
      <header className="border-b border-neutral-200 bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            {/* 햄버거 버튼 */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="메뉴 열기"
              className="min-h-9 min-w-9 -ml-1 flex items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
            >
              <Menu size={22} strokeWidth={2} />
            </button>
            <h1 className="text-lg font-extrabold text-brand-700">텅장</h1>
            <span className="hidden sm:inline text-xs text-neutral-400 font-medium">{user.name}</span>
          </div>

          {/* 월/연도 네비게이션 (홈·월정산·예산 탭에서 표시) */}
          {(activeTab === 'home' || activeTab === 'monthly' || activeTab === 'budget' || activeTab === 'notes') && (
            <div className="flex items-center gap-1">
              <button onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
                className="min-h-8 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
              >◀</button>
              <span className="min-w-24 text-center text-sm font-bold text-neutral-800">
                {monthLabel}
              </span>
              <button onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
                disabled={isCurrentMonth}
                className="min-h-8 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-neutral-100"
              >▶</button>
              {!isCurrentMonth && (
                <button onClick={() => setSelectedMonth(currentMonth())}
                  className="min-h-8 rounded-lg bg-brand-600 px-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 active:bg-brand-800"
                >오늘</button>
              )}
            </div>
          )}

          {/* 연도 네비게이션 (연정산 탭) */}
          {activeTab === 'annual' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setSelectedYear((y) => String(parseInt(y) - 1))}
                className="min-h-8 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold transition-colors hover:bg-neutral-200"
              >◀</button>
              <span className="min-w-16 text-center text-sm font-bold">{selectedYear}년</span>
              <button
                onClick={() => setSelectedYear((y) => String(parseInt(y) + 1))}
                disabled={selectedYear === currentYear()}
                className="min-h-8 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold transition-colors hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-neutral-100"
              >▶</button>
            </div>
          )}

          {/* 로그아웃 (좁은 화면에서는 헤더가 붐벼서 사이드 메뉴로만 노출) */}
          <button
            type="button"
            onClick={logout}
            className="hidden shrink-0 min-h-8 rounded-lg bg-neutral-100 px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-200 sm:inline-flex sm:items-center"
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
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-red-800">
                      <TriangleAlert size={16} strokeWidth={2.5} /> 예산 초과 {exceeded.length}건
                    </p>
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
              {loading ? (
                <p className="flex items-center gap-2 text-base text-neutral-500">
                  <LoadingSpinner size={18} /> 불러오는 중...
                </p>
              ) : error ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-base font-semibold text-red-700">{error}</p>
                  <button
                    type="button"
                    onClick={loadHomeData}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
                  >
                    <RotateCw size={13} /> 다시 시도
                  </button>
                </div>
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

        {/* 메모 탭 */}
        {activeTab === 'notes' && (
          <NotesView month={selectedMonth} />
        )}

        {/* 검색 탭 */}
        {activeTab === 'search' && (
          <SearchView cards={cards} />
        )}
      </main>

      {/* 사이드 메뉴 오버레이 */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* 사이드 메뉴 드로어 */}
      <nav
        className={`fixed left-0 top-0 z-40 h-full w-64 max-w-[80vw] transform bg-white shadow-xl transition-transform duration-200 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-lg font-extrabold text-brand-700">텅장</h2>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="메뉴 닫기"
            className="min-h-9 min-w-9 flex items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <div className="flex flex-col p-2">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setMenuOpen(false) }}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-semibold transition-colors ${
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <Icon size={20} strokeWidth={2} />
                {tab.label}
              </button>
            )
          })}
          {/* 로그아웃 (넓은 화면은 헤더에도 있지만, 좁은 화면은 헤더에서 숨겨서 여기가 유일한 진입점) */}
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex items-center gap-3 rounded-xl border-t border-neutral-100 px-3 pt-4 pb-3 text-left text-base font-semibold text-red-600 transition-colors hover:bg-red-50 sm:hidden"
          >
            <LogOut size={20} strokeWidth={2} />
            로그아웃
          </button>
        </div>
      </nav>
    </div>
  )
}

export default App
