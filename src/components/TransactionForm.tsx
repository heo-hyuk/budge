import { useState } from 'react'
import { addCustomCategory, getCategories } from '../lib/categories'
import { todayStr } from '../lib/format'
import type { Card, NewTransaction, TransactionType } from '../types'

interface Props {
  onSubmit: (tx: NewTransaction) => Promise<void>
  cards: Card[]
}

function TransactionForm({ onSubmit, cards }: Props) {
  const [type, setType]               = useState<TransactionType>('expense')
  const [categories, setCategories]   = useState(() => getCategories('expense'))
  const [category, setCategory]       = useState(categories[0])
  const [amount, setAmount]           = useState('')
  const [date, setDate]               = useState(todayStr())
  const [memo, setMemo]               = useState('')
  const [merchant, setMerchant]       = useState('')        // 구매처/판매처
  const [paymentMethod, setPaymentMethod] = useState('현금') // '현금' | 카드 id
  const [saving, setSaving]           = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  function handleTypeChange(next: TransactionType) {
    setType(next)
    const nextCats = getCategories(next)
    setCategories(nextCats)
    setCategory(nextCats[0])
    setAddingCategory(false)
  }

  function handleAddCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed) { setAddingCategory(false); return }
    const updated = addCustomCategory(type, trimmed)
    setCategories(updated)
    setCategory(trimmed)
    setNewCategory('')
    setAddingCategory(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numericAmount = Number(amount.replace(/[^0-9]/g, ''))
    if (!numericAmount || numericAmount <= 0) return

    const selectedCard = cards.find((c) => c.id === paymentMethod)

    setSaving(true)
    try {
      await onSubmit({
        type, category, amount: numericAmount, date,
        memo: memo.trim() || undefined,
        merchant: merchant.trim() || undefined,
        payment_method: selectedCard ? selectedCard.id : '현금',
        card_id: selectedCard ? selectedCard.id : undefined,
      })
      setAmount('')
      setMemo('')
      setMerchant('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-neutral-700">내역 추가</h2>

      {/* 수입/지출 토글 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(['expense', 'income'] as TransactionType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTypeChange(t)}
            className={`min-h-11 rounded-xl text-base font-bold transition-colors ${
              type === t
                ? t === 'expense' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {t === 'expense' ? '지출' : '수입'}
          </button>
        ))}
      </div>

      {/* 금액 */}
      <div className="mt-4">
        <label htmlFor="amount" className="block text-sm font-semibold text-neutral-700">금액</label>
        <div className="relative mt-1.5">
          <input
            id="amount"
            type="text"
            inputMode="numeric"
            required
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="min-h-11 w-full rounded-xl border-2 border-neutral-300 px-3 py-2 text-right text-lg font-bold text-neutral-900 focus:border-blue-500 focus:outline-none"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-neutral-400">원</span>
        </div>
      </div>

      {/* 구매처/판매처 */}
      <div className="mt-4">
        <label htmlFor="merchant" className="block text-sm font-semibold text-neutral-700">
          구매처 / 판매처 <span className="text-neutral-400 font-normal">(선택)</span>
        </label>
        <input
          id="merchant"
          type="text"
          placeholder="예: 스타벅스, 쿠팡"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-xl border-2 border-neutral-300 px-3 text-base text-neutral-900 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* 결제 방법 */}
      <div className="mt-4">
        <span className="block text-sm font-semibold text-neutral-700">결제 방법</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {/* 현금 버튼 */}
          <button
            type="button"
            onClick={() => setPaymentMethod('현금')}
            className={`min-h-9 rounded-full px-3 text-sm font-semibold ${
              paymentMethod === '현금' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            현금
          </button>
          {/* 등록된 카드 버튼 */}
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setPaymentMethod(card.id)}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                paymentMethod === card.id ? 'text-white' : 'text-neutral-600 bg-neutral-100'
              }`}
              style={paymentMethod === card.id ? { backgroundColor: card.color } : {}}
            >
              {card.name}
            </button>
          ))}
          {cards.length === 0 && (
            <p className="text-xs text-neutral-400 self-center">카드 관리에서 카드를 등록하면 선택할 수 있어요</p>
          )}
        </div>
      </div>

      {/* 분류 */}
      <div className="mt-4">
        <span className="block text-sm font-semibold text-neutral-700">분류</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold ${
                category === c ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {c}
            </button>
          ))}
          {!addingCategory && (
            <button
              type="button"
              onClick={() => setAddingCategory(true)}
              className="min-h-9 rounded-full border-2 border-dashed border-neutral-300 px-3 text-sm font-semibold text-neutral-500"
            >
              + 직접입력
            </button>
          )}
        </div>
        {addingCategory && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder="새 분류 이름"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() } }}
              className="min-h-9 flex-1 rounded-lg border-2 border-neutral-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="min-h-9 rounded-lg bg-neutral-900 px-3 text-sm font-semibold text-white"
            >
              추가
            </button>
          </div>
        )}
      </div>

      {/* 날짜 */}
      <div className="mt-4">
        <label htmlFor="date" className="block text-sm font-semibold text-neutral-700">날짜</label>
        <input
          id="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-xl border-2 border-neutral-300 px-3 text-base focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* 메모 */}
      <div className="mt-4">
        <label htmlFor="memo" className="block text-sm font-semibold text-neutral-700">
          메모 <span className="text-neutral-400 font-normal">(선택)</span>
        </label>
        <input
          id="memo"
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-xl border-2 border-neutral-300 px-3 text-base focus:border-blue-500 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-5 min-h-12 w-full rounded-xl bg-neutral-900 text-lg font-bold text-white disabled:opacity-50"
      >
        {saving ? '저장 중...' : '저장하기'}
      </button>
    </form>
  )
}

export default TransactionForm
