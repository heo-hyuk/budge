import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import UiCard from './ui/Card'
import { useToast } from '../contexts/ToastContext'
import { fetchTransactions, updateTransaction } from '../lib/api'
import { getCategories, loadCategories } from '../lib/categories'
import { isDeliveryCategoryIncluded, loadDeliveryExcludedCategories, toggleDeliveryCategory } from '../lib/deliveryCategories'
import { formatDateLabel, formatWon } from '../lib/format'
import type { Transaction } from '../types'

interface Props {
  month: string // 'YYYY-MM'
}

/**
 * "배송" 탭 — 지출계산기와 같은 방식(기본 전체 포함, 탭하면 제외)으로
 * 지출 분류를 필터링하되, 월정산 표가 아니라 홈 탭(TransactionList)과
 * 같은 날짜별 개별 거래 목록으로 보여준다. 각 거래에 배송완료 체크박스를
 * 붙여 택배가 오면 바로 체크할 수 있게 함(체크해도 목록에서 사라지지
 * 않고 흐리게/취소선으로만 표시).
 */
function DeliveryView({ month }: Props) {
  const { showToast } = useToast()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [, forceRerender]     = useState(0) // deliveryCategories 캐시(모듈 전역) 변경을 반영하기 위한 트리거
  const [togglingId, setTogglingId] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError('')
    fetchTransactions({ month })
      .then(setTransactions)
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [month])

  // 마운트 시점엔 서버 제외 목록/분류가 아직 로드되기 전일 수 있어 로드 후 재렌더
  useEffect(() => {
    loadDeliveryExcludedCategories().then(() => forceRerender((n) => n + 1))
  }, [])
  useEffect(() => {
    loadCategories().then(() => forceRerender((n) => n + 1))
  }, [])

  async function handleTapChip(category: string) {
    await toggleDeliveryCategory(category)
    forceRerender((n) => n + 1)
  }

  async function handleToggleDelivery(tx: Transaction) {
    const next = !tx.delivery_done
    setTogglingId(tx.id)
    try {
      await updateTransaction(tx.id, { delivery_done: next })
      setTransactions((prev) => prev.map((t) => (t.id === tx.id ? { ...t, delivery_done: next ? 1 : 0 } : t)))
    } catch (err) {
      showToast(err instanceof Error ? err.message : '배송 상태를 변경하지 못했습니다', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  const categories = getCategories('expense')
  const visibleTxs = transactions.filter((t) => t.type === 'expense' && isDeliveryCategoryIncluded(t.category))

  const groups = new Map<string, Transaction[]>()
  for (const tx of visibleTxs) {
    const list = groups.get(tx.date) ?? []
    list.push(tx)
    groups.set(tx.date, list)
  }

  return (
    <div className="space-y-4">
      <UiCard>
        <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-200">배송 조회</h2>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          기본적으로 모든 지출 분류가 표시됩니다. 목록에서 제외하고 싶은 분류는 탭해서 꺼주세요.
        </p>
      </UiCard>

      <UiCard>
        <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">지출 분류</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {categories.map((c) => {
            const included = isDeliveryCategoryIncluded(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => handleTapChip(c)}
                className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                  included
                    ? 'bg-coral-400 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {c}
              </button>
            )
          })}
          {categories.length === 0 && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">등록된 지출 분류가 없습니다</p>
          )}
        </div>
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
                        checked={!!tx.delivery_done}
                        disabled={togglingId === tx.id}
                        onChange={() => handleToggleDelivery(tx)}
                        className="h-5 w-5 shrink-0 rounded border-neutral-300 dark:border-neutral-700 text-coral-400 focus:ring-coral-400"
                      />
                      <div className="min-w-0">
                        <p className={`truncate text-base font-semibold ${
                          tx.delivery_done ? 'text-neutral-400 dark:text-neutral-600 line-through' : 'text-neutral-900 dark:text-neutral-100'
                        }`}>
                          {tx.merchant || tx.category}
                        </p>
                        {tx.merchant && (
                          <span className="text-sm text-neutral-500 dark:text-neutral-400">{tx.category}</span>
                        )}
                      </div>
                    </label>
                    <span className={`shrink-0 whitespace-nowrap text-base font-bold ${
                      tx.delivery_done ? 'text-neutral-400 dark:text-neutral-600' : 'text-coral-600 dark:text-coral-200'
                    }`}>
                      -{formatWon(tx.amount)}
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

export default DeliveryView
