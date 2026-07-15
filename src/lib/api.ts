import type { Card, NewCard, NewTransaction, Transaction, UpdateTransaction } from '../types'

// ── 거래 API ──────────────────────────────────────────

export async function fetchTransactions(params?: {
  month?: string       // YYYY-MM
  year?: string        // YYYY
  q?: string           // 검색어
  card_id?: string     // 카드별 조회
  date_start?: string  // 날짜 범위 시작
  date_end?: string    // 날짜 범위 종료
}): Promise<Transaction[]> {
  const qs = new URLSearchParams()
  if (params?.month)      qs.set('month', params.month)
  if (params?.year)       qs.set('year', params.year)
  if (params?.q)          qs.set('q', params.q)
  if (params?.card_id)    qs.set('card_id', params.card_id)
  if (params?.date_start) qs.set('date_start', params.date_start)
  if (params?.date_end)   qs.set('date_end', params.date_end)

  const url = `/api/transactions${qs.toString() ? `?${qs}` : ''}`
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

// ── 카드 API ──────────────────────────────────────────

export async function fetchCards(): Promise<Card[]> {
  const res = await fetch('/api/cards')
  if (!res.ok) throw new Error('카드 목록을 불러오지 못했습니다')
  const body = (await res.json()) as { data: Card[] }
  return body.data
}

export async function createCard(card: NewCard): Promise<void> {
  const res = await fetch('/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  })
  if (!res.ok) throw new Error('카드를 추가하지 못했습니다')
}

export async function updateCard(id: string, data: Partial<NewCard>): Promise<void> {
  const res = await fetch(`/api/cards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('카드를 수정하지 못했습니다')
}

export async function deleteCard(id: string): Promise<void> {
  const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('카드를 삭제하지 못했습니다')
}
