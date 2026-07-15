import { useState } from 'react'
import { getCategories } from '../lib/categories'
import { formatDateLabel, formatNumberInput, formatWon } from '../lib/format'
import type { Card, Transaction, TransactionType, UpdateTransaction } from '../types'

interface Props {
  transactions: Transaction[]
  cards: Card[]
  onDelete: (id: string) => void
  onUpdate: (id: string, data: UpdateTransaction) => Promise<void>
}

interface EditState {
  type: TransactionType
  category: string
  amount: string
  date: string
  memo: string
  merchant: string
  paymentMethod: string // '현금' | card.id
}

function TransactionList({ transactions, cards, onDelete, onUpdate }: Props) {
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editState, setEditState]   = useState<EditState | null>(null)
  const [saving, setSaving]         = useState(false)

  // 카드 ID → Card 매핑
  const cardMap = new Map(cards.map((c) => [c.id, c]))

  if (transactions.length === 0) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
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
      amount: formatNumberInput(String(tx.amount)),
      date: tx.date,
      memo: tx.memo ?? '',
      merchant: tx.merchant ?? '',
      paymentMethod: tx.card_id || '현금',
    })
  }

  function cancelEdit() { setEditingId(null); setEditState(null) }

  async function handleSave(id: string) {
    if (!editState) return
    const numericAmount = Number(editState.amount.replace(/[^0-9]/g, ''))
    if (!numericAmount || numericAmount <= 0) return
    const selectedCard = cards.find((c) => c.id === editState.paymentMethod)
    setSaving(true)
    try {
      await onUpdate(id, {
        type: editState.type,
        category: editState.category,
        amount: numericAmount,
        date: editState.date,
        memo: editState.memo.trim(),
        merchant: editState.merchant.trim(),
        payment_method: selectedCard ? selectedCard.id : '현금',
        card_id: selectedCard ? selectedCard.id : '',
      })
      setEditingId(null)
      setEditState(null)
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(id: string) {
    if (window.confirm('이 내역을 삭제할까요?')) onDelete(id)
  }

  return (
    <section className="space-y-4">
      {Array.from(groups.entries()).map(([date, items]) => (
        <div key={date} className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <h3 className="border-b border-neutral-100 px-4 py-2.5 text-sm font-bold text-neutral-500">
            {formatDateLabel(date)}
          </h3>
          <ul>
            {items.map((tx) =>
              editingId === tx.id && editState ? (
                /* ── 인라인 편집 폼 ── */
                <li key={tx.id} className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
                  {/* 수입/지출 */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {(['expense', 'income'] as TransactionType[]).map((t) => (
                      <button key={t} type="button"
                        onClick={() => {
                          const cats = getCategories(t)
                          setEditState((s) => s && { ...s, type: t, category: cats[0] })
                        }}
                        className={`min-h-9 rounded-xl text-sm font-bold transition-colors ${
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
                  <input type="text" inputMode="numeric"
                    value={editState.amount}
                    onChange={(e) => setEditState((s) => s && { ...s, amount: formatNumberInput(e.target.value) })}
                    className="mb-2 min-h-10 w-full rounded-xl border border-neutral-300 px-3 text-right text-base font-bold transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    placeholder="금액"
                  />
                  {/* 구매처 */}
                  <input type="text"
                    value={editState.merchant}
                    onChange={(e) => setEditState((s) => s && { ...s, merchant: e.target.value })}
                    placeholder="구매처 (선택)"
                    className="mb-2 min-h-10 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  {/* 결제방법 */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {['현금', ...cards.map((c) => c.id)].map((pm) => {
                      const card = pm !== '현금' ? cardMap.get(pm) : null
                      return (
                        <button key={pm} type="button"
                          onClick={() => setEditState((s) => s && { ...s, paymentMethod: pm })}
                          className={`min-h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
                            editState.paymentMethod === pm ? 'text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          }`}
                          style={editState.paymentMethod === pm ? { backgroundColor: card?.color ?? '#1f2937' } : {}}
                        >
                          {card ? card.name : '현금'}
                        </button>
                      )
                    })}
                  </div>
                  {/* 분류 */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {getCategories(editState.type).map((c) => (
                      <button key={c} type="button"
                        onClick={() => setEditState((s) => s && { ...s, category: c })}
                        className={`min-h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
                          editState.category === c ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {/* 날짜 */}
                  <input type="date"
                    value={editState.date}
                    onChange={(e) => setEditState((s) => s && { ...s, date: e.target.value })}
                    className="mb-2 min-h-10 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  {/* 메모 */}
                  <input type="text"
                    value={editState.memo}
                    onChange={(e) => setEditState((s) => s && { ...s, memo: e.target.value })}
                    placeholder="메모 (선택)"
                    className="mb-3 min-h-10 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleSave(tx.id)} disabled={saving}
                      className="min-h-9 flex-1 rounded-xl bg-brand-600 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                    >
                      {saving ? '저장 중...' : '저장'}
                    </button>
                    <button type="button" onClick={cancelEdit}
                      className="min-h-9 rounded-xl bg-neutral-100 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-200"
                    >
                      취소
                    </button>
                  </div>
                </li>
              ) : (
                /* ── 일반 표시 ── */
                <li key={tx.id}
                  className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-neutral-900">
                      {tx.merchant || tx.category}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {tx.merchant && (
                        <span className="text-sm text-neutral-500">{tx.category}</span>
                      )}
                      {/* 결제방법 뱃지 */}
                      {tx.card_id && cardMap.get(tx.card_id) ? (
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: cardMap.get(tx.card_id)!.color }}
                        >
                          {cardMap.get(tx.card_id)!.name}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-500">
                          현금
                        </span>
                      )}
                      {tx.memo && (
                        <span className="truncate text-sm text-neutral-400">{tx.memo}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`whitespace-nowrap text-base font-bold ${tx.type === 'income' ? 'text-blue-700' : 'text-red-700'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatWon(tx.amount)}
                    </span>
                    <button type="button" onClick={() => startEdit(tx)}
                      className="min-h-9 whitespace-nowrap rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-200"
                    >
                      수정
                    </button>
                    <button type="button" onClick={() => handleDelete(tx.id)}
                      className="min-h-9 whitespace-nowrap rounded-lg bg-neutral-100 px-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600"
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
