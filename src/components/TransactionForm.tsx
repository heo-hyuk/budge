import { useEffect, useRef, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import UiCard from './ui/Card'
import { useToast } from '../contexts/ToastContext'
import { createTemplate, deleteTemplate, fetchRecentMerchants, fetchTemplates, matchBenefit, updateTemplate } from '../lib/api'
import { addCustomCategory, getCategories } from '../lib/categories'
import { formatNumberInput, formatWon, todayStr } from '../lib/format'
import type { BenefitMatch, BudgetStatus, Card, NewTransaction, QuickTemplate, RecentMerchant, TransactionType } from '../types'

export interface TransactionPrefill {
  type: TransactionType
  category: string
  amount: number
  merchant: string
  paymentMethod: string  // '현금' | card.id
  memo: string
}

interface Props {
  onSubmit: (tx: NewTransaction) => Promise<void>
  cards: Card[]
  budgetStatuses?: BudgetStatus[]  // 현재 월 예산 현황 (홈에서 주입)
  duplicateFrom?: { data: TransactionPrefill; nonce: number } | null  // 거래 목록에서 "복제" 클릭 시 주입
  onDuplicateApplied?: () => void
}

function TransactionForm({ onSubmit, cards, budgetStatuses = [], duplicateFrom, onDuplicateApplied }: Props) {
  const { showToast } = useToast()
  const [type, setType]               = useState<TransactionType>('expense')
  const [categories, setCategories]   = useState(() => getCategories('expense'))
  const [category, setCategory]       = useState(categories[0])
  const [categoryManuallySet, setCategoryManuallySet] = useState(false)
  const [amount, setAmount]           = useState('')
  const [date, setDate]               = useState(todayStr())
  const [memo, setMemo]               = useState('')
  const [merchant, setMerchant]       = useState('')
  const [paymentMethod, setPaymentMethod] = useState('현금')
  const [saving, setSaving]           = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  // 혜택 매칭 상태
  const [matches, setMatches]         = useState<BenefitMatch[]>([])
  const [selectedMatch, setSelectedMatch] = useState<BenefitMatch | null>(null)
  const [matchLoading, setMatchLoading]   = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 최근 구매처 자동완성 상태
  const [recentMerchants, setRecentMerchants] = useState<RecentMerchant[]>([])
  const [merchantSuggestOpen, setMerchantSuggestOpen] = useState(false)

  // 빠른 입력 템플릿 상태
  const [templates, setTemplates] = useState<QuickTemplate[]>([])
  const [manageTemplates, setManageTemplates] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateLabel, setTemplateLabel] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateBusyId, setTemplateBusyId] = useState<string | null>(null)

  useEffect(() => {
    fetchRecentMerchants().then(setRecentMerchants).catch(() => {})
    fetchTemplates().then(setTemplates).catch(() => {})
  }, [])

  // 폼 전체를 한번에 채우는 공통 로직 — 거래 복제 / 템플릿 적용 둘 다 이걸 씀
  function applyPrefill(data: TransactionPrefill) {
    setType(data.type)
    const nextCats = getCategories(data.type)
    setCategories(nextCats)
    setCategory(nextCats.includes(data.category) ? data.category : nextCats[0])
    setCategoryManuallySet(true)  // 자동완성이 채워진 분류를 덮어쓰지 않도록
    setAmount(formatNumberInput(String(data.amount)))
    setMerchant(data.merchant)
    setPaymentMethod(data.paymentMethod)
    setMemo(data.memo)
    setDate(todayStr())
    setAddingCategory(false)
  }

  // 거래 복제 — App.tsx가 nonce를 바꿔가며 주입
  useEffect(() => {
    if (!duplicateFrom) return
    applyPrefill(duplicateFrom.data)
    onDuplicateApplied?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateFrom?.nonce])

  function applyTemplate(t: QuickTemplate) {
    applyPrefill({
      type: t.type,
      category: t.category,
      amount: t.amount,
      merchant: t.merchant,
      paymentMethod: t.card_id || '현금',
      memo: '',
    })
  }

  async function handleSaveAsTemplate() {
    const numericAmount = Number(amount.replace(/[^0-9]/g, ''))
    const label = templateLabel.trim()
    if (!label || !numericAmount || numericAmount <= 0) return
    const selectedCard = cards.find((c) => c.id === paymentMethod)
    setSavingTemplate(true)
    try {
      await createTemplate({
        label, type, category, amount: numericAmount,
        merchant: merchant.trim() || undefined,
        payment_method: selectedCard ? selectedCard.id : '현금',
        card_id: selectedCard ? selectedCard.id : undefined,
      })
      setTemplates(await fetchTemplates())
      setTemplateLabel('')
      setShowSaveTemplate(false)
      showToast('템플릿으로 저장했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '템플릿을 저장하지 못했습니다', 'error')
    } finally {
      setSavingTemplate(false)
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!window.confirm('이 템플릿을 삭제할까요?')) return
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
    // 수입으로 바꾸면 혜택 초기화
    if (next === 'income') {
      setMatches([])
      setSelectedMatch(null)
    }
  }

  function handleAddCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed) { setAddingCategory(false); return }
    const updated = addCustomCategory(type, trimmed)
    setCategories(updated)
    setCategory(trimmed)
    setCategoryManuallySet(true)
    setNewCategory('')
    setAddingCategory(false)
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
  useEffect(() => {
    if (type !== 'expense') return
    const cardId = paymentMethod !== '현금' ? paymentMethod : ''
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
  }, [paymentMethod, merchant, category, amount, date, type])

  // 혜택 적용 취소
  function dismissBenefit() {
    setSelectedMatch(null)
    setMatches([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numericAmount = Number(amount.replace(/[^0-9]/g, ''))
    if (!numericAmount || numericAmount <= 0) return

    const selectedCard = cards.find((c) => c.id === paymentMethod)

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
        payment_method: selectedCard ? selectedCard.id : '현금',
        card_id: selectedCard ? selectedCard.id : undefined,
        original_amount: discountAmount > 0 ? numericAmount : undefined,
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
        benefit_id: selectedMatch ? selectedMatch.benefit.id : undefined,
        cashback_amount: cashbackAmount > 0 ? cashbackAmount : undefined,
      })
      setAmount('')
      setMemo('')
      setMerchant('')
      setMatches([])
      setSelectedMatch(null)
      showToast('거래를 저장했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '거래를 저장하지 못했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  const numericAmount = Number(amount.replace(/[^0-9]/g, ''))

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h2 className="text-base font-bold text-neutral-700">내역 추가</h2>

      {/* 빠른 입력 템플릿 */}
      {templates.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500">빠른 입력</span>
            <button
              type="button"
              onClick={() => setManageTemplates((v) => !v)}
              className="text-xs text-neutral-400 underline hover:text-neutral-600"
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
                  className="min-h-9 shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-coral-50 hover:text-coral-800"
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {templates.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-800">{t.label}</p>
                    <p className="text-xs text-neutral-400">{t.category} · {formatWon(t.amount)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" disabled={i === 0 || templateBusyId !== null}
                      onClick={() => handleMoveTemplate(i, -1)}
                      className="min-h-7 min-w-7 rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                    >▲</button>
                    <button type="button" disabled={i === templates.length - 1 || templateBusyId !== null}
                      onClick={() => handleMoveTemplate(i, 1)}
                      className="min-h-7 min-w-7 rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                    >▼</button>
                    <button type="button" disabled={templateBusyId !== null}
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="min-h-7 whitespace-nowrap rounded-md px-2 text-xs font-semibold text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
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

      {/* 강조 카드: 수입/지출 + 금액 */}
      <UiCard>
        <div className="grid grid-cols-2 gap-2">
          {(['expense', 'income'] as TransactionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`min-h-11 rounded-xl text-base font-bold transition-colors ${
                type === t
                  ? t === 'expense' ? 'bg-coral-400 text-white' : 'bg-blue-600 text-white'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {t === 'expense' ? '지출' : '수입'}
            </button>
          ))}
        </div>

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
              onChange={(e) => setAmount(formatNumberInput(e.target.value))}
              className="min-h-11 w-full rounded-xl border border-neutral-300 pl-3 pr-9 py-2 text-right text-2xl font-bold text-neutral-900 transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-neutral-400">원</span>
          </div>
        </div>
      </UiCard>

      {/* 구매처/결제 카드 */}
      <UiCard>
        <div className="relative">
          <label htmlFor="merchant" className="block text-sm font-semibold text-neutral-700">
            구매처 / 판매처 <span className="text-neutral-400 font-normal">(선택)</span>
          </label>
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
            className="mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-base text-neutral-900 transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
          />
          {merchantSuggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
              {merchantSuggestions.map((m) => (
                <li key={m.merchant}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}  // blur보다 먼저 처리되도록
                    onClick={() => selectMerchantSuggestion(m)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50"
                  >
                    <span className="truncate font-semibold text-neutral-800">{m.merchant}</span>
                    {m.category && <span className="shrink-0 text-xs text-neutral-400">{m.category}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <span className="block text-sm font-semibold text-neutral-700">결제 방법</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('현금')}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                paymentMethod === '현금' ? 'bg-coral-400 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              현금
            </button>
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setPaymentMethod(card.id)}
                className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                  paymentMethod === card.id ? 'text-white' : 'text-neutral-600 bg-neutral-100 hover:bg-neutral-200'
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

        {/* 혜택 매칭 섹션 (지출 + 카드 선택 시만 표시) */}
        {type === 'expense' && paymentMethod !== '현금' && numericAmount > 0 && (
          <div className="mt-4">
            {matchLoading && (
              <p className="text-xs text-neutral-400">혜택 확인 중...</p>
            )}

            {/* 복수 매칭 → 라디오 선택 */}
            {!matchLoading && matches.length > 1 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-xs font-bold text-amber-800">적용 혜택을 선택하세요</p>
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
                      <p className="text-sm font-semibold text-neutral-900">
                        {m.benefit.name}
                        {m.benefit_type === 'cashback' && (
                          <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 align-middle">적립</span>
                        )}
                      </p>
                      <p className="text-xs text-amber-700">
                        {formatWon(m.estimated_discount)} {m.benefit_type === 'cashback' ? '적립 예정' : '할인'}
                        {m.monthly_remaining > 0 && (
                          <span className="ml-1 text-neutral-500">
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
                  className="text-xs text-neutral-400 underline"
                >
                  혜택 미적용
                </button>
              </div>
            )}

            {/* 단일 매칭 → 자동 제안 */}
            {!matchLoading && matches.length === 1 && selectedMatch && (
              <div className={`rounded-xl border p-3 ${
                selectedMatch.benefit_type === 'cashback' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${selectedMatch.benefit_type === 'cashback' ? 'text-blue-800' : 'text-green-800'}`}>
                      {selectedMatch.benefit_type === 'cashback' ? '적립 혜택 감지' : '혜택 자동 적용'}: {selectedMatch.benefit.name}
                    </p>
                    {selectedMatch.benefit_type === 'cashback' ? (
                      <p className="text-sm font-bold text-blue-700 mt-0.5">
                        이 결제로 예상 적립: {formatWon(selectedMatch.estimated_discount)}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-green-700 mt-0.5">
                        {formatWon(selectedMatch.estimated_discount)} 할인 →{' '}
                        실결제 {formatWon(numericAmount - selectedMatch.estimated_discount)}
                      </p>
                    )}
                    {selectedMatch.monthly_remaining > 0 && (
                      <p className={`text-xs mt-0.5 ${selectedMatch.benefit_type === 'cashback' ? 'text-blue-600' : 'text-green-600'}`}>
                        이번 달 한도 {formatWon(selectedMatch.monthly_remaining)} 남음
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={dismissBenefit}
                    className="shrink-0 text-xs text-neutral-400 underline"
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
        <span className="block text-sm font-semibold text-neutral-700">분류</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setCategory(c); setCategoryManuallySet(true) }}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                category === c ? 'bg-coral-50 text-coral-800' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {c}
            </button>
          ))}
          {!addingCategory && (
            <button
              type="button"
              onClick={() => setAddingCategory(true)}
              className="min-h-9 rounded-full border-2 border-dashed border-neutral-300 px-3 text-sm font-semibold text-neutral-500 transition-colors hover:border-coral-200 hover:text-coral-400"
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
              className="min-h-9 flex-1 rounded-lg border border-neutral-300 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
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

        {/* 예산 현황 인라인 표시 (지출 + 해당 카테고리 예산 있을 때만) */}
        {type === 'expense' && (() => {
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
              isExceeded ? 'border-coral-200 bg-coral-50' :
              pct >= 80   ? 'border-coral-100 bg-coral-50' :
                            'border-neutral-200 bg-neutral-50'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-bold ${
                  isExceeded ? 'text-coral-800' : pct >= 80 ? 'text-coral-800' : 'text-neutral-600'
                }`}>
                  {matched.budget.category === '전체' ? '전체 지출' : matched.budget.category} 예산
                </span>
                <span className={`text-xs font-semibold ${
                  isExceeded ? 'text-coral-600' : pct >= 80 ? 'text-coral-600' : 'text-neutral-600'
                }`}>
                  {pct}% 사용
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className={`h-full rounded-full ${
                    isExceeded ? 'bg-coral-600' : pct >= 80 ? 'bg-coral-200' : 'bg-neutral-300'
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${
                isExceeded ? 'text-coral-600' : pct >= 80 ? 'text-coral-600' : 'text-neutral-600'
              }`}>
                {isExceeded
                  ? `예산 초과! ${formatWon(Math.abs(matched.remaining))} 초과`
                  : `${formatWon(matched.remaining)} 남음 (${formatWon(matched.spent)} / ${formatWon(matched.budget.monthly_limit)})`}
              </p>
              {/* 입력 중인 금액 포함 예상 초과 경고 */}
              {addingAmount > 0 && !isExceeded && projectedExceeded && (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-coral-600">
                  이 거래를 추가하면 {formatWon(projectedSpent - matched.budget.monthly_limit)} 초과됩니다
                </p>
              )}
              {addingAmount > 0 && !projectedExceeded && projectedPct >= 80 && (
                <p className="mt-0.5 text-xs text-coral-600">
                  입력 후 {projectedPct}% 사용 예정
                </p>
              )}
            </div>
          )
        })()}

        {/* 날짜 */}
        <div className="mt-4">
          <label htmlFor="date" className="block text-sm font-semibold text-neutral-700">날짜</label>
          <input
            id="date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
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
            className="mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
          />
        </div>
      </UiCard>

      {/* 현재 입력값을 템플릿으로 저장 */}
      {!showSaveTemplate ? (
        <button
          type="button"
          onClick={() => setShowSaveTemplate(true)}
          className="w-full text-center text-xs text-neutral-400 underline hover:text-neutral-600"
        >
          현재 입력값을 템플릿으로 저장
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            autoFocus
            placeholder="템플릿 이름 (예: 아메리카노)"
            value={templateLabel}
            onChange={(e) => setTemplateLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveAsTemplate() } }}
            className="min-h-9 flex-1 rounded-lg border border-neutral-300 px-3 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
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
            onClick={() => { setShowSaveTemplate(false); setTemplateLabel('') }}
            className="min-h-9 rounded-lg bg-neutral-100 px-3 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-200"
          >
            취소
          </button>
        </div>
      )}

      {/* 저장 전 예산 반영 미리보기 */}
      {type === 'expense' && numericAmount > 0 && (() => {
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
          <p className={`text-center text-xs font-semibold ${projectedExceeded ? 'text-coral-600' : 'text-neutral-500'}`}>
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
          selectedMatch && selectedMatch.benefit_type === 'discount'
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
