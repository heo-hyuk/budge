import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import SummaryCard from './SummaryCard'
import TransactionList from './TransactionList'
import { useConfirm } from '../contexts/ConfirmContext'
import { useToast } from '../contexts/ToastContext'
import { deleteTransaction, fetchTransactions, updateTransaction } from '../lib/api'
import type { Card, Transaction, UpdateTransaction } from '../types'

interface Props {
  month: string  // 'YYYY-MM'
  cards: Card[]
  onDuplicate: (tx: Transaction) => void
}

/**
 * "비정산" 탭 — 가족 비용 확인 등 일반 정산·예산·잔액에서 제외하고 싶은 거래만 모아보는 화면.
 * 홈의 Undo-delete 로직과는 분리된 자체 상태(삭제는 즉시 반영, 되돌리기 없음)
 */
function UnsettledView({ month, cards, onDuplicate }: Props) {
  const { showToast } = useToast()
  const confirm = useConfirm()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    fetchTransactions({ month, unsettled: true })
      .then(setTransactions)
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [month])

  async function handleUpdate(id: string, data: UpdateTransaction) {
    await updateTransaction(id, data)
    load()  // 비정산 해제 시 목록에서 빠져야 하므로 재조회
  }

  async function handleDelete(id: string) {
    if (!(await confirm('이 내역을 삭제할까요?'))) return
    try {
      await deleteTransaction(id)
      load()
      showToast('삭제됨')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제하지 못했습니다', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <SummaryCard transactions={transactions} month={month} />

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
        <TransactionList
          transactions={transactions}
          cards={cards}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onDuplicate={onDuplicate}
        />
      )}
    </div>
  )
}

export default UnsettledView
