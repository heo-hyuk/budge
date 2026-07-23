import { useEffect, useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import { getCardBillingPeriod } from '../lib/billing'
import { fetchTransactions } from '../lib/api'
import { formatWon } from '../lib/format'
import { migrateLegacyLocalStorage } from '../lib/legacyMigration'
import { getMonthlyBasis, loadSettings, setMonthlyBasis } from '../lib/settings'
import type { Card, Transaction } from '../types'

interface Props {
  month: string   // 'YYYY-MM'
  cards: Card[]
  categories?: string[]
}

interface CardBill {
  card: Card
  start: string       // basis='transaction'일 때는 빈 문자열
  end: string
  billingDate: string
  amount: number
  transactions: Transaction[]
}

type SettlementView = 'expense' | 'income'
// billing = 카드 청구(출금)일 기준, transaction = 거래(결제)한 날짜 기준
type DateBasis = 'billing' | 'transaction'

function MonthlyReport({ month, cards, categories = [] }: Props) {
  const { showToast } = useToast()
  const [monthlyTx, setMonthlyTx] = useState<Transaction[]>([])
  const [cardBills, setCardBills] = useState<CardBill[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [view, setView] = useState<SettlementView>('expense')
  const [basis, setBasis] = useState<DateBasis>(getMonthlyBasis)

  const [year, mon] = month.split('-')
  const label = `${year}년 ${parseInt(mon)}월 정산`
  const shortMonthLabel = `${parseInt(mon)}월`

  // 마운트 시점엔 서버 설정이 아직 로드되기 전이라 기본값(billing)일 수 있음 —
  // 로드가 끝나면 실제 값으로 재동기화
  useEffect(() => {
    migrateLegacyLocalStorage().then(loadSettings).then(() => setBasis(getMonthlyBasis()))
  }, [])

  async function changeBasis(next: DateBasis) {
    setBasis(next)
    try {
      await setMonthlyBasis(next)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '설정을 저장하지 못했습니다', 'error')
    }
  }

  useEffect(() => {
    setLoading(true)

    // 비정산 거래는 "기록"으로는 다른 화면(홈 등)에도 보이지만 이 정산 리포트는
    // 실제 회계 합계라 항상 제외해야 함(fetchTransactions 기본 조회가 이제 비정산도
    // 함께 반환하므로 여기서 걸러냄)
    const settledOnly = (txs: Transaction[]) => txs.filter((t) => t.unsettled !== 1)

    if (basis === 'billing') {
      // 출금일 기준 — 카드별로 실제 청구(출금)될 기간을 계산해 그 기간의 거래를 따로 조회
      Promise.all([
        fetchTransactions({ month }),
        ...cards.map((card) => {
          const { start, end } = getCardBillingPeriod(month, card)
          return fetchTransactions({ card_id: card.id, date_start: start, date_end: end })
            .then((txs) => ({ card, start, end, txs: settledOnly(txs) }))
        }),
      ]).then(([txs, ...cardResults]) => {
        setMonthlyTx(settledOnly(txs as Transaction[]))
        setCardBills(
          (cardResults as { card: Card; start: string; end: string; txs: Transaction[] }[]).map(
            ({ card, start, end, txs }) => {
              const { billingDate } = getCardBillingPeriod(month, card)
              const amount = txs
                .filter((t) => t.type === 'expense')
                .reduce((s, t) => s + t.amount, 0)
              return { card, start, end, billingDate, amount, transactions: txs }
            }
          )
        )
      }).finally(() => setLoading(false))
    } else {
      // 거래일 기준 — 이미 조회한 이번 달 전체 거래를 카드별로 묶기만 하면 됨 (별도 조회 불필요)
      fetchTransactions({ month }).then((raw) => {
        const txs = settledOnly(raw)
        setMonthlyTx(txs)
        setCardBills(
          cards.map((card) => {
            const cardTxs = txs.filter((t) => t.card_id === card.id)
            const amount = cardTxs
              .filter((t) => t.type === 'expense')
              .reduce((s, t) => s + t.amount, 0)
            return { card, start: '', end: '', billingDate: '', amount, transactions: cardTxs }
          })
        )
      }).finally(() => setLoading(false))
    }
  }, [month, cards, basis])

  if (loading) return <p className="text-base text-neutral-500 dark:text-neutral-400">불러오는 중...</p>

  // 분류 필터 — 선택된 분류가 있으면 집계 전에 거래 목록 자체를 필터링
  const filteredMonthlyTx = categories.length > 0 ? monthlyTx.filter((t) => categories.includes(t.category)) : monthlyTx
  const filteredCardBills = categories.length > 0
    ? cardBills.map((bill) => {
        const transactions = bill.transactions.filter((t) => categories.includes(t.category))
        const amount = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
        return { ...bill, transactions, amount }
      })
    : cardBills

  // 현금 수입/지출 (카드 거래 제외)
  const cashIncome  = filteredMonthlyTx.filter((t) => t.type === 'income'  && !t.card_id).reduce((s, t) => s + t.amount, 0)
  const cardIncome  = filteredMonthlyTx.filter((t) => t.type === 'income'  &&  t.card_id).reduce((s, t) => s + t.amount, 0)
  const cashExpense = filteredMonthlyTx.filter((t) => t.type === 'expense' && !t.card_id).reduce((s, t) => s + t.amount, 0)
  const totalIncome = cashIncome + cardIncome

  // 이번달 실제 카드 청구 합계
  const totalCardBill = filteredCardBills.reduce((s, b) => s + b.amount, 0)

  // 실지출 = 현금지출 + 카드 청구액
  const totalExpense = cashExpense + totalCardBill
  const balance = totalIncome - totalExpense

  // 카드 입금 내역 (드문 케이스지만 수입정산에서 확인 가능해야 함)
  const cashIncomeList = filteredMonthlyTx.filter((t) => t.type === 'income' && !t.card_id)
  const cardIncomeList = filteredMonthlyTx.filter((t) => t.type === 'income' && t.card_id)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">{label}</h2>

        {/* 카드 지출 집계 기준 — 출금(청구)일 기준 vs 거래(결제)일 기준, 기기에 선호 저장 */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">카드 지출 집계</span>
          <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5">
            <button
              type="button"
              onClick={() => changeBasis('billing')}
              className={`min-h-7 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                basis === 'billing' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              출금일 기준
            </button>
            <button
              type="button"
              onClick={() => changeBasis('transaction')}
              className={`min-h-7 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                basis === 'transaction' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              거래일 기준
            </button>
          </div>
        </div>
      </div>

      {/* 잔액 요약 (항상 표시) */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm">
        {/* 좁은 화면에서는 큰 금액이 어색하게 줄바꿈되므로 세로로 쌓고, sm 이상에서 2열로 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">수입 합계</p>
            <p className="text-lg font-extrabold text-blue-700 dark:text-blue-300">{formatWon(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">지출 합계</p>
            <p className="text-lg font-extrabold text-coral-600 dark:text-coral-200">{formatWon(totalExpense)}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-baseline justify-between">
          <span className="text-base font-bold text-neutral-700 dark:text-neutral-300">잔액</span>
          <span className={`text-2xl font-extrabold ${balance >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-coral-600 dark:text-coral-200'}`}>
            {balance >= 0 ? '+' : ''}{formatWon(balance)}
          </span>
        </div>
      </div>

      {/* 지출정산 / 수입정산 탭 */}
      <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
        <button
          type="button"
          onClick={() => setView('expense')}
          className={`flex-1 min-h-10 rounded-lg text-sm font-bold transition-colors ${
            view === 'expense' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          지출정산
        </button>
        <button
          type="button"
          onClick={() => setView('income')}
          className={`flex-1 min-h-10 rounded-lg text-sm font-bold transition-colors ${
            view === 'income' ? 'bg-white dark:bg-neutral-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          수입정산
        </button>
      </div>

      {/* 수입정산 */}
      {view === 'income' && (
        <>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mb-3">수입</h3>
            <div className="space-y-2">
              <Row label="현금 수입" amount={cashIncome} color="blue" />
              {cardIncome > 0 && <Row label="카드 입금" amount={cardIncome} color="blue" />}
              <Row label="합계" amount={totalIncome} color="blue" bold />
            </div>
          </div>

          {cashIncomeList.length > 0 && (
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm">
              <h3 className="text-base font-bold text-neutral-700 dark:text-neutral-300 mb-3">현금 수입 내역</h3>
              <ul className="space-y-2">
                {cashIncomeList.map((tx) => (
                  <li key={tx.id} className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                        {tx.merchant || tx.category}
                      </p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                        {tx.date} · {tx.category}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-sm font-bold text-blue-700 dark:text-blue-300">{tx.amount >= 0 ? '+' : ''}{formatWon(tx.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cardIncomeList.length > 0 && (
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm">
              <h3 className="text-base font-bold text-neutral-700 dark:text-neutral-300 mb-3">카드 입금 내역</h3>
              <ul className="space-y-2">
                {cardIncomeList.map((tx) => (
                  <li key={tx.id} className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                        {tx.merchant || tx.category}
                      </p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                        {tx.date} · {tx.category}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-sm font-bold text-blue-700 dark:text-blue-300">{tx.amount >= 0 ? '+' : ''}{formatWon(tx.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cashIncomeList.length === 0 && cardIncomeList.length === 0 && (
            <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">이번 달 수입 내역이 없습니다</p>
          )}
        </>
      )}

      {/* 지출정산 */}
      {view === 'expense' && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mb-3">실지출</h3>
          <div className="space-y-2">
            <Row label="현금 지출" amount={cashExpense} color="coral" />
            <Row label="카드 청구 합계" amount={totalCardBill} color="coral" />
            <Row label="합계" amount={totalExpense} color="coral" bold />
          </div>
        </div>
      )}

      {/* 카드별 청구 내역 (지출정산에서만) */}
      {view === 'expense' && filteredCardBills.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-neutral-700 dark:text-neutral-300">카드별 청구 내역</h3>
          {filteredCardBills.map((bill) => (
            <div
              key={bill.card.id}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden"
            >
              {/* 카드 헤더 */}
              <button
                type="button"
                onClick={() => setExpandedCard(expandedCard === bill.card.id ? null : bill.card.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-12 rounded-md shrink-0" style={{ backgroundColor: bill.card.color }} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-neutral-900 dark:text-neutral-100">{bill.card.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {basis === 'billing'
                        ? `${bill.start} ~ ${bill.end} 사용분 · ${bill.billingDate} 결제`
                        : `${shortMonthLabel} 거래 기준`}
                    </p>
                  </div>
                </div>
                {/* 금액/화살표는 줄어들면 안 되므로 shrink-0 — 없으면 "0원"조차 글자 단위로 쪼개짐 */}
                <div className="shrink-0 whitespace-nowrap text-right pl-2">
                  <p className="text-base font-bold text-coral-600 dark:text-coral-200">{formatWon(bill.amount)}</p>
                  <p className="mt-0.5 flex justify-end text-neutral-400 dark:text-neutral-500">
                    {expandedCard === bill.card.id ? <span>▲</span> : <span>▼</span>}
                  </p>
                </div>
              </button>

              {/* 세부 내역 펼치기 */}
              {expandedCard === bill.card.id && (
                <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                  {bill.transactions.filter((t) => t.type === 'expense').length === 0 ? (
                    <p className="px-6 py-3 text-sm text-neutral-400 dark:text-neutral-500">내역 없음</p>
                  ) : (
                    <ul>
                      {bill.transactions
                        .filter((t) => t.type === 'expense')
                        .map((tx) => (
                          <li
                            key={tx.id}
                            className="flex items-center justify-between gap-2 px-6 py-2.5 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                                {tx.merchant || tx.category}
                              </p>
                              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                                {tx.date} · {tx.category}
                                {tx.memo ? ` · ${tx.memo}` : ''}
                              </p>
                            </div>
                            <span className="shrink-0 whitespace-nowrap text-sm font-bold text-coral-600 dark:text-coral-200">
                              -{formatWon(tx.amount)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 현금 지출 상세 (지출정산에서만) */}
      {view === 'expense' && cashExpense > 0 && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm">
          <h3 className="text-base font-bold text-neutral-700 dark:text-neutral-300 mb-3">현금 지출 내역</h3>
          <ul className="space-y-2">
            {filteredMonthlyTx
              .filter((t) => t.type === 'expense' && !t.card_id)
              .map((tx) => (
                <li key={tx.id} className="flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      {tx.merchant || tx.category}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">
                      {tx.date} · {tx.category}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-sm font-bold text-coral-600 dark:text-coral-200">-{formatWon(tx.amount)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// 정산 행 컴포넌트
function Row({
  label, amount, color, bold = false,
}: {
  label: string
  amount: number
  color: 'blue' | 'coral'
  bold?: boolean
}) {
  return (
    <div className={`flex justify-between items-center ${bold ? 'pt-2 border-t border-neutral-100 dark:border-neutral-800' : ''}`}>
      <span className={`text-sm ${bold ? 'font-bold text-neutral-700 dark:text-neutral-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
        {label}
      </span>
      <span
        className={`text-sm font-bold ${
          color === 'blue' ? 'text-blue-700 dark:text-blue-300' : 'text-coral-600 dark:text-coral-200'
        } ${bold ? 'text-base' : ''}`}
      >
        {formatWon(amount)}
      </span>
    </div>
  )
}

export default MonthlyReport
