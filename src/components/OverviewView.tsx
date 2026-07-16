import { useState } from 'react'
import DailySettlement from './DailySettlement'
import WeeklySettlement from './WeeklySettlement'
import type { Transaction } from '../types'

interface Props {
  onEditTransaction: (tx: Transaction) => void
}

type SubTab = 'daily' | 'weekly'

function OverviewView({ onEditTransaction }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('daily')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(['daily', 'weekly'] as SubTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={`min-h-10 rounded-xl text-sm font-bold transition-colors ${
              subTab === t ? 'bg-coral-400 text-white' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {t === 'daily' ? '일일' : '주간'}
          </button>
        ))}
      </div>

      {subTab === 'daily'
        ? <DailySettlement onEditTransaction={onEditTransaction} />
        : <WeeklySettlement />}
    </div>
  )
}

export default OverviewView
