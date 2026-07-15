import { useState } from 'react'
import { createBenefit, createCard, deleteBenefit, deleteCard, fetchBenefits, updateBenefit, updateCard } from '../lib/api'
import { getCategories } from '../lib/categories'
import { formatWon } from '../lib/format'
import type { Card, CardBenefit, NewBenefit, NewCard } from '../types'

// 카드 색상 프리셋
const COLOR_PRESETS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
]

interface CardFormState {
  name: string
  color: string
  billing_day: string
  closing_day: string
  benefits: string // 레거시 메모 텍스트 (삭제 예정)
}

const defaultForm = (): CardFormState => ({
  name: '',
  color: COLOR_PRESETS[0],
  billing_day: '25',
  closing_day: '14',
  benefits: '',
})

interface BenefitFormState {
  name: string
  category: string
  merchant_pattern: string
  discount_type: 'percent' | 'fixed'
  discount_value: string
  monthly_cap: string
  min_spend: string
  memo: string
}

const defaultBenefitForm = (): BenefitFormState => ({
  name: '',
  category: '',
  merchant_pattern: '',
  discount_type: 'percent',
  discount_value: '',
  monthly_cap: '',
  min_spend: '',
  memo: '',
})

interface Props {
  cards: Card[]
  onRefresh: () => Promise<void>
}

function CardManager({ cards, onRefresh }: Props) {
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm]           = useState<CardFormState>(defaultForm)
  const [saving, setSaving]       = useState(false)

  // 카드별 혜택 규칙 상태
  const [openBenefitCardId, setOpenBenefitCardId] = useState<string | null>(null)
  const [cardBenefits, setCardBenefits]           = useState<CardBenefit[]>([])
  const [benefitForm, setBenefitForm]             = useState<BenefitFormState>(defaultBenefitForm)
  const [editingBenefitId, setEditingBenefitId]   = useState<string | null>(null)
  const [showBenefitForm, setShowBenefitForm]     = useState(false)
  const [savingBenefit, setSavingBenefit]         = useState(false)

  const expenseCategories = getCategories('expense')

  // 혜택 섹션 열기
  async function openBenefits(cardId: string) {
    if (openBenefitCardId === cardId) {
      setOpenBenefitCardId(null)
      return
    }
    setOpenBenefitCardId(cardId)
    setShowBenefitForm(false)
    setEditingBenefitId(null)
    const list = await fetchBenefits(cardId)
    setCardBenefits(list)
  }

  // 혜택 목록 새로고침
  async function refreshBenefits(cardId: string) {
    const list = await fetchBenefits(cardId)
    setCardBenefits(list)
  }

  // ── 카드 CRUD ──────────────────────────────────────

  function startAdd() {
    setEditingId(null)
    setForm(defaultForm())
    setShowForm(true)
  }

  function startEdit(card: Card) {
    setEditingId(card.id)
    const legacyBenefits = JSON.parse(card.benefits || '[]') as string[]
    setForm({
      name: card.name,
      color: card.color,
      billing_day: String(card.billing_day),
      closing_day: String(card.closing_day),
      benefits: legacyBenefits.join('\n'),
    })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSave() {
    const billing_day = parseInt(form.billing_day)
    const closing_day = parseInt(form.closing_day)
    if (!form.name.trim() || isNaN(billing_day) || isNaN(closing_day)) return

    const benefits = JSON.stringify(
      form.benefits.split('\n').map((s) => s.trim()).filter(Boolean)
    )

    const data: NewCard = {
      name: form.name.trim(),
      color: form.color,
      billing_day,
      closing_day,
      benefits,
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateCard(editingId, data)
      } else {
        await createCard(data)
      }
      await onRefresh()
      cancelForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`"${name}" 카드를 삭제할까요?\n해당 카드로 기록된 거래는 결제방법이 현금으로 변경됩니다.`)) return
    await deleteCard(id)
    await onRefresh()
  }

  // ── 혜택 규칙 CRUD ──────────────────────────────────

  function startAddBenefit() {
    setEditingBenefitId(null)
    setBenefitForm(defaultBenefitForm())
    setShowBenefitForm(true)
  }

  function startEditBenefit(b: CardBenefit) {
    setEditingBenefitId(b.id)
    setBenefitForm({
      name: b.name,
      category: b.category,
      merchant_pattern: b.merchant_pattern,
      discount_type: b.discount_type,
      discount_value: String(b.discount_value),
      monthly_cap: b.monthly_cap > 0 ? String(b.monthly_cap) : '',
      min_spend: b.min_spend > 0 ? String(b.min_spend) : '',
      memo: b.memo,
    })
    setShowBenefitForm(true)
  }

  function cancelBenefitForm() {
    setShowBenefitForm(false)
    setEditingBenefitId(null)
  }

  async function handleSaveBenefit() {
    if (!openBenefitCardId) return
    const discountValue = parseFloat(benefitForm.discount_value)
    if (!benefitForm.name.trim() || isNaN(discountValue) || discountValue <= 0) return

    const payload: NewBenefit = {
      card_id: openBenefitCardId,
      name: benefitForm.name.trim(),
      category: benefitForm.category || undefined,
      merchant_pattern: benefitForm.merchant_pattern.trim() || undefined,
      discount_type: benefitForm.discount_type,
      discount_value: discountValue,
      monthly_cap: benefitForm.monthly_cap ? parseInt(benefitForm.monthly_cap) : undefined,
      min_spend: benefitForm.min_spend ? parseInt(benefitForm.min_spend) : undefined,
      memo: benefitForm.memo.trim() || undefined,
    }

    setSavingBenefit(true)
    try {
      if (editingBenefitId) {
        await updateBenefit(editingBenefitId, payload)
      } else {
        await createBenefit(payload)
      }
      await refreshBenefits(openBenefitCardId)
      cancelBenefitForm()
    } finally {
      setSavingBenefit(false)
    }
  }

  async function handleDeleteBenefit(b: CardBenefit) {
    if (!window.confirm(`"${b.name}" 혜택을 삭제할까요?`)) return
    if (!openBenefitCardId) return
    await deleteBenefit(b.id)
    await refreshBenefits(openBenefitCardId)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-800">카드 관리</h2>
        <button
          type="button"
          onClick={startAdd}
          className="min-h-9 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"
        >
          + 카드 추가
        </button>
      </div>

      {/* 카드 등록/수정 폼 */}
      {showForm && (
        <div className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-neutral-700 mb-4">
            {editingId ? '카드 수정' : '새 카드 등록'}
          </h3>

          {/* 카드명 */}
          <label className="block text-sm font-semibold text-neutral-700 mb-1">카드명</label>
          <input
            type="text"
            placeholder="예: 신한 Deep Dream"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mb-4 min-h-10 w-full rounded-xl border-2 border-neutral-300 px-3 text-base focus:border-blue-500 focus:outline-none"
          />

          {/* 색상 */}
          <label className="block text-sm font-semibold text-neutral-700 mb-2">카드 색상</label>
          <div className="mb-4 flex gap-2 flex-wrap">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`h-8 w-8 rounded-full border-4 ${form.color === c ? 'border-neutral-900' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* 청구 기간 안내 */}
          <div className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">청구 기간이란?</p>
            <p>마감일까지 사용한 금액이 결제일에 청구됩니다.</p>
            <p className="mt-1 text-blue-600">
              결제일이 마감일과 같거나 늦으면(예: 마감 14일·결제 25일) 같은 달에 마감→결제되고,
              결제일이 마감일보다 빠르면(예: 마감 25일·결제 14일) 마감 다음 달에 결제됩니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">청구 마감일</label>
              <div className="relative">
                <input
                  type="number"
                  min={1} max={31}
                  value={form.closing_day}
                  onChange={(e) => setForm((f) => ({ ...f, closing_day: e.target.value }))}
                  className="min-h-10 w-full rounded-xl border-2 border-neutral-300 px-3 pr-8 text-base focus:border-blue-500 focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">일</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">결제일</label>
              <div className="relative">
                <input
                  type="number"
                  min={1} max={31}
                  value={form.billing_day}
                  onChange={(e) => setForm((f) => ({ ...f, billing_day: e.target.value }))}
                  className="min-h-10 w-full rounded-xl border-2 border-neutral-300 px-3 pr-8 text-base focus:border-blue-500 focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">일</span>
              </div>
            </div>
          </div>

          {form.closing_day && form.billing_day && (() => {
            const closingDay = parseInt(form.closing_day)
            const billingDay = parseInt(form.billing_day)
            // 결제일이 마감일보다 빠르면 마감은 결제월 전월에 끝난다
            const sameMonth = billingDay >= closingDay
            return (
              <div className="mb-4 rounded-xl bg-neutral-100 p-3 text-sm text-neutral-600">
                매월 <span className="font-bold text-neutral-900">{billingDay}일</span>에{' '}
                {sameMonth ? '전월' : '전전월'} <span className="font-bold text-neutral-900">{closingDay + 1}일</span>
                {' '}~{' '}
                {sameMonth ? '당월' : '전월'} <span className="font-bold text-neutral-900">{closingDay}일</span> 사용분이 청구됩니다
              </div>
            )
          })()}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="min-h-10 flex-1 rounded-xl bg-neutral-900 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="min-h-10 rounded-xl bg-neutral-100 px-4 text-sm font-semibold text-neutral-600"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 카드 목록 */}
      {cards.length === 0 ? (
        <div className="rounded-2xl border-2 border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base text-neutral-500">등록된 카드가 없습니다</p>
          <p className="mt-1 text-sm text-neutral-400">카드를 추가하면 결제방법으로 선택할 수 있어요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const isOpen = openBenefitCardId === card.id
            return (
              <div key={card.id} className="rounded-2xl border-2 border-neutral-200 bg-white shadow-sm overflow-hidden">
                {/* 카드 헤더 */}
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-16 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: card.color }}
                    />
                    <div>
                      <p className="text-base font-bold text-neutral-900">{card.name}</p>
                      <p className="text-sm text-neutral-500">
                        마감 {card.closing_day}일 · 결제 {card.billing_day}일
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openBenefits(card.id)}
                      className={`min-h-8 rounded-lg px-3 text-sm font-semibold ${
                        isOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      혜택
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(card)}
                      className="min-h-8 rounded-lg bg-neutral-100 px-3 text-sm font-semibold text-neutral-600"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(card.id, card.name)}
                      className="min-h-8 rounded-lg bg-neutral-100 px-3 text-sm font-semibold text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {/* 혜택 규칙 섹션 */}
                {isOpen && (
                  <div className="border-t-2 border-neutral-100 p-4 space-y-3 bg-neutral-50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-neutral-700">혜택 규칙</p>
                      <button
                        type="button"
                        onClick={startAddBenefit}
                        className="min-h-7 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white"
                      >
                        + 규칙 추가
                      </button>
                    </div>

                    {/* 혜택 등록/수정 폼 */}
                    {showBenefitForm && (
                      <div className="rounded-xl border-2 border-indigo-200 bg-white p-4 space-y-3">
                        <h4 className="text-sm font-bold text-neutral-700">
                          {editingBenefitId ? '혜택 수정' : '새 혜택 규칙'}
                        </h4>

                        {/* 혜택 이름 */}
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 mb-1">혜택 이름</label>
                          <input
                            type="text"
                            placeholder="예: 편의점 10% 할인"
                            value={benefitForm.name}
                            onChange={(e) => setBenefitForm((f) => ({ ...f, name: e.target.value }))}
                            className="min-h-9 w-full rounded-lg border-2 border-neutral-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
                          />
                        </div>

                        {/* 할인 유형 + 값 */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1">할인 유형</label>
                            <div className="flex gap-1">
                              {(['percent', 'fixed'] as const).map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setBenefitForm((f) => ({ ...f, discount_type: t }))}
                                  className={`flex-1 min-h-9 rounded-lg text-xs font-semibold ${
                                    benefitForm.discount_type === t
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-neutral-100 text-neutral-600'
                                  }`}
                                >
                                  {t === 'percent' ? '% 할인' : '정액 할인'}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1">
                              {benefitForm.discount_type === 'percent' ? '할인율 (%)' : '할인액 (원)'}
                            </label>
                            <input
                              type="number"
                              min={0}
                              placeholder={benefitForm.discount_type === 'percent' ? '10' : '1000'}
                              value={benefitForm.discount_value}
                              onChange={(e) => setBenefitForm((f) => ({ ...f, discount_value: e.target.value }))}
                              className="min-h-9 w-full rounded-lg border-2 border-neutral-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* 적용 분류 */}
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 mb-1">
                            적용 분류 <span className="font-normal text-neutral-400">(빈 값 = 전체)</span>
                          </label>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => setBenefitForm((f) => ({ ...f, category: '' }))}
                              className={`min-h-7 rounded-full px-2.5 text-xs font-semibold ${
                                benefitForm.category === '' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
                              }`}
                            >
                              전체
                            </button>
                            {expenseCategories.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setBenefitForm((f) => ({ ...f, category: c }))}
                                className={`min-h-7 rounded-full px-2.5 text-xs font-semibold ${
                                  benefitForm.category === c ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 구매처 키워드 */}
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 mb-1">
                            구매처 키워드 <span className="font-normal text-neutral-400">(빈 값 = 전체)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="예: 편의점, 스타벅스"
                            value={benefitForm.merchant_pattern}
                            onChange={(e) => setBenefitForm((f) => ({ ...f, merchant_pattern: e.target.value }))}
                            className="min-h-9 w-full rounded-lg border-2 border-neutral-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
                          />
                        </div>

                        {/* 월 한도 / 최소 결제 */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1">
                              월 최대 할인 <span className="font-normal text-neutral-400">(빈 값 = 무제한)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              placeholder="예: 5000"
                              value={benefitForm.monthly_cap}
                              onChange={(e) => setBenefitForm((f) => ({ ...f, monthly_cap: e.target.value }))}
                              className="min-h-9 w-full rounded-lg border-2 border-neutral-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1">
                              최소 결제 금액 <span className="font-normal text-neutral-400">(빈 값 = 무조건)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              placeholder="예: 10000"
                              value={benefitForm.min_spend}
                              onChange={(e) => setBenefitForm((f) => ({ ...f, min_spend: e.target.value }))}
                              className="min-h-9 w-full rounded-lg border-2 border-neutral-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleSaveBenefit}
                            disabled={savingBenefit}
                            className="min-h-9 flex-1 rounded-lg bg-indigo-600 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {savingBenefit ? '저장 중...' : '저장'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelBenefitForm}
                            className="min-h-9 rounded-lg bg-neutral-100 px-3 text-sm font-semibold text-neutral-600"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 혜택 규칙 목록 */}
                    {cardBenefits.length === 0 && !showBenefitForm && (
                      <p className="text-xs text-neutral-400 text-center py-2">
                        등록된 혜택 규칙이 없습니다
                      </p>
                    )}
                    {cardBenefits.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-900">{b.name}</p>
                          <p className="text-xs text-indigo-700 font-bold mt-0.5">
                            {b.discount_type === 'percent'
                              ? `${b.discount_value}% 할인`
                              : `${formatWon(b.discount_value)} 정액 할인`}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-neutral-500">
                            {b.category && <span className="bg-neutral-100 px-1.5 py-0.5 rounded">{b.category}</span>}
                            {b.merchant_pattern && <span className="bg-neutral-100 px-1.5 py-0.5 rounded">"{b.merchant_pattern}" 포함</span>}
                            {!b.category && !b.merchant_pattern && <span className="text-neutral-400">전체 적용</span>}
                            {b.monthly_cap > 0 && <span>한도 {formatWon(b.monthly_cap)}/월</span>}
                            {b.min_spend > 0 && <span>최소 {formatWon(b.min_spend)}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditBenefit(b)}
                            className="min-h-7 rounded-lg bg-neutral-100 px-2 text-xs font-semibold text-neutral-600"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBenefit(b)}
                            className="min-h-7 rounded-lg bg-neutral-100 px-2 text-xs font-semibold text-red-600"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CardManager
