import { addCategoryApi, fetchCategoryOverrides, removeCategoryApi } from './api'
import type { TransactionType } from '../types'

// functions/lib/categories.ts의 DEFAULT_CATEGORIES와 항상 동일하게 유지할 것
const DEFAULT_CATEGORIES: Record<TransactionType, string[]> = {
  expense: ['식비', '교통', '주거/공과금', '의료', '문화/여가', '쇼핑', '교육', '경조사', '기타'],
  income: ['급여', '용돈', '기타수입'],
}

interface Overrides {
  custom: string[]
  removedDefaults: string[]
}

function emptyOverrides(): Record<TransactionType, Overrides> {
  return {
    expense: { custom: [], removedDefaults: [] },
    income: { custom: [], removedDefaults: [] },
  }
}

// 분류 오버라이드(커스텀 추가/기본 삭제)는 계정 단위로 서버(D1)에 저장돼 기기 간
// 동기화됨(이전엔 localStorage에만 저장돼 로그인한 기기마다 분류 목록이 서로 달랐음).
// getCategories()는 여러 컴포넌트에서 동기 함수로 바로 호출하는 기존 구조를 유지하기
// 위해 이 모듈 레벨 캐시를 읽기만 하고, 실제 로드는 loadCategories()가 담당한다.
let cache = emptyOverrides()
let loadPromise: Promise<void> | null = null

/** 로그인 직후 호출 — 서버의 분류 오버라이드를 캐시에 채운다(App.tsx) */
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
  cache = emptyOverrides()
  loadPromise = null
}

export function getCategories(type: TransactionType): string[] {
  const { custom, removedDefaults } = cache[type]
  const defaults = DEFAULT_CATEGORIES[type].filter((c) => !removedDefaults.includes(c))
  return [...defaults, ...custom.filter((c) => !DEFAULT_CATEGORIES[type].includes(c))]
}

export async function addCustomCategory(type: TransactionType, name: string): Promise<string[]> {
  const trimmed = name.trim()
  if (!trimmed) return getCategories(type)

  await addCategoryApi(type, trimmed)

  // 예전에 삭제했던 기본 분류를 같은 이름으로 다시 추가하면 복원으로 처리
  if (DEFAULT_CATEGORIES[type].includes(trimmed)) {
    cache[type].removedDefaults = cache[type].removedDefaults.filter((c) => c !== trimmed)
  } else if (!cache[type].custom.includes(trimmed)) {
    cache[type].custom = [...cache[type].custom, trimmed]
  }
  return getCategories(type)
}

/** 분류 삭제 — 기본 제공 분류/사용자 정의 분류 구분 없이 전부 삭제 가능 */
export async function removeCategory(type: TransactionType, name: string): Promise<string[]> {
  await removeCategoryApi(type, name)

  if (DEFAULT_CATEGORIES[type].includes(name)) {
    if (!cache[type].removedDefaults.includes(name)) {
      cache[type].removedDefaults = [...cache[type].removedDefaults, name]
    }
  } else {
    cache[type].custom = cache[type].custom.filter((c) => c !== name)
  }
  return getCategories(type)
}
