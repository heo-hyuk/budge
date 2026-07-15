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
  created_at: string
}

export interface NewCard {
  name: string
  color: string
  billing_day: number
  closing_day: number
  benefits?: string
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
  monthly_cap: number   // 0 = 무제한
  min_spend: number     // 0 = 무조건
  memo: string
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
}

export interface BenefitMatch {
  benefit: CardBenefit
  score: number
  estimated_discount: number
  monthly_used: number
  monthly_remaining: number  // 0 = 무제한
}

// ── 예산 ──────────────────────────────────────────────

export interface Budget {
  id: number
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
