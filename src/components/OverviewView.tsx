import { useState } from 'react'
import AnnualReport from './AnnualReport'
import AnnualSettlementTable from './AnnualSettlementTable'
import CategoryFilterBar from './CategoryFilterBar'
import DailySettlement from './DailySettlement'
import MonthlyReport from './MonthlyReport'
import MonthlySettlementTable from './MonthlySettlementTable'
import WeeklySettlement from './WeeklySettlement'
import type { Card, Transaction } from '../types'

interface Props {
  onEditTransaction: (tx: Transaction) => void
  cards: Card[]
}

type SubTab = 'daily' | 'weekly' | 'monthly' | 'annual'
type MonthlyView = 'table' | 'card'
type AnnualView = 'table' | 'chart'

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'daily',   label: '일일' },
  { id: 'weekly',  label: '주간' },
  { id: 'monthly', label: '월간' },
  { id: 'annual',  label: '연간' },
]

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentYear(): string {
  return String(new Date().getFullYear())
}

// 카드 정산 push 알림 딥링크(?tab=overview&view=monthly)로 들어오면 월간 탭의
// 카드별 청구 화면으로 바로 열어준다
function initialSubTabFromUrl(): SubTab {
  const v = new URLSearchParams(window.location.search).get('view')
  return SUB_TABS.some((t) => t.id === v) ? (v as SubTab) : 'daily'
}

function initialMonthlyViewFromUrl(): MonthlyView {
  return new URLSearchParams(window.location.search).get('view') === 'monthly' ? 'card' : 'table'
}

function OverviewView({ onEditTransaction, cards }: Props) {
  const [subTab, setSubTab] = useState<SubTab>(initialSubTabFromUrl)
  const [categories, setCategories] = useState<string[]>([])
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)
  const [monthlyView, setMonthlyView] = useState<MonthlyView>(initialMonthlyViewFromUrl)
  const [annualView, setAnnualView] = useState<AnnualView>('table')

  const isThisMonth = month === currentMonth()
  const isThisYear = year === currentYear()
  const [y, mon] = month.split('-')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`min-h-10 rounded-xl text-sm font-bold transition-colors ${
              subTab === t.id ? 'bg-coral-400 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <CategoryFilterBar selected={categories} onChange={setCategories} />

      {subTab === 'daily' && <DailySettlement onEditTransaction={onEditTransaction} categories={categories} />}
      {subTab === 'weekly' && <WeeklySettlement categories={categories} />}

      {subTab === 'monthly' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >◀</button>
              <span className="min-w-24 text-center text-sm font-bold text-neutral-800 dark:text-neutral-200">
                {y}년 {parseInt(mon)}월
              </span>
              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                disabled={isThisMonth}
                className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-100"
              >▶</button>
              {!isThisMonth && (
                <button
                  type="button"
                  onClick={() => setMonth(currentMonth())}
                  className="min-h-8 rounded-lg bg-coral-400 px-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-600"
                >이번 달</button>
              )}
            </div>
            <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1">
              <button
                type="button"
                onClick={() => setMonthlyView('table')}
                className={`min-h-8 rounded-md px-3 text-xs font-bold transition-colors ${
                  monthlyView === 'table' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >분류별 표</button>
              <button
                type="button"
                onClick={() => setMonthlyView('card')}
                className={`min-h-8 rounded-md px-3 text-xs font-bold transition-colors ${
                  monthlyView === 'card' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >카드별 청구</button>
            </div>
          </div>

          {monthlyView === 'table'
            ? <MonthlySettlementTable month={month} categories={categories} />
            : <MonthlyReport month={month} cards={cards} categories={categories} />}
        </div>
      )}

      {subTab === 'annual' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setYear((yr) => String(parseInt(yr) - 1))}
                className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >◀</button>
              <span className="min-w-16 text-center text-sm font-bold text-neutral-800 dark:text-neutral-200">{year}년</span>
              <button
                type="button"
                onClick={() => setYear((yr) => String(parseInt(yr) + 1))}
                disabled={isThisYear}
                className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-100"
              >▶</button>
              {!isThisYear && (
                <button
                  type="button"
                  onClick={() => setYear(currentYear())}
                  className="min-h-8 rounded-lg bg-coral-400 px-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-600"
                >올해</button>
              )}
            </div>
            <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1">
              <button
                type="button"
                onClick={() => setAnnualView('table')}
                className={`min-h-8 rounded-md px-3 text-xs font-bold transition-colors ${
                  annualView === 'table' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >분류별 표</button>
              <button
                type="button"
                onClick={() => setAnnualView('chart')}
                className={`min-h-8 rounded-md px-3 text-xs font-bold transition-colors ${
                  annualView === 'chart' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >차트·내보내기</button>
            </div>
          </div>

          {annualView === 'table'
            ? <AnnualSettlementTable year={year} categories={categories} />
            : <AnnualReport year={year} categories={categories} />}
        </div>
      )}
    </div>
  )
}

export default OverviewView
