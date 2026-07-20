import { addMerchantApi, fetchMerchantList, removeMerchantApi, reorderMerchantsApi } from './api'

// 구매처/판매처 관리 목록 — 분류(src/lib/categories.ts)와 동일한 서버 동기화 캐시
// 패턴이지만, 기본값 개념이 없어(사용자마다 상호명이 전혀 다름) 단순 문자열 배열만 관리
let cache: string[] = []
let loadPromise: Promise<void> | null = null

/** 로그인 직후 호출 — 서버의 구매처 목록을 캐시에 채운다(App.tsx) */
export function loadMerchants(): Promise<void> {
  if (!loadPromise) {
    loadPromise = fetchMerchantList()
      .then((res) => { cache = res })
      .catch(() => { /* 실패해도 빈 목록으로 계속 동작 */ })
  }
  return loadPromise
}

/** 로그아웃 시 호출 — 다음 로그인(다른 계정일 수도 있음)에 이전 계정 목록이 새지 않게 캐시 비움 */
export function resetMerchants() {
  cache = []
  loadPromise = null
}

export function getMerchants(): string[] {
  return cache
}

export async function addMerchant(name: string): Promise<string[]> {
  const trimmed = name.trim()
  if (!trimmed) return cache

  await addMerchantApi(trimmed)
  if (!cache.includes(trimmed)) cache = [...cache, trimmed]
  return cache
}

export async function removeMerchant(name: string): Promise<string[]> {
  await removeMerchantApi(name)
  cache = cache.filter((c) => c !== name)
  return cache
}

export async function reorderMerchants(order: string[]): Promise<string[]> {
  await reorderMerchantsApi(order)
  cache = order
  return cache
}
