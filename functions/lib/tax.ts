/// <reference types="@cloudflare/workers-types" />
import { EXCLUDE_PENDING_SETTLEMENT_SQL } from './settlement'

export type TaxType = 'general' | 'simplified' | 'freelance_3_3'

export interface TaxEstimateResult {
  total_revenue: number        // 지정 월 확정 매출(카드정산기 "예정" 상태 제외, 비정산 제외)
  total_expense: number        // 지정 월 종소세용 필요경비(is_tax_deductible=1인 분류만, 비정산 제외) — 전체 지출이 아님
  est_vat: number | null       // null = vat_calculable이 false라 계산하지 않음
  est_income_tax: number       // 연초~지정 월까지 누적 순수익을 연환산해 계산한 뒤 경과 개월수로 일할 계산한 값(누적 추정 세액)
  tax_reserve_fund: number     // 지금까지 벌어들인 돈 중 세금으로 떼어둬야 할 추정 총액(est_vat + est_income_tax)
  real_net_income: number      // 이번 달 실질 순수익(이번 달 매출 - 이번 달 필요경비 - 세금 적립금)
  vat_calculable: boolean      // false면 est_vat은 항상 null
  vat_not_applicable: boolean  // true = 프리랜서(3.3%)라 부가세 체계 자체가 해당 없음(vat_calculable=false와 별개 신호)
  calculation_basis_year: number  // tax_brackets_config 조회에 사용한 귀속연도
  is_estimate: true            // 세무 신고를 대체하지 않는 추정치임을 항상 명시
}

export class TaxEstimateError extends Error {}

interface TaxSettingsRow {
  tax_type: TaxType
  simplified_vat_rate: number | null
}

interface TaxBracketRow {
  min_amount: number
  max_amount: number | null
  rate: number
  deduction: number
  local_tax_rate: number
}

async function sumRevenue(db: D1Database, userId: string, dateStart: string, dateEnd: string): Promise<number> {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
     WHERE user_id = ? AND type = 'income' AND date >= ? AND date <= ? AND unsettled = 0
       ${EXCLUDE_PENDING_SETTLEMENT_SQL}`
  ).bind(userId, dateStart, dateEnd, userId).first<{ total: number }>()
  return row?.total ?? 0
}

// 종소세용 필요경비 — is_tax_deductible=1인 분류만. 아직 물질화되지 않은(한 번도
// 재정렬/삭제/토글된 적 없는) 기본 분류는 categories에 행이 없으므로 LEFT JOIN 후
// COALESCE로 스키마 기본값(1=포함)과 동일하게 처리(functions/api/categories/index.ts의
// resolveExpenseTaxDeductible과 동일한 기본값 규칙)
async function sumDeductibleExpense(db: D1Database, userId: string, dateStart: string, dateEnd: string): Promise<number> {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(t.amount), 0) AS total FROM transactions t
     LEFT JOIN categories c
       ON c.user_id = t.user_id AND c.type = 'expense' AND c.name = t.category AND c.removed_default = 0
     WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ? AND t.unsettled = 0
       AND COALESCE(c.is_tax_deductible, 1) = 1`
  ).bind(userId, dateStart, dateEnd).first<{ total: number }>()
  return row?.total ?? 0
}

// 부가세 매입세액 대상 — 필요경비 중에서도 사업용 카드 결제 + 접대성 지출 아님을
// 추가로 만족해야 함. cards에 JOIN(LEFT 아님)해서 card_id가 비어있거나(현금) 개인
// 카드로 결제한 건은 자동으로 제외됨
async function sumVatDeductibleExpense(db: D1Database, userId: string, dateStart: string, dateEnd: string): Promise<number> {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(t.amount), 0) AS total FROM transactions t
     JOIN cards cd ON cd.id = t.card_id AND cd.user_id = t.user_id AND cd.is_business = 1
     LEFT JOIN categories c
       ON c.user_id = t.user_id AND c.type = 'expense' AND c.name = t.category AND c.removed_default = 0
     WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ? AND t.unsettled = 0
       AND COALESCE(c.is_tax_deductible, 1) = 1
       AND t.is_entertainment = 0`
  ).bind(userId, dateStart, dateEnd).first<{ total: number }>()
  return row?.total ?? 0
}

/**
 * 1인 사업자 세금 추정 — 세무 신고를 대체하지 않는 참고용 계산.
 * month: 'YYYY-MM'. 부가세/필요경비는 그 달 한 달치, 종합소득세는 그 해 1월부터
 * 그 달까지의 누적 순수익을 연환산해 추정한 뒤 경과 개월수만큼 일할 계산한다.
 */
export async function calculateTaxEstimate(db: D1Database, userId: string, month: string): Promise<TaxEstimateResult> {
  const year = Number(month.slice(0, 4))
  const elapsedMonths = Number(month.slice(5, 7))  // 1~12, "연초부터 이 달까지 몇 개월째인지"

  const settings = await db.prepare(
    'SELECT tax_type, simplified_vat_rate FROM user_tax_settings WHERE user_id = ?'
  ).bind(userId).first<TaxSettingsRow>()

  if (!settings) {
    throw new TaxEstimateError('사업자 세금 설정을 먼저 저장해주세요 (마이페이지 > 사업자 세금 설정)')
  }

  // 세율 구간은 반드시 해당 귀속연도 데이터가 실제로 있어야만 계산 — 없으면 추정치를
  // 만들지 않고 명확히 실패시켜 과거/미래 연도가 방치되는 걸 막는다(임의 추정 금지 원칙)
  const bracketCountRow = await db.prepare(
    'SELECT COUNT(*) AS n FROM tax_brackets_config WHERE year = ?'
  ).bind(year).first<{ n: number }>()
  if (!bracketCountRow || bracketCountRow.n === 0) {
    throw new TaxEstimateError(`${year}년 세율 정보가 아직 등록되지 않았습니다`)
  }

  const monthStart = `${month}-01`
  const monthEnd   = `${month}-31`  // 실제 없는 날짜(예: 2월 31일)라도 문자열 비교 상한으로는 안전
  const yearStart  = `${year}-01-01`

  const [totalRevenue, totalExpense, vatDeductibleExpense, cumulativeRevenue, cumulativeExpense] = await Promise.all([
    sumRevenue(db, userId, monthStart, monthEnd),
    sumDeductibleExpense(db, userId, monthStart, monthEnd),
    sumVatDeductibleExpense(db, userId, monthStart, monthEnd),
    sumRevenue(db, userId, yearStart, monthEnd),
    sumDeductibleExpense(db, userId, yearStart, monthEnd),
  ])

  // ── 부가세 ──────────────────────────────────────────
  let estVat: number | null = null
  let vatCalculable = false
  let vatNotApplicable = false

  if (settings.tax_type === 'general') {
    vatCalculable = true
    estVat = Math.round(totalRevenue * 0.1 - vatDeductibleExpense * 0.1)
  } else if (settings.tax_type === 'simplified') {
    if (settings.simplified_vat_rate != null) {
      vatCalculable = true
      // 간이과세자 납부세액 = 공급대가(매출) × 업종별 부가가치율 × 10%
      estVat = Math.round(totalRevenue * (settings.simplified_vat_rate / 100) * 0.1)
    }
    // 부가율 미입력이면 vat_calculable=false, est_vat=null 그대로 — 임의 추정 금지
  } else {
    // freelance_3_3 — 원천징수 3.3% 체계라 부가세 자체가 해당 없음
    vatNotApplicable = true
  }

  // ── 종합소득세 ────────────────────────────────────────
  const cumulativeNet = cumulativeRevenue - cumulativeExpense
  const annualizedIncome = (cumulativeNet / elapsedMonths) * 12

  let estIncomeTax = 0
  if (annualizedIncome > 0) {
    const bracket = await db.prepare(
      `SELECT min_amount, max_amount, rate, deduction, local_tax_rate FROM tax_brackets_config
       WHERE year = ? AND min_amount <= ? AND (max_amount IS NULL OR ? < max_amount)
       ORDER BY min_amount DESC LIMIT 1`
    ).bind(year, annualizedIncome, annualizedIncome).first<TaxBracketRow>()

    if (bracket) {
      const annualIncomeTax = Math.max(0, annualizedIncome * bracket.rate - bracket.deduction)
      const annualLocalTax  = annualIncomeTax * bracket.local_tax_rate
      const annualTotalTax  = annualIncomeTax + annualLocalTax
      estIncomeTax = Math.round(annualTotalTax * (elapsedMonths / 12))
    }
  }

  // ── 세금 적립금 / 실질 순수익 ─────────────────────────────
  // 부가세는 "이번 달" 기준, 종합소득세는 "연초부터 지금까지 누적" 기준으로 계산 기준이
  // 서로 다르다(부가세는 통상 반기/분기 정산, 종소세는 연 1회 정산이라 실제 세무 실무에서도
  // 계산 주기가 다름) — tax_reserve_fund는 "지금까지 벌었으면 세금으로 얼마를 떼어둬야
  // 하는지"의 추정 총액이라 이 둘을 그대로 더한다
  const taxReserveFund = (estVat ?? 0) + estIncomeTax
  const realNetIncome = (totalRevenue - totalExpense) - taxReserveFund

  return {
    total_revenue: totalRevenue,
    total_expense: totalExpense,
    est_vat: estVat,
    est_income_tax: estIncomeTax,
    tax_reserve_fund: taxReserveFund,
    real_net_income: realNetIncome,
    vat_calculable: vatCalculable,
    vat_not_applicable: vatNotApplicable,
    calculation_basis_year: year,
    is_estimate: true,
  }
}
