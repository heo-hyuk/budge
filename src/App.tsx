import { BarChart3, CalendarDays, ClipboardList, CreditCard, Home, Menu, Moon, NotebookPen, Repeat, RotateCw, Search, Sun, TrendingUp, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import AnnualReport from './components/AnnualReport'
import AuthPage from './components/AuthPage'
import BudgetManager from './components/BudgetManager'
import CardManager from './components/CardManager'
import CategoryBreakdown from './components/CategoryBreakdown'
import LoadingSpinner from './components/LoadingSpinner'
import MonthlyReport from './components/MonthlyReport'
import MyPage from './components/MyPage'
import NotesView from './components/NotesView'
import OverviewView from './components/OverviewView'
import RecurringManager from './components/RecurringManager'
import SearchView from './components/SearchView'
import SummaryCard from './components/SummaryCard'
import TransactionForm from './components/TransactionForm'
import type { TransactionPrefill } from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import { useAuth } from './contexts/AuthContext'
import { useTheme } from './contexts/ThemeContext'
import { useToast } from './contexts/ToastContext'
import { createTransaction, deleteTransaction, fetchBudgetStatus, fetchCards, fetchRecurring, fetchTransactions, updateTransaction } from './lib/api'
import { validateNicknameClient } from './lib/nickname'
import type { BudgetStatus, Card, NewTransaction, RecurringTransaction, Transaction, UpdateTransaction } from './types'

// 탭 정의
type Tab = 'home' | 'overview' | 'monthly' | 'annual' | 'cards' | 'recurring' | 'budget' | 'search' | 'notes'

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home',      label: '홈',       icon: Home },
  { id: 'overview',  label: '한눈에 보기', icon: CalendarDays },
  { id: 'monthly',   label: '월정산',   icon: BarChart3 },
  { id: 'annual',    label: '연정산',   icon: TrendingUp },
  { id: 'cards',     label: '카드',     icon: CreditCard },
  { id: 'recurring', label: '고정',     icon: Repeat },
  { id: 'budget',    label: '예산',     icon: ClipboardList },
  { id: 'notes',     label: '메모',     icon: NotebookPen },
  { id: 'search',    label: '검색',     icon: Search },
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

// 카드 정산 push 알림 클릭 시 월정산 화면으로 바로 이동시키기 위한 딥링크(?tab=monthly)
function initialTabFromUrl(): Tab {
  const tab = new URLSearchParams(window.location.search).get('tab')
  return TABS.some((t) => t.id === tab) ? (tab as Tab) : 'home'
}

function App() {
  const { user, loading: authLoading, logout, updateNickname } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { showToast } = useToast()
  const [activeTab, setActiveTab]       = useState<Tab>(initialTabFromUrl)
  const [menuOpen, setMenuOpen]         = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [myPageOpen, setMyPageOpen]     = useState(false)
  const [nicknamePromptDismissed, setNicknamePromptDismissed] = useState(false)
  const [nicknamePromptInput, setNicknamePromptInput] = useState('')
  const [nicknamePromptError, setNicknamePromptError] = useState('')
  const [nicknamePromptSaving, setNicknamePromptSaving] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedYear, setSelectedYear]   = useState(currentYear)
  const [transactions, setTransactions]   = useState<Transaction[]>([])
  const [cards, setCards]                 = useState<Card[]>([])
  const [recurringItems, setRecurringItems] = useState<RecurringTransaction[]>([])
  const [budgetStatuses, setBudgetStatuses] = useState<BudgetStatus[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [duplicateFrom, setDuplicateFrom] = useState<{ data: TransactionPrefill; nonce: number } | null>(null)
  const [editTarget, setEditTarget]       = useState<{ id: string; data: TransactionPrefill; nonce: number } | null>(null)

  // 삭제 Undo — 각 삭제마다 독립된 타이머로 관리해 여러 건을 동시에 삭제해도
  // 서로 덮어쓰지 않게 함 (id별로 별도 pending 항목)
  interface PendingDelete { tx: Transaction; index: number; timer: ReturnType<typeof setTimeout> }
  const pendingDeletesRef = useRef(new Map<string, PendingDelete>())
  const UNDO_DELAY_MS = 3000

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

  // 삭제 대기중(3초 undo 창)인 거래는 서버에서 다시 불러온 목록에도 제외해야
  // 낙관적으로 지운 항목이 다른 새로고침(추가/수정 등) 때 되살아나지 않음
  function withoutPending(list: Transaction[]): Transaction[] {
    if (pendingDeletesRef.current.size === 0) return list
    return list.filter((t) => !pendingDeletesRef.current.has(t.id))
  }

  // 홈 탭: 선택 월 데이터 로드 (로그인 후에만)
  function loadHomeData() {
    setLoading(true)
    setError('')
    Promise.all([
      fetchTransactions({ month: selectedMonth }),
      fetchBudgetStatus(selectedMonth).catch(() => []),
    ])
      .then(([txs, budgets]) => {
        setTransactions(withoutPending(txs))
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
    setTransactions(withoutPending(txs))
    setBudgetStatuses(budgets)
  }

  async function refreshBudgets() {
    setBudgetStatuses(await fetchBudgetStatus(selectedMonth).catch(() => []))
  }

  function insertAt(list: Transaction[], index: number, tx: Transaction): Transaction[] {
    const clamped = Math.min(index, list.length)
    return [...list.slice(0, clamped), tx, ...list.slice(clamped)]
  }

  async function commitDelete(id: string) {
    const pending = pendingDeletesRef.current.get(id)
    if (!pending) return
    pendingDeletesRef.current.delete(id)
    try {
      await deleteTransaction(id)
    } catch (err) {
      setTransactions((prev) => insertAt(prev, pending.index, pending.tx))
      showToast(err instanceof Error ? err.message : '거래를 삭제하지 못했습니다', 'error')
    }
  }

  function undoDelete(id: string) {
    const pending = pendingDeletesRef.current.get(id)
    if (!pending) return
    clearTimeout(pending.timer)
    pendingDeletesRef.current.delete(id)
    setTransactions((prev) => insertAt(prev, pending.index, pending.tx))
  }

  function handleDelete(id: string) {
    const index = transactions.findIndex((t) => t.id === id)
    if (index === -1) return
    const tx = transactions[index]
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    const timer = setTimeout(() => { commitDelete(id) }, UNDO_DELAY_MS)
    pendingDeletesRef.current.set(id, { tx, index, timer })
    showToast('삭제됨', 'success', {
      actionLabel: '되돌리기',
      onAction: () => undoDelete(id),
      durationMs: UNDO_DELAY_MS,
    })
  }

  // 직전 거래 복제 — 날짜만 오늘로 재설정한 채 폼에 채워서 사용자가 확인 후 저장
  function handleDuplicate(tx: Transaction) {
    setActiveTab('home')
    setDuplicateFrom({
      data: {
        type: tx.type,
        category: tx.category,
        amount: tx.amount,
        merchant: tx.merchant,
        paymentMethod: tx.card_id || '현금',
        memo: tx.memo,
        date: tx.date,
      },
      nonce: Date.now(),
    })
  }

  // 한눈에 보기(일일/주간 정산)에서 항목 탭 시 — 홈 탭으로 이동해 TransactionForm을 수정 모드로 채움
  function handleEditRequest(tx: Transaction) {
    setActiveTab('home')
    setEditTarget({
      id: tx.id,
      data: {
        type: tx.type,
        category: tx.category,
        amount: tx.amount,
        merchant: tx.merchant,
        paymentMethod: tx.card_id || '현금',
        memo: tx.memo,
        date: tx.date,
      },
      nonce: Date.now(),
    })
  }

  // 월 이동 스와이프 (모바일) — 라이브러리 없이 순수 touch 이벤트로 감지
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
    if (Math.abs(dx) < 60 || Math.abs(dy) > 60) return  // 세로 스크롤과 헷갈리지 않게
    if (dx < 0) {
      if (!isCurrentMonth) setSelectedMonth((m) => shiftMonth(m, 1))  // 좌로 스와이프 = 다음달
    } else {
      setSelectedMonth((m) => shiftMonth(m, -1))  // 우로 스와이프 = 이전달
    }
  }

  async function handleUpdate(id: string, data: UpdateTransaction) {
    await updateTransaction(id, data)
    setTransactions(withoutPending(await fetchTransactions({ month: selectedMonth })))
  }

  async function refreshCards() {
    setCards(await fetchCards())
  }

  async function refreshRecurring() {
    setRecurringItems(await fetchRecurring())
  }

  async function handleSetNickname(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validateNicknameClient(nicknamePromptInput)
    if (validationError) {
      setNicknamePromptError(validationError)
      return
    }
    setNicknamePromptSaving(true)
    try {
      await updateNickname(nicknamePromptInput)
      showToast('닉네임이 설정되었습니다')
    } catch (err) {
      setNicknamePromptError(err instanceof Error ? err.message : '닉네임 설정에 실패했습니다')
    } finally {
      setNicknamePromptSaving(false)
    }
  }

  const isCurrentMonth = selectedMonth === currentMonth()
  const [y, mon] = selectedMonth.split('-')
  const monthLabel = `${y}년 ${parseInt(mon)}월`

  // 인증 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-svh bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <p className="text-base text-neutral-500 dark:text-neutral-400">불러오는 중...</p>
      </div>
    )
  }

  // 미로그인 → 로그인 페이지
  if (!user) return <AuthPage />

  return (
    <div className="min-h-svh bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 lg:flex">
      {/* 데스크탑 전용 상시 사이드바 — 모바일은 기존처럼 햄버거+드로어 유지 */}
      <aside className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-neutral-200 dark:border-neutral-800 lg:bg-white dark:bg-neutral-900">
        <div className="px-4 py-4">
          <button type="button" onClick={() => setActiveTab('home')} aria-label="홈으로 이동">
            <img src="/logo.svg" alt="텅장" className="h-8 w-auto" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-coral-400 text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon size={18} strokeWidth={2} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
      {/* 헤더 */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            {/* 햄버거 버튼 — 모바일 전용 (데스크탑은 좌측 상시 사이드바로 대체) */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="메뉴 열기"
              className="min-h-9 min-w-9 -ml-1 flex items-center justify-center rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 lg:hidden"
            >
              <Menu size={22} strokeWidth={2} />
            </button>
            <button type="button" onClick={() => setActiveTab('home')} aria-label="홈으로 이동" className="lg:hidden">
              <img src="/logo.svg" alt="텅장" className="h-8 w-auto" />
            </button>
          </div>

          {/* 월/연도 네비게이션 (홈·월정산·예산 탭에서 표시) */}
          {(activeTab === 'home' || activeTab === 'monthly' || activeTab === 'budget' || activeTab === 'notes') && (
            <div className="flex items-center gap-1">
              <button onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
                className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >◀</button>
              <span className="min-w-24 text-center text-sm font-bold text-neutral-800 dark:text-neutral-200">
                {monthLabel}
              </span>
              <button onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
                disabled={isCurrentMonth}
                className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-100"
              >▶</button>
              {!isCurrentMonth && (
                <button onClick={() => setSelectedMonth(currentMonth())}
                  className="min-h-8 rounded-lg bg-coral-400 px-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-600 active:bg-coral-800"
                >오늘</button>
              )}
            </div>
          )}

          {/* 연도 네비게이션 (연정산 탭) */}
          {activeTab === 'annual' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setSelectedYear((y) => String(parseInt(y) - 1))}
                className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >◀</button>
              <span className="min-w-16 text-center text-sm font-bold">{selectedYear}년</span>
              <button
                onClick={() => setSelectedYear((y) => String(parseInt(y) + 1))}
                disabled={selectedYear === currentYear()}
                className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-100"
              >▶</button>
            </div>
          )}

          {/* 다크모드 토글 */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            className="min-h-8 min-w-8 shrink-0 flex items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {theme === 'dark' ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
          </button>

          {/* 닉네임 — 클릭 시 드롭다운으로 내 정보/로그아웃 진입 */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {user.nickname ?? user.name}
              <span className="text-neutral-400 dark:text-neutral-500">▾</span>
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full z-30 mt-1 w-32 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => { setMyPageOpen(true); setUserMenuOpen(false) }}
                    className="block w-full px-3 py-2 text-left text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    내 정보
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); logout() }}
                    className="block w-full px-3 py-2 text-left text-sm font-semibold text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/40"
                  >
                    로그아웃
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {/* 홈 탭 */}
        {activeTab === 'home' && (
          <div className="lg:grid lg:grid-cols-[420px_1fr] lg:items-start lg:gap-6">
            <div className="space-y-4 lg:sticky lg:top-20">
              {/* 모바일 좌우 스와이프로 월 이동 (라이브러리 없이 순수 touch 이벤트) */}
              <div onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
                <SummaryCard transactions={transactions} month={selectedMonth} />
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="w-full rounded-xl border border-coral-100 dark:border-coral-900 bg-coral-50 dark:bg-coral-900/30 px-4 py-2.5 text-center text-sm font-semibold text-coral-600 dark:text-coral-200 transition-colors hover:bg-coral-100 dark:hover:bg-coral-900/50"
              >
                한눈에 보기 (일일·주간 정산) →
              </button>
              {/* 예산 초과 카테고리 요약 배너 */}
              {(() => {
                const exceeded = budgetStatuses.filter((s) => s.exceeded && s.budget.active === 1)
                if (exceeded.length === 0) return null
                return (
                  <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 shadow-sm">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-red-800 dark:text-red-300">
                      <TriangleAlert size={16} strokeWidth={2.5} /> 예산 초과 {exceeded.length}건
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {exceeded.map((s) => (
                        <li key={s.budget.id} className="text-xs text-red-700 dark:text-red-400">
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
              <TransactionForm
                onSubmit={handleAdd}
                cards={cards}
                budgetStatuses={budgetStatuses}
                duplicateFrom={duplicateFrom}
                onDuplicateApplied={() => setDuplicateFrom(null)}
                onUpdateSubmit={handleUpdate}
                editTarget={editTarget}
                onEditApplied={() => setEditTarget(null)}
              />
            </div>
            <div className="mt-4 space-y-4 lg:mt-0">
              {loading ? (
                <p className="flex items-center gap-2 text-base text-neutral-500 dark:text-neutral-400">
                  <LoadingSpinner size={18} /> 불러오는 중...
                </p>
              ) : error ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4">
                  <p className="text-base font-semibold text-red-700 dark:text-red-400">{error}</p>
                  <button
                    type="button"
                    onClick={loadHomeData}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-red-700 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
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
                    onDuplicate={handleDuplicate}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* 한눈에 보기 탭 (일일/주간 정산) */}
        {activeTab === 'overview' && (
          <OverviewView onEditTransaction={handleEditRequest} />
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
          <CardManager cards={cards} recurringItems={recurringItems} onRefresh={refreshCards} />
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
      </div>

      {/* 사이드 메뉴 오버레이 — 모바일 전용 (데스크탑은 좌측 상시 사이드바 사용) */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* 사이드 메뉴 드로어 — 모바일 전용 */}
      <nav
        className={`fixed left-0 top-0 z-40 h-full w-64 max-w-[80vw] transform bg-white dark:bg-neutral-900 shadow-xl transition-transform duration-200 lg:hidden ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setActiveTab('home'); setMenuOpen(false) }} aria-label="홈으로 이동">
              <img src="/logo.svg" alt="텅장" className="h-8 w-auto" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="메뉴 닫기"
            className="min-h-9 min-w-9 flex items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700"
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
                    ? 'bg-coral-400 text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon size={20} strokeWidth={2} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>

      {/* 내 정보 화면 */}
      {myPageOpen && <MyPage onClose={() => setMyPageOpen(false)} />}

      {/* 닉네임 미설정 기존 가입자 대상 1회성 유도 모달 — 설정 완료 시 user.nickname이 채워져 자연히 재노출 안 됨 */}
      {!myPageOpen && !user.nickname && !nicknamePromptDismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">닉네임을 설정해주세요</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">헤더에 표시될 닉네임이에요. 나중에 내 정보에서 바꿀 수 있어요.</p>
            <form onSubmit={handleSetNickname} className="mt-4 space-y-2">
              <input
                type="text"
                autoFocus
                value={nicknamePromptInput}
                onChange={(e) => setNicknamePromptInput(e.target.value)}
                placeholder="한글/영문/숫자 2~12자"
                className="min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
              />
              {nicknamePromptError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{nicknamePromptError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={nicknamePromptSaving}
                  className="min-h-11 flex-1 rounded-xl bg-coral-400 text-base font-bold text-white transition-colors hover:bg-coral-600 active:bg-coral-800 disabled:opacity-50"
                >
                  {nicknamePromptSaving ? '저장 중...' : '설정'}
                </button>
                <button
                  type="button"
                  onClick={() => setNicknamePromptDismissed(true)}
                  className="min-h-11 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-4 text-base font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                >
                  나중에
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
