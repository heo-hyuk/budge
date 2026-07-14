import type { TransactionType } from '../types'

const DEFAULT_CATEGORIES: Record<TransactionType, string[]> = {
  expense: ['식비', '교통', '주거/공과금', '의료', '문화/여가', '쇼핑', '교육', '경조사', '기타'],
  income: ['급여', '용돈', '기타수입'],
}

function storageKey(type: TransactionType) {
  return `budget:categories:${type}`
}

function loadCustomCategories(type: TransactionType): string[] {
  try {
    const raw = localStorage.getItem(storageKey(type))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function getCategories(type: TransactionType): string[] {
  const custom = loadCustomCategories(type)
  return [...DEFAULT_CATEGORIES[type], ...custom.filter((c) => !DEFAULT_CATEGORIES[type].includes(c))]
}

export function addCustomCategory(type: TransactionType, name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return getCategories(type)

  const custom = loadCustomCategories(type)
  if (!custom.includes(trimmed) && !DEFAULT_CATEGORIES[type].includes(trimmed)) {
    custom.push(trimmed)
    localStorage.setItem(storageKey(type), JSON.stringify(custom))
  }
  return getCategories(type)
}
