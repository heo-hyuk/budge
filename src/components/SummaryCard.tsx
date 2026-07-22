import Card from './ui/Card'
import { isCardSettlementSourcePaymentMethod } from '../lib/cardSettlementPaymentMethods'
import { formatWon } from '../lib/format'
import type { Transaction } from '../types'

interface Props {
  transactions: Transaction[]
  month: string // 'YYYY-MM'
}

function SummaryCard({ transactions, month }: Props) {
  // 카드정산기에서 소스로 선택한 결제방법(예: "예정")으로 등록된 수입은 아직 실제
  // 입금 확인 전이라 잔액/수입/지출 합산에서 제외(목록 자체엔 그대로 보임)
  const settled = transactions.filter((t) => !isCardSettlementSourcePaymentMethod(t.payment_method || '현금'))

  // 선택된 월의 수입/지출/잔액 계산
  const income  = settled.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = settled.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense

  const [year, mon] = month.split('-')
  const label = `${year}년 ${parseInt(mon)}월 요약`

  return (
    <Card>
      <h2 className="text-base font-bold text-neutral-700 dark:text-neutral-300">{label}</h2>

      {/* 잔액을 가장 크게 강조하고, 수입/지출은 보조 지표로 하단에 작게 표시 */}
      <div className="mt-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 p-4">
        <dt className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">잔액</dt>
        <dd className="mt-1 text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">{formatWon(balance)}</dd>
      </div>

      {/* 좁은 화면에서는 큰 금액이 "원"만 다음 줄로 떨어지며 어색해지므로 세로로 쌓고, sm 이상에서 2열로 */}
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3">
          <dt className="text-xs font-semibold text-blue-800 dark:text-blue-300">수입</dt>
          <dd className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{formatWon(income)}</dd>
        </div>
        <div className="rounded-xl bg-coral-50 dark:bg-coral-900/30 p-3">
          <dt className="text-xs font-semibold text-coral-800 dark:text-coral-200">지출</dt>
          <dd className="mt-1 text-lg font-bold text-coral-600 dark:text-coral-200">{formatWon(expense)}</dd>
        </div>
      </dl>
    </Card>
  )
}

export default SummaryCard
