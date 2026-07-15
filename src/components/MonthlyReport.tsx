import { useEffect, useState } from 'react'
import { getCardBillingPeriod } from '../lib/billing'
import { fetchTransactions } from '../lib/api'
import { formatWon } from '../lib/format'
import type { Card, Transaction } from '../types'

interface Props {
  month: string   // 'YYYY-MM'
  cards: Card[]
}

interface CardBill {
  card: Card
  start: string
  end: string
  billingDate: string
  amount: number
  transactions: Transaction[]
}

type SettlementView = 'expense' | 'income'

function MonthlyReport({ month, cards }: Props) {
  const [monthlyTx, setMonthlyTx] = useState<Transaction[]>([])
  const [cardBills, setCardBills] = useState<CardBill[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [view, setView] = useState<SettlementView>('expense')

  const [year, mon] = month.split('-')
  const label = `${year}년 ${parseInt(mon)}월 정산`

  useEffect(() => {
    setLoading(true)
    Promise.all([
      // 이번달 전체 거래
      fetchTransactions({ month }),
      // 카드별 청구 기간 거래
      ...cards.map((card) => {
        const { start, end } = getCardBillingPeriod(month, card)
        return fetchTransactions({ card_id: card.id, date_start: start, date_end: end })
          .then((txs) => ({ card, start, end, txs }))
      }),
    ]).then(([txs, ...cardResults]) => {
      setMonthlyTx(txs as Transaction[])
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
  }, [month, cards])

  if (loading) return <p className="text-base text-neutral-500">불러오는 중...</p>

  // 현금 수입/지출 (카드 거래 제외)
  const cashIncome  = monthlyTx.filter((t) => t.type === 'income'  && !t.card_id).reduce((s, t) => s + t.amount, 0)
  const cardIncome  = monthlyTx.filter((t) => t.type === 'income'  &&  t.card_id).reduce((s, t) => s + t.amount, 0)
  const cashExpense = monthlyTx.filter((t) => t.type === 'expense' && !t.card_id).reduce((s, t) => s + t.amount, 0)
  const totalIncome = cashIncome + cardIncome

  // 이번달 실제 카드 청구 합계
  const totalCardBill = cardBills.reduce((s, b) => s + b.amount, 0)

  // 실지출 = 현금지출 + 카드 청구액
  const totalExpense = cashExpense + totalCardBill
  const balance = totalIncome - totalExpense

  // 카드 입금 내역 (드문 케이스지만 수입정산에서 확인 가능해야 함)
  const cashIncomeList = monthlyTx.filter((t) => t.type === 'income' && !t.card_id)
  const cardIncomeList = monthlyTx.filter((t) => t.type === 'income' && t.card_id)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-neutral-800">{label}</h2>

      {/* 잔액 요약 (항상 표시) */}
      <div className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
        {/* 좁은 화면에서는 큰 금액이 어색하게 줄바꿈되므로 세로로 쌓고, sm 이상에서 2열로 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-neutral-500">수입 합계</p>
            <p className="text-lg font-extrabold text-blue-700">{formatWon(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500">지출 합계</p>
            <p className="text-lg font-extrabold text-red-700">{formatWon(totalExpense)}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t-2 border-neutral-200 flex items-baseline justify-between">
          <span className="text-base font-bold text-neutral-700">잔액</span>
          <span className={`text-2xl font-extrabold ${balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            {balance >= 0 ? '+' : ''}{formatWon(balance)}
          </span>
        </div>
      </div>

      {/* 지출정산 / 수입정산 탭 */}
      <div className="flex rounded-xl bg-neutral-100 p-1">
        <button
          type="button"
          onClick={() => setView('expense')}
          className={`flex-1 min-h-10 rounded-lg text-sm font-bold transition-colors ${
            view === 'expense' ? 'bg-white text-red-700 shadow-sm' : 'text-neutral-500'
          }`}
        >
          지출정산
        </button>
        <button
          type="button"
          onClick={() => setView('income')}
          className={`flex-1 min-h-10 rounded-lg text-sm font-bold transition-colors ${
            view === 'income' ? 'bg-white text-blue-700 shadow-sm' : 'text-neutral-500'
          }`}
        >
          수입정산
        </button>
      </div>

      {/* 수입정산 */}
      {view === 'income' && (
        <>
          <div className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-neutral-500 mb-3">수입</h3>
            <div className="space-y-2">
              <Row label="현금 수입" amount={cashIncome} color="blue" />
              {cardIncome > 0 && <Row label="카드 입금" amount={cardIncome} color="blue" />}
              <Row label="합계" amount={totalIncome} color="blue" bold />
            </div>
          </div>

          {cashIncomeList.length > 0 && (
            <div className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-neutral-700 mb-3">현금 수입 내역</h3>
              <ul className="space-y-2">
                {cashIncomeList.map((tx) => (
                  <li key={tx.id} className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-800">
                        {tx.merchant || tx.category}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {tx.date} · {tx.category}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-sm font-bold text-blue-700">+{formatWon(tx.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cardIncomeList.length > 0 && (
            <div className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-neutral-700 mb-3">카드 입금 내역</h3>
              <ul className="space-y-2">
                {cardIncomeList.map((tx) => (
                  <li key={tx.id} className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-800">
                        {tx.merchant || tx.category}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {tx.date} · {tx.category}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-sm font-bold text-blue-700">+{formatWon(tx.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cashIncomeList.length === 0 && cardIncomeList.length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-4">이번 달 수입 내역이 없습니다</p>
          )}
        </>
      )}

      {/* 지출정산 */}
      {view === 'expense' && (
        <div className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-neutral-500 mb-3">실지출</h3>
          <div className="space-y-2">
            <Row label="현금 지출" amount={cashExpense} color="red" />
            <Row label="카드 청구 합계" amount={totalCardBill} color="red" />
            <Row label="합계" amount={totalExpense} color="red" bold />
          </div>
        </div>
      )}

      {/* 카드별 청구 내역 (지출정산에서만) */}
      {view === 'expense' && cardBills.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-neutral-700">카드별 청구 내역</h3>
          {cardBills.map((bill) => (
            <div
              key={bill.card.id}
              className="rounded-2xl border-2 border-neutral-200 bg-white shadow-sm overflow-hidden"
            >
              {/* 카드 헤더 */}
              <button
                type="button"
                onClick={() => setExpandedCard(expandedCard === bill.card.id ? null : bill.card.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-12 rounded-md shrink-0" style={{ backgroundColor: bill.card.color }} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-neutral-900">{bill.card.name}</p>
                    <p className="text-xs text-neutral-500">
                      {bill.start} ~ {bill.end} 사용분 · {bill.billingDate} 결제
                    </p>
                  </div>
                </div>
                {/* 금액/화살표는 줄어들면 안 되므로 shrink-0 — 없으면 "0원"조차 글자 단위로 쪼개짐 */}
                <div className="shrink-0 whitespace-nowrap text-right pl-2">
                  <p className="text-base font-bold text-red-700">{formatWon(bill.amount)}</p>
                  <p className="text-xs text-neutral-400">{expandedCard === bill.card.id ? '▲' : '▼'}</p>
                </div>
              </button>

              {/* 세부 내역 펼치기 */}
              {expandedCard === bill.card.id && (
                <div className="border-t-2 border-neutral-100">
                  {bill.transactions.filter((t) => t.type === 'expense').length === 0 ? (
                    <p className="px-5 py-3 text-sm text-neutral-400">내역 없음</p>
                  ) : (
                    <ul>
                      {bill.transactions
                        .filter((t) => t.type === 'expense')
                        .map((tx) => (
                          <li
                            key={tx.id}
                            className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-neutral-100 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-neutral-800">
                                {tx.merchant || tx.category}
                              </p>
                              <p className="text-xs text-neutral-400">
                                {tx.date} · {tx.category}
                                {tx.memo ? ` · ${tx.memo}` : ''}
                              </p>
                            </div>
                            <span className="shrink-0 whitespace-nowrap text-sm font-bold text-red-700">
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
        <div className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-neutral-700 mb-3">현금 지출 내역</h3>
          <ul className="space-y-2">
            {monthlyTx
              .filter((t) => t.type === 'expense' && !t.card_id)
              .map((tx) => (
                <li key={tx.id} className="flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-800">
                      {tx.merchant || tx.category}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {tx.date} · {tx.category}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-sm font-bold text-red-700">-{formatWon(tx.amount)}</span>
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
  color: 'blue' | 'red'
  bold?: boolean
}) {
  return (
    <div className={`flex justify-between items-center ${bold ? 'pt-2 border-t border-neutral-100' : ''}`}>
      <span className={`text-sm ${bold ? 'font-bold text-neutral-700' : 'text-neutral-500'}`}>
        {label}
      </span>
      <span
        className={`text-sm font-bold ${
          color === 'blue' ? 'text-blue-700' : 'text-red-700'
        } ${bold ? 'text-base' : ''}`}
      >
        {formatWon(amount)}
      </span>
    </div>
  )
}

export default MonthlyReport
