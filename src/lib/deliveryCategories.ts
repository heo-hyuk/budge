import { addDeliveryExcludedCategory, fetchDeliveryExcludedCategories, removeDeliveryExcludedCategory } from './api'

// 배송 탭 전용 분류 exclude 캐시 — calcSelections.ts와 같은 서버 동기화
// 캐시 패턴이나, 지출계산기와는 완전히 독립된 상태(calc_selections 테이블과 무관).
// 기본은 전체 포함이라 여기 있는 분류만 "제외됨"으로 취급
let cache: string[] = []
let loadPromise: Promise<void> | null = null

/** 로그인 직후 호출 — 서버의 제외 목록을 캐시에 채운다(App.tsx) */
export function loadDeliveryExcludedCategories(): Promise<void> {
  if (!loadPromise) {
    loadPromise = fetchDeliveryExcludedCategories()
      .then((res) => { cache = res })
      .catch(() => { /* 실패해도 전체 포함 상태로 계속 동작 */ })
  }
  return loadPromise
}

/** 로그아웃 시 호출 — 다음 로그인(다른 계정일 수도 있음)에 이전 계정 설정이 새지 않게 캐시 비움 */
export function resetDeliveryExcludedCategories() {
  cache = []
  loadPromise = null
}

export function isDeliveryCategoryIncluded(category: string): boolean {
  return !cache.includes(category)
}

/** 칩 탭 — 포함/제외 토글 */
export async function toggleDeliveryCategory(category: string): Promise<void> {
  const excluded = cache.includes(category)
  const prev = cache

  cache = excluded ? cache.filter((c) => c !== category) : [...cache, category]

  try {
    if (excluded) await removeDeliveryExcludedCategory(category)
    else await addDeliveryExcludedCategory(category)
  } catch (err) {
    cache = prev
    throw err
  }
}
