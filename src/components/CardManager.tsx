import { RotateCw } from 'lucide-react'
import { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import { useConfirm } from '../contexts/ConfirmContext'
import { useToast } from '../contexts/ToastContext'
import {
  createBenefit, createBenefitGroup, createCard, deleteBenefit, deleteCard,
  fetchBenefitGroups, fetchBenefits, fetchTransactions, updateBenefit, updateCard,
} from '../lib/api'
import { getCardBillingPeriod } from '../lib/billing'
import { CARD_BENEFIT_PRESETS, type CardPreset } from '../lib/cardBenefitPresets'
import { suggestClosingDay } from '../lib/cardDateUtils'
import { addCustomCategory, getCategories } from '../lib/categories'
import { formatWon, todayStr } from '../lib/format'
import type { BenefitGroup, Card, CardBenefit, NewBenefit, NewCard, RecurringTransaction, Transaction } from '../types'

const MONTH_BACK_LABELS = ['당월', '전월', '전전월', '전전전월']

/** 두 'YYYY-MM-DD' 사이의 개월 차이 (a가 b보다 몇 달 뒤인지) */
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (ay - by) * 12 + (am - bm)
}

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
  benefit_type: 'discount' | 'cashback'
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
  benefit_type: 'discount',
})

interface Props {
  cards: Card[]
  recurringItems: RecurringTransaction[]
  onRefresh: () => Promise<void>
}

function CardManager({ cards, recurringItems, onRefresh }: Props) {
  const { showToast } = useToast()
  const confirm = useConfirm()
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm]           = useState<CardFormState>(defaultForm)
  // "말일 마감·결제" 토글을 껐을 때 되돌아갈 직전 수동 입력값 — 켜기 직전 값을 기억해둠
  const [lastManualDays, setLastManualDays] = useState({ billing_day: defaultForm().billing_day, closing_day: defaultForm().closing_day })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null)
  const [presetId, setPresetId]   = useState('')  // 새 카드 등록 시 선택한 카드 프리셋 ('' = 직접 입력)
  const [imageLoadFailedIds, setImageLoadFailedIds] = useState<Set<string>>(new Set())  // 이미지 깨진 카드 → color 기반 비주얼로 폴백

  // 카드별 혜택 규칙 상태
  const [openBenefitCardId, setOpenBenefitCardId] = useState<string | null>(null)
  const [cardBenefits, setCardBenefits]           = useState<CardBenefit[]>([])
  const [benefitsLoading, setBenefitsLoading]     = useState(false)
  const [benefitsError, setBenefitsError]         = useState('')
  const [benefitForm, setBenefitForm]             = useState<BenefitFormState>(defaultBenefitForm)
  const [editingBenefitId, setEditingBenefitId]   = useState<string | null>(null)
  const [showBenefitForm, setShowBenefitForm]     = useState(false)
  const [savingBenefit, setSavingBenefit]         = useState(false)
  const [deletingBenefitId, setDeletingBenefitId] = useState<string | null>(null)
  const [togglingBenefitId, setTogglingBenefitId] = useState<string | null>(null)

  // 혜택 그룹(통합 한도) 상태 — 열린 카드의 그룹 정의 + 이번 달 그룹별 사용액 계산용 거래
  const [benefitGroups, setBenefitGroups] = useState<BenefitGroup[]>([])
  const [cardMonthTx, setCardMonthTx]     = useState<Transaction[]>([])

  const expenseCategories = getCategories('expense')

  // 혜택 목록 로드 (GET 실패는 토스트 대신 인라인 재시도)
  async function loadBenefits(cardId: string) {
    setBenefitsLoading(true)
    setBenefitsError('')
    try {
      const list = await fetchBenefits(cardId)
      setCardBenefits(list)
    } catch (err) {
      setBenefitsError(err instanceof Error ? err.message : '혜택 목록을 불러오지 못했습니다')
    } finally {
      setBenefitsLoading(false)
    }
  }

  // 혜택 그룹(통합 한도) + 이번 달 그룹 사용액 계산용 거래 로드 — 실패해도 개별 한도 표시엔
  // 지장 없으므로 조용히 빈 배열로 폴백
  async function loadBenefitGroups(cardId: string) {
    try {
      const [groups, tx] = await Promise.all([
        fetchBenefitGroups(cardId),
        fetchTransactions({ card_id: cardId, month: todayStr().slice(0, 7) }),
      ])
      setBenefitGroups(groups)
      setCardMonthTx(tx)
    } catch {
      setBenefitGroups([])
      setCardMonthTx([])
    }
  }

  // 그룹에 속한 혜택들의 이번 달 합산 사용액(할인+적립)
  function groupMonthlyUsed(groupId: string): number {
    const memberIds = new Set(cardBenefits.filter((b) => b.benefit_group_id === groupId).map((b) => b.id))
    return cardMonthTx
      .filter((t) => t.benefit_id && memberIds.has(t.benefit_id))
      .reduce((sum, t) => sum + t.discount_amount + t.cashback_amount, 0)
  }

  // 혜택 섹션 열기
  async function openBenefits(cardId: string) {
    if (openBenefitCardId === cardId) {
      setOpenBenefitCardId(null)
      return
    }
    setOpenBenefitCardId(cardId)
    setShowBenefitForm(false)
    setEditingBenefitId(null)
    await Promise.all([loadBenefits(cardId), loadBenefitGroups(cardId)])
  }

  // 혜택 목록 새로고침 (등록/수정/삭제 성공 후 호출)
  async function refreshBenefits(cardId: string) {
    await Promise.all([loadBenefits(cardId), loadBenefitGroups(cardId)])
  }

  // ── 카드 CRUD ──────────────────────────────────────

  function startAdd() {
    setEditingId(null)
    const initial = defaultForm()
    setForm(initial)
    setLastManualDays({ billing_day: initial.billing_day, closing_day: initial.closing_day })
    setPresetId('')
    setError('')
    setShowForm(true)
  }

  function startEdit(card: Card) {
    setEditingId(card.id)
    const legacyBenefits = JSON.parse(card.benefits || '[]') as string[]
    const billing_day = String(card.billing_day)
    const closing_day = String(card.closing_day)
    setForm({
      name: card.name,
      color: card.color,
      billing_day,
      closing_day,
      benefits: legacyBenefits.join('\n'),
    })
    // 이미 "말일 모드"(31/31)인 카드는 되돌아갈 수동값을 알 수 없어 기본 제안값으로 채워둠
    const isLastDay = card.billing_day === 31 && card.closing_day === 31
    setLastManualDays(isLastDay
      ? { billing_day: defaultForm().billing_day, closing_day: defaultForm().closing_day }
      : { billing_day, closing_day })
    setPresetId('')  // 카드 자체엔 저장된 프리셋 값이 없어 매번 "직접 입력"부터 시작 — 선택해야만 적용됨
    setError('')
    setShowForm(true)
  }

  // "말일 모드" 여부는 별도 필드가 아니라 결제일·마감일이 둘 다 31인지로 판단(파생 상태) —
  // billing.ts가 31을 항상 그 달 말일로 클램핑하므로 이 값만으로 완전히 표현 가능
  const isLastDayMode = form.billing_day === '31' && form.closing_day === '31'

  function toggleLastDayMode() {
    if (isLastDayMode) {
      setForm((f) => ({ ...f, billing_day: lastManualDays.billing_day, closing_day: lastManualDays.closing_day }))
    } else {
      setLastManualDays({ billing_day: form.billing_day, closing_day: form.closing_day })
      setForm((f) => ({ ...f, billing_day: '31', closing_day: '31' }))
    }
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setPresetId('')
    setError('')
  }

  // 프리셋 적용 — 그룹 먼저 생성 후 각 혜택을 등록, 필요한 커스텀 분류도 함께 등록해
  // TransactionForm에서 바로 선택할 수 있게 함
  async function applyPreset(cardId: string, preset: CardPreset) {
    const groupIdByName = new Map<string, string>()
    for (const g of preset.groups) {
      const id = await createBenefitGroup({ card_id: cardId, name: g.name, monthly_cap: g.monthly_cap })
      groupIdByName.set(g.name, id)
    }
    for (const b of preset.benefits) {
      if (b.category) await addCustomCategory('expense', b.category)
    }
    for (const b of preset.benefits) {
      await createBenefit({
        card_id: cardId,
        name: b.name,
        category: b.category,
        merchant_pattern: b.merchant_pattern,
        discount_type: b.discount_type,
        discount_value: b.discount_value,
        monthly_cap: b.monthly_cap,
        memo: b.memo,
        benefit_type: b.benefit_type,
        benefit_group_id: b.groupName ? groupIdByName.get(b.groupName) : undefined,
      })
    }
  }

  async function handleSave() {
    const billing_day = parseInt(form.billing_day)
    const closing_day = parseInt(form.closing_day)
    if (!form.name.trim() || isNaN(billing_day) || isNaN(closing_day)) return
    if (billing_day < 1 || billing_day > 31 || closing_day < 1 || closing_day > 31) {
      setError('결제일과 마감일은 1~31 사이로 입력해주세요')
      return
    }
    setError('')

    const benefits = JSON.stringify(
      form.benefits.split('\n').map((s) => s.trim()).filter(Boolean)
    )

    const preset = presetId ? CARD_BENEFIT_PRESETS.find((p) => p.id === presetId) : undefined

    const data: NewCard = {
      name: form.name.trim(),
      color: form.color,
      billing_day,
      closing_day,
      benefits,
      ...(preset ? { image_url: preset.imageUrl } : {}),
    }

    setSaving(true)
    try {
      let cardId: string
      if (editingId) {
        await updateCard(editingId, data)
        cardId = editingId
      } else {
        cardId = await createCard(data)
      }

      let presetApplied = false
      if (preset) {
        // 기존 카드는 이미 등록된 혜택 규칙이 있을 수 있어, 프리셋을 새로 추가하기 전에
        // 중복 등록될 수 있음을 한 번 확인시킴 (새 카드는 처음이라 확인 없이 바로 적용)
        const shouldApply = !editingId || (await confirm(
          `"${preset.label}" 프리셋의 혜택 규칙을 이 카드에 추가할까요?\n기존에 등록된 혜택 규칙은 그대로 유지되고 새로 추가됩니다.`
        ))
        if (shouldApply) {
          await applyPreset(cardId, preset)
          presetApplied = true
        }
      }

      await onRefresh()
      cancelForm()
      showToast(
        presetApplied && preset?.requiresPackageChoice
          ? '프리셋 혜택을 추가했습니다. 혜택 목록에서 매달 사용할 패키지 하나만 켜두세요'
          : presetApplied
          ? '프리셋 혜택을 추가했습니다'
          : editingId ? '카드를 수정했습니다' : '카드를 추가했습니다'
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : '카드를 저장하지 못했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    // 삭제 전 영향 범위(혜택 규칙 개수, 연결된 고정지출 개수)를 확인 문구에 포함
    // — 그냥 삭제하면 사용자가 모르는 사이 혜택 규칙이 통째로 사라질 수 있음
    const linkedBenefits = await fetchBenefits(id).catch(() => [] as CardBenefit[])
    const linkedRecurring = recurringItems.filter((r) => r.card_id === id)

    const warnings: string[] = ['해당 카드로 기록된 거래는 결제방법이 현금으로 변경됩니다.']
    if (linkedBenefits.length > 0) warnings.push(`이 카드에 연결된 혜택 규칙 ${linkedBenefits.length}개도 함께 삭제됩니다.`)
    if (linkedRecurring.length > 0) warnings.push(`이 카드로 등록된 고정지출 ${linkedRecurring.length}건은 결제수단이 현금으로 변경됩니다.`)

    if (!(await confirm(`"${name}" 카드를 삭제할까요?\n${warnings.join('\n')}`))) return
    setDeletingCardId(id)
    try {
      await deleteCard(id)
      await onRefresh()
      showToast('카드를 삭제했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '카드를 삭제하지 못했습니다', 'error')
    } finally {
      setDeletingCardId(null)
    }
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
      benefit_type: b.benefit_type,
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
      benefit_type: benefitForm.benefit_type,
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
      showToast(editingBenefitId ? '혜택을 수정했습니다' : '혜택을 추가했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '혜택을 저장하지 못했습니다', 'error')
    } finally {
      setSavingBenefit(false)
    }
  }

  async function handleDeleteBenefit(b: CardBenefit) {
    if (!(await confirm(`"${b.name}" 혜택을 삭제할까요?`))) return
    if (!openBenefitCardId) return
    setDeletingBenefitId(b.id)
    try {
      await deleteBenefit(b.id)
      await refreshBenefits(openBenefitCardId)
      showToast('혜택을 삭제했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '혜택을 삭제하지 못했습니다', 'error')
    } finally {
      setDeletingBenefitId(null)
    }
  }

  // 활성/비활성 토글 — taptap O처럼 "패키지 중 택1"인 카드에서 미선택 패키지를 끄는 용도
  async function handleToggleBenefitActive(b: CardBenefit) {
    if (!openBenefitCardId) return
    setTogglingBenefitId(b.id)
    try {
      await updateBenefit(b.id, { active: b.active ? 0 : 1 })
      await refreshBenefits(openBenefitCardId)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '혜택 상태를 변경하지 못했습니다', 'error')
    } finally {
      setTogglingBenefitId(null)
    }
  }

  // 혜택 규칙 한 줄 렌더링 — 그룹/개별 공통 사용
  function renderBenefitRow(b: CardBenefit) {
    const isInactive = b.active === 0
    return (
      <div
        key={b.id}
        className={`rounded-xl border px-3 py-2.5 flex items-start justify-between gap-2 ${
          isInactive ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 opacity-60' : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
        }`}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {b.name}
            {b.benefit_type === 'cashback' && (
              <span className="ml-1.5 rounded bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 align-middle">적립</span>
            )}
            {isInactive && (
              <span className="ml-1.5 rounded bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 align-middle">꺼짐</span>
            )}
          </p>
          <p className="text-xs text-coral-600 dark:text-coral-200 font-bold mt-0.5">
            {b.discount_type === 'percent'
              ? `${b.discount_value}% ${b.benefit_type === 'cashback' ? '적립' : '할인'}`
              : `${formatWon(b.discount_value)} ${b.benefit_type === 'cashback' ? '적립' : '정액 할인'}`}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            {b.category && <span className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">{b.category}</span>}
            {b.merchant_pattern && <span className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">"{b.merchant_pattern}" 포함</span>}
            {!b.category && !b.merchant_pattern && <span className="text-neutral-400 dark:text-neutral-500">전체 적용</span>}
            {!b.benefit_group_id && b.monthly_cap > 0 && <span>한도 {formatWon(b.monthly_cap)}/월</span>}
            {b.min_spend > 0 && <span>최소 {formatWon(b.min_spend)}</span>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => handleToggleBenefitActive(b)}
            disabled={togglingBenefitId === b.id}
            className={`min-h-7 whitespace-nowrap rounded-lg px-2 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1 ${
              isInactive ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700' : 'bg-coral-50 dark:bg-coral-900/30 text-coral-800 dark:text-coral-200 hover:bg-coral-100 dark:hover:bg-coral-900/50'
            }`}
          >
            {togglingBenefitId === b.id ? <LoadingSpinner size={12} /> : isInactive ? '켜기' : '사용중'}
          </button>
          <button
            type="button"
            onClick={() => startEditBenefit(b)}
            className="min-h-7 whitespace-nowrap rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            수정
          </button>
          <button
            type="button"
            onClick={() => handleDeleteBenefit(b)}
            disabled={deletingBenefitId === b.id}
            className="min-h-7 whitespace-nowrap rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2 text-xs font-semibold text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/40 disabled:opacity-50 flex items-center gap-1"
          >
            {deletingBenefitId === b.id ? <LoadingSpinner size={12} /> : '삭제'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">카드 관리</h2>
        <button
          type="button"
          onClick={startAdd}
          className="min-h-9 rounded-xl bg-coral-400 px-4 text-sm font-bold text-white transition-colors hover:bg-coral-600"
        >
          + 카드 추가
        </button>
      </div>

      {/* 카드 등록/수정 폼 */}
      {showForm && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm">
          <h3 className="text-base font-bold text-neutral-700 dark:text-neutral-300 mb-4">
            {editingId ? '카드 수정' : '새 카드 등록'}
          </h3>

          {/* 카드명 */}
          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">카드명</label>
          <input
            type="text"
            placeholder="예: 신한 Deep Dream"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mb-4 min-h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
          />

          {/* 카드 프리셋 — 새 카드 등록은 물론, 기존 카드 수정 중에도 나중에 선택해 혜택 규칙을
              추가할 수 있음 */}
          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">카드 상품 선택 (선택사항)</label>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="mb-2 min-h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-base text-neutral-900 dark:text-neutral-100 transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
          >
            <option value="">직접 입력</option>
            {CARD_BENEFIT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          {presetId && (
            <p className="mb-4 text-xs text-neutral-400 dark:text-neutral-500">
              저장하면 이 카드 상품의 혜택 규칙이 {editingId ? '추가로' : '자동으로'} 등록돼요.
              AI가 조사한 정보라 실제 카드 약관과 다를 수 있으니 등록 후 꼭 확인하세요
              {CARD_BENEFIT_PRESETS.find((p) => p.id === presetId)?.requiresPackageChoice &&
                ' — 이 카드는 매달 패키지 중 하나만 선택해 쓰는 방식이라, 등록 후 혜택 목록에서 사용할 패키지 하나만 켜두세요.'}
            </p>
          )}
          {!presetId && <div className="mb-4" />}

          {/* 색상 */}
          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">카드 색상</label>
          <div className="mb-4 flex gap-2 flex-wrap">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`h-8 w-8 rounded-full border-4 transition-colors ${form.color === c ? 'border-coral-400' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* 청구 기간 안내 */}
          <div className="mb-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1">청구 기간이란?</p>
            <p>마감일까지 사용한 금액이 결제일에 청구됩니다.</p>
            <p className="mt-1 text-blue-600 dark:text-blue-400">
              결제일이 마감일과 같거나 늦으면(예: 마감 14일·결제 25일) 같은 달에 마감→결제되고,
              결제일이 마감일보다 빠르면(예: 마감 25일·결제 14일) 마감 다음 달에 결제됩니다.
            </p>
          </div>

          {/* "말일 마감·결제" 토글 — 새 필드 없이 결제일/마감일을 둘 다 31로 저장하는 것으로 표현.
              billing.ts가 31을 항상 그 달의 실제 말일로 클램핑해서 계산해줌 */}
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
            <div>
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">매달 1일~말일 마감·말일 결제</p>
              <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                당월 1일부터 말일까지 사용한 금액을 그 달 말일에 결제하는 카드에 사용하세요
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isLastDayMode}
              aria-label="매달 1일~말일 마감·말일 결제"
              onClick={toggleLastDayMode}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isLastDayMode ? 'bg-coral-400' : 'bg-neutral-300 dark:bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isLastDayMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-1.5">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">결제일</label>
              <div className="relative">
                <input
                  type={isLastDayMode ? 'text' : 'number'}
                  min={1} max={31}
                  disabled={isLastDayMode}
                  value={isLastDayMode ? '말일' : form.billing_day}
                  onChange={(e) => {
                    const raw = e.target.value
                    const parsed = parseInt(raw, 10)
                    setForm((f) => ({
                      ...f,
                      billing_day: raw,
                      // 결제일을 바꿀 때마다 마감일을 다시 제안 (기존 수동 수정값이 있어도 그냥 덮어씀)
                      closing_day: raw && !isNaN(parsed) ? String(suggestClosingDay(parsed)) : f.closing_day,
                    }))
                  }}
                  className={`min-h-10 w-full rounded-xl border px-3 pr-8 text-base transition-colors ${
                    isLastDayMode
                      ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                      : 'border-neutral-300 dark:border-neutral-700 focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40'
                  }`}
                />
                {!isLastDayMode && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 dark:text-neutral-500">일</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">청구 마감일</label>
              <div className="relative">
                <input
                  type={isLastDayMode ? 'text' : 'number'}
                  min={1} max={31}
                  disabled={isLastDayMode}
                  value={isLastDayMode ? '말일' : form.closing_day}
                  onChange={(e) => setForm((f) => ({ ...f, closing_day: e.target.value }))}
                  className={`min-h-10 w-full rounded-xl border px-3 pr-8 text-base transition-colors ${
                    isLastDayMode
                      ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                      : 'border-neutral-300 dark:border-neutral-700 focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40'
                  }`}
                />
                {!isLastDayMode && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 dark:text-neutral-500">일</span>
                )}
              </div>
            </div>
          </div>
          <p className="mb-4 text-xs text-neutral-400 dark:text-neutral-500">
            마감일은 결제일 기준 자동 제안값이에요. 카드사 안내와 다르면 직접 수정하세요
          </p>

          {isLastDayMode ? (
            <div className="mb-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-3 text-sm text-neutral-600 dark:text-neutral-400">
              매달 <span className="font-bold text-neutral-900 dark:text-neutral-100">1일</span>부터{' '}
              <span className="font-bold text-neutral-900 dark:text-neutral-100">말일</span>까지 사용분이{' '}
              그 달 <span className="font-bold text-neutral-900 dark:text-neutral-100">말일</span>에 청구됩니다
            </div>
          ) : form.closing_day && form.billing_day && (() => {
            const closingDay = parseInt(form.closing_day)
            const billingDay = parseInt(form.billing_day)
            if (isNaN(closingDay) || isNaN(billingDay)) return null
            if (closingDay < 1 || closingDay > 31 || billingDay < 1 || billingDay > 31) return null

            // 실제 청구기간 계산(billing.ts)과 동일한 로직으로 미리보기를 만들어 화면 문구와
            // 실제 계산이 항상 일치하게 함 (마감일 31일처럼 "+1일"이 32일로 넘어가는 경우를
            // 직접 계산하면 놓치기 쉬움). 앵커 월은 항상 31일까지 있는 달을 써서
            // 말일 클램핑이 미리보기 숫자를 왜곡하지 않도록 함
            const { start, end, billingDate } = getCardBillingPeriod('2024-01', {
              id: '', name: '', color: '', billing_day: billingDay, closing_day: closingDay,
              benefits: '[]', image_url: null, created_at: '',
            })
            const endLabel   = MONTH_BACK_LABELS[monthsBetween(billingDate, end)]   ?? '이전월'
            const startLabel = MONTH_BACK_LABELS[monthsBetween(billingDate, start)] ?? '이전월'
            const endDay   = parseInt(end.split('-')[2], 10)
            const startDay = parseInt(start.split('-')[2], 10)

            return (
              <div className="mb-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-3 text-sm text-neutral-600 dark:text-neutral-400">
                매월 <span className="font-bold text-neutral-900 dark:text-neutral-100">{billingDay}일</span>에{' '}
                {startLabel} <span className="font-bold text-neutral-900 dark:text-neutral-100">{startDay}일</span>
                {' '}~{' '}
                {startLabel !== endLabel && `${endLabel} `}
                <span className="font-bold text-neutral-900 dark:text-neutral-100">{endDay}일</span> 사용분이 청구됩니다
              </div>
            )
          })()}

          {error && <p className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2">
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

      {/* 카드 목록 */}
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center shadow-sm">
          <p className="text-base text-neutral-500 dark:text-neutral-400">등록된 카드가 없습니다</p>
          <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">카드를 추가하면 결제방법으로 선택할 수 있어요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const isOpen = openBenefitCardId === card.id
            return (
              <div
                key={card.id}
                className="rounded-2xl border border-l-4 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden"
                style={{ borderLeftColor: card.color }}
              >
                {/* 카드 헤더 — 좁은 화면에서는 이름 줄과 버튼 줄을 분리해야 이름이
                    "테스..."처럼 과도하게 줄어들지 않음. sm 이상에서는 한 줄로 합침 */}
                <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* 카드 실물 썸네일 — 프리셋에서 이미지가 저장된 카드만 표시, 없거나
                        로드 실패 시 color 필드 기반 그라데이션 블록으로 폴백 */}
                    {card.image_url && !imageLoadFailedIds.has(card.id) ? (
                      <img
                        src={card.image_url}
                        alt={`${card.name} 카드 디자인`}
                        className="h-11 w-[70px] shrink-0 rounded-md object-cover shadow-sm"
                        onError={() => setImageLoadFailedIds((prev) => new Set(prev).add(card.id))}
                      />
                    ) : (
                      <div
                        className="h-11 w-[70px] shrink-0 rounded-md shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}99)` }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-neutral-900 dark:text-neutral-100">{card.name}</p>
                      <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                        {card.billing_day === 31 && card.closing_day === 31
                          ? '매달 1일~말일 마감 · 말일 결제'
                          : `마감 ${card.closing_day}일 · 결제 ${card.billing_day}일`}
                      </p>
                    </div>
                  </div>
                  {/* CJK 텍스트는 공백 없이도 글자 단위로 줄바꿈될 수 있어 좁은 화면에서
                      "혜/택"처럼 쪼개지는 걸 막기 위해 shrink-0 + whitespace-nowrap 필요 */}
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => openBenefits(card.id)}
                      className={`min-h-8 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${
                        isOpen ? 'bg-coral-50 dark:bg-coral-900/30 text-coral-800 dark:text-coral-200' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      혜택
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(card)}
                      className="min-h-8 whitespace-nowrap rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(card.id, card.name)}
                      disabled={deletingCardId === card.id}
                      className="min-h-8 whitespace-nowrap rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 text-sm font-semibold text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/40 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {deletingCardId === card.id ? <LoadingSpinner size={13} /> : '삭제'}
                    </button>
                  </div>
                </div>

                {/* 혜택 규칙 섹션 */}
                {isOpen && (
                  <div className="border-t border-neutral-100 dark:border-neutral-800 p-4 space-y-3 bg-neutral-50 dark:bg-neutral-950">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">혜택 규칙</p>
                      <button
                        type="button"
                        onClick={startAddBenefit}
                        className="min-h-7 rounded-lg bg-coral-400 px-3 text-xs font-bold text-white transition-colors hover:bg-coral-600"
                      >
                        + 규칙 추가
                      </button>
                    </div>

                    {/* 혜택 등록/수정 폼 */}
                    {showBenefitForm && (
                      <div className="rounded-xl border border-coral-200 dark:border-coral-900 bg-white dark:bg-neutral-900 p-4 space-y-3">
                        <h4 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                          {editingBenefitId ? '혜택 수정' : '새 혜택 규칙'}
                        </h4>

                        {/* 혜택 이름 */}
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">혜택 이름</label>
                          <input
                            type="text"
                            placeholder="예: 편의점 10% 할인"
                            value={benefitForm.name}
                            onChange={(e) => setBenefitForm((f) => ({ ...f, name: e.target.value }))}
                            className="min-h-9 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                          />
                        </div>

                        {/* 혜택 방식: 즉시 할인 vs 포인트/캐시 적립 */}
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">혜택 방식</label>
                          <div className="flex gap-1">
                            {(['discount', 'cashback'] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setBenefitForm((f) => ({ ...f, benefit_type: t }))}
                                className={`flex-1 min-h-9 rounded-lg text-xs font-semibold transition-colors ${
                                  benefitForm.benefit_type === t
                                    ? 'bg-coral-400 text-white'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                }`}
                              >
                                {t === 'discount' ? '즉시 할인' : '포인트/캐시 적립'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 할인 유형 + 값 */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">할인 유형</label>
                            <div className="flex gap-1">
                              {(['percent', 'fixed'] as const).map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setBenefitForm((f) => ({ ...f, discount_type: t }))}
                                  className={`flex-1 min-h-9 rounded-lg text-xs font-semibold transition-colors ${
                                    benefitForm.discount_type === t
                                      ? 'bg-coral-400 text-white'
                                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                  }`}
                                >
                                  {t === 'percent' ? '% 할인' : '정액 할인'}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                              {benefitForm.discount_type === 'percent' ? '할인율 (%)' : '할인액 (원)'}
                            </label>
                            <input
                              type="number"
                              min={0}
                              placeholder={benefitForm.discount_type === 'percent' ? '10' : '1000'}
                              value={benefitForm.discount_value}
                              onChange={(e) => setBenefitForm((f) => ({ ...f, discount_value: e.target.value }))}
                              className="min-h-9 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                            />
                          </div>
                        </div>

                        {/* 적용 분류 */}
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                            적용 분류 <span className="font-normal text-neutral-400 dark:text-neutral-500">(빈 값 = 전체)</span>
                          </label>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => setBenefitForm((f) => ({ ...f, category: '' }))}
                              className={`min-h-7 rounded-full px-2.5 text-xs font-semibold transition-colors ${
                                benefitForm.category === '' ? 'bg-coral-50 dark:bg-coral-900/30 text-coral-800 dark:text-coral-200' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                              }`}
                            >
                              전체
                            </button>
                            {expenseCategories.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setBenefitForm((f) => ({ ...f, category: c }))}
                                className={`min-h-7 rounded-full px-2.5 text-xs font-semibold transition-colors ${
                                  benefitForm.category === c ? 'bg-coral-50 dark:bg-coral-900/30 text-coral-800 dark:text-coral-200' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 구매처 키워드 */}
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                            구매처 키워드 <span className="font-normal text-neutral-400 dark:text-neutral-500">(빈 값 = 전체)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="예: 편의점, 스타벅스"
                            value={benefitForm.merchant_pattern}
                            onChange={(e) => setBenefitForm((f) => ({ ...f, merchant_pattern: e.target.value }))}
                            className="min-h-9 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                          />
                        </div>

                        {/* 월 한도 / 최소 결제 */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                              월 최대 할인 <span className="font-normal text-neutral-400 dark:text-neutral-500">(빈 값 = 무제한)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              placeholder="예: 5000"
                              value={benefitForm.monthly_cap}
                              onChange={(e) => setBenefitForm((f) => ({ ...f, monthly_cap: e.target.value }))}
                              className="min-h-9 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                              최소 결제 금액 <span className="font-normal text-neutral-400 dark:text-neutral-500">(빈 값 = 무조건)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              placeholder="예: 10000"
                              value={benefitForm.min_spend}
                              onChange={(e) => setBenefitForm((f) => ({ ...f, min_spend: e.target.value }))}
                              className="min-h-9 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleSaveBenefit}
                            disabled={savingBenefit}
                            className="min-h-9 flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600 disabled:opacity-50"
                          >
                            {savingBenefit ? <><LoadingSpinner size={14} /> 처리 중...</> : '저장'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelBenefitForm}
                            className="min-h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 혜택 규칙 목록 */}
                    {benefitsLoading && (
                      <p className="flex items-center justify-center gap-1.5 py-3 text-xs text-neutral-400 dark:text-neutral-500">
                        <LoadingSpinner size={13} /> 불러오는 중...
                      </p>
                    )}
                    {!benefitsLoading && benefitsError && (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2">
                        <p className="text-xs text-red-700 dark:text-red-400">{benefitsError}</p>
                        <button
                          type="button"
                          onClick={() => loadBenefits(card.id)}
                          className="shrink-0 flex items-center gap-1 rounded-md bg-white dark:bg-neutral-900 px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
                        >
                          <RotateCw size={12} /> 다시 시도
                        </button>
                      </div>
                    )}
                    {!benefitsLoading && !benefitsError && cardBenefits.length === 0 && !showBenefitForm && (
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-2">
                        등록된 혜택 규칙이 없습니다
                      </p>
                    )}
                    {!benefitsLoading && !benefitsError && (() => {
                      // 같은 benefit_group_id를 가진 항목들을 묶어서 표시 (그룹명+통합한도+이번달 사용액)
                      const grouped = new Map<string, CardBenefit[]>()
                      const ungrouped: CardBenefit[] = []
                      for (const b of cardBenefits) {
                        if (b.benefit_group_id) {
                          const arr = grouped.get(b.benefit_group_id) ?? []
                          arr.push(b)
                          grouped.set(b.benefit_group_id, arr)
                        } else {
                          ungrouped.push(b)
                        }
                      }
                      return (
                        <>
                          {[...grouped.entries()].map(([groupId, members]) => {
                            const group = benefitGroups.find((g) => g.id === groupId)
                            const used = groupMonthlyUsed(groupId)
                            return (
                              <div key={groupId} className="rounded-xl border border-coral-200 dark:border-coral-900 bg-coral-50/40 dark:bg-coral-900/20 p-2.5 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-1 px-1">
                                  <p className="text-xs font-bold text-coral-800 dark:text-coral-200">
                                    {group?.name ?? '혜택 그룹'} · 통합한도 {formatWon(group?.monthly_cap ?? 0)}/월
                                  </p>
                                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                                    이번 달 {formatWon(used)} 사용
                                  </p>
                                </div>
                                {members.map((b) => renderBenefitRow(b))}
                              </div>
                            )
                          })}
                          {ungrouped.map((b) => renderBenefitRow(b))}
                        </>
                      )
                    })()}
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
