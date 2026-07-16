import { useState } from 'react'
import AnnualSettlementTable from './AnnualSettlementTable'
import DailySettlement from './DailySettlement'
import MonthlySettlementTable from './MonthlySettlementTable'
import WeeklySettlement from './WeeklySettlement'
import type { Transaction } from '../types'

interface Props {
  onEditTransaction: (tx: Transaction) => void
}

type SubTab = 'daily' | 'weekly' | 'monthly' | 'annual'

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'daily',   label: '일일' },
  { id: 'weekly',  label: '주간' },
  { id: 'monthly', label: '월간' },
  { id: 'annual',  label: '연간' },
]

function OverviewView({ onEditTransaction }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('daily')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`min-h-10 rounded-xl text-sm font-bold transition-colors ${
              subTab === t.id ? 'bg-coral-400 text-white' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'daily' && <DailySettlement onEditTransaction={onEditTransaction} />}
      {subTab === 'weekly' && <WeeklySettlement />}
      {subTab === 'monthly' && <MonthlySettlementTable />}
      {subTab === 'annual' && <AnnualSettlementTable />}
    </div>
  )
}

export default OverviewView
