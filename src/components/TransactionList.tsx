import { useState } from 'react'
import { getCategories } from '../lib/categories'
import { formatDateLabel, formatWon } from '../lib/format'
import type { Transaction, TransactionType, UpdateTransaction } from '../types'

interface Props {
  transactions: Transaction[]
  onDelete: (id: string) => void
  onUpdate: (id: string, data: UpdateTransaction) => Promise<void>
}

// 인라인 편집 폼 상태
interface EditState {
  type: TransactionType
  category: string
  amount: string
  date: string
  memo: string
}

function TransactionList({ transactions, onDelete, onUpdate }: Props) {
  // 현재 편집 중인 거래 id
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  if (transactions.length === 0) {
    return (
      <section className="rounded-2xl border-2 border-neutral-200 bg-white p-6 text-center shadow-sm">
        <p className="text-base text-neutral-500">아직 내역이 없습니다</p>
      </section>
    )
  }

  // 날짜별 그룹
  const groups = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const list = groups.get(tx.date) ?? []
    list.push(tx)
    groups.set(tx.date, list)
  }

  function startEdit(tx: Transaction) {
    setEditingId(tx.id)
    setEditState({
      type: tx.type,
      category: tx.category,
      amount: String(tx.amount),
      date: tx.date,
      memo: tx.memo ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState(null)
  }

  async function handleSave(id: string) {
    if (!editState) return
    const numericAmount = Number(editState.amount.replace(/[^0-9]/g, ''))
    if (!numericAmount || numericAmount <= 0) return
    setSaving(true)
    try {
      await onUpdate(id, {
        type: editState.type,
        category: editState.category,
        amount: numericAmount,
        date: editState.date,
        memo: editState.memo.trim(),
      })
      setEditingId(null)
      setEditState(null)
    } finally {
      setSaving(false)
    }
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
            {items.map((tx) =>
              editingId === tx.id && editState ? (
                /* ---- 인라인 편집 폼 ---- */
                <li key={tx.id} className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
                  {/* 수입/지출 토글 */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {(['expense', 'income'] as TransactionType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          const cats = getCategories(t)
                          setEditState((s) => s && { ...s, type: t, category: cats[0] })
                        }}
                        className={`min-h-9 rounded-xl text-sm font-bold ${
                          editState.type === t
                            ? t === 'expense' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {t === 'expense' ? '지출' : '수입'}
                      </button>
                    ))}
                  </div>
                  {/* 금액 */}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editState.amount}
                    onChange={(e) => setEditState((s) => s && { ...s, amount: e.target.value })}
                    className="mb-2 min-h-10 w-full rounded-xl border-2 border-neutral-300 px-3 text-right text-base font-bold focus:border-blue-500 focus:outline-none"
                    placeholder="금액"
                  />
                  {/* 분류 칩 */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {getCategories(editState.type).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditState((s) => s && { ...s, category: c })}
                        className={`min-h-8 rounded-full px-3 text-sm font-semibold ${
                          editState.category === c ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {/* 날짜 */}
                  <input
                    type="date"
                    value={editState.date}
                    onChange={(e) => setEditState((s) => s && { ...s, date: e.target.value })}
                    className="mb-2 min-h-10 w-full rounded-xl border-2 border-neutral-300 px-3 text-base focus:border-blue-500 focus:outline-none"
                  />
                  {/* 메모 */}
                  <input
                    type="text"
                    value={editState.memo}
                    onChange={(e) => setEditState((s) => s && { ...s, memo: e.target.value })}
                    placeholder="메모 (선택)"
                    className="mb-3 min-h-10 w-full rounded-xl border-2 border-neutral-300 px-3 text-base focus:border-blue-500 focus:outline-none"
                  />
                  {/* 저장/취소 */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSave(tx.id)}
                      disabled={saving}
                      className="min-h-9 flex-1 rounded-xl bg-neutral-900 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {saving ? '저장 중...' : '저장'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="min-h-9 rounded-xl bg-neutral-100 px-4 text-sm font-semibold text-neutral-600"
                    >
                      취소
                    </button>
                  </div>
                </li>
              ) : (
                /* ---- 일반 표시 ---- */
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
                      onClick={() => startEdit(tx)}
                      className="min-h-9 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold text-neutral-600"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tx.id)}
                      className="min-h-9 rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold text-neutral-600"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default TransactionList
