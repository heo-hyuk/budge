import { useState } from 'react'
import { createCard, deleteCard, updateCard } from '../lib/api'
import type { Card, NewCard } from '../types'

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
  benefits: string // 줄바꿈으로 구분된 텍스트
}

const defaultForm = (): CardFormState => ({
  name: '',
  color: COLOR_PRESETS[0],
  billing_day: '25',
  closing_day: '14',
  benefits: '',
})

interface Props {
  cards: Card[]
  onRefresh: () => Promise<void>
}

function CardManager({ cards, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CardFormState>(defaultForm)
  const [saving, setSaving] = useState(false)

  function startAdd() {
    setEditingId(null)
    setForm(defaultForm())
    setShowForm(true)
  }

  function startEdit(card: Card) {
    setEditingId(card.id)
    const benefits = JSON.parse(card.benefits || '[]') as string[]
    setForm({
      name: card.name,
      color: card.color,
      billing_day: String(card.billing_day),
      closing_day: String(card.closing_day),
      benefits: benefits.join('\n'),
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

          {/* 청구 기간 설명 */}
          <div className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">청구 기간이란?</p>
            <p>마감일까지 사용한 금액이 다음달 결제일에 청구됩니다.</p>
            <p className="mt-1 text-blue-600">예) 마감일 14일 → 전월 15일~당월 14일 사용분</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                청구 마감일
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.closing_day}
                  onChange={(e) => setForm((f) => ({ ...f, closing_day: e.target.value }))}
                  className="min-h-10 w-full rounded-xl border-2 border-neutral-300 px-3 pr-8 text-base focus:border-blue-500 focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">일</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                결제일
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.billing_day}
                  onChange={(e) => setForm((f) => ({ ...f, billing_day: e.target.value }))}
                  className="min-h-10 w-full rounded-xl border-2 border-neutral-300 px-3 pr-8 text-base focus:border-blue-500 focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">일</span>
              </div>
            </div>
          </div>

          {/* 미리보기 */}
          {form.closing_day && form.billing_day && (
            <div className="mb-4 rounded-xl bg-neutral-100 p-3 text-sm text-neutral-600">
              매월 <span className="font-bold text-neutral-900">{form.billing_day}일</span>에{' '}
              전월 <span className="font-bold text-neutral-900">{parseInt(form.closing_day) + 1}일</span>
              {' '}~{' '}
              당월 <span className="font-bold text-neutral-900">{form.closing_day}일</span> 사용분이 청구됩니다
            </div>
          )}

          {/* 혜택 */}
          <label className="block text-sm font-semibold text-neutral-700 mb-1">
            카드 혜택 (한 줄에 하나씩)
          </label>
          <textarea
            rows={3}
            placeholder={"예:\n편의점 5% 할인\n대중교통 10% 적립\n해외 결제 수수료 면제"}
            value={form.benefits}
            onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value }))}
            className="mb-4 w-full rounded-xl border-2 border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

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
            const benefits = JSON.parse(card.benefits || '[]') as string[]
            return (
              <div
                key={card.id}
                className="rounded-2xl border-2 border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* 카드 색상 표시 */}
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
                {/* 혜택 목록 */}
                {benefits.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-neutral-600">
                        <span className="mt-0.5 text-neutral-400">•</span>
                        {b}
                      </li>
                    ))}
                  </ul>
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
