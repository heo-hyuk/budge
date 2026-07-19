import { getCategories } from '../lib/categories'

interface Props {
  selected: string[]
  onChange: (next: string[]) => void
}

/** 정산 화면 상단의 분류 다중 선택 필터 — 지출+수입 분류를 칩으로 나열, 0개 선택 = 전체 */
function CategoryFilterBar({ selected, onChange }: Props) {
  const expenseCategories = getCategories('expense')
  const incomeCategories = getCategories('income')

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name])
  }

  function chipClass(active: boolean) {
    return `min-h-7 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors ${
      active ? 'bg-coral-400 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
    }`
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => onChange([])} className={chipClass(selected.length === 0)}>
        전체
      </button>
      {expenseCategories.map((c) => (
        <button key={c} type="button" onClick={() => toggle(c)} className={chipClass(selected.includes(c))}>
          {c}
        </button>
      ))}
      <span className="mx-0.5 h-4 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />
      {incomeCategories.map((c) => (
        <button key={c} type="button" onClick={() => toggle(c)} className={chipClass(selected.includes(c))}>
          {c}
        </button>
      ))}
    </div>
  )
}

export default CategoryFilterBar
