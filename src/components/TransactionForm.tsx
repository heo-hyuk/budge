import { useEffect, useRef, useState } from 'react'
import { matchBenefit } from '../lib/api'
import { addCustomCategory, getCategories } from '../lib/categories'
import { formatNumberInput, formatWon, todayStr } from '../lib/format'
import type { BenefitMatch, BudgetStatus, Card, NewTransaction, TransactionType } from '../types'

interface Props {
  onSubmit: (tx: NewTransaction) => Promise<void>
  cards: Card[]
  budgetStatuses?: BudgetStatus[]  // 현재 월 예산 현황 (홈에서 주입)
}

function TransactionForm({ onSubmit, cards, budgetStatuses = [] }: Props) {
  const [type, setType]               = useState<TransactionType>('expense')
  const [categories, setCategories]   = useState(() => getCategories('expense'))
  const [category, setCategory]       = useState(categories[0])
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

  function handleTypeChange(next: TransactionType) {
    setType(next)
    const nextCats = getCategories(next)
    setCategories(nextCats)
    setCategory(nextCats[0])
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
    setNewCategory('')
    setAddingCategory(false)
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

    // 할인 적용 계산
    const discountAmount = selectedMatch ? selectedMatch.estimated_discount : 0
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
      })
      setAmount('')
      setMemo('')
      setMerchant('')
      setMatches([])
      setSelectedMatch(null)
    } finally {
      setSaving(false)
    }
  }

  const numericAmount = Number(amount.replace(/[^0-9]/g, ''))

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
            onChange={(e) => setAmount(formatNumberInput(e.target.value))}
            className="min-h-11 w-full rounded-xl border-2 border-neutral-300 pl-3 pr-9 py-2 text-right text-lg font-bold text-neutral-900 focus:border-blue-500 focus:outline-none"
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
          <button
            type="button"
            onClick={() => setPaymentMethod('현금')}
            className={`min-h-9 rounded-full px-3 text-sm font-semibold ${
              paymentMethod === '현금' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
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

      {/* 예산 현황 인라인 표시 (지출 + 해당 카테고리 예산 있을 때만) */}
      {type === 'expense' && (() => {
        // 카테고리 우선, 없으면 전체 예산
        const matched = budgetStatuses.find(
          (s) => s.budget.active === 1 && s.budget.category === category
        ) ?? budgetStatuses.find(
          (s) => s.budget.active === 1 && s.budget.category === '전체'
        )
        if (!matched) return null

        // 입력 중인 금액까지 더한 예상 지출
        const inputAmount = Number(amount.replace(/[^0-9]/g, ''))
        const discountAmt = selectedMatch ? selectedMatch.estimated_discount : 0
        const addingAmount = inputAmount > 0 ? inputAmount - discountAmt : 0
        const projectedSpent = matched.spent + addingAmount
        const projectedPct = matched.budget.monthly_limit > 0
          ? Math.round((projectedSpent / matched.budget.monthly_limit) * 100)
          : 0
        const projectedExceeded = projectedSpent > matched.budget.monthly_limit

        const isExceeded = matched.exceeded
        const pct = matched.percentage

        return (
          <div className={`mt-3 rounded-xl border-2 px-3 py-2.5 ${
            isExceeded ? 'border-red-200 bg-red-50' :
            pct >= 80   ? 'border-amber-200 bg-amber-50' :
                          'border-green-200 bg-green-50'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-bold ${
                isExceeded ? 'text-red-800' : pct >= 80 ? 'text-amber-800' : 'text-green-800'
              }`}>
                {matched.budget.category === '전체' ? '전체 지출' : matched.budget.category} 예산
              </span>
              <span className={`text-xs font-semibold ${
                isExceeded ? 'text-red-700' : pct >= 80 ? 'text-amber-700' : 'text-green-700'
              }`}>
                {pct}% 사용
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className={`h-full rounded-full ${
                  isExceeded ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <p className={`mt-1 text-xs font-semibold ${
              isExceeded ? 'text-red-700' : pct >= 80 ? 'text-amber-700' : 'text-green-700'
            }`}>
              {isExceeded
                ? `⚠ 예산 초과! ${formatWon(Math.abs(matched.remaining))} 초과`
                : `${formatWon(matched.remaining)} 남음 (${formatWon(matched.spent)} / ${formatWon(matched.budget.monthly_limit)})`}
            </p>
            {/* 입력 중인 금액 포함 예상 초과 경고 */}
            {addingAmount > 0 && !isExceeded && projectedExceeded && (
              <p className="mt-0.5 text-xs font-bold text-red-700">
                ⚠ 이 거래를 추가하면 {formatWon(projectedSpent - matched.budget.monthly_limit)} 초과됩니다
              </p>
            )}
            {addingAmount > 0 && !projectedExceeded && projectedPct >= 80 && (
              <p className="mt-0.5 text-xs text-amber-700">
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

      {/* 혜택 매칭 섹션 (지출 + 카드 선택 시만 표시) */}
      {type === 'expense' && paymentMethod !== '현금' && numericAmount > 0 && (
        <div className="mt-4">
          {matchLoading && (
            <p className="text-xs text-neutral-400">혜택 확인 중...</p>
          )}

          {/* 복수 매칭 → 라디오 선택 */}
          {!matchLoading && matches.length > 1 && (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3 space-y-2">
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
                    <p className="text-sm font-semibold text-neutral-900">{m.benefit.name}</p>
                    <p className="text-xs text-amber-700">
                      {formatWon(m.estimated_discount)} 할인
                      {m.benefit.monthly_cap > 0 && (
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
            <div className="rounded-xl border-2 border-green-200 bg-green-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-green-800">
                    혜택 자동 적용: {selectedMatch.benefit.name}
                  </p>
                  <p className="text-sm font-bold text-green-700 mt-0.5">
                    {formatWon(selectedMatch.estimated_discount)} 할인 →{' '}
                    실결제 {formatWon(numericAmount - selectedMatch.estimated_discount)}
                  </p>
                  {selectedMatch.benefit.monthly_cap > 0 && (
                    <p className="text-xs text-green-600 mt-0.5">
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

      <button
        type="submit"
        disabled={saving}
        className="mt-5 min-h-12 w-full rounded-xl bg-neutral-900 text-lg font-bold text-white disabled:opacity-50"
      >
        {saving ? '저장 중...' : (
          selectedMatch
            ? `저장 (${formatWon(numericAmount - selectedMatch.estimated_discount)} 결제)`
            : '저장하기'
        )}
      </button>
    </form>
  )
}

export default TransactionForm
