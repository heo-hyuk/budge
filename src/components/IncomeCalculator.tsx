import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import TransactionList from './TransactionList'
import UiCard from './ui/Card'
import { useToast } from '../contexts/ToastContext'
import { deleteTransaction, fetchMonthlySettlement, fetchTransactions, updateTransaction } from '../lib/api'
import { getCalcSelections, isCalcSelected, loadCalcSelections, toggleCalcSelection } from '../lib/calcSelections'
import { getCategories, loadCategories } from '../lib/categories'
import { formatWon } from '../lib/format'
import type { Card, MonthlySettlement, Transaction, UpdateTransaction } from '../types'

interface Props {
  month: string  // 'YYYY-MM'
  cards: Card[]
  onDuplicate: (tx: Transaction) => void
}

/**
 * "계산기" 탭 — 원하는 수입 분류 칩만 골라 합산한 "개인화 수익"을 보는 화면.
 * 예: 영업수익 + 급여 선택 → 두 분류의 월 합계를 더함. 차감할 항목(식대/담배/LPG 등)은
 * 지출이 아니라 수입 등록 시 금액 앞에 '-'를 붙여 이미 표현 가능하므로, 계산기는
 * 수입 분류만 대상으로 하고 선택된 값을 그대로 더하기만 한다(부호 선택 없음).
 * 분류별 월 합계는 이미 계산되는 /api/settlement/monthly를 그대로 재사용하고,
 * 선택된 분류에 속하는 개별 거래는 fetchTransactions로 따로 조회해 목록으로 보여준다.
 */
function IncomeCalculator({ month, cards, onDuplicate }: Props) {
  const { showToast } = useToast()
  const [settlement, setSettlement] = useState<MonthlySettlement | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [, forceRerender] = useState(0)  // calcSelections 캐시(모듈 전역) 변경을 반영하기 위한 트리거

  function load() {
    setLoading(true)
    setError('')
    Promise.all([fetchMonthlySettlement(month), fetchTransactions({ month })])
      .then(([s, tx]) => { setSettlement(s); setTransactions(tx) })
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [month])

  // 마운트 시점엔 서버 선택 목록/분류가 아직 로드되기 전일 수 있어 로드 후 재렌더
  useEffect(() => {
    loadCalcSelections().then(() => forceRerender((n) => n + 1))
  }, [])
  useEffect(() => {
    loadCategories().then(() => forceRerender((n) => n + 1))
  }, [])

  async function handleTapChip(category: string) {
    await toggleCalcSelection(category)
    forceRerender((n) => n + 1)
  }

  async function handleUpdate(id: string, data: UpdateTransaction) {
    await updateTransaction(id, data)
    load()  // 분류가 바뀌면 선택 목록에서 빠지거나 들어올 수 있으므로 재조회
  }

  // TransactionList가 onDelete 호출 전에 이미 자체적으로 확인 모달을 띄우므로
  // 여기서 또 confirm()을 부르면 확인을 두 번 눌러야 하는 버그가 생김(모달이 똑같은
  // 문구로 다시 뜨는 것처럼 보임) — 여기서는 바로 삭제만 수행
  async function handleDelete(id: string) {
    try {
      await deleteTransaction(id)
      load()
      showToast('삭제됨')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제하지 못했습니다', 'error')
    }
  }

  const incomeBucket = settlement?.month_total.income ?? {}
  const selections = getCalcSelections()
  const selectedCategories = new Set(selections.map((s) => s.category))
  const breakdown = selections.map((s) => ({ ...s, amount: incomeBucket[s.category] ?? 0 }))
  const total = breakdown.reduce((sum, s) => sum + s.amount, 0)
  const categories = getCategories('income')
  const selectedTransactions = transactions.filter((tx) => tx.type === 'income' && selectedCategories.has(tx.category))

  return (
    <div className="space-y-4">
      <UiCard>
        <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-200">개인화 수익 계산기</h2>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          합산에 포함할 수입 분류 칩을 선택하세요. 다시 탭하면 선택이 해제됩니다.
          차감할 항목은 수입 등록 시 금액 앞에 '-'를 붙이면 자동으로 반영돼요.
        </p>
      </UiCard>

      {loading ? (
        <p className="flex items-center gap-2 text-base text-neutral-500 dark:text-neutral-400">
          <LoadingSpinner size={18} /> 불러오는 중...
        </p>
      ) : error ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4">
          <p className="text-base font-semibold text-red-700 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={load}
            className="shrink-0 rounded-lg bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-red-700 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <UiCard>
            <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">선택 합계</p>
            <p className={`mt-1 text-3xl font-bold ${total < 0 ? 'text-red-500' : 'text-neutral-900 dark:text-neutral-100'}`}>
              {formatWon(total)}
            </p>
            {breakdown.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-400 dark:text-neutral-500">아래에서 계산에 포함할 수입 분류 칩을 선택하세요.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {breakdown.map((s) => (
                  <li key={s.category} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">{s.category}</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">{formatWon(s.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </UiCard>

          <UiCard>
            <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">수입 분류</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {categories.map((c) => {
                const selected = isCalcSelected(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleTapChip(c)}
                    className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                      selected
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
              {categories.length === 0 && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">등록된 수입 분류가 없습니다</p>
              )}
            </div>
          </UiCard>

          {/* 선택된 분류에 속하는 개별 거래 내역 — 월 정산처럼 실제 내역을 그대로 보여줌 */}
          {selections.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300">선택 분류 내역</p>
              {selectedTransactions.length === 0 ? (
                <UiCard>
                  <p className="text-sm text-neutral-400 dark:text-neutral-500">이번 달엔 선택한 분류의 내역이 없습니다.</p>
                </UiCard>
              ) : (
                <TransactionList
                  transactions={selectedTransactions}
                  cards={cards}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                  onDuplicate={onDuplicate}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default IncomeCalculator
