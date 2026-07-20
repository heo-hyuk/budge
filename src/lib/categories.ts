import { addCategoryApi, fetchCategoryOverrides, removeCategoryApi, reorderCategoriesApi } from './api'
import type { TransactionType } from '../types'

// functions/lib/categories.ts의 DEFAULT_CATEGORIES와 항상 동일하게 유지할 것.
export const DEFAULT_CATEGORIES: Record<TransactionType, string[]> = {
  expense: ['식비', '교통', '주거/공과금', '의료', '문화/여가', '쇼핑', '교육', '경조사', '기타'],
  income: ['급여', '용돈', '기타수입'],
}

// 분류(기본 제공 + 커스텀 추가/삭제/순서 변경)는 계정 단위로 서버(D1)에 저장돼
// 기기 간 동기화됨. 서버가 이미 기본+커스텀을 병합/정렬해 최종 순서 배열로
// 내려주므로, 프론트는 그 배열을 그대로 캐시해뒀다가 동기 함수로 읽기만 한다.
let cache: Record<TransactionType, string[]> = {
  expense: [...DEFAULT_CATEGORIES.expense],
  income: [...DEFAULT_CATEGORIES.income],
}
let loadPromise: Promise<void> | null = null

/** 로그인 직후 호출 — 서버의 분류 목록을 캐시에 채운다(App.tsx) */
export function loadCategories(): Promise<void> {
  if (!loadPromise) {
    loadPromise = fetchCategoryOverrides()
      .then((res) => { cache = res })
      .catch(() => { /* 실패해도 기본 분류만으로 계속 동작 */ })
  }
  return loadPromise
}

/** 로그아웃 시 호출 — 다음 로그인(다른 계정일 수도 있음)에 이전 계정 분류가 새지 않게 캐시 비움 */
export function resetCategories() {
  cache = { expense: [...DEFAULT_CATEGORIES.expense], income: [...DEFAULT_CATEGORIES.income] }
  loadPromise = null
}

export function getCategories(type: TransactionType): string[] {
  return cache[type]
}

export async function addCustomCategory(type: TransactionType, name: string): Promise<string[]> {
  const trimmed = name.trim()
  if (!trimmed) return getCategories(type)

  await addCategoryApi(type, trimmed)
  // 추가된 위치(기본 분류 복원은 원래 자리, 신규 커스텀은 맨 끝)는 서버 로직에
  // 달려 있어 프론트에서 예측하기보다 다시 조회하는 편이 단순하고 항상 정확함
  cache = await fetchCategoryOverrides()
  return getCategories(type)
}

/** 분류 삭제 — 기본 제공 분류/사용자 정의 분류 구분 없이 전부 삭제 가능 */
export async function removeCategory(type: TransactionType, name: string): Promise<string[]> {
  await removeCategoryApi(type, name)
  cache = { ...cache, [type]: cache[type].filter((c) => c !== name) }
  return getCategories(type)
}

/** 분류 순서 변경(드래그) — 기본 제공 분류도 대상에 포함됨 */
export async function reorderCategories(type: TransactionType, order: string[]): Promise<string[]> {
  const prev = cache[type]
  cache = { ...cache, [type]: order }
  try {
    await reorderCategoriesApi(type, order)
  } catch (err) {
    cache = { ...cache, [type]: prev }
    throw err
  }
  return getCategories(type)
}
