import { useState } from 'react'
import { addCustomCategory, getCategories } from '../lib/categories'
import { todayStr } from '../lib/format'
import type { NewTransaction, TransactionType } from '../types'

interface Props {
  onSubmit: (tx: NewTransaction) => Promise<void>
}

function TransactionForm({ onSubmit }: Props) {
  const [type, setType] = useState<TransactionType>('expense')
  const [categories, setCategories] = useState(() => getCategories('expense'))
  const [category, setCategory] = useState(categories[0])
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  function handleTypeChange(next: TransactionType) {
    setType(next)
    const nextCategories = getCategories(next)
    setCategories(nextCategories)
    setCategory(nextCategories[0])
    setAddingCategory(false)
  }

  function handleAddCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed) {
      setAddingCategory(false)
      return
    }
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

    setSaving(true)
    try {
      await onSubmit({ type, category, amount: numericAmount, date, memo: memo.trim() || undefined })
      setAmount('')
      setMemo('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-neutral-700">내역 추가</h2>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleTypeChange('expense')}
          className={`min-h-11 rounded-xl text-base font-bold transition-colors ${
            type === 'expense' ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          지출
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange('income')}
          className={`min-h-11 rounded-xl text-base font-bold transition-colors ${
            type === 'income' ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          수입
        </button>
      </div>

      <div className="mt-4">
        <label htmlFor="amount" className="block text-sm font-semibold text-neutral-700">
          금액
        </label>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddCategory()
                }
              }}
              className="min-h-9 flex-1 rounded-lg border-2 border-neutral-300 px-3 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none"
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

      <div className="mt-4">
        <label htmlFor="date" className="block text-sm font-semibold text-neutral-700">
          날짜
        </label>
        <input
          id="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-xl border-2 border-neutral-300 px-3 text-base text-neutral-900 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="memo" className="block text-sm font-semibold text-neutral-700">
          메모 (선택)
        </label>
        <input
          id="memo"
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-xl border-2 border-neutral-300 px-3 text-base text-neutral-900 focus:border-blue-500 focus:outline-none"
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
