import type { NewTransaction, Transaction } from '../types'

export async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch('/api/transactions')
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
