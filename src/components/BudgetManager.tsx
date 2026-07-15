import { useState } from 'react'
import { BudgetConflictError, createBudget, deleteBudget, updateBudget } from '../lib/api'
import { getCategories } from '../lib/categories'
import { formatWon } from '../lib/format'
import type { BudgetStatus, NewBudget } from '../types'

interface Props {
  statuses: BudgetStatus[]
  month: string          // YYYY-MM (현재 선택 월)
  onRefresh: () => Promise<void>
}

interface FormState {
  category: string
  monthly_limit: string
  repeat: 'monthly' | 'once'  // monthly = NULL, once = 이번 달만
}

const EXPENSE_CATEGORIES = ['전체', ...getCategories('expense')]

function defaultForm(): FormState {
  return {
    category: '전체',
    monthly_limit: '',
    repeat: 'monthly',
  }
}

/** 퍼센트에 따른 색상 */
function barColor(pct: number): string {
  if (pct >= 100) return 'bg-red-500'
  if (pct >= 80)  return 'bg-amber-400'
  return 'bg-green-500'
}
function textColor(pct: number): string {
  if (pct >= 100) return 'text-red-700'
  if (pct >= 80)  return 'text-amber-700'
  return 'text-green-700'
}
function bgColor(pct: number): string {
  if (pct >= 100) return 'bg-red-50 border-red-200'
  if (pct >= 80)  return 'bg-amber-50 border-amber-200'
  return 'bg-neutral-50 border-neutral-200'
}

function BudgetManager({ statuses, month, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<FormState>(defaultForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [conflictTarget, setConflictTarget] = useState<BudgetStatus | null>(null)

  const [y, mon] = month.split('-')
  const monthLabel = `${y}년 ${parseInt(mon)}월`

  function startAdd() {
    setEditingId(null)
    setForm(defaultForm())
    setError('')
    setShowForm(true)
  }

  function startEdit(s: BudgetStatus) {
    setEditingId(s.budget.id)
    setForm({
      category: s.budget.category,
      monthly_limit: String(s.budget.monthly_limit),
      repeat: s.budget.year_month ? 'once' : 'monthly',
    })
    setError('')
    setConflictTarget(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setError('')
    setConflictTarget(null)
  }

  // 현재 선택된 반복 범위(매월반복/이번달만)에서 이미 예산이 설정된 카테고리 목록
  // (수정 중인 항목 자신은 제외)
  function takenCategories(repeat: FormState['repeat']): Set<string> {
    const set = new Set<string>()
    for (const s of statuses) {
      if (s.budget.active !== 1) continue
      if (editingId && s.budget.id === editingId) continue
      const isMonthly = s.budget.year_month === null
      if ((repeat === 'monthly') !== isMonthly) continue
      set.add(s.budget.category)
    }
    return set
  }

  async function handleSave() {
    const limit = parseInt(form.monthly_limit.replace(/[^0-9]/g, ''), 10)
    if (!form.category) { setError('카테고리를 선택하세요'); return }
    if (!limit || limit <= 0) { setError('금액을 입력하세요'); return }

    const payload: NewBudget = {
      category: form.category,
      monthly_limit: limit,
      year_month: form.repeat === 'once' ? month : null,
    }

    setSaving(true)
    setError('')
    setConflictTarget(null)
    try {
      if (editingId !== null) {
        await updateBudget(editingId, payload)
      } else {
        await createBudget(payload)
      }
      await onRefresh()
      cancelForm()
    } catch (e) {
      if (e instanceof BudgetConflictError) {
        setError(e.message)
        setConflictTarget(statuses.find((s) => s.budget.id === e.conflictId) ?? null)
      } else {
        setError(e instanceof Error ? e.message : '저장 실패')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, category: string) {
    if (!window.confirm(`"${category}" 예산을 삭제할까요?`)) return
    await deleteBudget(id)
    await onRefresh()
  }

  async function handleToggle(s: BudgetStatus) {
    await updateBudget(s.budget.id, { active: s.budget.active === 1 ? 0 : 1 })
    await onRefresh()
  }

  const exceededList = statuses.filter((s) => s.exceeded && s.budget.active === 1)

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-800">{monthLabel} 예산 관리</h2>
        <button
          type="button"
          onClick={startAdd}
          className="min-h-9 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"
        >
          + 예산 추가
        </button>
      </div>

      {/* 초과 경고 배너 */}
      {exceededList.length > 0 && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">⚠ 예산 초과 항목 {exceededList.length}건</p>
          <ul className="mt-1.5 space-y-0.5">
            {exceededList.map((s) => (
              <li key={s.budget.id} className="text-xs text-red-700">
                • {s.budget.category}: {formatWon(s.spent)} / {formatWon(s.budget.monthly_limit)}{' '}
                ({formatWon(Math.abs(s.remaining))} 초과)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 등록/수정 폼 */}
      {showForm && (
        <div className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-neutral-700">
            {editingId !== null ? '예산 수정' : '새 예산 등록'}
          </h3>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">카테고리</label>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((c) => {
                const isTaken = takenCategories(form.repeat).has(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: c }))}
                    className={`min-h-8 rounded-full px-3 text-sm font-semibold ${
                      form.category === c
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {c === '전체' ? '💰 전체 지출' : c}
                    {isTaken && (
                      <span className={`ml-1 text-xs ${form.category === c ? 'text-neutral-300' : 'text-neutral-400'}`}>
                        (이미 설정됨)
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 금액 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">월 한도 금액</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={form.monthly_limit}
                onChange={(e) => setForm((f) => ({ ...f, monthly_limit: e.target.value }))}
                className="min-h-10 w-full rounded-xl border-2 border-neutral-300 px-3 pr-8 text-right text-base font-bold focus:border-blue-500 focus:outline-none"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">원</span>
            </div>
          </div>

          {/* 반복 여부 */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">적용 범위</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, repeat: 'monthly' }))}
                className={`min-h-10 rounded-xl text-sm font-semibold ${
                  form.repeat === 'monthly'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                매월 반복
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, repeat: 'once' }))}
                className={`min-h-10 rounded-xl text-sm font-semibold ${
                  form.repeat === 'once'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {monthLabel}만
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{error}</p>
              {conflictTarget && (
                <button
                  type="button"
                  onClick={() => startEdit(conflictTarget)}
                  className="mt-1.5 text-sm font-semibold text-red-700 underline"
                >
                  기존 항목 수정하러 가기
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="min-h-10 flex-1 rounded-xl bg-neutral-900 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="min-h-10 rounded-xl bg-neutral-100 px-4 text-sm font-semibold text-neutral-600"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 예산 목록 */}
      {statuses.length === 0 ? (
        <div className="rounded-2xl border-2 border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base text-neutral-500">설정된 예산이 없습니다</p>
          <p className="mt-1 text-sm text-neutral-400">카테고리별 월 지출 한도를 설정해 보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {statuses.map((s) => {
            const pct = Math.min(s.percentage, 100)  // 바는 최대 100%
            const isActive = s.budget.active === 1
            return (
              <div
                key={s.budget.id}
                className={`rounded-2xl border-2 bg-white p-4 shadow-sm transition-opacity ${
                  isActive ? bgColor(s.percentage) : 'border-neutral-100 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* 카테고리 + 배지 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-neutral-900">
                        {s.budget.category === '전체' ? '💰 전체 지출' : s.budget.category}
                      </span>
                      {s.budget.year_month ? (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                          {monthLabel}만
                        </span>
                      ) : (
                        <span className="text-xs bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded font-semibold">
                          매월
                        </span>
                      )}
                      {!isActive && (
                        <span className="text-xs bg-neutral-100 text-neutral-400 px-1.5 py-0.5 rounded">
                          비활성
                        </span>
                      )}
                    </div>

                    {/* 금액 현황 */}
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className={`text-lg font-extrabold ${isActive ? textColor(s.percentage) : 'text-neutral-400'}`}>
                        {formatWon(s.spent)}
                      </span>
                      <span className="text-sm text-neutral-400">/ {formatWon(s.budget.monthly_limit)}</span>
                      <span className={`ml-auto text-sm font-bold ${isActive ? textColor(s.percentage) : 'text-neutral-400'}`}>
                        {s.percentage}%
                      </span>
                    </div>

                    {/* 진행률 바 */}
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className={`h-full rounded-full transition-all ${isActive ? barColor(s.percentage) : 'bg-neutral-300'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* 남은 금액 / 초과 금액 */}
                    <p className={`mt-1.5 text-xs font-semibold ${isActive ? textColor(s.percentage) : 'text-neutral-400'}`}>
                      {s.exceeded
                        ? `⚠ ${formatWon(Math.abs(s.remaining))} 초과`
                        : `${formatWon(s.remaining)} 남음`}
                    </p>
                  </div>

                  {/* 버튼 */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggle(s)}
                      className={`min-h-7 rounded-lg px-2.5 text-xs font-semibold ${
                        isActive ? 'bg-neutral-100 text-neutral-600' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {isActive ? '비활성화' : '활성화'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="min-h-7 rounded-lg bg-neutral-100 px-2.5 text-xs font-semibold text-neutral-600"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.budget.id, s.budget.category)}
                      className="min-h-7 rounded-lg bg-neutral-100 px-2.5 text-xs font-semibold text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default BudgetManager
