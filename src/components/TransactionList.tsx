import { useEffect, useRef, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import { useConfirm } from '../contexts/ConfirmContext'
import { useToast } from '../contexts/ToastContext'
import { matchBenefit } from '../lib/api'
import { getCategories } from '../lib/categories'
import { formatDateLabel, formatNumberInput, formatWon, parseAmountInput } from '../lib/format'
import { renderMemoWithHighlights } from '../lib/memoHighlight'
import { getPaymentMethods } from '../lib/paymentMethods'
import type { BenefitMatch, Card, Transaction, TransactionType, UpdateTransaction } from '../types'

interface Props {
  transactions: Transaction[]
  cards: Card[]
  onDelete: (id: string) => void
  onUpdate: (id: string, data: UpdateTransaction) => Promise<void>
  onDuplicate: (tx: Transaction) => void
}

interface EditState {
  type: TransactionType
  category: string
  amount: string
  date: string
  memo: string
  merchant: string
  paymentMethod: string // '현금' | '계좌이체' | card.id
  unsettled: boolean
}

function TransactionList({ transactions, cards, onDelete, onUpdate, onDuplicate }: Props) {
  const { showToast } = useToast()
  const confirm = useConfirm()
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editState, setEditState]   = useState<EditState | null>(null)
  const [saving, setSaving]         = useState(false)

  // 혜택 매칭 상태 — TransactionForm과 동일한 패턴(수정 중인 항목 하나에만 적용)
  const [matches, setMatches]             = useState<BenefitMatch[]>([])
  const [selectedMatch, setSelectedMatch] = useState<BenefitMatch | null>(null)
  const [matchLoading, setMatchLoading]   = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 결제방법·구매처·분류·금액 변경 시 혜택 매칭 (debounce 400ms) — TransactionForm과 동일 로직
  useEffect(() => {
    if (!editState || editState.type !== 'expense') {
      setMatches([])
      setSelectedMatch(null)
      return
    }
    const cardId = cards.some((c) => c.id === editState.paymentMethod) ? editState.paymentMethod : ''
    const numericAmount = Number(editState.amount.replace(/[^0-9]/g, ''))

    if (!cardId || numericAmount <= 0) {
      setMatches([])
      setSelectedMatch(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setMatchLoading(true)
      try {
        const month = editState.date.slice(0, 7)
        const result = await matchBenefit({
          card_id: cardId,
          merchant: editState.merchant.trim(),
          category: editState.category,
          amount: numericAmount,
          month,
        })
        setMatches(result)
        setSelectedMatch(result.length === 1 ? result[0] : null)
      } catch {
        // 오류 시 조용히 무시
      } finally {
        setMatchLoading(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editState?.paymentMethod, editState?.merchant, editState?.category, editState?.amount, editState?.date, editState?.type, cards])

  // 카드 ID → Card 매핑
  const cardMap = new Map(cards.map((c) => [c.id, c]))

  if (transactions.length === 0) {
    return (
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-center shadow-sm">
        <p className="text-base text-neutral-500 dark:text-neutral-400">아직 내역이 없습니다</p>
      </section>
    )
  }

  // 날짜별 그룹 — 같은 날짜 내에서는 지출을 먼저, 수입을 아래에 배치
  // (Array.sort는 안정 정렬이라 각 그룹 내 원래 시간 순서는 유지됨)
  const groups = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const list = groups.get(tx.date) ?? []
    list.push(tx)
    groups.set(tx.date, list)
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (a.type === b.type ? 0 : a.type === 'expense' ? -1 : 1))
  }

  function startEdit(tx: Transaction) {
    setEditingId(tx.id)
    setEditState({
      type: tx.type,
      category: tx.category,
      // 혜택 할인이 적용된 거래면 amount는 이미 할인 후 금액이라, 그대로 채우면
      // 혜택 재계산 시 할인이 중복 적용됨 — 할인 전 원래 금액(original_amount)을 채움
      amount: formatNumberInput(String(tx.original_amount > 0 ? tx.original_amount : tx.amount), tx.type === 'income'),
      date: tx.date,
      memo: tx.memo ?? '',
      merchant: tx.merchant ?? '',
      paymentMethod: tx.card_id || tx.payment_method || '현금',
      unsettled: tx.unsettled === 1,
    })
    setMatches([])
    setSelectedMatch(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState(null)
    setMatches([])
    setSelectedMatch(null)
  }

  async function handleSave(id: string) {
    if (!editState) return
    const numericAmount = parseAmountInput(editState.amount)
    // 지출은 항상 양수, 수입은 차감(음수) 항목을 허용 — 0/NaN은 어느 쪽이든 무효
    if (!numericAmount) return
    if (editState.type === 'expense' && numericAmount < 0) return
    const selectedCard = cards.find((c) => c.id === editState.paymentMethod)

    // cashback 혜택은 결제액을 깎지 않고 적립 예정액만 정보로 기록 — discount만 실결제액에서 차감
    const isCashback = selectedMatch?.benefit_type === 'cashback'
    const discountAmount = selectedMatch && !isCashback ? selectedMatch.estimated_discount : 0
    const cashbackAmount = selectedMatch && isCashback ? selectedMatch.estimated_discount : 0
    const finalAmount = numericAmount - discountAmount

    setSaving(true)
    try {
      await onUpdate(id, {
        type: editState.type,
        category: editState.category,
        amount: finalAmount,
        date: editState.date,
        memo: editState.memo.trim(),
        merchant: editState.merchant.trim(),
        payment_method: selectedCard ? selectedCard.id : editState.paymentMethod,
        card_id: selectedCard ? selectedCard.id : '',
        original_amount: discountAmount > 0 ? numericAmount : 0,
        discount_amount: discountAmount,
        benefit_id: selectedMatch ? selectedMatch.benefit.id : '',
        cashback_amount: cashbackAmount,
        unsettled: editState.unsettled,
      })
      setEditingId(null)
      setEditState(null)
      setMatches([])
      setSelectedMatch(null)
      showToast('거래를 수정했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '거래를 수정하지 못했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm('이 내역을 삭제할까요?'))) return
    // 실제 삭제는 App.tsx가 지연 처리 — 삭제됨/되돌리기 토스트도 거기서 띄움
    onDelete(id)
  }

  return (
    <section className="space-y-4">
      {Array.from(groups.entries()).map(([date, items]) => (
        <div key={date} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <h3 className="border-b border-neutral-100 dark:border-neutral-800 px-4 py-2.5 text-sm font-bold text-neutral-500 dark:text-neutral-400">
            {formatDateLabel(date)}
          </h3>
          <ul>
            {items.map((tx) =>
              editingId === tx.id && editState ? (
                /* ── 인라인 편집 폼 ── */
                <li key={tx.id} className="border-b border-neutral-100 dark:border-neutral-800 px-4 py-3 last:border-b-0">
                  {/* 수입/지출 + 비정산 */}
                  <div className="mb-3 flex gap-2">
                    <div className="grid flex-1 grid-cols-2 gap-2">
                      {(['expense', 'income'] as TransactionType[]).map((t) => (
                        <button key={t} type="button"
                          onClick={() => {
                            const cats = getCategories(t)
                            const pms = getPaymentMethods(t)
                            setEditState((s) => s && {
                              ...s, type: t, category: cats[0],
                              // 결제 방법도 지출/수입 독립 관리라 타입 전환 시 재동기화(카드가 선택된
                              // 채로 수입으로 넘어가지 않도록 — TransactionForm과 동일 원칙)
                              paymentMethod: pms[0],
                              // 수입엔 구매처 개념이 없어 입력창 자체를 숨김 — 전환 시 비움(TransactionForm과 동일 원칙)
                              merchant: t === 'income' ? '' : s.merchant,
                              // 지출로 바꾸면 음수 입력이 불가하므로 남아있던 '-' 부호 제거
                              amount: t === 'expense' ? s.amount.replace(/^-/, '') : s.amount,
                            })
                          }}
                          className={`min-h-9 rounded-xl text-sm font-bold transition-colors ${
                            editState.type === t
                              ? t === 'expense' ? 'bg-coral-400 text-white' : 'bg-blue-600 text-white'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          {t === 'expense' ? '지출' : '수입'}
                        </button>
                      ))}
                    </div>
                    <button type="button"
                      onClick={() => setEditState((s) => s && { ...s, unsettled: !s.unsettled })}
                      title="가족 비용 확인 등 정산·예산·잔액에서 제외할 거래에 표시 — '비정산' 탭에서만 조회됨"
                      className={`min-h-9 shrink-0 rounded-xl px-3 text-sm font-bold transition-colors ${
                        editState.unsettled ? 'bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      비정산
                    </button>
                  </div>
                  {/* 금액 — 수입은 차감 항목을 위해 음수(-) 입력 허용 */}
                  <input type="text" inputMode={editState.type === 'income' ? 'text' : 'numeric'}
                    value={editState.amount}
                    onChange={(e) => setEditState((s) => s && { ...s, amount: formatNumberInput(e.target.value, s.type === 'income') })}
                    className="mb-2 min-h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-right text-base font-bold transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                    placeholder="금액"
                  />
                  {/* 구매처 — 수입엔 구매처 개념이 없어 지출일 때만 표시(TransactionForm과 동일 원칙) */}
                  {editState.type === 'expense' && (
                    <input type="text"
                      value={editState.merchant}
                      onChange={(e) => setEditState((s) => s && { ...s, merchant: e.target.value })}
                      placeholder="구매처 (선택)"
                      className="mb-2 min-h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                    />
                  )}
                  {/* 결제방법 */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {/* 카드는 지출일 때만 이어붙임 — 수입엔 카드 개념이 없음(TransactionForm과 동일 원칙) */}
                    {[...getPaymentMethods(editState.type), ...(editState.type === 'expense' ? cards.map((c) => c.id) : [])].map((pm) => {
                      const card = cardMap.get(pm)
                      return (
                        <button key={pm} type="button"
                          onClick={() => setEditState((s) => s && { ...s, paymentMethod: pm })}
                          className={`min-h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
                            editState.paymentMethod === pm ? 'text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                          }`}
                          style={editState.paymentMethod === pm ? { backgroundColor: card?.color ?? '#1f2937' } : {}}
                        >
                          {card ? card.name : pm}
                        </button>
                      )
                    })}
                  </div>
                  {/* 혜택 매칭 — TransactionForm과 동일한 UI/로직(지출 + 카드 선택 시만 표시) */}
                  {editState.type === 'expense' && cards.some((c) => c.id === editState.paymentMethod) && parseAmountInput(editState.amount) > 0 && (
                    <div className="mb-2">
                      {matchLoading && (
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">혜택 확인 중...</p>
                      )}

                      {!matchLoading && matches.length > 1 && (
                        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-2.5 space-y-1.5">
                          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">적용 혜택을 선택하세요</p>
                          {matches.map((m) => (
                            <label key={m.benefit.id} className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`benefit-${tx.id}`}
                                className="mt-0.5"
                                checked={selectedMatch?.benefit.id === m.benefit.id}
                                onChange={() => setSelectedMatch(m)}
                              />
                              <div>
                                <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                  {m.benefit.name}
                                  {m.benefit_type === 'cashback' && (
                                    <span className="ml-1.5 rounded bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 align-middle">적립</span>
                                  )}
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                  {m.benefit_type === 'cashback'
                                    ? `${formatWon(m.estimated_discount)} 적립 예정`
                                    : `${formatWon(parseAmountInput(editState.amount))} → ${formatWon(parseAmountInput(editState.amount) - m.estimated_discount)} (${formatWon(m.estimated_discount)} 할인)`}
                                </p>
                              </div>
                            </label>
                          ))}
                          <button type="button"
                            onClick={() => { setMatches([]); setSelectedMatch(null) }}
                            className="text-xs text-neutral-400 dark:text-neutral-500 underline"
                          >
                            혜택 미적용
                          </button>
                        </div>
                      )}

                      {!matchLoading && matches.length === 1 && selectedMatch && (
                        <div className={`rounded-xl border p-2.5 flex items-center justify-between gap-2 ${
                          selectedMatch.benefit_type === 'cashback' ? 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40' : 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40'
                        }`}>
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
                                {formatWon(parseAmountInput(editState.amount))} →{' '}
                                {formatWon(parseAmountInput(editState.amount) - selectedMatch.estimated_discount)}{' '}
                                <span className="font-normal">({formatWon(selectedMatch.estimated_discount)} 할인)</span>
                              </p>
                            )}
                          </div>
                          <button type="button"
                            onClick={() => { setMatches([]); setSelectedMatch(null) }}
                            className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500 underline"
                          >
                            취소
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {/* 분류 */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {getCategories(editState.type).map((c) => (
                      <button key={c} type="button"
                        onClick={() => setEditState((s) => s && { ...s, category: c })}
                        className={`min-h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
                          editState.category === c ? 'bg-coral-50 dark:bg-coral-900/30 text-coral-800 dark:text-coral-200' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {/* 날짜 */}
                  <input type="date"
                    value={editState.date}
                    onChange={(e) => setEditState((s) => s && { ...s, date: e.target.value })}
                    className="mb-2 min-h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                  />
                  {/* 메모 */}
                  <textarea
                    rows={2}
                    value={editState.memo}
                    onChange={(e) => setEditState((s) => s && { ...s, memo: e.target.value })}
                    placeholder="메모 (선택)"
                    className="mb-3 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleSave(tx.id)} disabled={saving}
                      className="min-h-9 flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600 disabled:opacity-50"
                    >
                      {saving ? <><LoadingSpinner size={14} /> 처리 중...</> : '저장'}
                    </button>
                    <button type="button" onClick={cancelEdit}
                      className="min-h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-4 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    >
                      취소
                    </button>
                  </div>
                </li>
              ) : (
                /* ── 일반 표시 ── */
                <li key={tx.id}
                  className="flex flex-col gap-1 border-b border-neutral-100 dark:border-neutral-800 px-4 py-3 transition-colors last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
                        {tx.merchant || tx.category}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {tx.merchant && (
                          <span className="text-sm text-neutral-500 dark:text-neutral-400">{tx.category}</span>
                        )}
                        {/* 결제방법 뱃지 */}
                        {tx.card_id && cardMap.get(tx.card_id) ? (
                          <span
                            className="text-xs font-semibold px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: cardMap.get(tx.card_id)!.color }}
                          >
                            {cardMap.get(tx.card_id)!.name}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400">
                            {tx.payment_method || '현금'}
                          </span>
                        )}
                        {/* 비정산 뱃지 — 목록엔 기록으로 보이지만 정산/예산/잔액엔 안 잡히는 거래임을 표시 */}
                        {tx.unsettled === 1 && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900">
                            비정산
                          </span>
                        )}
                        {/* 적립형 혜택 뱃지 — 결제액은 그대로라 금액 자체엔 안 보이므로 별도 표시 */}
                        {tx.cashback_amount > 0 && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            적립 {formatWon(tx.cashback_amount)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex flex-col items-end">
                        {/* 할인 혜택이 적용된 거래는 할인 전 금액도 함께 보여줌(취소선) */}
                        {tx.discount_amount > 0 && (
                          <span className="whitespace-nowrap text-xs text-neutral-400 dark:text-neutral-500 line-through">
                            {formatWon(tx.original_amount)}
                          </span>
                        )}
                        <span className={`whitespace-nowrap text-lg font-bold ${tx.type === 'income' ? 'text-blue-700 dark:text-blue-300' : 'text-coral-600 dark:text-coral-200'}`}>
                          {/* 지출은 항상 양수라 '-' 고정, 수입은 차감 항목(음수)이면 formatWon이 이미 '-'를 표시하므로 '+'를 붙이지 않음 */}
                          {tx.type === 'expense' ? '-' : tx.amount >= 0 ? '+' : ''}{formatWon(tx.amount)}
                        </span>
                      </div>
                      <button type="button" onClick={() => onDuplicate(tx)}
                        className="min-h-9 whitespace-nowrap rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      >
                        복제
                      </button>
                      <button type="button" onClick={() => startEdit(tx)}
                        className="min-h-9 whitespace-nowrap rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      >
                        수정
                      </button>
                      <button type="button" onClick={() => handleDelete(tx.id)}
                        className="min-h-9 whitespace-nowrap rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  {tx.memo && (
                    <p className="whitespace-pre-wrap break-words text-sm text-neutral-400 dark:text-neutral-500">{renderMemoWithHighlights(tx.memo)}</p>
                  )}
                </li>
              )
            )}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default TransactionList
