import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import UiCard from './ui/Card'
import { fetchAnnualSettlement, fetchMonthlySettlement } from '../lib/api'
import { getCalcSelections, loadCalcSelections, toggleCalcSelection } from '../lib/calcSelections'
import { getCategories, loadCategories } from '../lib/categories'
import { formatWon } from '../lib/format'
import type { AnnualSettlement, MonthlySettlement, TransactionType } from '../types'

type PeriodView = 'month' | 'year'

interface Props {
  month: string  // 'YYYY-MM'
  type: TransactionType
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// mode: 'include' = 기본 전부 미선택, 칩을 탭하면 합계에 포함(수입계산기)
//       'exclude' = 기본 전부 포함, 칩을 탭하면 그 분류만 합계에서 제외(지출계산기)
//       calc_selections엔 두 경우 모두 "칩을 탭해서 생긴 행"만 저장되고
//       (include=포함된 분류, exclude=제외된 분류) 화면에서 의미만 다르게 해석한다.
const THEME = {
  income: {
    title: '개인화 수입 계산기',
    description:
      "합산에 포함할 수입 분류 칩을 선택하세요. 다시 탭하면 선택이 해제됩니다. " +
      "차감할 항목은 수입 등록 시 금액 앞에 '-'를 붙이면 자동으로 반영돼요.",
    chipLabel: '수입 분류',
    emptyChipMessage: '등록된 수입 분류가 없습니다',
    emptyBreakdownMessage: '아래에서 계산에 포함할 수입 분류 칩을 선택하세요.',
    selectedChip: 'bg-blue-600 text-white',
    headerText: 'text-blue-700 dark:text-blue-300',
    headerTextStrong: 'text-blue-800 dark:text-blue-300',
    cellText: 'text-blue-700 dark:text-blue-300',
    cellTextStrong: 'text-blue-800 dark:text-blue-300',
    mode: 'include',
  },
  expense: {
    title: '개인화 지출 계산기',
    description: '기본적으로 모든 지출 분류가 합계에 포함되어 있어요. 제외하고 싶은 분류만 탭해서 꺼주세요. 다시 탭하면 다시 포함됩니다.',
    chipLabel: '지출 분류',
    emptyChipMessage: '등록된 지출 분류가 없습니다',
    emptyBreakdownMessage: '모든 지출 분류가 제외되어 있습니다. 아래에서 포함할 분류를 다시 켜주세요.',
    selectedChip: 'bg-coral-400 text-white',
    headerText: 'text-coral-600 dark:text-coral-200',
    headerTextStrong: 'text-coral-700 dark:text-coral-200',
    cellText: 'text-coral-600 dark:text-coral-200',
    cellTextStrong: 'text-coral-700 dark:text-coral-200',
    mode: 'exclude',
  },
} as const

function compactDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()}일(${WEEKDAY_LABELS[d.getDay()]})`
}

function monthLabel(ym: string): string {
  return `${parseInt(ym.split('-')[1], 10)}월`
}

function cell(amount: number): string {
  return amount !== 0 ? amount.toLocaleString('ko-KR') : '-'
}

/**
 * "수입계산기"/"지출계산기" 탭 — 원하는 분류 칩만 골라 합산한 "개인화" 금액을 보는 화면.
 * 예: 영업수익 + 급여 선택 → 두 분류의 월 합계를 더함.
 * 월간 뷰는 이미 계산되는 /api/settlement/monthly, 연간 뷰는 /api/settlement/annual을
 * 그대로 재사용하고, 선택된 분류만 열로 골라 각각 MonthlySettlementTable/
 * AnnualSettlementTable과 같은 표로 보여준다(매일/매달 반복 등록되는 항목 특성상
 * 개별 거래 목록보다 표가 한눈에 보기 좋음).
 * 비정산(unsettled) 거래는 두 API 모두 이미 제외하고 집계하므로 이 화면에서
 * 별도로 신경쓸 필요가 없다.
 */
function CategoryCalculator({ month, type }: Props) {
  const theme = THEME[type]
  const year = month.slice(0, 4)
  const [periodView, setPeriodView] = useState<PeriodView>('month')
  const [settlement, setSettlement] = useState<MonthlySettlement | null>(null)
  const [annualSettlement, setAnnualSettlement] = useState<AnnualSettlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [, forceRerender] = useState(0)  // calcSelections 캐시(모듈 전역) 변경을 반영하기 위한 트리거

  function load() {
    setLoading(true)
    setError('')
    fetchMonthlySettlement(month)
      .then(setSettlement)
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  function loadAnnual() {
    setLoading(true)
    setError('')
    fetchAnnualSettlement(year)
      .then(setAnnualSettlement)
      .catch((err) => setError(err instanceof Error ? err.message : '불러오기에 실패했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (periodView === 'month') load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, periodView])

  useEffect(() => {
    if (periodView === 'year') loadAnnual()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, periodView])

  // 마운트 시점엔 서버 선택 목록/분류가 아직 로드되기 전일 수 있어 로드 후 재렌더
  useEffect(() => {
    loadCalcSelections().then(() => forceRerender((n) => n + 1))
  }, [])
  useEffect(() => {
    loadCategories().then(() => forceRerender((n) => n + 1))
  }, [])

  async function handleTapChip(category: string) {
    await toggleCalcSelection(type, category)
    forceRerender((n) => n + 1)
  }

  const bucket = periodView === 'month'
    ? ((type === 'income' ? settlement?.month_total.income : settlement?.month_total.expense) ?? {})
    : ((type === 'income' ? annualSettlement?.year_total.income : annualSettlement?.year_total.expense) ?? {})
  const categories = getCategories(type)
  // calc_selections엔 "탭해서 생긴 행"만 저장됨 — include 모드는 그 행이 포함된 분류,
  // exclude 모드는 그 행이 제외된 분류라 isIncluded 판정을 모드에 따라 뒤집는다.
  const tappedCategories = new Set(getCalcSelections(type).map((s) => s.category))
  function isIncluded(category: string): boolean {
    return theme.mode === 'exclude' ? !tappedCategories.has(category) : tappedCategories.has(category)
  }
  const activeCategories = categories.filter(isIncluded)
  const breakdown = activeCategories.map((c) => ({ category: c, amount: bucket[c] ?? 0 }))
  const total = breakdown.reduce((sum, s) => sum + s.amount, 0)

  function rowSum(bucketOfRow: Record<string, number>): number {
    return activeCategories.reduce((s, c) => s + (bucketOfRow[c] ?? 0), 0)
  }

  const loaded = periodView === 'month' ? settlement : annualSettlement
  const rows: { key: string; label: string; bucket: Record<string, number> }[] =
    periodView === 'month'
      ? (settlement?.days.map((d) => ({ key: d.date, label: compactDateLabel(d.date), bucket: type === 'income' ? d.income : d.expense })) ?? [])
      : (annualSettlement?.months.map((m) => ({ key: m.month, label: monthLabel(m.month), bucket: type === 'income' ? m.income : m.expense })) ?? [])
  const rowHeaderLabel = periodView === 'month' ? '날짜' : '월'
  const totalRowLabel = periodView === 'month' ? '월계' : '연계'
  const detailSectionLabel = periodView === 'month' ? '선택 분류 일별 내역' : '선택 분류 월별 내역'

  return (
    <div className="space-y-4">
      <UiCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-200">{theme.title}</h2>
          <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1">
            <button
              type="button"
              onClick={() => setPeriodView('month')}
              className={`min-h-8 rounded-md px-3 text-xs font-bold transition-colors ${
                periodView === 'month' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >월간</button>
            <button
              type="button"
              onClick={() => setPeriodView('year')}
              className={`min-h-8 rounded-md px-3 text-xs font-bold transition-colors ${
                periodView === 'year' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >연간</button>
          </div>
        </div>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          {periodView === 'year' && <span className="mr-1 font-semibold text-neutral-500 dark:text-neutral-400">{year}년 —</span>}
          {theme.description}
        </p>
      </UiCard>

      {loading ? (
        <p className="flex items-center gap-2 text-base text-neutral-500 dark:text-neutral-400">
          <LoadingSpinner size={18} /> 불러오는 중...
        </p>
      ) : error ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4">
          <p className="text-base font-semibold text-red-700 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={periodView === 'month' ? load : loadAnnual}
            className="shrink-0 rounded-lg bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-red-700 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
          >
            다시 시도
          </button>
        </div>
      ) : loaded && (
        <>
          <UiCard>
            <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">선택 합계</p>
            <p className={`mt-1 text-3xl font-bold ${total < 0 ? 'text-red-500' : 'text-neutral-900 dark:text-neutral-100'}`}>
              {formatWon(total)}
            </p>
            {breakdown.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-400 dark:text-neutral-500">{theme.emptyBreakdownMessage}</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {breakdown.map((s) => (
                  <li key={s.category} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">{s.category}</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">{formatWon(s.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </UiCard>

          <UiCard>
            <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">{theme.chipLabel}</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {categories.map((c) => {
                const selected = isIncluded(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleTapChip(c)}
                    className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                      selected
                        ? theme.selectedChip
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
              {categories.length === 0 && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">{theme.emptyChipMessage}</p>
              )}
            </div>
          </UiCard>

          {/* 선택된 분류의 일별/월별 내역 — 매일/매달 반복 등록되는 항목 특성상
              MonthlySettlementTable/AnnualSettlementTable과 동일한 구조의 표로 표시 */}
          {activeCategories.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300">{detailSectionLabel}</p>
              <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-neutral-100 dark:bg-neutral-800">
                      <th className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left">{rowHeaderLabel}</th>
                      {activeCategories.map((c) => (
                        <th key={c} className={`whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold ${theme.headerText}`}>{c}</th>
                      ))}
                      <th className={`whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold ${theme.headerTextStrong}`}>합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.key}>
                        <td className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left">{row.label}</td>
                        {activeCategories.map((c) => (
                          <td key={c} className={`whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right ${theme.cellText}`}>
                            {cell(row.bucket[c] ?? 0)}
                          </td>
                        ))}
                        <td className={`whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold ${theme.cellTextStrong}`}>
                          {cell(rowSum(row.bucket))}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-neutral-50 dark:bg-neutral-950 font-bold">
                      <td className="whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left">{totalRowLabel}</td>
                      {activeCategories.map((c) => (
                        <td key={c} className={`whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right ${theme.cellText}`}>
                          {cell(bucket[c] ?? 0)}
                        </td>
                      ))}
                      <td className={`whitespace-nowrap border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-right font-semibold ${theme.cellTextStrong}`}>
                        {cell(rowSum(bucket))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CategoryCalculator
