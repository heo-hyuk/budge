import { addNoteCategoryApi, fetchNoteCategoryOverrides, removeNoteCategoryApi, reorderNoteCategoriesApi } from './api'

// functions/lib/noteCategories.ts의 DEFAULT_NOTE_CATEGORIES와 항상 동일하게 유지할 것.
// export하는 이유: UI에서 "이 분류가 기본 제공인지(= 순서 변경 불가)"를 판단해야 함
export const DEFAULT_NOTE_CATEGORIES = ['일상', '만남', '기념일', '건강', '기타']

interface Overrides {
  custom: string[]
  removedDefaults: string[]
}

// 거래 분류(src/lib/categories.ts)와 동일한 이유로 서버 동기화 캐시 방식을 씀 —
// 자세한 설명은 그쪽 주석 참고
let cache: Overrides = { custom: [], removedDefaults: [] }
let loadPromise: Promise<void> | null = null

/** 로그인 직후 호출 — 서버의 메모 분류 오버라이드를 캐시에 채운다(App.tsx) */
export function loadNoteCategories(): Promise<void> {
  if (!loadPromise) {
    loadPromise = fetchNoteCategoryOverrides()
      .then((res) => { cache = res })
      .catch(() => { /* 실패해도 기본 분류만으로 계속 동작 */ })
  }
  return loadPromise
}

/** 로그아웃 시 호출 — 다음 로그인(다른 계정일 수도 있음)에 이전 계정 분류가 새지 않게 캐시 비움 */
export function resetNoteCategories() {
  cache = { custom: [], removedDefaults: [] }
  loadPromise = null
}

export function getNoteCategories(): string[] {
  const { custom, removedDefaults } = cache
  const defaults = DEFAULT_NOTE_CATEGORIES.filter((c) => !removedDefaults.includes(c))
  return [...defaults, ...custom.filter((c) => !DEFAULT_NOTE_CATEGORIES.includes(c))]
}

export async function addCustomNoteCategory(name: string): Promise<string[]> {
  const trimmed = name.trim()
  if (!trimmed) return getNoteCategories()

  await addNoteCategoryApi(trimmed)

  if (DEFAULT_NOTE_CATEGORIES.includes(trimmed)) {
    cache.removedDefaults = cache.removedDefaults.filter((c) => c !== trimmed)
  } else if (!cache.custom.includes(trimmed)) {
    cache.custom = [...cache.custom, trimmed]
  }
  return getNoteCategories()
}

/** 분류 삭제 — 기본 제공 분류/사용자 정의 분류 구분 없이 전부 삭제 가능 */
export async function removeNoteCategory(name: string): Promise<string[]> {
  await removeNoteCategoryApi(name)

  if (DEFAULT_NOTE_CATEGORIES.includes(name)) {
    if (!cache.removedDefaults.includes(name)) {
      cache.removedDefaults = [...cache.removedDefaults, name]
    }
  } else {
    cache.custom = cache.custom.filter((c) => c !== name)
  }
  return getNoteCategories()
}

/** 커스텀 분류 순서 변경 — 기본 분류는 항상 앞에 고정이라 대상에서 제외됨 */
export async function reorderCustomNoteCategories(order: string[]): Promise<string[]> {
  await reorderNoteCategoriesApi(order)
  cache.custom = order
  return getNoteCategories()
}
