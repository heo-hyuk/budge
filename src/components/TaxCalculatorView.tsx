import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import UiCard from './ui/Card'
import { fetchTaxEstimate } from '../lib/api'
import { formatWon } from '../lib/format'
import type { TaxEstimate } from '../types'

interface Props {
  month: string  // 'YYYY-MM'
  onOpenMyPage: () => void  // 부가율 미입력/세금 설정 미저장 시 마이페이지 바로가기
}

/**
 * 세금 계산기 — /api/tax/estimate를 그대로 보여주는 화면. 신고를 대체하지 않는
 * 참고용 추정치라는 걸 항상 눈에 띄게 알려야 해서(요청 사항) "추정치" 배지를
 * 숫자 바로 옆에, 면책 조항은 하단에 눈에 띄는 박스로 둔다.
 */
function TaxCalculatorView({ month, onOpenMyPage }: Props) {
  const [estimate, setEstimate] = useState<TaxEstimate | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  function load() {
    setLoading(true)
    setError('')
    fetchTaxEstimate(month)
      .then(setEstimate)
      .catch((err) => setError(err instanceof Error ? err.message : '세금 추정치를 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [month])

  return (
    <div className="space-y-4">
      {/* 수입/지출 계산기와 집계 기준이 다르다는 걸 항상 먼저 안내 — 두 계산기 합계가
          서로 달라 보일 때 혼란을 막기 위함(요청 사항) */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">
        이 계산은 수입/지출 계산기와 기준이 다릅니다(세무 경비 기준)
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-base text-neutral-500 dark:text-neutral-400">
          <LoadingSpinner size={18} /> 불러오는 중...
        </p>
      ) : error ? (
        <div className="space-y-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4">
          <p className="text-base font-semibold text-red-700 dark:text-red-400">{error}</p>
          <div className="flex gap-2">
            {error.includes('세금 설정') && (
              <button
                type="button"
                onClick={onOpenMyPage}
                className="min-h-9 rounded-lg bg-coral-400 px-3 text-sm font-semibold text-white transition-colors hover:bg-coral-600"
              >
                마이페이지로 이동
              </button>
            )}
            <button
              type="button"
              onClick={load}
              className="min-h-9 rounded-lg bg-white dark:bg-neutral-900 px-3 text-sm font-semibold text-red-700 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : estimate && (
        <>
          {/* 세후 예상 순수익 — "추정치" 배지는 숫자와 항상 같은 줄(옆)에 붙여서 시야에서
              절대 분리되지 않게 함(하단 배치 금지 요청 사항) */}
          <UiCard className="py-6 text-center">
            <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">세후 예상 순수익</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <p className={`text-4xl font-bold ${estimate.real_net_income < 0 ? 'text-red-500' : 'text-neutral-900 dark:text-neutral-100'}`}>
                {formatWon(estimate.real_net_income)}
              </p>
              <span className="shrink-0 rounded-full bg-coral-100 dark:bg-coral-900/40 px-2.5 py-1 text-xs font-bold text-coral-700 dark:text-coral-200">
                추정치
              </span>
            </div>
          </UiCard>

          {/* 단계별 차감 — 총매출 → 필요경비 → 세금 예비비 순으로 얼마씩 빠지는지 */}
          <UiCard>
            <p className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">단계별 계산</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">총매출</span>
                <span className="text-base font-bold text-neutral-900 dark:text-neutral-100">{formatWon(estimate.total_revenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">− 필요경비</span>
                <span className="font-semibold text-coral-600 dark:text-coral-300">−{formatWon(estimate.total_expense)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 pt-2">
                <span className="text-neutral-500 dark:text-neutral-400">− 세금 예비비</span>
                <span className="font-semibold text-coral-600 dark:text-coral-300">−{formatWon(estimate.tax_reserve_fund)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 pt-2">
                <span className="font-bold text-neutral-700 dark:text-neutral-300">= 세후 예상 순수익</span>
                <span className="text-base font-bold text-neutral-900 dark:text-neutral-100">{formatWon(estimate.real_net_income)}</span>
              </div>
            </div>
          </UiCard>

          {/* 예상 부가세 — 과세유형별로 표시 내용이 완전히 달라짐 */}
          <UiCard>
            <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">예상 부가세</p>
            {estimate.vat_not_applicable ? (
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                프리랜서 3.3% 원천징수 대상은 부가세 해당 없음
              </p>
            ) : !estimate.vat_calculable ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">부가율 미입력 — 마이페이지에서 입력해주세요</p>
                <button
                  type="button"
                  onClick={onOpenMyPage}
                  className="min-h-9 rounded-lg bg-coral-400 px-3 text-sm font-semibold text-white transition-colors hover:bg-coral-600"
                >
                  마이페이지로 이동
                </button>
              </div>
            ) : (
              <>
                <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">{formatWon(estimate.est_vat ?? 0)}</p>
                <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                  매입세액공제는 사업용 카드로 결제하고 거래처 접대가 아닌 거래만 반영돼요
                </p>
              </>
            )}
          </UiCard>

          {/* 예상 종합소득세 */}
          <UiCard>
            <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">예상 종합소득세</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">{formatWon(estimate.est_income_tax)}</p>
            <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
              {estimate.calculation_basis_year}년 1월부터 이 달까지 누적 순수익을 연 환산해 추정한 금액이에요(지방소득세 포함)
            </p>
          </UiCard>

          {/* 면책 조항 — 작은 회색 글씨로 숨기지 말고 눈에 띄게(요청 사항) */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-300">
            이 화면의 모든 금액은 참고용 추정치이며 실제 신고 세액과 다를 수 있습니다. 정확한 세금은 세무사 또는 홈택스를 통해 확인하세요
          </div>
        </>
      )}
    </div>
  )
}

export default TaxCalculatorView
