import { fetchUserSettings, updateUserSetting } from './api'
import type { UserSettings } from './api'

// 계정당 값 하나뿐인 설정(카드 지출 집계 기준 등)의 서버 동기화 캐시.
// src/lib/categories.ts와 동일한 이유·패턴 — 자세한 설명은 그쪽 주석 참고
let cache: UserSettings = { monthlyBasis: 'billing', cardSettlementTargetPaymentMethod: '' }
let loadPromise: Promise<void> | null = null

/** 로그인 직후 호출 — 서버의 설정 값을 캐시에 채운다(App.tsx) */
export function loadSettings(): Promise<void> {
  if (!loadPromise) {
    loadPromise = fetchUserSettings()
      .then((res) => { cache = res })
      .catch(() => { /* 실패해도 기본값으로 계속 동작 */ })
  }
  return loadPromise
}

/** 로그아웃 시 호출 — 다음 로그인(다른 계정일 수도 있음)에 이전 계정 설정이 새지 않게 캐시 비움 */
export function resetSettings() {
  cache = { monthlyBasis: 'billing', cardSettlementTargetPaymentMethod: '' }
  loadPromise = null
}

export function getMonthlyBasis(): UserSettings['monthlyBasis'] {
  return cache.monthlyBasis
}

export async function setMonthlyBasis(value: UserSettings['monthlyBasis']): Promise<void> {
  await updateUserSetting('monthlyBasis', value)
  cache.monthlyBasis = value
}

/** 카드 정산기에서 체크 시 바뀔 목표 결제방법, '' = 아직 미설정 */
export function getCardSettlementTargetPaymentMethod(): string {
  return cache.cardSettlementTargetPaymentMethod
}

export async function setCardSettlementTargetPaymentMethod(value: string): Promise<void> {
  await updateUserSetting('cardSettlementTargetPaymentMethod', value)
  cache.cardSettlementTargetPaymentMethod = value
}
