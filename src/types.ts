export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TransactionType
  category: string
  amount: number
  memo: string
  date: string
  merchant: string         // 구매처/판매처
  payment_method: string   // '현금' | 카드ID
  card_id: string          // 카드 결제 시 카드 ID
  recurring_id: string     // 고정지출 연결 ID
  original_amount: number  // 할인 전 원래 금액 (0이면 할인 없음)
  discount_amount: number  // 적용된 할인액
  benefit_id: string       // 적용된 혜택 규칙 ID
  cashback_amount: number  // 적립형(cashback) 혜택 예상 적립액 (정산 계산엔 미포함, 정보 표시 전용)
  created_at: string
}

export interface NewTransaction {
  type: TransactionType
  category: string
  amount: number
  memo?: string
  date: string
  merchant?: string
  payment_method?: string
  card_id?: string
  original_amount?: number
  discount_amount?: number
  benefit_id?: string
  cashback_amount?: number
}

export interface UpdateTransaction {
  type?: TransactionType
  category?: string
  amount?: number
  memo?: string
  date?: string
  merchant?: string
  payment_method?: string
  card_id?: string
}

export interface Card {
  id: string
  name: string
  color: string
  billing_day: number   // 결제일 (1-31)
  closing_day: number   // 청구 마감일 (이 날까지 사용분이 다음달 청구)
  benefits: string      // JSON 배열 문자열
  image_url: string | null  // 카드 실물 디자인 이미지 URL, NULL이면 color 기반 표시
  created_at: string
}

export interface NewCard {
  name: string
  color: string
  billing_day: number
  closing_day: number
  benefits?: string
  image_url?: string | null
}

export interface RecurringTransaction {
  id: string
  user_id: string
  name: string
  type: TransactionType
  category: string
  amount: number
  merchant: string
  payment_method: string
  card_id: string
  day_of_month: number
  start_date: string
  end_date: string | null
  last_generated_date: string | null
  active: number   // 1 = 활성, 0 = 비활성
  created_at: string
}

// ── 카드 혜택 규칙 ───────────────────────────────────────

export interface CardBenefit {
  id: string
  user_id: string
  card_id: string
  name: string
  category: string
  merchant_pattern: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  monthly_cap: number   // 0 = 무제한 (benefit_group_id가 있으면 무시되고 그룹 한도 사용)
  min_spend: number     // 0 = 무조건
  memo: string
  benefit_group_id: string | null  // 있으면 benefit_groups 참조 (통합 한도 공유)
  benefit_type: 'discount' | 'cashback'  // discount: 즉시 할인, cashback: 나중에 적립
  active: number   // 0 = 비활성 (택1 패키지 카드에서 미선택 항목)
  created_at: string
}

export interface NewBenefit {
  card_id: string
  name: string
  category?: string
  merchant_pattern?: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  monthly_cap?: number
  min_spend?: number
  memo?: string
  benefit_group_id?: string
  benefit_type?: 'discount' | 'cashback'
  active?: number
}

export interface BenefitMatch {
  benefit: CardBenefit
  score: number
  estimated_discount: number  // discount면 할인액, cashback이면 예상 적립액
  monthly_used: number
  monthly_remaining: number  // 0 = 무제한
  benefit_type: 'discount' | 'cashback'
}

// ── 혜택 그룹 (통합 월한도 공유) ───────────────────────────

export interface BenefitGroup {
  id: string
  card_id: string
  name: string
  monthly_cap: number
  created_at: string
}

export interface NewBenefitGroup {
  card_id: string
  name: string
  monthly_cap: number
}

// ── 예산 ──────────────────────────────────────────────

export interface Budget {
  id: string
  user_id: string
  category: string        // '전체' = 전체 지출 예산
  monthly_limit: number
  year_month: string | null  // null = 매월 반복
  active: number
  created_at: string
}

export interface BudgetStatus {
  budget: Budget
  spent: number
  remaining: number
  percentage: number    // 0~100+ (초과 시 100 이상)
  exceeded: boolean
}

export interface NewBudget {
  category: string
  monthly_limit: number
  year_month?: string | null
}

export interface NewRecurring {
  name: string
  type: TransactionType
  category: string
  amount: number
  merchant?: string
  payment_method?: string
  card_id?: string
  day_of_month: number
  start_date: string
  end_date?: string
}

// ── 빠른 입력 템플릿 ────────────────────────────────────

export interface QuickTemplate {
  id: string
  user_id: string
  label: string
  type: TransactionType
  category: string
  amount: number | null  // null = 금액 미지정(적용 시 금액만 매번 새로 입력)
  merchant: string
  payment_method: string
  card_id: string
  sort_order: number
  created_at: string
}

export interface NewQuickTemplate {
  label: string
  type: TransactionType
  category: string
  amount?: number | null
  merchant?: string
  payment_method?: string
  card_id?: string
}

// ── 최근 구매처 자동완성 ─────────────────────────────────

export interface RecentMerchant {
  merchant: string
  category: string  // 가장 많이 짝지어진 분류 ('' = 없음)
  count: number
}

// ── 한눈에 보기 (일일/주간 정산) ──────────────────────────

export interface DailySettlement {
  date: string
  prev_balance: number
  incomes: Transaction[]
  income_total: number
  expenses: Transaction[]
  expense_total: number
  today_balance: number
}

export interface SettlementIncomeBucket {
  소득: number
  예금인출: number
  기타: number
  total: number
}

export interface SettlementExpenseBucket {
  [category: string]: number  // 카테고리별 합계 + total 키
}

export interface WeeklySettlementDay {
  date: string
  income: SettlementIncomeBucket
  expense: SettlementExpenseBucket
}

export interface WeeklySettlement {
  week_start: string
  week_end: string
  days: WeeklySettlementDay[]
  week_total: { income: SettlementIncomeBucket; expense: SettlementExpenseBucket }
  month_cumulative_total: { income: SettlementIncomeBucket; expense: SettlementExpenseBucket }
}

export interface MonthlySettlementDay {
  date: string
  income: SettlementIncomeBucket
  expense: SettlementExpenseBucket
}

export interface MonthlySettlement {
  month: string  // 'YYYY-MM'
  days: MonthlySettlementDay[]
  month_total: { income: SettlementIncomeBucket; expense: SettlementExpenseBucket }
}

export interface AnnualSettlementMonth {
  month: string  // 'YYYY-MM'
  income: SettlementIncomeBucket
  expense: SettlementExpenseBucket
}

export interface AnnualSettlement {
  year: string  // 'YYYY'
  months: AnnualSettlementMonth[]
  year_total: { income: SettlementIncomeBucket; expense: SettlementExpenseBucket }
}

// ── 메모장 ──────────────────────────────────────────

export interface Note {
  id: string
  user_id: string
  date: string       // 'YYYY-MM-DD'
  category: string
  content: string
  created_at: string
  updated_at: string
}

export interface NewNote {
  date: string
  category: string
  content: string
}
