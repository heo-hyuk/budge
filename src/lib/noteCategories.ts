import { addNoteCategoryApi, fetchNoteCategoryOverrides, removeNoteCategoryApi, reorderNoteCategoriesApi } from './api'

// functions/lib/noteCategories.ts의 DEFAULT_NOTE_CATEGORIES와 항상 동일하게 유지할 것.
export const DEFAULT_NOTE_CATEGORIES = ['일상', '만남', '기념일', '건강', '기타']

// 거래 분류(src/lib/categories.ts)와 동일한 이유로 서버 동기화 캐시 방식을 씀 —
// 자세한 설명은 그쪽 주석 참고
let cache: string[] = [...DEFAULT_NOTE_CATEGORIES]
let loadPromise: Promise<void> | null = null

/** 로그인 직후 호출 — 서버의 메모 분류 목록을 캐시에 채운다(App.tsx) */
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
  cache = [...DEFAULT_NOTE_CATEGORIES]
  loadPromise = null
}

export function getNoteCategories(): string[] {
  return cache
}

export async function addCustomNoteCategory(name: string): Promise<string[]> {
  const trimmed = name.trim()
  if (!trimmed) return getNoteCategories()

  await addNoteCategoryApi(trimmed)
  cache = await fetchNoteCategoryOverrides()
  return getNoteCategories()
}

/** 분류 삭제 — 기본 제공 분류/사용자 정의 분류 구분 없이 전부 삭제 가능 */
export async function removeNoteCategory(name: string): Promise<string[]> {
  await removeNoteCategoryApi(name)
  cache = cache.filter((c) => c !== name)
  return getNoteCategories()
}

/** 분류 순서 변경(드래그) — 기본 제공 분류도 대상에 포함됨 */
export async function reorderNoteCategories(order: string[]): Promise<string[]> {
  const prev = cache
  cache = order
  try {
    await reorderNoteCategoriesApi(order)
  } catch (err) {
    cache = prev
    throw err
  }
  return getNoteCategories()
}
