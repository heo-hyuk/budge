import type { TransactionType } from '../types'

const DEFAULT_CATEGORIES: Record<TransactionType, string[]> = {
  expense: ['식비', '교통', '주거/공과금', '의료', '문화/여가', '쇼핑', '교육', '경조사', '기타'],
  income: ['급여', '용돈', '기타수입'],
}

function customKey(type: TransactionType) {
  return `budget:categories:${type}`
}

function removedDefaultsKey(type: TransactionType) {
  return `budget:categories:${type}:removedDefaults`
}

function loadList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function getCategories(type: TransactionType): string[] {
  const removedDefaults = loadList(removedDefaultsKey(type))
  const custom = loadList(customKey(type))
  const defaults = DEFAULT_CATEGORIES[type].filter((c) => !removedDefaults.includes(c))
  return [...defaults, ...custom.filter((c) => !DEFAULT_CATEGORIES[type].includes(c))]
}

export function addCustomCategory(type: TransactionType, name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return getCategories(type)

  // 예전에 삭제했던 기본 분류를 같은 이름으로 다시 추가하면 복원으로 처리
  if (DEFAULT_CATEGORIES[type].includes(trimmed)) {
    const removedDefaults = loadList(removedDefaultsKey(type)).filter((c) => c !== trimmed)
    localStorage.setItem(removedDefaultsKey(type), JSON.stringify(removedDefaults))
    return getCategories(type)
  }

  const custom = loadList(customKey(type))
  if (!custom.includes(trimmed)) {
    custom.push(trimmed)
    localStorage.setItem(customKey(type), JSON.stringify(custom))
  }
  return getCategories(type)
}

/** 분류 삭제 — 기본 제공 분류/사용자 정의 분류 구분 없이 전부 삭제 가능 */
export function removeCategory(type: TransactionType, name: string): string[] {
  if (DEFAULT_CATEGORIES[type].includes(name)) {
    const removedDefaults = loadList(removedDefaultsKey(type))
    if (!removedDefaults.includes(name)) {
      removedDefaults.push(name)
      localStorage.setItem(removedDefaultsKey(type), JSON.stringify(removedDefaults))
    }
  } else {
    const custom = loadList(customKey(type)).filter((c) => c !== name)
    localStorage.setItem(customKey(type), JSON.stringify(custom))
  }
  return getCategories(type)
}
