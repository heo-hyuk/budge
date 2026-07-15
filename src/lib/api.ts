import type { BenefitMatch, Budget, BudgetStatus, Card, CardBenefit, NewBenefit, NewBudget, NewCard, NewNote, NewRecurring, NewTransaction, Note, RecurringTransaction, Transaction, UpdateTransaction } from '../types'

/** 서버가 4xx/5xx로 응답했을 때 던지는 에러 (서버가 준 메시지를 그대로 보존) */
export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 실패 응답 본문에서 { error: "..." } 메시지를 뽑아내고, 없으면 폴백 메시지 사용 */
async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json() as { error?: string }
    return body?.error || fallback
  } catch {
    return fallback
  }
}

/** 네트워크 자체 실패(서버에 도달 못함)를 사용자 친화적 메시지로 변환 */
async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new ApiError('인터넷 연결을 확인해주세요')
  }
}

/** 공통 요청 헬퍼: 네트워크 실패 / 서버 실패를 구분해 ApiError로 통일 */
async function apiRequest<T>(url: string, init: RequestInit | undefined, fallback: string): Promise<T> {
  const res = await apiFetch(url, init)
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, fallback), res.status)
  return res.json() as Promise<T>
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

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
  const body = await apiRequest<{ data: Transaction[] }>(url, undefined, '거래 내역을 불러오지 못했습니다')
  return body.data
}

export async function createTransaction(tx: NewTransaction): Promise<void> {
  await apiRequest('/api/transactions', jsonInit('POST', tx), '거래를 추가하지 못했습니다')
}

export async function deleteTransaction(id: string): Promise<void> {
  await apiRequest(`/api/transactions/${id}`, { method: 'DELETE' }, '거래를 삭제하지 못했습니다')
}

export async function updateTransaction(id: string, data: UpdateTransaction): Promise<void> {
  await apiRequest(`/api/transactions/${id}`, jsonInit('PATCH', data), '거래를 수정하지 못했습니다')
}

// ── 카드 API ──────────────────────────────────────────

export async function fetchCards(): Promise<Card[]> {
  const body = await apiRequest<{ data: Card[] }>('/api/cards', undefined, '카드 목록을 불러오지 못했습니다')
  return body.data
}

export async function createCard(card: NewCard): Promise<void> {
  await apiRequest('/api/cards', jsonInit('POST', card), '카드를 추가하지 못했습니다')
}

export async function updateCard(id: string, data: Partial<NewCard>): Promise<void> {
  await apiRequest(`/api/cards/${id}`, jsonInit('PATCH', data), '카드를 수정하지 못했습니다')
}

export async function deleteCard(id: string): Promise<void> {
  await apiRequest(`/api/cards/${id}`, { method: 'DELETE' }, '카드를 삭제하지 못했습니다')
}

// ── 고정지출 API ──────────────────────────────────────

export async function fetchRecurring(): Promise<RecurringTransaction[]> {
  const body = await apiRequest<{ data: RecurringTransaction[] }>('/api/recurring', undefined, '고정지출 목록을 불러오지 못했습니다')
  return body.data
}

export async function createRecurring(data: NewRecurring): Promise<void> {
  await apiRequest('/api/recurring', jsonInit('POST', data), '고정지출을 추가하지 못했습니다')
}

export async function updateRecurring(id: string, data: Partial<NewRecurring> & { active?: number }): Promise<void> {
  await apiRequest(`/api/recurring/${id}`, jsonInit('PATCH', data), '고정지출을 수정하지 못했습니다')
}

export async function deleteRecurring(id: string): Promise<void> {
  await apiRequest(`/api/recurring/${id}`, { method: 'DELETE' }, '고정지출을 삭제하지 못했습니다')
}

// ── 혜택 규칙 API ─────────────────────────────────────

export async function fetchBenefits(cardId?: string): Promise<CardBenefit[]> {
  const url = cardId ? `/api/benefits?card_id=${encodeURIComponent(cardId)}` : '/api/benefits'
  const body = await apiRequest<{ data: CardBenefit[] }>(url, undefined, '혜택 목록을 불러오지 못했습니다')
  return body.data
}

export async function createBenefit(data: NewBenefit): Promise<void> {
  await apiRequest('/api/benefits', jsonInit('POST', data), '혜택을 추가하지 못했습니다')
}

export async function updateBenefit(id: string, data: Partial<NewBenefit>): Promise<void> {
  await apiRequest(`/api/benefits/${id}`, jsonInit('PATCH', data), '혜택을 수정하지 못했습니다')
}

export async function deleteBenefit(id: string): Promise<void> {
  await apiRequest(`/api/benefits/${id}`, { method: 'DELETE' }, '혜택을 삭제하지 못했습니다')
}

/** 혜택 매칭은 거래 입력 중 실시간 보조 기능이라, 실패해도 조용히 빈 배열 반환(사용자 흐름 방해 안 함) */
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
  try {
    const res = await fetch(`/api/benefits/match?${qs}`)
    if (!res.ok) return []
    const body = (await res.json()) as { data: BenefitMatch[] }
    return body.data
  } catch {
    return []
  }
}

// ── 예산 API ──────────────────────────────────────────

export async function fetchBudgetStatus(yearMonth: string): Promise<BudgetStatus[]> {
  const body = await apiRequest<{ data: BudgetStatus[] }>(`/api/budgets?year_month=${encodeURIComponent(yearMonth)}`, undefined, '예산 정보를 불러오지 못했습니다')
  return body.data
}

/** 예산 카테고리/기간 중복 시 서버가 409로 응답할 때 던지는 에러 */
export class BudgetConflictError extends Error {
  conflictId?: string
  constructor(message: string, conflictId?: string) {
    super(message)
    this.name = 'BudgetConflictError'
    this.conflictId = conflictId
  }
}

export async function createBudget(data: NewBudget): Promise<void> {
  const res = await apiFetch('/api/budgets', jsonInit('POST', data))
  if (res.status === 409) {
    const body = await res.json() as { error: string; conflictId?: string }
    throw new BudgetConflictError(body.error, body.conflictId)
  }
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, '예산을 등록하지 못했습니다'), res.status)
}

export async function updateBudget(id: string, data: Partial<NewBudget> & { active?: number }): Promise<void> {
  const res = await apiFetch(`/api/budgets/${id}`, jsonInit('PATCH', data))
  if (res.status === 409) {
    const body = await res.json() as { error: string; conflictId?: string }
    throw new BudgetConflictError(body.error, body.conflictId)
  }
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, '예산을 수정하지 못했습니다'), res.status)
}

export async function deleteBudget(id: string): Promise<void> {
  await apiRequest(`/api/budgets/${id}`, { method: 'DELETE' }, '예산을 삭제하지 못했습니다')
}

// Budget 타입 re-export (편의)
export type { Budget, BudgetStatus }

// ── 메모장 API ────────────────────────────────────────

export async function fetchNotes(month: string): Promise<Note[]> {
  const body = await apiRequest<{ data: Note[] }>(`/api/notes?month=${encodeURIComponent(month)}`, undefined, '메모를 불러오지 못했습니다')
  return body.data
}

export async function saveNote(note: NewNote): Promise<void> {
  await apiRequest('/api/notes', jsonInit('POST', note), '메모를 저장하지 못했습니다')
}

export async function updateNote(id: string, data: Partial<Pick<NewNote, 'category' | 'content'>>): Promise<void> {
  await apiRequest(`/api/notes/${id}`, jsonInit('PATCH', data), '메모를 수정하지 못했습니다')
}

export async function deleteNote(id: string): Promise<void> {
  await apiRequest(`/api/notes/${id}`, { method: 'DELETE' }, '메모를 삭제하지 못했습니다')
}

// ── 엑셀 내보내기 API ────────────────────────────────────

import type { ExportData } from './exportExcel'

export async function fetchExportData(params: {
  start_date?: string
  end_date?: string
}): Promise<ExportData> {
  const qs = new URLSearchParams()
  if (params.start_date) qs.set('start_date', params.start_date)
  if (params.end_date)   qs.set('end_date',   params.end_date)

  const url = `/api/export${qs.toString() ? `?${qs}` : ''}`
  return apiRequest<ExportData>(url, undefined, '내보내기 데이터를 불러오지 못했습니다')
}
