// functions/lib/tax.ts(메인 앱, functions/lib/settlement.ts의 EXCLUDE_PENDING_SETTLEMENT_SQL 포함)의
// 세금 추정 로직을 그대로 포팅. 별도 배포 단위(wrangler 프로젝트)라 소스 공유 대신
// 복사 — 로직은 100% 동일하게 유지할 것(workers/card-settlement-notifier/src/billing.ts와
// 동일한 이유·패턴)

export type TaxType = 'general' | 'simplified' | 'freelance_3_3'

export interface TaxEstimateResult {
  total_revenue: number
  total_expense: number
  est_vat: number | null
  est_income_tax: number
  tax_reserve_fund: number
  real_net_income: number
  vat_calculable: boolean
  vat_not_applicable: boolean
  calculation_basis_year: number
  is_estimate: true
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

// 카드 정산기에서 소스로 선택한 결제방법(예: "예정")으로 등록된 수입은 아직 실제
// 입금이 확인되지 않은 상태라 집계에서 제외한다(functions/lib/settlement.ts와 동일)
const EXCLUDE_PENDING_SETTLEMENT_SQL =
  'AND payment_method NOT IN (SELECT payment_method FROM card_settlement_source_payment_methods WHERE user_id = ?)'

async function sumRevenue(db: D1Database, userId: string, dateStart: string, dateEnd: string): Promise<number> {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
     WHERE user_id = ? AND type = 'income' AND date >= ? AND date <= ? AND unsettled = 0
       ${EXCLUDE_PENDING_SETTLEMENT_SQL}`
  ).bind(userId, dateStart, dateEnd, userId).first<{ total: number }>()
  return row?.total ?? 0
}

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
  const elapsedMonths = Number(month.slice(5, 7))

  const settings = await db.prepare(
    'SELECT tax_type, simplified_vat_rate FROM user_tax_settings WHERE user_id = ?'
  ).bind(userId).first<TaxSettingsRow>()

  if (!settings) {
    throw new TaxEstimateError('사업자 세금 설정을 먼저 저장해주세요 (마이페이지 > 사업자 세금 설정)')
  }

  const bracketCountRow = await db.prepare(
    'SELECT COUNT(*) AS n FROM tax_brackets_config WHERE year = ?'
  ).bind(year).first<{ n: number }>()
  if (!bracketCountRow || bracketCountRow.n === 0) {
    throw new TaxEstimateError(`${year}년 세율 정보가 아직 등록되지 않았습니다`)
  }

  const monthStart = `${month}-01`
  const monthEnd   = `${month}-31`
  const yearStart  = `${year}-01-01`

  const [totalRevenue, totalExpense, vatDeductibleExpense, cumulativeRevenue, cumulativeExpense] = await Promise.all([
    sumRevenue(db, userId, monthStart, monthEnd),
    sumDeductibleExpense(db, userId, monthStart, monthEnd),
    sumVatDeductibleExpense(db, userId, monthStart, monthEnd),
    sumRevenue(db, userId, yearStart, monthEnd),
    sumDeductibleExpense(db, userId, yearStart, monthEnd),
  ])

  let estVat: number | null = null
  let vatCalculable = false
  let vatNotApplicable = false

  if (settings.tax_type === 'general') {
    vatCalculable = true
    estVat = Math.round(totalRevenue * 0.1 - vatDeductibleExpense * 0.1)
  } else if (settings.tax_type === 'simplified') {
    if (settings.simplified_vat_rate != null) {
      vatCalculable = true
      estVat = Math.round(totalRevenue * (settings.simplified_vat_rate / 100) * 0.1)
    }
  } else {
    vatNotApplicable = true
  }

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
