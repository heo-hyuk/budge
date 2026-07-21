import { fetchCalcSelections, removeCalcSelectionApi, setCalcSelectionApi, type CalcSelection } from './api'
import type { TransactionType } from '../types'

export type { CalcSelection }

// 분류(src/lib/categories.ts)와 동일한 서버 동기화 캐시 패턴 — 자세한 설명은 그쪽 주석 참고.
// 기본값 개념이 없어 빈 배열이 자연스러운 초기 상태.
// 수입/지출 계산기가 같은 캐시를 공유하고 type으로 구분해서 걸러 쓴다.
let cache: CalcSelection[] = []
let loadPromise: Promise<void> | null = null

/** 로그인 직후 호출 — 서버의 계산기 선택을 캐시에 채운다(App.tsx) */
export function loadCalcSelections(): Promise<void> {
  if (!loadPromise) {
    loadPromise = fetchCalcSelections()
      .then((res) => { cache = res })
      .catch(() => { /* 실패해도 선택 없음으로 계속 동작 */ })
  }
  return loadPromise
}

/** 로그아웃 시 호출 — 다음 로그인(다른 계정일 수도 있음)에 이전 계정 선택이 새지 않게 캐시 비움 */
export function resetCalcSelections() {
  cache = []
  loadPromise = null
}

/** 해당 타입(수입/지출) 분류 선택 목록만 반환 */
export function getCalcSelections(type: TransactionType): CalcSelection[] {
  return cache.filter((s) => s.type === type)
}

export function isCalcSelected(type: TransactionType, category: string): boolean {
  return cache.some((s) => s.type === type && s.category === category)
}

/** 칩 탭 — 선택/해제 토글(부호는 항상 +1) */
export async function toggleCalcSelection(type: TransactionType, category: string): Promise<CalcSelection[]> {
  const selected = isCalcSelected(type, category)
  const prev = cache

  cache = selected
    ? cache.filter((s) => !(s.type === type && s.category === category))
    : [...cache.filter((s) => !(s.type === type && s.category === category)), { type, category, sign: 1 }]

  try {
    if (selected) {
      await removeCalcSelectionApi(type, category)
    } else {
      await setCalcSelectionApi(type, category, 1)
    }
  } catch (err) {
    cache = prev
    throw err
  }
  return getCalcSelections(type)
}
