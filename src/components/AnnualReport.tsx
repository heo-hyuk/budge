import { useEffect, useState } from 'react'
import { fetchTransactions } from '../lib/api'
import { formatWon } from '../lib/format'
import type { Transaction } from '../types'
import ExportButton from './ExportButton'

interface Props {
  year: string  // 'YYYY'
}

interface MonthStat {
  month: string   // 'YYYY-MM'
  label: string   // 'n월'
  income: number
  expense: number
}

function AnnualReport({ year }: Props) {
  const [stats, setStats] = useState<MonthStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchTransactions({ year }).then((txs: Transaction[]) => {
      // 12개월치 집계
      const monthMap = new Map<string, { income: number; expense: number }>()
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`
        monthMap.set(key, { income: 0, expense: 0 })
      }
      for (const tx of txs) {
        const key = tx.date.slice(0, 7)
        const stat = monthMap.get(key)
        if (!stat) continue
        if (tx.type === 'income')  stat.income  += tx.amount
        if (tx.type === 'expense') stat.expense += tx.amount
      }
      setStats(
        Array.from(monthMap.entries()).map(([month, { income, expense }]) => ({
          month,
          label: `${parseInt(month.split('-')[1])}월`,
          income,
          expense,
        }))
      )
    }).finally(() => setLoading(false))
  }, [year])

  if (loading) return <p className="text-base text-neutral-500">불러오는 중...</p>

  const totalIncome  = stats.reduce((s, m) => s + m.income,  0)
  const totalExpense = stats.reduce((s, m) => s + m.expense, 0)
  const maxVal = Math.max(...stats.map((m) => Math.max(m.income, m.expense)), 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-neutral-800">{year}년 연간 정산</h2>
        <ExportButton defaultPreset="this_year" year={year} />
      </div>

      {/* 연 합계 */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        {/* 좁은 화면에서는 큰 금액이 줄바꿈되며 어색해지므로 세로로 쌓고, sm 이상에서 3열로 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-800">연 수입</p>
            <p className="mt-1 text-base font-bold text-blue-700">{formatWon(totalIncome)}</p>
          </div>
          <div className="rounded-xl bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-800">연 지출</p>
            <p className="mt-1 text-base font-bold text-red-700">{formatWon(totalExpense)}</p>
          </div>
          <div className="rounded-xl bg-brand-50 p-3">
            <p className="text-xs font-semibold text-brand-800">연 잔액</p>
            <p className={`mt-1 text-base font-bold ${totalIncome - totalExpense >= 0 ? 'text-brand-900' : 'text-red-700'}`}>
              {formatWon(totalIncome - totalExpense)}
            </p>
          </div>
        </div>
      </div>

      {/* 월별 바 차트 */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4 mb-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-blue-500" />수입</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-red-400" />지출</span>
        </div>
        <div className="space-y-3">
          {stats.map((m) => (
            <div key={m.month}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 text-xs font-semibold text-neutral-500 shrink-0">
                  {m.label}
                </span>
                <div className="flex-1 space-y-1">
                  {/* 수입 바 */}
                  <div className="h-4 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-[width] duration-300"
                      style={{ width: `${(m.income / maxVal) * 100}%` }}
                    />
                  </div>
                  {/* 지출 바 */}
                  <div className="h-4 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full transition-[width] duration-300"
                      style={{ width: `${(m.expense / maxVal) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 월별 숫자 표 — 좁은 화면에서는 셀 안에서 줄바꿈되며 찌그러지는 대신 표 자체가 가로 스크롤되게 함 */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="whitespace-nowrap px-4 py-2.5 text-left font-semibold text-neutral-500">월</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-blue-700">수입</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-red-700">지출</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-neutral-700">잔액</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((m) => {
                const bal = m.income - m.expense
                return (
                  <tr key={m.month} className="border-b border-neutral-100 transition-colors last:border-b-0 hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-neutral-700">{m.label}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-blue-700">
                      {m.income > 0 ? formatWon(m.income) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-red-700">
                      {m.expense > 0 ? formatWon(m.expense) : '—'}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold ${bal >= 0 ? 'text-neutral-800' : 'text-red-700'}`}>
                      {m.income === 0 && m.expense === 0 ? '—' : formatWon(bal)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AnnualReport
