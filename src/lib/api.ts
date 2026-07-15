import type { BenefitMatch, Card, CardBenefit, NewBenefit, NewCard, NewRecurring, NewTransaction, RecurringTransaction, Transaction, UpdateTransaction } from '../types'

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

// ── 고정지출 API ──────────────────────────────────────

export async function fetchRecurring(): Promise<RecurringTransaction[]> {
  const res = await fetch('/api/recurring')
  if (!res.ok) throw new Error('고정지출 목록을 불러오지 못했습니다')
  const body = (await res.json()) as { data: RecurringTransaction[] }
  return body.data
}

export async function createRecurring(data: NewRecurring): Promise<void> {
  const res = await fetch('/api/recurring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('고정지출을 추가하지 못했습니다')
}

export async function updateRecurring(id: string, data: Partial<NewRecurring> & { active?: number }): Promise<void> {
  const res = await fetch(`/api/recurring/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('고정지출을 수정하지 못했습니다')
}

export async function deleteRecurring(id: string): Promise<void> {
  const res = await fetch(`/api/recurring/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('고정지출을 삭제하지 못했습니다')
}

// ── 혜택 규칙 API ─────────────────────────────────────

export async function fetchBenefits(cardId?: string): Promise<CardBenefit[]> {
  const url = cardId ? `/api/benefits?card_id=${encodeURIComponent(cardId)}` : '/api/benefits'
  const res = await fetch(url)
  if (!res.ok) throw new Error('혜택 목록을 불러오지 못했습니다')
  const body = (await res.json()) as { data: CardBenefit[] }
  return body.data
}

export async function createBenefit(data: NewBenefit): Promise<void> {
  const res = await fetch('/api/benefits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('혜택을 추가하지 못했습니다')
}

export async function updateBenefit(id: string, data: Partial<NewBenefit>): Promise<void> {
  const res = await fetch(`/api/benefits/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('혜택을 수정하지 못했습니다')
}

export async function deleteBenefit(id: string): Promise<void> {
  const res = await fetch(`/api/benefits/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('혜택을 삭제하지 못했습니다')
}

export async function matchBenefit(params: {
  card_id: string
  merchant: string
  category: string
  amount: number
  month: string
}): Promise<BenefitMatch[]> {
  const qs = new URLSearchParams({
    card_id: params.card_id,
    merchant: params.merchant,
    category: params.category,
    amount: String(params.amount),
    month: params.month,
  })
  const res = await fetch(`/api/benefits/match?${qs}`)
  if (!res.ok) return []
  const body = (await res.json()) as { data: BenefitMatch[] }
  return body.data
}
