export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TransactionType
  category: string
  amount: number
  memo: string
  date: string
  merchant: string       // 구매처/판매처
  payment_method: string // '현금' | 카드ID
  card_id: string        // 카드 결제 시 카드 ID
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
