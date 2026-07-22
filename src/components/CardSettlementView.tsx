import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import UiCard from './ui/Card'
import { useToast } from '../contexts/ToastContext'
import { fetchTransactions, updateTransaction } from '../lib/api'
import { isCardSettlementSourceCategory, loadCardSettlementSourceCategories, toggleCardSettlementSourceCategory } from '../lib/cardSettlementCategories'
import { getCategories, loadCategories } from '../lib/categories'
import { formatDateLabel, formatWon, shiftDate } from '../lib/format'
import { getCardSettlementTargetCategory, loadSettings, setCardSettlementTargetCategory } from '../lib/settings'
import type { Transaction } from '../types'

interface Props {
  month: string // 'YYYY-MM'
}

const SETTLEMENT_DELAY_DAYS = 2

/**
 * "카드 정산기" 탭 — 자영업자용. 카드매출로 등록한 수입 중 정산 대기중인 항목을
 * 날짜별로 보여준다(등록일 + 2일 = 예상 입금일 표시). 통장에 들어온 금액을
 * 확인하고 체크하면 거래의 분류를 미리 정해둔 "목표 분류"로 즉시 바꿔서(홈 탭
 * 수입에도 그대로 반영) 정산 대기 목록에서 자연히 빠지게 한다(별도의 "확인 완료"
 * 플래그 없이 분류 자체를 소스/목표 필터로 씀).
 * 소스 분류(추적 대상)/목표 분류(체크 시 바뀔 분류) 둘 다 이 탭 안에서 직접 선택한다.
 */
function CardSettlementView({ month }: Props) {
  const { showToast } = useToast()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [, forceRerender]     = useState(0) // 소스분류/목표분류 캐시(모듈 전역) 변경을 반영하기 위한 트리거
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError('')
    fetchTransactions({ month })
      .then(setTransactions)
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [month])

  // 마운트 시점엔 서버 소스분류/목표분류/분류 목록이 아직 로드되기 전일 수 있어 로드 후 재렌더
  useEffect(() => {
    loadCardSettlementSourceCategories().then(() => forceRerender((n) => n + 1))
  }, [])
  useEffect(() => {
    loadCategories().then(() => forceRerender((n) => n + 1))
  }, [])
  useEffect(() => {
    loadSettings().then(() => forceRerender((n) => n + 1))
  }, [])

  async function handleTapSourceChip(category: string) {
    await toggleCardSettlementSourceCategory(category)
    forceRerender((n) => n + 1)
  }

  async function handleSelectTarget(category: string) {
    try {
      await setCardSettlementTargetCategory(category)
      forceRerender((n) => n + 1)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '분류를 저장하지 못했습니다', 'error')
    }
  }

  async function handleConfirmSettlement(tx: Transaction) {
    const target = getCardSettlementTargetCategory()
    if (!target) { showToast('먼저 확인 시 변경할 분류를 설정해주세요', 'error'); return }
    setConfirmingId(tx.id)
    try {
      await updateTransaction(tx.id, { category: target })
      setTransactions((prev) => prev.filter((t) => t.id !== tx.id))
      showToast(`'${target}' 분류로 변경했습니다`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '분류를 변경하지 못했습니다', 'error')
    } finally {
      setConfirmingId(null)
    }
  }

  const categories = getCategories('income')
  const targetCategory = getCardSettlementTargetCategory()
  const sourceCategories = categories.filter((c) => isCardSettlementSourceCategory(c))
  const visibleTxs = transactions.filter((t) => t.type === 'income' && sourceCategories.includes(t.category))

  const groups = new Map<string, Transaction[]>()
  for (const tx of visibleTxs) {
    const list = groups.get(tx.date) ?? []
    list.push(tx)
    groups.set(tx.date, list)
  }

  return (
    <div className="space-y-4">
      <UiCard>
        <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-200">카드 정산기</h2>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          카드매출(정산 대기) 분류를 선택하면 그 분류로 등록된 수입이 날짜별로 아래
          표시돼요. 등록일 기준 {SETTLEMENT_DELAY_DAYS}일 뒤 입금 예정 금액을 확인하고
          체크하면 미리 정해둔 분류로 바뀌어요.
        </p>
      </UiCard>

      <UiCard>
        <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">카드매출 분류 (여러 개 선택 가능)</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {categories.map((c) => {
            const selected = isCardSettlementSourceCategory(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => handleTapSourceChip(c)}
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

      <UiCard>
        <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">확인 시 변경할 분류</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {categories.map((c) => {
            const selected = targetCategory === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => handleSelectTarget(c)}
                className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                  selected
                    ? 'bg-coral-400 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {c}
              </button>
            )
          })}
        </div>
        {!targetCategory && (
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">아직 설정되지 않았습니다. 위에서 하나를 선택해주세요.</p>
        )}
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
      ) : sourceCategories.length === 0 ? (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-center shadow-sm">
          <p className="text-base text-neutral-500 dark:text-neutral-400">위에서 카드매출 분류를 먼저 선택해주세요.</p>
        </section>
      ) : groups.size === 0 ? (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-center shadow-sm">
          <p className="text-base text-neutral-500 dark:text-neutral-400">표시할 내역이 없습니다</p>
        </section>
      ) : (
        <section className="space-y-4">
          {Array.from(groups.entries()).map(([date, items]) => (
            <div key={date} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
              <h3 className="border-b border-neutral-100 dark:border-neutral-800 px-4 py-2.5 text-sm font-bold text-neutral-500 dark:text-neutral-400">
                {formatDateLabel(date)}
              </h3>
              <ul>
                {items.map((tx) => (
                  <li key={tx.id} className="flex items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 px-4 py-3 last:border-b-0">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={false}
                        disabled={confirmingId === tx.id}
                        onChange={() => handleConfirmSettlement(tx)}
                        className="h-5 w-5 shrink-0 rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-600"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
                          {tx.merchant || tx.category}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-sm text-neutral-500 dark:text-neutral-400">{tx.category}</span>
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                            입금 예정 {formatDateLabel(shiftDate(tx.date, SETTLEMENT_DELAY_DAYS))}
                          </span>
                        </div>
                      </div>
                    </label>
                    <span className="shrink-0 whitespace-nowrap text-base font-bold text-blue-700 dark:text-blue-300">
                      +{formatWon(tx.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

export default CardSettlementView
