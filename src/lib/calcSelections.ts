import { fetchCalcSelections, removeCalcSelectionApi, setCalcSelectionApi, type CalcSelection } from './api'

export type { CalcSelection }

// 분류(src/lib/categories.ts)와 동일한 서버 동기화 캐시 패턴 — 자세한 설명은 그쪽 주석 참고.
// 기본값 개념이 없어 빈 배열이 자연스러운 초기 상태.
// 계산기는 수입 분류만 대상으로 함(차감 항목은 수입 등록 시 금액 앞에 '-'를 붙여 이미
// 표현 가능하므로 별도 지출 칩/부호 선택 없이 선택된 수입 분류 금액을 그대로 합산)
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

/** 수입 분류 선택 목록만 반환(예전 버전에서 남은 지출 분류 선택이 있어도 걸러짐) */
export function getCalcSelections(): CalcSelection[] {
  return cache.filter((s) => s.type === 'income')
}

export function isCalcSelected(category: string): boolean {
  return cache.some((s) => s.type === 'income' && s.category === category)
}

/** 칩 탭 — 선택/해제 토글(수입 분류 전용, 부호는 항상 +1) */
export async function toggleCalcSelection(category: string): Promise<CalcSelection[]> {
  const selected = isCalcSelected(category)
  const prev = cache

  cache = selected
    ? cache.filter((s) => !(s.type === 'income' && s.category === category))
    : [...cache.filter((s) => !(s.type === 'income' && s.category === category)), { type: 'income', category, sign: 1 }]

  try {
    if (selected) {
      await removeCalcSelectionApi('income', category)
    } else {
      await setCalcSelectionApi('income', category, 1)
    }
  } catch (err) {
    cache = prev
    throw err
  }
  return getCalcSelections()
}
