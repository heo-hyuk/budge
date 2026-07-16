import { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import { useToast } from '../contexts/ToastContext'
import { BudgetConflictError, createBudget, deleteBudget, updateBudget } from '../lib/api'
import { getCategories } from '../lib/categories'
import { formatNumberInput, formatWon } from '../lib/format'
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

/** 퍼센트에 따른 진행 바 색상 */
function barColor(pct: number): string {
  if (pct >= 100) return 'bg-coral-600'
  if (pct >= 80)  return 'bg-coral-200'
  return 'bg-neutral-300'
}
/** 퍼센트에 따른 텍스트 색상 */
function textColor(pct: number): string {
  if (pct >= 100) return 'text-coral-800'
  if (pct >= 80)  return 'text-coral-600'
  return 'text-neutral-600'
}
/** 퍼센트에 따른 카드 배경/테두리 색상 */
function bgColor(pct: number): string {
  if (pct >= 100) return 'bg-coral-50 border-coral-200'
  if (pct >= 80)  return 'bg-coral-50 border-coral-100'
  return 'bg-neutral-50 border-neutral-200'
}

function BudgetManager({ statuses, month, onRefresh }: Props) {
  const { showToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<FormState>(defaultForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [conflictTarget, setConflictTarget] = useState<BudgetStatus | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
      monthly_limit: formatNumberInput(String(s.budget.monthly_limit)),
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
      showToast(editingId !== null ? '예산을 수정했습니다' : '예산을 등록했습니다')
    } catch (e) {
      // 카테고리 중복(409)은 alert가 아니라 폼 내부 인라인 에러로 표시 — 토스트로 화면을 덮으면
      // "기존 항목 수정하러 가기" 안내를 놓치기 쉬워 의도적으로 토스트를 쓰지 않음
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
    setDeletingId(id)
    try {
      await deleteBudget(id)
      await onRefresh()
      showToast('예산을 삭제했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '예산을 삭제하지 못했습니다', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggle(s: BudgetStatus) {
    setTogglingId(s.budget.id)
    try {
      await updateBudget(s.budget.id, { active: s.budget.active === 1 ? 0 : 1 })
      await onRefresh()
      showToast(s.budget.active === 1 ? '비활성화했습니다' : '활성화했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '상태를 변경하지 못했습니다', 'error')
    } finally {
      setTogglingId(null)
    }
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
          className="min-h-9 rounded-xl bg-coral-400 px-4 text-sm font-bold text-white transition-colors hover:bg-coral-600"
        >
          + 예산 추가
        </button>
      </div>

      {/* 초과 경고 배너 */}
      {exceededList.length > 0 && (
        <div className="rounded-xl border border-coral-200 bg-coral-50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-coral-800">
            예산 초과 항목 {exceededList.length}건
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {exceededList.map((s) => (
              <li key={s.budget.id} className="text-xs text-coral-700">
                • {s.budget.category}: {formatWon(s.spent)} / {formatWon(s.budget.monthly_limit)}{' '}
                ({formatWon(Math.abs(s.remaining))} 초과)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 등록/수정 폼 */}
      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
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
                    className={`min-h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
                      form.category === c
                        ? 'bg-coral-50 text-coral-800'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {c === '전체' ? '전체 지출' : c}
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
                onChange={(e) => setForm((f) => ({ ...f, monthly_limit: formatNumberInput(e.target.value) }))}
                className="min-h-10 w-full rounded-xl border border-neutral-300 px-3 pr-8 text-right text-base font-bold transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
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
                className={`min-h-10 rounded-xl text-sm font-semibold transition-colors ${
                  form.repeat === 'monthly'
                    ? 'bg-coral-400 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                매월 반복
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, repeat: 'once' }))}
                className={`min-h-10 rounded-xl text-sm font-semibold transition-colors ${
                  form.repeat === 'once'
                    ? 'bg-coral-400 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {monthLabel}만
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-coral-50 border border-coral-200 p-3">
              <p className="text-sm text-coral-600">{error}</p>
              {conflictTarget && (
                <button
                  type="button"
                  onClick={() => startEdit(conflictTarget)}
                  className="mt-1.5 text-sm font-semibold text-coral-800 underline"
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
              className="min-h-10 flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600 disabled:opacity-50"
            >
              {saving ? <><LoadingSpinner size={14} /> 처리 중...</> : '저장'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="min-h-10 rounded-xl bg-neutral-100 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-200"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 예산 목록 */}
      {statuses.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
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
                className={`rounded-xl border bg-white p-4 shadow-sm transition-opacity ${
                  isActive ? bgColor(s.percentage) : 'border-neutral-100 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* 카테고리 + 배지 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-neutral-900">
                        {s.budget.category === '전체' ? '전체 지출' : s.budget.category}
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
                    <p className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${isActive ? textColor(s.percentage) : 'text-neutral-400'}`}>
                      {s.exceeded
                        ? `${formatWon(Math.abs(s.remaining))} 초과`
                        : `${formatWon(s.remaining)} 남음`}
                    </p>
                  </div>

                  {/* 버튼 */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggle(s)}
                      disabled={togglingId === s.budget.id}
                      className={`min-h-7 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 ${
                        isActive ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {togglingId === s.budget.id ? <LoadingSpinner size={12} /> : (isActive ? '비활성화' : '활성화')}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="min-h-7 whitespace-nowrap rounded-lg bg-neutral-100 px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-200"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.budget.id, s.budget.category)}
                      disabled={deletingId === s.budget.id}
                      className="min-h-7 whitespace-nowrap rounded-lg bg-neutral-100 px-2.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {deletingId === s.budget.id ? <LoadingSpinner size={12} /> : '삭제'}
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
