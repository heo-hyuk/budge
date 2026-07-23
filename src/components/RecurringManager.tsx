import { Settings2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import ReorderableChipList from './ReorderableChipList'
import { useConfirm } from '../contexts/ConfirmContext'
import { useToast } from '../contexts/ToastContext'
import { addCustomCategory, getCategories, loadCategories, removeCategory, reorderCategories } from '../lib/categories'
import { createRecurring, deleteRecurring, updateRecurring } from '../lib/api'
import { formatNumberInput, formatWon } from '../lib/format'
import { addMerchant, getMerchants, loadMerchants, removeMerchant, reorderMerchants } from '../lib/merchants'
import { addPaymentMethod, getPaymentMethods, loadPaymentMethods, removePaymentMethod, reorderPaymentMethods } from '../lib/paymentMethods'
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
  const confirm = useConfirm()
  const [showForm, setShowForm]     = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [form, setForm]             = useState<FormState>(defaultForm)
  const typeRef = useRef(form.type)
  typeRef.current = form.type
  const [saving, setSaving]         = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 분류 관리 목록(칩) — TransactionForm.tsx와 동일한 패턴(자세한 설명은 그쪽 주석 참고)
  const [categories, setCategories]   = useState(() => getCategories('expense'))
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [manageCategories, setManageCategories] = useState(false)

  // 구매처 관리 목록(칩)
  const [merchantList, setMerchantList] = useState(() => getMerchants())
  const [addingMerchant, setAddingMerchant] = useState(false)
  const [newMerchant, setNewMerchant] = useState('')
  const [manageMerchants, setManageMerchants] = useState(false)

  // 결제 방법 관리 목록(칩)
  const [paymentMethods, setPaymentMethods] = useState(() => getPaymentMethods('expense'))
  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false)
  const [newPaymentMethod, setNewPaymentMethod] = useState('')
  const [managePaymentMethods, setManagePaymentMethods] = useState(false)

  // 마운트 시점엔 서버 분류/구매처/결제방법 오버라이드가 아직 로드되기 전이라
  // 기본값뿐일 수 있음 — 로드가 끝나면 최신 목록으로 재동기화(TransactionForm과 동일 이유)
  useEffect(() => {
    loadCategories().then(() => setCategories(getCategories(typeRef.current)))
    loadMerchants().then(() => setMerchantList(getMerchants()))
    loadPaymentMethods().then(() => setPaymentMethods(getPaymentMethods(typeRef.current)))
  }, [])

  const cardMap = new Map(cards.map((c) => [c.id, c]))

  function resetChipUiState() {
    setAddingCategory(false)
    setManageCategories(false)
    setAddingMerchant(false)
    setManageMerchants(false)
    setAddingPaymentMethod(false)
    setManagePaymentMethods(false)
  }

  function startAdd() {
    setEditingId(null)
    setForm(defaultForm())
    setCategories(getCategories('expense'))
    setPaymentMethods(getPaymentMethods('expense'))
    resetChipUiState()
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
      payment_method: item.card_id || item.payment_method || '현금',
      day_of_month: String(item.day_of_month),
      start_date: item.start_date,
      end_date: item.end_date ?? '',
    })
    setCategories(getCategories(item.type))
    setPaymentMethods(getPaymentMethods(item.type))
    resetChipUiState()
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
  }

  function handleTypeChange(type: TransactionType) {
    const nextCats = getCategories(type)
    const nextPm   = getPaymentMethods(type)
    setForm((f) => ({
      ...f,
      type,
      category: nextCats[0],
      payment_method: nextPm[0],
      // 수입엔 구매처 개념이 없어(TransactionForm과 동일 원칙) 전환 시 비움
      merchant: type === 'income' ? '' : f.merchant,
    }))
    setCategories(nextCats)
    setPaymentMethods(nextPm)
    resetChipUiState()
  }

  async function handleAddCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed) { setAddingCategory(false); return }
    setAddingCategory(false)
    try {
      const updated = await addCustomCategory(form.type, trimmed)
      setCategories(updated)
      setForm((f) => ({ ...f, category: trimmed }))
      setNewCategory('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '분류를 추가하지 못했습니다', 'error')
    }
  }

  async function handleDeleteCategory(name: string) {
    if (!(await confirm(`"${name}" 분류를 삭제할까요? 이미 이 분류로 저장된 거래는 그대로 남습니다.`))) return
    try {
      const updated = await removeCategory(form.type, name)
      setCategories(updated)
      setForm((f) => (f.category === name ? { ...f, category: updated[0] ?? '' } : f))
    } catch (err) {
      showToast(err instanceof Error ? err.message : '분류를 삭제하지 못했습니다', 'error')
    }
  }

  async function handleReorderCategories(order: string[]) {
    try {
      setCategories(await reorderCategories(form.type, order))
    } catch (err) {
      showToast(err instanceof Error ? err.message : '순서를 변경하지 못했습니다', 'error')
    }
  }

  async function handleAddMerchant() {
    const trimmed = newMerchant.trim()
    if (!trimmed) { setAddingMerchant(false); return }
    setAddingMerchant(false)
    try {
      const updated = await addMerchant(trimmed)
      setMerchantList(updated)
      setForm((f) => ({ ...f, merchant: trimmed }))
      setNewMerchant('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '구매처를 추가하지 못했습니다', 'error')
    }
  }

  async function handleDeleteMerchant(name: string) {
    if (!(await confirm(`"${name}" 구매처를 삭제할까요? 이미 이 구매처로 저장된 거래는 그대로 남습니다.`))) return
    try {
      const updated = await removeMerchant(name)
      setMerchantList(updated)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '구매처를 삭제하지 못했습니다', 'error')
    }
  }

  async function handleReorderMerchants(order: string[]) {
    try {
      setMerchantList(await reorderMerchants(order))
    } catch (err) {
      showToast(err instanceof Error ? err.message : '순서를 변경하지 못했습니다', 'error')
    }
  }

  async function handleAddPaymentMethod() {
    const trimmed = newPaymentMethod.trim()
    if (!trimmed) { setAddingPaymentMethod(false); return }
    setAddingPaymentMethod(false)
    try {
      const updated = await addPaymentMethod(form.type, trimmed)
      setPaymentMethods(updated)
      setForm((f) => ({ ...f, payment_method: trimmed }))
      setNewPaymentMethod('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '결제 방법을 추가하지 못했습니다', 'error')
    }
  }

  async function handleDeletePaymentMethod(name: string) {
    if (!(await confirm(`"${name}" 결제 방법을 삭제할까요? 이미 이 결제 방법으로 저장된 거래는 그대로 남습니다.`))) return
    try {
      const updated = await removePaymentMethod(form.type, name)
      setPaymentMethods(updated)
      setForm((f) => (f.payment_method === name ? { ...f, payment_method: updated[0] ?? '' } : f))
    } catch (err) {
      showToast(err instanceof Error ? err.message : '결제 방법을 삭제하지 못했습니다', 'error')
    }
  }

  async function handleReorderPaymentMethods(order: string[]) {
    try {
      setPaymentMethods(await reorderPaymentMethods(form.type, order))
    } catch (err) {
      showToast(err instanceof Error ? err.message : '순서를 변경하지 못했습니다', 'error')
    }
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
      payment_method: selectedCard ? selectedCard.id : form.payment_method,
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
    if (!(await confirm(`"${name}" 고정항목을 삭제할까요?\n이미 생성된 거래 내역은 유지됩니다.`))) return
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">고정 수입/지출</h2>
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
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-neutral-700 dark:text-neutral-300">
            {editingId ? '고정항목 수정' : '새 고정항목 등록'}
          </h3>

          {/* 항목명 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">항목명</label>
            <input
              type="text"
              placeholder="예: 넷플릭스, 월세, 보험료"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="min-h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
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
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>

          {/* 금액 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">금액</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: formatNumberInput(e.target.value) }))}
                className="min-h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 pr-8 text-right text-base font-bold transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 dark:text-neutral-500">원</span>
            </div>
          </div>

          {/* 분류 — TransactionForm.tsx와 동일한 관리 패턴(+ 직접입력/삭제/드래그 재정렬) */}
          <div>
            <div className="flex items-center mb-1">
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">분류</label>
              <button
                type="button"
                onClick={() => setManageCategories((m) => !m)}
                aria-label={manageCategories ? '분류 삭제 모드 종료' : '분류 삭제'}
                className={`ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                  manageCategories ? 'bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-300'
                }`}
              >
                <Settings2 size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ReorderableChipList
                items={categories}
                draggable={manageCategories}
                onReorder={handleReorderCategories}
                onTap={(c) => {
                  if (manageCategories) { handleDeleteCategory(c); return }
                  setForm((f) => ({ ...f, category: c }))
                }}
                renderChip={(c, dragging) => (
                  <div className="relative">
                    <div
                      className={`inline-flex min-h-8 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors ${manageCategories ? 'pr-7' : ''} ${
                        form.category === c && !manageCategories ? 'bg-coral-50 dark:bg-coral-900/30 text-coral-800 dark:text-coral-200' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      } ${dragging ? 'shadow-lg' : ''}`}
                    >
                      {c}
                    </div>
                    {manageCategories && (
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-red-500 dark:text-red-400">
                        <X size={12} />
                      </span>
                    )}
                  </div>
                )}
              />
              {!addingCategory && !manageCategories && (
                <button
                  type="button"
                  onClick={() => setAddingCategory(true)}
                  className="min-h-8 rounded-full border-2 border-dashed border-neutral-300 dark:border-neutral-700 px-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400 transition-colors hover:border-coral-200 dark:hover:border-coral-900 hover:text-coral-400 dark:hover:text-coral-300"
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
                  className="min-h-9 flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="min-h-9 rounded-lg bg-coral-400 px-3 text-sm font-semibold text-white transition-colors hover:bg-coral-600"
                >
                  추가
                </button>
              </div>
            )}
          </div>

          {/* 구매처 — 지출에만 필요(TransactionForm과 동일 원칙), 관리 패턴도 동일 */}
          {form.type === 'expense' && (
            <div>
              <div className="flex items-center mb-1">
                <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  구매처 <span className="font-normal text-neutral-400 dark:text-neutral-500">(선택)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setManageMerchants((m) => !m)}
                  aria-label={manageMerchants ? '구매처 삭제 모드 종료' : '구매처 삭제'}
                  className={`ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                    manageMerchants ? 'bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-300'
                  }`}
                >
                  <Settings2 size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <ReorderableChipList
                  items={merchantList}
                  draggable={manageMerchants}
                  onReorder={handleReorderMerchants}
                  onTap={(m) => {
                    if (manageMerchants) { handleDeleteMerchant(m); return }
                    setForm((f) => ({ ...f, merchant: m }))
                  }}
                  renderChip={(m, dragging) => (
                    <div className="relative">
                      <div
                        className={`inline-flex min-h-8 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors ${manageMerchants ? 'pr-7' : ''} ${
                          form.merchant === m && !manageMerchants ? 'bg-coral-50 dark:bg-coral-900/30 text-coral-800 dark:text-coral-200' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        } ${dragging ? 'shadow-lg' : ''}`}
                      >
                        {m}
                      </div>
                      {manageMerchants && (
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-red-500 dark:text-red-400">
                          <X size={12} />
                        </span>
                      )}
                    </div>
                  )}
                />
                {!addingMerchant && !manageMerchants && (
                  <button
                    type="button"
                    onClick={() => setAddingMerchant(true)}
                    className="min-h-8 rounded-full border-2 border-dashed border-neutral-300 dark:border-neutral-700 px-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400 transition-colors hover:border-coral-200 dark:hover:border-coral-900 hover:text-coral-400 dark:hover:text-coral-300"
                  >
                    + 직접입력
                  </button>
                )}
              </div>
              {addingMerchant && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="새 구매처 이름"
                    value={newMerchant}
                    onChange={(e) => setNewMerchant(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMerchant() } }}
                    className="min-h-9 flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                  />
                  <button
                    type="button"
                    onClick={handleAddMerchant}
                    className="min-h-9 rounded-lg bg-coral-400 px-3 text-sm font-semibold text-white transition-colors hover:bg-coral-600"
                  >
                    추가
                  </button>
                </div>
              )}
              <input
                type="text"
                placeholder="예: 넷플릭스"
                value={form.merchant}
                onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
                className="mt-2 min-h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
              />
            </div>
          )}

          {/* 결제 방법 — TransactionForm.tsx와 동일한 관리 패턴, 등록된 카드는 지출일 때만 이어붙임 */}
          <div>
            <div className="flex items-center mb-1">
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">결제 방법</label>
              <button
                type="button"
                onClick={() => setManagePaymentMethods((m) => !m)}
                aria-label={managePaymentMethods ? '결제 방법 삭제 모드 종료' : '결제 방법 삭제'}
                className={`ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                  managePaymentMethods ? 'bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-300'
                }`}
              >
                <Settings2 size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ReorderableChipList
                items={paymentMethods}
                draggable={managePaymentMethods}
                onReorder={handleReorderPaymentMethods}
                onTap={(pm) => {
                  if (managePaymentMethods) { handleDeletePaymentMethod(pm); return }
                  setForm((f) => ({ ...f, payment_method: pm }))
                }}
                renderChip={(pm, dragging) => (
                  <div className="relative">
                    <div
                      className={`inline-flex min-h-8 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors ${managePaymentMethods ? 'pr-7' : ''} ${
                        form.payment_method === pm && !managePaymentMethods ? 'bg-coral-400 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      } ${dragging ? 'shadow-lg' : ''}`}
                    >
                      {pm}
                    </div>
                    {managePaymentMethods && (
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-red-500 dark:text-red-400">
                        <X size={12} />
                      </span>
                    )}
                  </div>
                )}
              />
              {!addingPaymentMethod && !managePaymentMethods && (
                <button
                  type="button"
                  onClick={() => setAddingPaymentMethod(true)}
                  className="min-h-8 rounded-full border-2 border-dashed border-neutral-300 dark:border-neutral-700 px-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400 transition-colors hover:border-coral-200 dark:hover:border-coral-900 hover:text-coral-400 dark:hover:text-coral-300"
                >
                  + 직접입력
                </button>
              )}
              {form.type === 'expense' && !managePaymentMethods && cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, payment_method: card.id }))}
                  className={`min-h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
                    form.payment_method === card.id ? 'text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                  style={form.payment_method === card.id ? { backgroundColor: card.color } : {}}
                >
                  {card.name}
                </button>
              ))}
            </div>
            {addingPaymentMethod && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="새 결제 방법 이름"
                  value={newPaymentMethod}
                  onChange={(e) => setNewPaymentMethod(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPaymentMethod() } }}
                  className="min-h-9 flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                />
                <button
                  type="button"
                  onClick={handleAddPaymentMethod}
                  className="min-h-9 rounded-lg bg-coral-400 px-3 text-sm font-semibold text-white transition-colors hover:bg-coral-600"
                >
                  추가
                </button>
              </div>
            )}
          </div>

          {/* 매월 며칠 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">매월 며칠</label>
            <div className="relative w-28">
              <input
                type="number"
                min={1}
                max={31}
                value={form.day_of_month}
                onChange={(e) => setForm((f) => ({ ...f, day_of_month: e.target.value }))}
                className="min-h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 pr-7 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 dark:text-neutral-500">일</span>
            </div>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">31일 등 해당 월에 없는 날짜는 그 달의 말일로 자동 보정됩니다</p>
          </div>

          {/* 시작일 / 종료일 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">시작일</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="min-h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                종료일 <span className="font-normal text-neutral-400 dark:text-neutral-500">(선택)</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="min-h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
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
              className="min-h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-4 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center shadow-sm">
          <p className="text-base text-neutral-500 dark:text-neutral-400">등록된 고정항목이 없습니다</p>
          <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">월세, 구독료, 급여 등을 등록하면 매달 자동으로 기록됩니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const card = item.card_id ? cardMap.get(item.card_id) : null
            const isActive = item.active === 1

            return (
              <div
                key={item.id}
                className={`rounded-xl border bg-white dark:bg-neutral-900 p-4 shadow-sm transition-opacity ${
                  isActive ? 'border-neutral-200 dark:border-neutral-800' : 'border-neutral-100 dark:border-neutral-800 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-bold text-neutral-900 dark:text-neutral-100">{item.name}</p>
                      {/* 활성/비활성 뱃지 */}
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500'
                      }`}>
                        {isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                    <p className={`text-base font-bold mt-0.5 ${item.type === 'income' ? 'text-blue-700 dark:text-blue-300' : 'text-coral-600 dark:text-coral-200'}`}>
                      {item.type === 'income' ? '+' : '-'}{formatWon(item.amount)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>매월 {item.day_of_month}일</span>
                      <span>·</span>
                      <span>{item.category}</span>
                      <span>·</span>
                      {card ? (
                        <span
                          className="font-semibold px-1.5 py-0.5 rounded text-white text-xs"
                          style={{ backgroundColor: card.color }}
                        >
                          {card.name}
                        </span>
                      ) : (
                        <span className="font-semibold px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 text-xs">
                          {item.payment_method || '현금'}
                        </span>
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
                          ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                          : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/60'
                      }`}
                    >
                      {togglingId === item.id ? <LoadingSpinner size={12} /> : (isActive ? '비활성화' : '활성화')}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="min-h-8 whitespace-nowrap rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.name)}
                      disabled={deletingId === item.id}
                      className="min-h-8 whitespace-nowrap rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-xs font-semibold text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/40 disabled:opacity-50 flex items-center justify-center gap-1"
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
