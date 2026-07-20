import { ChevronDown, ChevronUp, Settings2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import UiCard from './ui/Card'
import { useConfirm } from '../contexts/ConfirmContext'
import { useToast } from '../contexts/ToastContext'
import { createTemplate, deleteTemplate, fetchRecentMerchants, fetchTemplates, matchBenefit, updateTemplate } from '../lib/api'
import { addCustomCategory, DEFAULT_CATEGORIES, getCategories, loadCategories, removeCategory, reorderCustomCategories } from '../lib/categories'
import { formatNumberInput, formatWon, parseAmountInput, todayStr } from '../lib/format'
import { migrateLegacyLocalStorage } from '../lib/legacyMigration'
import { addMerchant, getMerchants, loadMerchants, removeMerchant, reorderMerchants } from '../lib/merchants'
import type { BenefitMatch, BudgetStatus, Card, NewTransaction, QuickTemplate, RecentMerchant, TransactionType, UpdateTransaction } from '../types'

export interface TransactionPrefill {
  type: TransactionType
  category: string
  amount: number | null  // null = 금액 미지정 템플릿(금액 필드는 비워두고 포커스만 이동)
  merchant: string
  paymentMethod: string  // '현금' | '계좌이체' | card.id
  memo: string
  date: string  // 복제/템플릿 적용 시엔 무시되고 오늘로 재설정되지만, 수정 모드에선 원래 날짜를 유지하는 데 사용
  unsettled?: boolean  // 비정산 거래 여부(가족 비용 확인용 — 정산/예산/잔액/내보내기에서 제외)
}

interface Props {
  onSubmit: (tx: NewTransaction) => Promise<void>
  cards: Card[]
  budgetStatuses?: BudgetStatus[]  // 현재 월 예산 현황 (홈에서 주입)
  duplicateFrom?: { data: TransactionPrefill; nonce: number } | null  // 거래 목록에서 "복제" 클릭 시 주입
  onDuplicateApplied?: () => void
  onUpdateSubmit?: (id: string, data: UpdateTransaction) => Promise<void>  // 수정 모드 저장 (한눈에 보기에서 항목 탭 시)
  editTarget?: { id: string; data: TransactionPrefill; nonce: number } | null
  onEditApplied?: () => void
}

function TransactionForm({
  onSubmit, cards, budgetStatuses = [], duplicateFrom, onDuplicateApplied,
  onUpdateSubmit, editTarget, onEditApplied,
}: Props) {
  const { showToast } = useToast()
  const confirm = useConfirm()
  const [type, setType]               = useState<TransactionType>('expense')
  const typeRef = useRef(type)
  typeRef.current = type
  const [categories, setCategories]   = useState(() => getCategories('expense'))
  const [category, setCategory]       = useState(categories[0])
  const [categoryManuallySet, setCategoryManuallySet] = useState(false)
  const [amount, setAmount]           = useState('')
  const amountInputRef = useRef<HTMLInputElement>(null)
  const [date, setDate]               = useState(todayStr())
  const [memo, setMemo]               = useState('')
  const [merchant, setMerchant]       = useState('')
  const [paymentMethod, setPaymentMethod] = useState('현금')
  const [unsettled, setUnsettled]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [manageCategories, setManageCategories] = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)  // 있으면 수정 모드(생성 대신 onUpdateSubmit 호출)

  // 혜택 매칭 상태
  const [matches, setMatches]         = useState<BenefitMatch[]>([])
  const [selectedMatch, setSelectedMatch] = useState<BenefitMatch | null>(null)
  const [matchLoading, setMatchLoading]   = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 최근 구매처 자동완성 상태
  const [recentMerchants, setRecentMerchants] = useState<RecentMerchant[]>([])
  const [merchantSuggestOpen, setMerchantSuggestOpen] = useState(false)

  // 구매처 관리 목록(칩) 상태 — 분류와 동일한 패턴, 자동완성과는 별개
  const [merchantList, setMerchantList] = useState(() => getMerchants())
  const [addingMerchant, setAddingMerchant] = useState(false)
  const [newMerchant, setNewMerchant] = useState('')
  const [manageMerchants, setManageMerchants] = useState(false)

  // 빠른 입력 템플릿 상태
  const [templates, setTemplates] = useState<QuickTemplate[]>([])
  const [manageTemplates, setManageTemplates] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateLabel, setTemplateLabel] = useState('')
  const [saveTemplateAmount, setSaveTemplateAmount] = useState(true)  // 해제 시 금액은 저장하지 않고 매번 입력
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateBusyId, setTemplateBusyId] = useState<string | null>(null)

  useEffect(() => {
    fetchRecentMerchants().then(setRecentMerchants).catch(() => {})
    fetchTemplates().then(setTemplates).catch(() => {})
  }, [])

  // 마운트 시점엔 서버 분류 오버라이드가 아직 로드되기 전이라 categories 초기값이
  // 기본 분류뿐일 수 있음 — 로드가 끝나면 최신 목록으로 재동기화
  useEffect(() => {
    migrateLegacyLocalStorage().then(loadCategories).then(() => {
      const next = getCategories(typeRef.current)
      setCategories(next)
      setCategory((c) => (next.includes(c) ? c : next[0]))
    })
  }, [])

  // 구매처 관리 목록도 분류와 동일하게 마운트 시점엔 비어있을 수 있어 로드 후 재동기화
  useEffect(() => {
    loadMerchants().then(() => setMerchantList(getMerchants()))
  }, [])

  // 폼 전체를 한번에 채우는 공통 로직 — 거래 복제 / 템플릿 적용 둘 다 이걸 씀
  function applyPrefill(data: TransactionPrefill) {
    setType(data.type)
    const nextCats = getCategories(data.type)
    setCategories(nextCats)
    setCategory(nextCats.includes(data.category) ? data.category : nextCats[0])
    setCategoryManuallySet(true)  // 자동완성이 채워진 분류를 덮어쓰지 않도록
    setAmount(data.amount != null ? formatNumberInput(String(data.amount), data.type === 'income') : '')
    setMerchant(data.merchant)
    setPaymentMethod(data.paymentMethod)
    setUnsettled(data.unsettled ?? false)
    setMemo(data.memo)
    setDate(todayStr())
    setAddingCategory(false)
    setManageCategories(false)
  }

  // 거래 복제 — App.tsx가 nonce를 바꿔가며 주입
  useEffect(() => {
    if (!duplicateFrom) return
    applyPrefill(duplicateFrom.data)
    onDuplicateApplied?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateFrom?.nonce])

  // 거래 수정 — 한눈에 보기(일일/주간 정산)에서 항목 탭 시 App.tsx가 nonce를 바꿔가며 주입.
  // 복제와 달리 날짜는 오늘로 재설정하지 않고 원래 거래 날짜를 유지해야 하므로 applyPrefill을
  // 그대로 쓰지 않고 date까지 별도로 채움
  useEffect(() => {
    if (!editTarget) return
    applyPrefill(editTarget.data)
    setDate(editTarget.data.date)
    setEditingId(editTarget.id)
    onEditApplied?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget?.nonce])

  function cancelEditMode() {
    setEditingId(null)
    setAmount('')
    setMemo('')
    setMerchant('')
    setUnsettled(false)
    setMatches([])
    setSelectedMatch(null)
    setDate(todayStr())
  }

  function applyTemplate(t: QuickTemplate) {
    applyPrefill({
      type: t.type,
      category: t.category,
      amount: t.amount,
      merchant: t.merchant,
      paymentMethod: t.card_id || t.payment_method || '현금',
      memo: t.memo,
      date: todayStr(),
    })
    // 금액 미지정 템플릿 — 나머지는 자동으로 채우고 금액만 바로 입력하게 포커스 이동
    if (t.amount == null) {
      amountInputRef.current?.focus()
    }
  }

  async function handleSaveAsTemplate() {
    const numericAmount = parseAmountInput(amount)
    const label = templateLabel.trim()
    if (!label) return
    // 금액도 저장하는 경우에만 금액이 필수 — 금액 제외 저장은 나머지 필드만으로도 저장 가능
    if (saveTemplateAmount && !numericAmount) return
    const selectedCard = cards.find((c) => c.id === paymentMethod)
    setSavingTemplate(true)
    try {
      await createTemplate({
        label, type, category,
        amount: saveTemplateAmount ? numericAmount : null,
        merchant: merchant.trim() || undefined,
        payment_method: selectedCard ? selectedCard.id : paymentMethod,
        card_id: selectedCard ? selectedCard.id : undefined,
        memo: memo.trim() || undefined,
      })
      setTemplates(await fetchTemplates())
      setTemplateLabel('')
      setShowSaveTemplate(false)
      setSaveTemplateAmount(true)
      showToast('템플릿으로 저장했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '템플릿을 저장하지 못했습니다', 'error')
    } finally {
      setSavingTemplate(false)
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!(await confirm('이 템플릿을 삭제할까요?'))) return
    setTemplateBusyId(id)
    try {
      await deleteTemplate(id)
      setTemplates(await fetchTemplates())
    } catch (err) {
      showToast(err instanceof Error ? err.message : '템플릿을 삭제하지 못했습니다', 'error')
    } finally {
      setTemplateBusyId(null)
    }
  }

  async function handleMoveTemplate(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= templates.length) return
    const a = templates[index]
    const b = templates[target]
    setTemplateBusyId(a.id)
    try {
      await Promise.all([
        updateTemplate(a.id, { sort_order: b.sort_order }),
        updateTemplate(b.id, { sort_order: a.sort_order }),
      ])
      setTemplates(await fetchTemplates())
    } catch (err) {
      showToast(err instanceof Error ? err.message : '순서를 변경하지 못했습니다', 'error')
    } finally {
      setTemplateBusyId(null)
    }
  }

  function handleTypeChange(next: TransactionType) {
    setType(next)
    const nextCats = getCategories(next)
    setCategories(nextCats)
    setCategory(nextCats[0])
    setCategoryManuallySet(false)
    setAddingCategory(false)
    setManageCategories(false)
    // 지출로 바꾸면 음수 입력이 불가하므로 남아있던 '-' 부호 제거
    if (next === 'expense') {
      setAmount((a) => a.replace(/^-/, ''))
    }
    // 수입으로 바꾸면 혜택 초기화
    if (next === 'income') {
      setMatches([])
      setSelectedMatch(null)
    }
  }

  async function handleAddCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed) { setAddingCategory(false); return }
    setAddingCategory(false)
    try {
      const updated = await addCustomCategory(type, trimmed)
      setCategories(updated)
      setCategory(trimmed)
      setCategoryManuallySet(true)
      setNewCategory('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '분류를 추가하지 못했습니다', 'error')
    }
  }

  async function handleDeleteCategory(name: string) {
    if (!(await confirm(`"${name}" 분류를 삭제할까요? 이미 이 분류로 저장된 거래는 그대로 남습니다.`))) return
    try {
      const updated = await removeCategory(type, name)
      setCategories(updated)
      if (category === name) setCategory(updated[0] ?? '')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '분류를 삭제하지 못했습니다', 'error')
    }
  }

  // 커스텀 분류끼리만 순서 변경(기본 분류는 항상 앞에 고정이라 대상에서 제외)
  async function handleMoveCategory(name: string, direction: -1 | 1) {
    const customOnly = categories.filter((c) => !DEFAULT_CATEGORIES[type].includes(c))
    const idx = customOnly.indexOf(name)
    const targetIdx = idx + direction
    if (idx === -1 || targetIdx < 0 || targetIdx >= customOnly.length) return
    const reordered = [...customOnly]
    ;[reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]]
    try {
      setCategories(await reorderCustomCategories(type, reordered))
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
      setMerchant(trimmed)
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

  async function handleMoveMerchant(name: string, direction: -1 | 1) {
    const idx = merchantList.indexOf(name)
    const targetIdx = idx + direction
    if (idx === -1 || targetIdx < 0 || targetIdx >= merchantList.length) return
    const reordered = [...merchantList]
    ;[reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]]
    try {
      setMerchantList(await reorderMerchants(reordered))
    } catch (err) {
      showToast(err instanceof Error ? err.message : '순서를 변경하지 못했습니다', 'error')
    }
  }

  // 구매처 입력값과 겹치는 최근 구매처 제안 (최대 5개)
  const merchantSuggestions = merchantSuggestOpen && merchant.trim()
    ? recentMerchants
        .filter((m) => m.merchant.toLowerCase().includes(merchant.trim().toLowerCase()) && m.merchant !== merchant)
        .slice(0, 5)
    : []

  function selectMerchantSuggestion(m: RecentMerchant) {
    setMerchant(m.merchant)
    setMerchantSuggestOpen(false)
    // 분류를 사용자가 이미 직접 고르지 않았을 때만 대표 분류로 자동 채움
    if (!categoryManuallySet && m.category && categories.includes(m.category)) {
      setCategory(m.category)
    }
  }

  // 결제방법·구매처·분류·금액 변경 시 혜택 매칭 (debounce 400ms)
  // 수정 모드에서는 건드리지 않음 — UpdateTransaction에 할인/적립 필드가 없어 반영할 곳이 없고,
  // TransactionList의 인라인 수정도 혜택을 재계산하지 않아 일관성 유지
  useEffect(() => {
    if (editingId) return
    if (type !== 'expense') return
    // paymentMethod가 카드 ID일 때만 혜택 매칭 대상 — '현금'/'계좌이체' 같은 비카드 값은 제외
    const cardId = cards.some((c) => c.id === paymentMethod) ? paymentMethod : ''
    const numericAmount = Number(amount.replace(/[^0-9]/g, ''))

    // 카드 미선택이거나 금액 없으면 초기화
    if (!cardId || numericAmount <= 0) {
      setMatches([])
      setSelectedMatch(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setMatchLoading(true)
      try {
        const month = date.slice(0, 7)
        const result = await matchBenefit({
          card_id: cardId,
          merchant: merchant.trim(),
          category,
          amount: numericAmount,
          month,
        })
        setMatches(result)
        // 1개면 자동 선택, 여러 개면 초기화
        if (result.length === 1) {
          setSelectedMatch(result[0])
        } else {
          setSelectedMatch(null)
        }
      } catch {
        // 오류 시 조용히 무시
      } finally {
        setMatchLoading(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [paymentMethod, merchant, category, amount, date, type, editingId, cards])

  // 혜택 적용 취소
  function dismissBenefit() {
    setSelectedMatch(null)
    setMatches([])
  }

  function resetAfterSave() {
    setAmount('')
    setMemo('')
    setMerchant('')
    setUnsettled(false)
    setMatches([])
    setSelectedMatch(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numericAmount = parseAmountInput(amount)
    // 지출은 항상 양수, 수입은 차감(음수) 항목을 허용 — 0/NaN은 어느 쪽이든 무효
    if (!numericAmount) return
    if (type === 'expense' && numericAmount < 0) return

    const selectedCard = cards.find((c) => c.id === paymentMethod)

    // 수정 모드 — 혜택 재계산 없이 필드 그대로 업데이트 (TransactionList 인라인 수정과 동일한 방식)
    if (editingId) {
      setSaving(true)
      try {
        await onUpdateSubmit?.(editingId, {
          type, category, amount: numericAmount, date,
          memo: memo.trim(),
          merchant: merchant.trim(),
          payment_method: selectedCard ? selectedCard.id : paymentMethod,
          card_id: selectedCard ? selectedCard.id : '',
          unsettled,
        })
        setEditingId(null)
        resetAfterSave()
        setDate(todayStr())
        showToast('거래를 수정했습니다')
      } catch (err) {
        showToast(err instanceof Error ? err.message : '거래를 수정하지 못했습니다', 'error')
      } finally {
        setSaving(false)
      }
      return
    }

    // cashback 혜택은 결제액을 깎지 않고 적립 예정액만 정보로 기록 — discount만 실결제액에서 차감
    const isCashback = selectedMatch?.benefit_type === 'cashback'
    const discountAmount = selectedMatch && !isCashback ? selectedMatch.estimated_discount : 0
    const cashbackAmount = selectedMatch && isCashback ? selectedMatch.estimated_discount : 0
    const finalAmount = numericAmount - discountAmount

    setSaving(true)
    try {
      await onSubmit({
        type, category, amount: finalAmount, date,
        memo: memo.trim() || undefined,
        merchant: merchant.trim() || undefined,
        payment_method: selectedCard ? selectedCard.id : paymentMethod,
        card_id: selectedCard ? selectedCard.id : undefined,
        original_amount: discountAmount > 0 ? numericAmount : undefined,
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
        benefit_id: selectedMatch ? selectedMatch.benefit.id : undefined,
        cashback_amount: cashbackAmount > 0 ? cashbackAmount : undefined,
        unsettled,
      })
      resetAfterSave()
      showToast('거래를 저장했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '거래를 저장하지 못했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  const numericAmount = parseAmountInput(amount)
  // 커스텀 분류끼리만 순서 변경 가능(기본 분류는 항상 앞에 고정) — 위/아래 버튼 활성/비활성 판단용
  const customCategories = categories.filter((c) => !DEFAULT_CATEGORIES[type].includes(c))

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-neutral-700 dark:text-neutral-300">{editingId ? '거래 수정' : '내역 추가'}</h2>
        {editingId && (
          <button
            type="button"
            onClick={cancelEditMode}
            className="text-xs text-neutral-400 dark:text-neutral-500 underline hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            취소
          </button>
        )}
      </div>

      {/* 빠른 입력 템플릿 — 수정 모드에서는 신규 입력 전용 편의 기능이라 숨김 */}
      {!editingId && templates.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">빠른 입력</span>
            <button
              type="button"
              onClick={() => setManageTemplates((v) => !v)}
              className="text-xs text-neutral-400 dark:text-neutral-500 underline hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              {manageTemplates ? '완료' : '관리'}
            </button>
          </div>
          {!manageTemplates ? (
            <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="min-h-9 shrink-0 whitespace-nowrap rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-coral-50 dark:hover:bg-coral-900/30 hover:text-coral-800 dark:hover:text-coral-200"
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {templates.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">{t.label}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.category} · {t.amount != null ? formatWon(t.amount) : '금액 직접 입력'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" disabled={i === 0 || templateBusyId !== null}
                      onClick={() => handleMoveTemplate(i, -1)}
                      className="min-h-7 min-w-7 rounded-md text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30"
                    >▲</button>
                    <button type="button" disabled={i === templates.length - 1 || templateBusyId !== null}
                      onClick={() => handleMoveTemplate(i, 1)}
                      className="min-h-7 min-w-7 rounded-md text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30"
                    >▼</button>
                    <button type="button" disabled={templateBusyId !== null}
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="min-h-7 whitespace-nowrap rounded-md px-2 text-xs font-semibold text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30"
                    >
                      {templateBusyId === t.id ? <LoadingSpinner size={12} /> : '삭제'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 강조 카드: 수입/지출 + 비정산 + 금액 */}
      <UiCard>
        <div className="flex gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            {(['expense', 'income'] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`min-h-11 rounded-xl text-base font-bold transition-colors ${
                  type === t
                    ? t === 'expense' ? 'bg-coral-400 text-white' : 'bg-blue-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setUnsettled((u) => !u)}
            title="가족 비용 확인 등 정산·예산·잔액에서 제외할 거래에 표시 — '비정산' 탭에서만 조회됨"
            className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold transition-colors ${
              unsettled ? 'bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
            }`}
          >
            비정산
          </button>
        </div>

        <div className="mt-4">
          <label htmlFor="amount" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">금액</label>
          <div className="relative mt-1.5">
            <input
              id="amount"
              ref={amountInputRef}
              type="text"
              inputMode={type === 'income' ? 'text' : 'numeric'}
              required
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(formatNumberInput(e.target.value, type === 'income'))}
              className="min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 pl-3 pr-9 py-2 text-right text-2xl font-bold text-neutral-900 dark:text-neutral-100 transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-neutral-400 dark:text-neutral-500">원</span>
          </div>
          {type === 'income' && (
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">차감되는 항목은 맨 앞에 '-'를 붙여 입력하세요 (예: -5000)</p>
          )}
        </div>
      </UiCard>

      {/* 구매처/결제 카드 */}
      <UiCard>
        <div className="flex items-center">
          <label htmlFor="merchant" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            구매처 / 판매처 <span className="text-neutral-400 dark:text-neutral-500 font-normal">(선택)</span>
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

        {/* 구매처 관리 목록(칩) — 분류와 동일한 패턴, 탭하면 아래 입력칸이 채워짐 */}
        <div className="mt-1.5 flex flex-wrap gap-2">
          {merchantList.map((m, idx) => (
            <div key={m} className="flex items-center gap-0.5">
              {manageMerchants && (
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleMoveMerchant(m, -1)}
                    disabled={idx === 0}
                    aria-label="위로 이동"
                    className="flex h-4 w-5 items-center justify-center rounded-t text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <ChevronUp size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveMerchant(m, 1)}
                    disabled={idx === merchantList.length - 1}
                    aria-label="아래로 이동"
                    className="flex h-4 w-5 items-center justify-center rounded-b text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <ChevronDown size={11} />
                  </button>
                </div>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (manageMerchants) { handleDeleteMerchant(m); return }
                    setMerchant(m)
                  }}
                  className={`min-h-8 rounded-full px-3 text-sm font-semibold transition-colors ${manageMerchants ? 'pr-7' : ''} ${
                    merchant === m && !manageMerchants ? 'bg-coral-50 dark:bg-coral-900/30 text-coral-800 dark:text-coral-200' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {m}
                </button>
                {manageMerchants && (
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-red-500 dark:text-red-400">
                    <X size={12} />
                  </span>
                )}
              </div>
            </div>
          ))}
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

        <div className="relative">
          <input
            id="merchant"
            type="text"
            autoComplete="off"
            placeholder="예: 스타벅스, 쿠팡"
            value={merchant}
            onChange={(e) => { setMerchant(e.target.value); setMerchantSuggestOpen(true) }}
            onFocus={() => setMerchantSuggestOpen(true)}
            onBlur={() => {
              // 클릭으로 제안을 선택할 시간을 주기 위해 살짝 지연 후 닫음
              setTimeout(() => setMerchantSuggestOpen(false), 150)
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base text-neutral-900 dark:text-neutral-100 transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
          />
          {merchantSuggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg">
              {merchantSuggestions.map((m) => (
                <li key={m.merchant}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}  // blur보다 먼저 처리되도록
                    onClick={() => selectMerchantSuggestion(m)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <span className="truncate font-semibold text-neutral-800 dark:text-neutral-200">{m.merchant}</span>
                    {m.category && <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">{m.category}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">결제 방법</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('현금')}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                paymentMethod === '현금' ? 'bg-coral-400 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              현금
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('계좌이체')}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                paymentMethod === '계좌이체' ? 'bg-coral-400 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              계좌이체
            </button>
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setPaymentMethod(card.id)}
                className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                  paymentMethod === card.id ? 'text-white' : 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
                style={paymentMethod === card.id ? { backgroundColor: card.color } : {}}
              >
                {card.name}
              </button>
            ))}
            {cards.length === 0 && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 self-center">카드 관리에서 카드를 등록하면 선택할 수 있어요</p>
            )}
          </div>
        </div>

        {/* 혜택 매칭 섹션 (지출 + 카드 선택 시만 표시, 수정 모드에서는 재계산 안 하므로 숨김) */}
        {!editingId && type === 'expense' && cards.some((c) => c.id === paymentMethod) && numericAmount > 0 && (
          <div className="mt-4">
            {matchLoading && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500">혜택 확인 중...</p>
            )}

            {/* 복수 매칭 → 라디오 선택 */}
            {!matchLoading && matches.length > 1 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">적용 혜택을 선택하세요</p>
                {matches.map((m) => (
                  <label key={m.benefit.id} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="benefit"
                      className="mt-0.5"
                      checked={selectedMatch?.benefit.id === m.benefit.id}
                      onChange={() => setSelectedMatch(m)}
                    />
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {m.benefit.name}
                        {m.benefit_type === 'cashback' && (
                          <span className="ml-1.5 rounded bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 align-middle">적립</span>
                        )}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {formatWon(m.estimated_discount)} {m.benefit_type === 'cashback' ? '적립 예정' : '할인'}
                        {m.monthly_remaining > 0 && (
                          <span className="ml-1 text-neutral-500 dark:text-neutral-400">
                            (이번 달 한도 {formatWon(m.monthly_remaining)} 남음)
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={dismissBenefit}
                  className="text-xs text-neutral-400 dark:text-neutral-500 underline"
                >
                  혜택 미적용
                </button>
              </div>
            )}

            {/* 단일 매칭 → 자동 제안 */}
            {!matchLoading && matches.length === 1 && selectedMatch && (
              <div className={`rounded-xl border p-3 ${
                selectedMatch.benefit_type === 'cashback' ? 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40' : 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${selectedMatch.benefit_type === 'cashback' ? 'text-blue-800 dark:text-blue-300' : 'text-green-800 dark:text-green-300'}`}>
                      {selectedMatch.benefit_type === 'cashback' ? '적립 혜택 감지' : '혜택 자동 적용'}: {selectedMatch.benefit.name}
                    </p>
                    {selectedMatch.benefit_type === 'cashback' ? (
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                        이 결제로 예상 적립: {formatWon(selectedMatch.estimated_discount)}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-green-700 dark:text-green-400 mt-0.5">
                        {formatWon(selectedMatch.estimated_discount)} 할인 →{' '}
                        실결제 {formatWon(numericAmount - selectedMatch.estimated_discount)}
                      </p>
                    )}
                    {selectedMatch.monthly_remaining > 0 && (
                      <p className={`text-xs mt-0.5 ${selectedMatch.benefit_type === 'cashback' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                        이번 달 한도 {formatWon(selectedMatch.monthly_remaining)} 남음
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={dismissBenefit}
                    className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500 underline"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 혜택 없음 — 조용히 표시 안 함 */}
          </div>
        )}
      </UiCard>

      {/* 분류/날짜/메모 카드 */}
      <UiCard>
        <div className="flex items-center">
          <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">분류</span>
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
        <div className="mt-1.5 flex flex-wrap gap-2">
          {categories.map((c) => {
            const customIdx = customCategories.indexOf(c)
            const isCustom = customIdx !== -1
            return (
              <div key={c} className="flex items-center gap-0.5">
                {manageCategories && isCustom && (
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => handleMoveCategory(c, -1)}
                      disabled={customIdx === 0}
                      aria-label="위로 이동"
                      className="flex h-4 w-5 items-center justify-center rounded-t text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-20 disabled:hover:bg-transparent"
                    >
                      <ChevronUp size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveCategory(c, 1)}
                      disabled={customIdx === customCategories.length - 1}
                      aria-label="아래로 이동"
                      className="flex h-4 w-5 items-center justify-center rounded-b text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-20 disabled:hover:bg-transparent"
                    >
                      <ChevronDown size={11} />
                    </button>
                  </div>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (manageCategories) { handleDeleteCategory(c); return }
                      setCategory(c)
                      setCategoryManuallySet(true)
                    }}
                    className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${manageCategories ? 'pr-7' : ''} ${
                      category === c && !manageCategories ? 'bg-coral-50 dark:bg-coral-900/30 text-coral-800 dark:text-coral-200' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {c}
                  </button>
                  {manageCategories && (
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-red-500 dark:text-red-400">
                      <X size={12} />
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {!addingCategory && !manageCategories && (
            <button
              type="button"
              onClick={() => setAddingCategory(true)}
              className="min-h-9 rounded-full border-2 border-dashed border-neutral-300 dark:border-neutral-700 px-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400 transition-colors hover:border-coral-200 dark:hover:border-coral-900 hover:text-coral-400 dark:hover:text-coral-300"
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

        {/* 예산 현황 인라인 표시 (지출 + 해당 카테고리 예산 있을 때만) — 수정 모드에서는 이 거래의
            기존 금액이 이미 matched.spent에 포함돼 있어 미리보기가 부정확해지므로 숨김 */}
        {!editingId && type === 'expense' && (() => {
          // 카테고리 우선, 없으면 전체 예산
          const matched = budgetStatuses.find(
            (s) => s.budget.active === 1 && s.budget.category === category
          ) ?? budgetStatuses.find(
            (s) => s.budget.active === 1 && s.budget.category === '전체'
          )
          if (!matched) return null

          // 입력 중인 금액까지 더한 예상 지출 — cashback은 결제액을 안 깎으므로 discount일 때만 차감
          const inputAmount = Number(amount.replace(/[^0-9]/g, ''))
          const discountAmt = selectedMatch && selectedMatch.benefit_type === 'discount' ? selectedMatch.estimated_discount : 0
          const addingAmount = inputAmount > 0 ? inputAmount - discountAmt : 0
          const projectedSpent = matched.spent + addingAmount
          const projectedPct = matched.budget.monthly_limit > 0
            ? Math.round((projectedSpent / matched.budget.monthly_limit) * 100)
            : 0
          const projectedExceeded = projectedSpent > matched.budget.monthly_limit

          const isExceeded = matched.exceeded
          const pct = matched.percentage

          return (
            <div className={`mt-3 rounded-xl border px-3 py-2.5 ${
              isExceeded ? 'border-coral-200 dark:border-coral-900 bg-coral-50 dark:bg-coral-900/30' :
              pct >= 80   ? 'border-coral-100 dark:border-coral-900 bg-coral-50 dark:bg-coral-900/30' :
                            'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-bold ${
                  isExceeded ? 'text-coral-800 dark:text-coral-200' : pct >= 80 ? 'text-coral-800 dark:text-coral-200' : 'text-neutral-600 dark:text-neutral-400'
                }`}>
                  {matched.budget.category === '전체' ? '전체 지출' : matched.budget.category} 예산
                </span>
                <span className={`text-xs font-semibold ${
                  isExceeded ? 'text-coral-600 dark:text-coral-200' : pct >= 80 ? 'text-coral-600 dark:text-coral-200' : 'text-neutral-600 dark:text-neutral-400'
                }`}>
                  {pct}% 사용
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div
                  className={`h-full rounded-full ${
                    isExceeded ? 'bg-coral-600' : pct >= 80 ? 'bg-coral-200 dark:bg-coral-900/50' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${
                isExceeded ? 'text-coral-600 dark:text-coral-200' : pct >= 80 ? 'text-coral-600 dark:text-coral-200' : 'text-neutral-600 dark:text-neutral-400'
              }`}>
                {isExceeded
                  ? `예산 초과! ${formatWon(Math.abs(matched.remaining))} 초과`
                  : `${formatWon(matched.remaining)} 남음 (${formatWon(matched.spent)} / ${formatWon(matched.budget.monthly_limit)})`}
              </p>
              {/* 입력 중인 금액 포함 예상 초과 경고 */}
              {addingAmount > 0 && !isExceeded && projectedExceeded && (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-coral-600 dark:text-coral-200">
                  이 거래를 추가하면 {formatWon(projectedSpent - matched.budget.monthly_limit)} 초과됩니다
                </p>
              )}
              {addingAmount > 0 && !projectedExceeded && projectedPct >= 80 && (
                <p className="mt-0.5 text-xs text-coral-600 dark:text-coral-200">
                  입력 후 {projectedPct}% 사용 예정
                </p>
              )}
            </div>
          )
        })()}

        {/* 날짜 */}
        <div className="mt-4">
          <label htmlFor="date" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">날짜</label>
          <input
            id="date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
          />
        </div>

        {/* 메모 */}
        <div className="mt-4">
          <label htmlFor="memo" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            메모 <span className="text-neutral-400 dark:text-neutral-500 font-normal">(선택)</span>
          </label>
          <input
            id="memo"
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
          />
        </div>
      </UiCard>

      {/* 현재 입력값을 템플릿으로 저장 — 수정 모드에서는 숨김 */}
      {!editingId && (!showSaveTemplate ? (
        <button
          type="button"
          onClick={() => setShowSaveTemplate(true)}
          className="w-full text-center text-xs text-neutral-400 dark:text-neutral-500 underline hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          현재 입력값을 템플릿으로 저장
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder="템플릿 이름 (예: 아메리카노)"
              value={templateLabel}
              onChange={(e) => setTemplateLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveAsTemplate() } }}
              className="min-h-9 flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
            />
            <button
              type="button"
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate}
              className="min-h-9 flex items-center justify-center gap-1.5 rounded-lg bg-coral-400 px-3 text-sm font-semibold text-white transition-colors hover:bg-coral-600 disabled:opacity-50"
            >
              {savingTemplate ? <LoadingSpinner size={14} /> : '저장'}
            </button>
            <button
              type="button"
              onClick={() => { setShowSaveTemplate(false); setTemplateLabel(''); setSaveTemplateAmount(true) }}
              className="min-h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              취소
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={saveTemplateAmount}
              onChange={(e) => setSaveTemplateAmount(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-700"
            />
            금액도 함께 저장 (해제 시 매번 금액만 새로 입력)
          </label>
        </div>
      ))}

      {/* 저장 전 예산 반영 미리보기 — 수정 모드에서는 부정확해지므로 숨김(위와 동일한 이유) */}
      {!editingId && type === 'expense' && numericAmount > 0 && (() => {
        const matched = budgetStatuses.find(
          (s) => s.budget.active === 1 && s.budget.category === category
        ) ?? budgetStatuses.find(
          (s) => s.budget.active === 1 && s.budget.category === '전체'
        )
        if (!matched) return null

        const discountAmt = selectedMatch && selectedMatch.benefit_type === 'discount' ? selectedMatch.estimated_discount : 0
        const addingAmount = numericAmount - discountAmt
        if (addingAmount <= 0) return null

        const projectedSpent = matched.spent + addingAmount
        const projectedPct = matched.budget.monthly_limit > 0
          ? Math.round((projectedSpent / matched.budget.monthly_limit) * 100)
          : 0
        const projectedExceeded = projectedSpent > matched.budget.monthly_limit
        const label = matched.budget.category === '전체' ? '전체' : matched.budget.category

        return (
          <p className={`text-center text-xs font-semibold ${projectedExceeded ? 'text-coral-600 dark:text-coral-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
            저장 시 이번 달 '{label}' 예산 {projectedPct}% 사용 (기존 {matched.percentage}% → {projectedPct}%)
          </p>
        )
      })()}

      <button
        type="submit"
        disabled={saving}
        className="min-h-12 w-full rounded-xl bg-coral-400 text-lg font-bold text-white transition-colors hover:bg-coral-600 active:bg-coral-800 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <><LoadingSpinner size={18} /> 처리 중...</> : (
          editingId
            ? '수정 완료'
            : selectedMatch && selectedMatch.benefit_type === 'discount'
            ? `저장 (${formatWon(numericAmount - selectedMatch.estimated_discount)} 결제)`
            : selectedMatch && selectedMatch.benefit_type === 'cashback'
            ? `저장 (적립 예정 ${formatWon(selectedMatch.estimated_discount)})`
            : '저장하기'
        )}
      </button>
    </form>
  )
}

export default TransactionForm
