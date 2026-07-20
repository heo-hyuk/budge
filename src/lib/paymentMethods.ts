import { addPaymentMethodApi, fetchPaymentMethods, removePaymentMethodApi, reorderPaymentMethodsApi } from './api'
import type { TransactionType } from '../types'

// functions/lib/paymentMethods.ts의 DEFAULT_PAYMENT_METHODS와 항상 동일하게 유지할 것.
// 등록된 카드는 이 목록과 무관(별도 cards API) — 화면에서 이 목록 뒤에 따로 이어붙여 표시함
export const DEFAULT_PAYMENT_METHODS: Record<TransactionType, string[]> = {
  expense: ['현금', '계좌이체'],
  income: ['현금', '계좌이체'],
}

// 분류(src/lib/categories.ts)와 동일한 서버 동기화 캐시 패턴 — 지출/수입을
// 독립적으로 관리(예: 수입에서 '계좌이체'를 지워도 지출 쪽엔 영향 없음)
let cache: Record<TransactionType, string[]> = {
  expense: [...DEFAULT_PAYMENT_METHODS.expense],
  income: [...DEFAULT_PAYMENT_METHODS.income],
}
let loadPromise: Promise<void> | null = null

/** 로그인 직후 호출 — 서버의 결제 방법 목록을 캐시에 채운다(App.tsx) */
export function loadPaymentMethods(): Promise<void> {
  if (!loadPromise) {
    loadPromise = fetchPaymentMethods()
      .then((res) => { cache = res })
      .catch(() => { /* 실패해도 기본 항목만으로 계속 동작 */ })
  }
  return loadPromise
}

/** 로그아웃 시 호출 — 다음 로그인(다른 계정일 수도 있음)에 이전 계정 목록이 새지 않게 캐시 비움 */
export function resetPaymentMethods() {
  cache = { expense: [...DEFAULT_PAYMENT_METHODS.expense], income: [...DEFAULT_PAYMENT_METHODS.income] }
  loadPromise = null
}

export function getPaymentMethods(type: TransactionType): string[] {
  return cache[type]
}

export async function addPaymentMethod(type: TransactionType, name: string): Promise<string[]> {
  const trimmed = name.trim()
  if (!trimmed) return getPaymentMethods(type)

  await addPaymentMethodApi(type, trimmed)
  cache = await fetchPaymentMethods()
  return getPaymentMethods(type)
}

/** 결제 방법 삭제 — 기본 제공 항목/사용자 정의 항목 구분 없이 전부 삭제 가능 */
export async function removePaymentMethod(type: TransactionType, name: string): Promise<string[]> {
  await removePaymentMethodApi(type, name)
  cache = { ...cache, [type]: cache[type].filter((c) => c !== name) }
  return getPaymentMethods(type)
}

/** 결제 방법 순서 변경(드래그) — 기본 제공 항목도 대상에 포함됨 */
export async function reorderPaymentMethods(type: TransactionType, order: string[]): Promise<string[]> {
  const prev = cache[type]
  cache = { ...cache, [type]: order }
  try {
    await reorderPaymentMethodsApi(type, order)
  } catch (err) {
    cache = { ...cache, [type]: prev }
    throw err
  }
  return getPaymentMethods(type)
}
