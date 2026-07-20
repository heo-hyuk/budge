import { fetchCalcSelections, removeCalcSelectionApi, setCalcSelectionApi, type CalcSelection } from './api'
import type { TransactionType } from '../types'

export type { CalcSelection }

// 분류(src/lib/categories.ts)와 동일한 서버 동기화 캐시 패턴 — 자세한 설명은 그쪽 주석 참고.
// 기본값 개념이 없어 빈 배열이 자연스러운 초기 상태
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

export function getCalcSelections(): CalcSelection[] {
  return cache
}

/** 현재 부호 조회 — 선택 안 함이면 0 */
export function getCalcSign(type: TransactionType, category: string): 1 | -1 | 0 {
  return cache.find((s) => s.type === type && s.category === category)?.sign ?? 0
}

/** 칩 탭 — 미선택(0) → +1 → -1 → 미선택(0) 순환 */
export async function cycleCalcSelection(type: TransactionType, category: string): Promise<CalcSelection[]> {
  const current = getCalcSign(type, category)
  const next = current === 0 ? 1 : current === 1 ? -1 : 0

  const prev = cache
  if (next === 0) {
    cache = cache.filter((s) => !(s.type === type && s.category === category))
  } else {
    cache = [...cache.filter((s) => !(s.type === type && s.category === category)), { type, category, sign: next }]
  }

  try {
    if (next === 0) {
      await removeCalcSelectionApi(type, category)
    } else {
      await setCalcSelectionApi(type, category, next)
    }
  } catch (err) {
    cache = prev
    throw err
  }
  return cache
}
