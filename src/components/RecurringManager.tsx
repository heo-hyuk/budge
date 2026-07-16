import { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import { useToast } from '../contexts/ToastContext'
import { getCategories } from '../lib/categories'
import { createRecurring, deleteRecurring, updateRecurring } from '../lib/api'
import { formatNumberInput, formatWon } from '../lib/format'
import type { Card, NewRecurring, RecurringTransaction, TransactionType } from '../types'

interface Props {
  items: RecurringTransaction[]
  cards: Card[]
  onRefresh: () => Promise<void>
}

interface FormState {
  name: string
  type: TransactionType
  category: string
  amount: string
  merchant: string
  payment_method: string  // '현금' | card.id
  day_of_month: string
  start_date: string
  end_date: string
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const defaultForm = (): FormState => ({
  name: '',
  type: 'expense',
  category: getCategories('expense')[0],
  amount: '',
  merchant: '',
  payment_method: '현금',
  day_of_month: '1',
  start_date: todayStr().slice(0, 7) + '-01',
  end_date: '',
})

function RecurringManager({ items, cards, onRefresh }: Props) {
  const { showToast } = useToast()
  const [showForm, setShowForm]     = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [form, setForm]             = useState<FormState>(defaultForm)
  const [saving, setSaving]         = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const cardMap = new Map(cards.map((c) => [c.id, c]))

  function startAdd() {
    setEditingId(null)
    setForm(defaultForm())
    setShowForm(true)
  }

  function startEdit(item: RecurringTransaction) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      type: item.type,
      category: item.category,
      amount: formatNumberInput(String(item.amount)),
      merchant: item.merchant ?? '',
      payment_method: item.card_id || '현금',
      day_of_month: String(item.day_of_month),
      start_date: item.start_date,
      end_date: item.end_date ?? '',
    })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
  }

  function handleTypeChange(type: TransactionType) {
    setForm((f) => ({
      ...f,
      type,
      category: getCategories(type)[0],
    }))
  }

  async function handleSave() {
    const amount = Number(form.amount.replace(/[^0-9]/g, ''))
    const day    = parseInt(form.day_of_month)
    if (!form.name.trim() || !amount || isNaN(day) || day < 1 || day > 31 || !form.start_date) return

    const selectedCard = cards.find((c) => c.id === form.payment_method)
    const payload: NewRecurring = {
      name: form.name.trim(),
      type: form.type,
      category: form.category,
      amount,
      merchant: form.merchant.trim() || undefined,
      payment_method: selectedCard ? selectedCard.id : '현금',
      card_id: selectedCard ? selectedCard.id : undefined,
      day_of_month: day,
      start_date: form.start_date,
      end_date: form.end_date.trim() || undefined,
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateRecurring(editingId, payload)
      } else {
        await createRecurring(payload)
      }
      await onRefresh()
      cancelForm()
      showToast(editingId ? '고정항목을 수정했습니다' : '고정항목을 추가했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '고정항목을 저장하지 못했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(item: RecurringTransaction) {
    setTogglingId(item.id)
    try {
      await updateRecurring(item.id, { active: item.active === 1 ? 0 : 1 })
      await onRefresh()
      showToast(item.active === 1 ? '비활성화했습니다' : '활성화했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '상태를 변경하지 못했습니다', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`"${name}" 고정항목을 삭제할까요?\n이미 생성된 거래 내역은 유지됩니다.`)) return
    setDeletingId(id)
    try {
      await deleteRecurring(id)
      await onRefresh()
      showToast('고정항목을 삭제했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '고정항목을 삭제하지 못했습니다', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const categories = getCategories(form.type)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-800">고정 수입/지출</h2>
        <button
          type="button"
          onClick={startAdd}
          className="min-h-9 rounded-xl bg-coral-400 px-4 text-sm font-bold text-white transition-colors hover:bg-coral-600"
        >
          + 항목 추가
        </button>
      </div>

      {/* 등록/수정 폼 */}
      {showForm && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-neutral-700">
            {editingId ? '고정항목 수정' : '새 고정항목 등록'}
          </h3>

          {/* 항목명 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">항목명</label>
            <input
              type="text"
              placeholder="예: 넷플릭스, 월세, 보험료"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="min-h-10 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
            />
          </div>

          {/* 수입/지출 */}
          <div className="grid grid-cols-2 gap-2">
            {(['expense', 'income'] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`min-h-10 rounded-xl text-sm font-bold transition-colors ${
                  form.type === t
                    ? t === 'expense' ? 'bg-coral-400 text-white' : 'bg-blue-600 text-white'
                    : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>

          {/* 금액 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">금액</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: formatNumberInput(e.target.value) }))}
                className="min-h-10 w-full rounded-xl border border-neutral-300 px-3 pr-8 text-right text-base font-bold transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">원</span>
            </div>
          </div>

          {/* 분류 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">분류</label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: c }))}
                  className={`min-h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
                    form.category === c ? 'bg-coral-50 text-coral-800' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 구매처 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">
              구매처 <span className="font-normal text-neutral-400">(선택)</span>
            </label>
            <input
              type="text"
              placeholder="예: 넷플릭스"
              value={form.merchant}
              onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
              className="min-h-10 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
            />
          </div>

          {/* 결제 방법 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">결제 방법</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, payment_method: '현금' }))}
                className={`min-h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
                  form.payment_method === '현금' ? 'bg-coral-400 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                현금
              </button>
              {cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, payment_method: card.id }))}
                  className={`min-h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
                    form.payment_method === card.id ? 'text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                  style={form.payment_method === card.id ? { backgroundColor: card.color } : {}}
                >
                  {card.name}
                </button>
              ))}
            </div>
          </div>

          {/* 매월 며칠 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">매월 며칠</label>
            <div className="relative w-28">
              <input
                type="number"
                min={1}
                max={31}
                value={form.day_of_month}
                onChange={(e) => setForm((f) => ({ ...f, day_of_month: e.target.value }))}
                className="min-h-10 w-full rounded-xl border border-neutral-300 px-3 pr-7 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">일</span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">31일 등 해당 월에 없는 날짜는 그 달의 말일로 자동 보정됩니다</p>
          </div>

          {/* 시작일 / 종료일 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">시작일</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="min-h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                종료일 <span className="font-normal text-neutral-400">(선택)</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="min-h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="min-h-10 flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600 disabled:opacity-50"
            >
              {saving ? <><LoadingSpinner size={14} /> 처리 중...</> : '저장'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="min-h-10 rounded-xl bg-neutral-100 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-200"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base text-neutral-500">등록된 고정항목이 없습니다</p>
          <p className="mt-1 text-sm text-neutral-400">월세, 구독료, 급여 등을 등록하면 매달 자동으로 기록됩니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const card = item.card_id ? cardMap.get(item.card_id) : null
            const isActive = item.active === 1

            return (
              <div
                key={item.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm transition-opacity ${
                  isActive ? 'border-neutral-200' : 'border-neutral-100 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-bold text-neutral-900">{item.name}</p>
                      {/* 활성/비활성 뱃지 */}
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        {isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                    <p className={`text-base font-bold mt-0.5 ${item.type === 'income' ? 'text-blue-700' : 'text-coral-600'}`}>
                      {item.type === 'income' ? '+' : '-'}{formatWon(item.amount)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-neutral-500">
                      <span>매월 {item.day_of_month}일</span>
                      <span>·</span>
                      <span>{item.category}</span>
                      {card && (
                        <>
                          <span>·</span>
                          <span
                            className="font-semibold px-1.5 py-0.5 rounded text-white text-xs"
                            style={{ backgroundColor: card.color }}
                          >
                            {card.name}
                          </span>
                        </>
                      )}
                      {item.end_date && (
                        <>
                          <span>·</span>
                          <span>~{item.end_date}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    {/* 활성/비활성 토글 */}
                    <button
                      type="button"
                      onClick={() => handleToggle(item)}
                      disabled={togglingId === item.id}
                      className={`min-h-8 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 ${
                        isActive
                          ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {togglingId === item.id ? <LoadingSpinner size={12} /> : (isActive ? '비활성화' : '활성화')}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="min-h-8 whitespace-nowrap rounded-lg bg-neutral-100 px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-200"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.name)}
                      disabled={deletingId === item.id}
                      className="min-h-8 whitespace-nowrap rounded-lg bg-neutral-100 px-2.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {deletingId === item.id ? <LoadingSpinner size={12} /> : '삭제'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default RecurringManager
