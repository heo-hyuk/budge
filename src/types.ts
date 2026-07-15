export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TransactionType
  category: string
  amount: number
  memo: string
  date: string
  created_at: string
}

export interface NewTransaction {
  type: TransactionType
  category: string
  amount: number
  memo?: string
  date: string
}

export interface UpdateTransaction {
  type?: TransactionType
  category?: string
  amount?: number
  memo?: string
  date?: string
}
