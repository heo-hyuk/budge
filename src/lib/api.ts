import type { AnnualSettlement, BenefitGroup, BenefitMatch, Budget, BudgetStatus, Card, CardBenefit, DailySettlement, MonthlySettlement, NewBenefit, NewBenefitGroup, NewBudget, NewCard, NewNote, NewQuickTemplate, NewRecurring, NewTransaction, Note, QuickTemplate, RecentMerchant, RecurringTransaction, Transaction, TransactionType, UpdateTransaction, WeeklySettlement } from '../types'

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
  card_id?: string     // 카드별 조회, 'cash' = 현금만
  date_start?: string  // 날짜 범위 시작
  date_end?: string    // 날짜 범위 종료
  min_amount?: number  // 최소 금액
  max_amount?: number  // 최대 금액
  unsettled?: boolean  // true면 비정산 거래만 조회(기본은 비정산 제외)
}): Promise<Transaction[]> {
  const qs = new URLSearchParams()
  if (params?.month)      qs.set('month', params.month)
  if (params?.year)       qs.set('year', params.year)
  if (params?.q)          qs.set('q', params.q)
  if (params?.card_id)    qs.set('card_id', params.card_id)
  if (params?.date_start) qs.set('date_start', params.date_start)
  if (params?.date_end)   qs.set('date_end', params.date_end)
  if (params?.min_amount != null) qs.set('min_amount', String(params.min_amount))
  if (params?.max_amount != null) qs.set('max_amount', String(params.max_amount))
  if (params?.unsettled)  qs.set('unsettled', '1')

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

export async function createCard(card: NewCard): Promise<string> {
  const body = await apiRequest<{ id: string }>('/api/cards', jsonInit('POST', card), '카드를 추가하지 못했습니다')
  return body.id
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

// ── 혜택 그룹 API (통합 월한도 공유) ───────────────────────

export async function fetchBenefitGroups(cardId?: string): Promise<BenefitGroup[]> {
  const url = cardId ? `/api/benefit-groups?card_id=${encodeURIComponent(cardId)}` : '/api/benefit-groups'
  const body = await apiRequest<{ data: BenefitGroup[] }>(url, undefined, '혜택 그룹을 불러오지 못했습니다')
  return body.data
}

export async function createBenefitGroup(data: NewBenefitGroup): Promise<string> {
  const body = await apiRequest<{ id: string }>('/api/benefit-groups', jsonInit('POST', data), '혜택 그룹을 추가하지 못했습니다')
  return body.id
}

export async function updateBenefitGroup(id: string, data: Partial<NewBenefitGroup>): Promise<void> {
  await apiRequest(`/api/benefit-groups/${id}`, jsonInit('PATCH', data), '혜택 그룹을 수정하지 못했습니다')
}

export async function deleteBenefitGroup(id: string): Promise<void> {
  await apiRequest(`/api/benefit-groups/${id}`, { method: 'DELETE' }, '혜택 그룹을 삭제하지 못했습니다')
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

export async function saveNote(note: NewNote, image?: File | null): Promise<void> {
  const form = new FormData()
  form.set('date', note.date)
  form.set('category', note.category)
  form.set('content', note.content)
  if (image) form.set('image', image)
  await apiRequest('/api/notes', { method: 'POST', body: form }, '메모를 저장하지 못했습니다')
}

export async function updateNote(
  id: string,
  data: Partial<Pick<NewNote, 'category' | 'content'>>,
  options?: { image?: File | null; removeImage?: boolean }
): Promise<void> {
  const form = new FormData()
  if (data.category !== undefined) form.set('category', data.category)
  if (data.content  !== undefined) form.set('content', data.content)
  if (options?.image) form.set('image', options.image)
  if (options?.removeImage) form.set('removeImage', '1')
  await apiRequest(`/api/notes/${id}`, { method: 'PATCH', body: form }, '메모를 수정하지 못했습니다')
}

export async function deleteNote(id: string): Promise<void> {
  await apiRequest(`/api/notes/${id}`, { method: 'DELETE' }, '메모를 삭제하지 못했습니다')
}

/** 메모에 첨부된 이미지 URL(세션 쿠키 인증 필요, 본인 메모만 조회 가능) */
export function noteImageUrl(noteId: string): string {
  return `/api/notes/image/${noteId}`
}

// ── 최근 구매처 자동완성 API ─────────────────────────────

export async function fetchRecentMerchants(): Promise<RecentMerchant[]> {
  const body = await apiRequest<{ data: RecentMerchant[] }>('/api/merchants/recent', undefined, '최근 구매처를 불러오지 못했습니다')
  return body.data
}

// ── 빠른 입력 템플릿 API ─────────────────────────────────

export async function fetchTemplates(): Promise<QuickTemplate[]> {
  const body = await apiRequest<{ data: QuickTemplate[] }>('/api/templates', undefined, '템플릿을 불러오지 못했습니다')
  return body.data
}

export async function createTemplate(data: NewQuickTemplate): Promise<void> {
  await apiRequest('/api/templates', jsonInit('POST', data), '템플릿을 저장하지 못했습니다')
}

export async function updateTemplate(id: string, data: Partial<NewQuickTemplate> & { sort_order?: number }): Promise<void> {
  await apiRequest(`/api/templates/${id}`, jsonInit('PATCH', data), '템플릿을 수정하지 못했습니다')
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiRequest(`/api/templates/${id}`, { method: 'DELETE' }, '템플릿을 삭제하지 못했습니다')
}

// ── 한눈에 보기 (일일/주간 정산) API ───────────────────────

export async function fetchDailySettlement(date: string): Promise<DailySettlement> {
  return apiRequest<DailySettlement>(`/api/settlement/daily?date=${encodeURIComponent(date)}`, undefined, '일일 정산을 불러오지 못했습니다')
}

export async function fetchWeeklySettlement(weekStart: string): Promise<WeeklySettlement> {
  return apiRequest<WeeklySettlement>(`/api/settlement/weekly?week_start=${encodeURIComponent(weekStart)}`, undefined, '주간 정산을 불러오지 못했습니다')
}

export async function fetchMonthlySettlement(month: string): Promise<MonthlySettlement> {
  return apiRequest<MonthlySettlement>(`/api/settlement/monthly?month=${encodeURIComponent(month)}`, undefined, '월간 정산을 불러오지 못했습니다')
}

export async function fetchAnnualSettlement(year: string): Promise<AnnualSettlement> {
  return apiRequest<AnnualSettlement>(`/api/settlement/annual?year=${encodeURIComponent(year)}`, undefined, '연간 정산을 불러오지 못했습니다')
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

// ── 카드 정산 알림(Push) API ─────────────────────────────

export interface PushSubscriptionPayload {
  endpoint: string
  p256dh: string
  auth: string
}

export async function subscribePush(payload: PushSubscriptionPayload): Promise<void> {
  await apiRequest('/api/push/subscribe', jsonInit('POST', payload), '알림 구독에 실패했습니다')
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await apiRequest('/api/push/unsubscribe', jsonInit('POST', { endpoint }), '알림 구독 해제에 실패했습니다')
}

// ── 거래 분류(카테고리) API ───────────────────────────────
// 계정 단위로 저장돼 기기 간 동기화됨(이전엔 localStorage에만 저장돼 기기마다 달랐음)

export interface CategoriesResponse {
  expense: string[]
  income: string[]
}

export async function fetchCategoryOverrides(): Promise<CategoriesResponse> {
  return apiRequest<CategoriesResponse>('/api/categories', undefined, '분류를 불러오지 못했습니다')
}

export async function addCategoryApi(type: TransactionType, name: string): Promise<void> {
  await apiRequest('/api/categories', jsonInit('POST', { type, name }), '분류를 추가하지 못했습니다')
}

export async function removeCategoryApi(type: TransactionType, name: string): Promise<void> {
  await apiRequest(
    `/api/categories?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}`,
    { method: 'DELETE' },
    '분류를 삭제하지 못했습니다'
  )
}

export async function reorderCategoriesApi(type: TransactionType, order: string[]): Promise<void> {
  await apiRequest('/api/categories', jsonInit('PATCH', { type, order }), '분류 순서를 저장하지 못했습니다')
}

// ── 메모 분류 API ────────────────────────────────────────
// 거래 분류와 동일한 이유로 계정 단위 저장(타입 구분 없는 단일 목록)

export async function fetchNoteCategoryOverrides(): Promise<string[]> {
  const body = await apiRequest<{ data: string[] }>('/api/note-categories', undefined, '메모 분류를 불러오지 못했습니다')
  return body.data
}

export async function addNoteCategoryApi(name: string): Promise<void> {
  await apiRequest('/api/note-categories', jsonInit('POST', { name }), '메모 분류를 추가하지 못했습니다')
}

export async function removeNoteCategoryApi(name: string): Promise<void> {
  await apiRequest(
    `/api/note-categories?name=${encodeURIComponent(name)}`,
    { method: 'DELETE' },
    '메모 분류를 삭제하지 못했습니다'
  )
}

export async function reorderNoteCategoriesApi(order: string[]): Promise<void> {
  await apiRequest('/api/note-categories', jsonInit('PATCH', { order }), '메모 분류 순서를 저장하지 못했습니다')
}

// ── 계정별 설정 API ──────────────────────────────────────
// 카드 지출 집계 기준 등 계정당 값 하나뿐인 설정(이전엔 localStorage에만 저장돼 기기마다 달랐음)

export interface UserSettings {
  monthlyBasis: 'billing' | 'transaction'
}

export async function fetchUserSettings(): Promise<UserSettings> {
  return apiRequest<UserSettings>('/api/settings', undefined, '설정을 불러오지 못했습니다')
}

export async function updateUserSetting(key: string, value: string): Promise<void> {
  await apiRequest('/api/settings', jsonInit('PATCH', { key, value }), '설정을 저장하지 못했습니다')
}

// ── 구매처/판매처 관리 목록 API ───────────────────────────
// 분류처럼 사용자가 직접 추가/삭제하는 계정 단위 목록(기본값 없음).
// /api/merchants/recent(거래 이력 기반 자동완성)와는 별개 기능

export async function fetchMerchantList(): Promise<string[]> {
  const body = await apiRequest<{ data: string[] }>('/api/merchants', undefined, '구매처 목록을 불러오지 못했습니다')
  return body.data
}

export async function addMerchantApi(name: string): Promise<void> {
  await apiRequest('/api/merchants', jsonInit('POST', { name }), '구매처를 추가하지 못했습니다')
}

export async function removeMerchantApi(name: string): Promise<void> {
  await apiRequest(
    `/api/merchants?name=${encodeURIComponent(name)}`,
    { method: 'DELETE' },
    '구매처를 삭제하지 못했습니다'
  )
}

export async function reorderMerchantsApi(order: string[]): Promise<void> {
  await apiRequest('/api/merchants', jsonInit('PATCH', { order }), '구매처 순서를 저장하지 못했습니다')
}

// ── 결제 방법(현금/계좌이체 + 커스텀) API ─────────────────
// 분류와 동일한 이유로 계정 단위 저장(지출/수입 타입별로 독립 관리). 등록된
// 카드는 이 API와 무관(카드 관리 API 별도)

export async function fetchPaymentMethods(): Promise<CategoriesResponse> {
  return apiRequest<CategoriesResponse>('/api/payment-methods', undefined, '결제 방법을 불러오지 못했습니다')
}

export async function addPaymentMethodApi(type: TransactionType, name: string): Promise<void> {
  await apiRequest('/api/payment-methods', jsonInit('POST', { type, name }), '결제 방법을 추가하지 못했습니다')
}

export async function removePaymentMethodApi(type: TransactionType, name: string): Promise<void> {
  await apiRequest(
    `/api/payment-methods?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}`,
    { method: 'DELETE' },
    '결제 방법을 삭제하지 못했습니다'
  )
}

export async function reorderPaymentMethodsApi(type: TransactionType, order: string[]): Promise<void> {
  await apiRequest('/api/payment-methods', jsonInit('PATCH', { type, order }), '결제 방법 순서를 저장하지 못했습니다')
}

// ── 개인화 수익 계산기 선택 칩 API ─────────────────────────
// 계정 단위 저장(기기 간 동기화). 기본값/순서 개념 없음 — 선택 안 함은 행 없음으로 표현

export interface CalcSelection {
  type: TransactionType
  category: string
  sign: 1 | -1
}

export async function fetchCalcSelections(): Promise<CalcSelection[]> {
  const body = await apiRequest<{ selections: CalcSelection[] }>('/api/calc-selections', undefined, '계산기 선택을 불러오지 못했습니다')
  return body.selections
}

export async function setCalcSelectionApi(type: TransactionType, category: string, sign: 1 | -1): Promise<void> {
  await apiRequest('/api/calc-selections', jsonInit('POST', { type, category, sign }), '선택을 저장하지 못했습니다')
}

export async function removeCalcSelectionApi(type: TransactionType, category: string): Promise<void> {
  await apiRequest(
    `/api/calc-selections?type=${encodeURIComponent(type)}&category=${encodeURIComponent(category)}`,
    { method: 'DELETE' },
    '선택을 해제하지 못했습니다'
  )
}

// ── 배송 탭 분류 제외 목록 API ────────────────────────────
// 지출계산기(calc-selections)와는 완전히 독립된 상태. exclude 전용이라
// 기본은 전체 포함, 여기 저장된 분류만 배송 탭 목록에서 제외됨

export async function fetchDeliveryExcludedCategories(): Promise<string[]> {
  const body = await apiRequest<{ data: string[] }>('/api/delivery-excluded-categories', undefined, '배송 분류 설정을 불러오지 못했습니다')
  return body.data
}

export async function addDeliveryExcludedCategory(category: string): Promise<void> {
  await apiRequest('/api/delivery-excluded-categories', jsonInit('POST', { category }), '분류를 제외하지 못했습니다')
}

export async function removeDeliveryExcludedCategory(category: string): Promise<void> {
  await apiRequest(
    `/api/delivery-excluded-categories?category=${encodeURIComponent(category)}`,
    { method: 'DELETE' },
    '분류를 다시 포함하지 못했습니다'
  )
}
