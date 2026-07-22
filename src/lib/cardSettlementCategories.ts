import { addCardSettlementSourceCategory, fetchCardSettlementSourceCategories, removeCardSettlementSourceCategory } from './api'

// 카드 정산기 전용 소스 분류 캐시 — calcSelections.ts/deliveryCategories.ts와 같은
// 서버 동기화 캐시 패턴이나, 배송 탭과는 완전히 독립된 상태(다른 테이블).
// deliveryCategories와 반대로 "포함" 방식 — 기본은 전체 미선택(옵트인)이라
// 여기 있는 분류만 카드 정산기 목록에 표시됨
let cache: string[] = []
let loadPromise: Promise<void> | null = null

/** 로그인 직후 호출 — 서버의 소스 분류 선택을 캐시에 채운다(App.tsx) */
export function loadCardSettlementSourceCategories(): Promise<void> {
  if (!loadPromise) {
    loadPromise = fetchCardSettlementSourceCategories()
      .then((res) => { cache = res })
      .catch(() => { /* 실패해도 전체 미선택 상태로 계속 동작 */ })
  }
  return loadPromise
}

/** 로그아웃 시 호출 — 다음 로그인(다른 계정일 수도 있음)에 이전 계정 설정이 새지 않게 캐시 비움 */
export function resetCardSettlementSourceCategories() {
  cache = []
  loadPromise = null
}

export function isCardSettlementSourceCategory(category: string): boolean {
  return cache.includes(category)
}

/** 칩 탭 — 추적 대상 포함/제외 토글 */
export async function toggleCardSettlementSourceCategory(category: string): Promise<void> {
  const included = cache.includes(category)
  const prev = cache

  cache = included ? cache.filter((c) => c !== category) : [...cache, category]

  try {
    if (included) await removeCardSettlementSourceCategory(category)
    else await addCardSettlementSourceCategory(category)
  } catch (err) {
    cache = prev
    throw err
  }
}
