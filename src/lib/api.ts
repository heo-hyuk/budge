import type { NewTransaction, Transaction, UpdateTransaction } from '../types'

// month: 'YYYY-MM' 형식, 없으면 전체 조회
export async function fetchTransactions(month?: string): Promise<Transaction[]> {
  const url = month ? `/api/transactions?month=${month}` : '/api/transactions'
  const res = await fetch(url)
  if (!res.ok) throw new Error('거래 내역을 불러오지 못했습니다')
  const body = (await res.json()) as { data: Transaction[] }
  return body.data
}

export async function createTransaction(tx: NewTransaction): Promise<void> {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx),
  })
  if (!res.ok) throw new Error('거래를 추가하지 못했습니다')
}

export async function deleteTransaction(id: string): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('거래를 삭제하지 못했습니다')
}

export async function updateTransaction(id: string, data: UpdateTransaction): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('거래를 수정하지 못했습니다')
}
