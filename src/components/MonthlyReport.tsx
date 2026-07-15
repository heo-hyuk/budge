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

function MonthlyReport({ month, cards }: Props) {
  const [monthlyTx, setMonthlyTx] = useState<Transaction[]>([])
  const [cardBills, setCardBills] = useState<CardBill[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-neutral-800">{label}</h2>

      {/* 요약 카드 */}
      <div className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-neutral-500 mb-3">수입</h3>
        <div className="space-y-2 mb-4">
          <Row label="현금 수입" amount={cashIncome} color="blue" />
          {cardIncome > 0 && <Row label="카드 입금" amount={cardIncome} color="blue" />}
          <Row label="합계" amount={totalIncome} color="blue" bold />
        </div>

        <h3 className="text-sm font-bold text-neutral-500 mb-3 pt-3 border-t border-neutral-100">실지출</h3>
        <div className="space-y-2 mb-4">
          <Row label="현금 지출" amount={cashExpense} color="red" />
          <Row label="카드 청구 합계" amount={totalCardBill} color="red" />
          <Row label="합계" amount={totalExpense} color="red" bold />
        </div>

        <div className="pt-3 border-t-2 border-neutral-200">
          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-neutral-700">잔액</span>
            <span className={`text-2xl font-extrabold ${balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
              {balance >= 0 ? '+' : ''}{formatWon(balance)}
            </span>
          </div>
        </div>
      </div>

      {/* 카드별 청구 내역 */}
      {cardBills.length > 0 && (
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
                <div className="flex items-center gap-3">
                  <div className="h-8 w-12 rounded-md" style={{ backgroundColor: bill.card.color }} />
                  <div>
                    <p className="text-base font-bold text-neutral-900">{bill.card.name}</p>
                    <p className="text-xs text-neutral-500">
                      {bill.start} ~ {bill.end} 사용분 · {bill.billingDate} 결제
                    </p>
                  </div>
                </div>
                <div className="text-right">
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
                            className="flex items-center justify-between px-5 py-2.5 border-b border-neutral-100 last:border-b-0"
                          >
                            <div>
                              <p className="text-sm font-semibold text-neutral-800">
                                {tx.merchant || tx.category}
                              </p>
                              <p className="text-xs text-neutral-400">
                                {tx.date} · {tx.category}
                                {tx.memo ? ` · ${tx.memo}` : ''}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-red-700">
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

      {/* 현금 지출 상세 */}
      {cashExpense > 0 && (
        <div className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-neutral-700 mb-3">현금 지출 내역</h3>
          <ul className="space-y-2">
            {monthlyTx
              .filter((t) => t.type === 'expense' && !t.card_id)
              .map((tx) => (
                <li key={tx.id} className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">
                      {tx.merchant || tx.category}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {tx.date} · {tx.category}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-red-700">-{formatWon(tx.amount)}</span>
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
