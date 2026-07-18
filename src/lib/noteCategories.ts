const DEFAULT_NOTE_CATEGORIES = ['일상', '만남', '기념일', '건강', '기타']

const STORAGE_KEY = 'budget:noteCategories'

function loadCustomCategories(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function getNoteCategories(): string[] {
  const custom = loadCustomCategories()
  return [...DEFAULT_NOTE_CATEGORIES, ...custom.filter((c) => !DEFAULT_NOTE_CATEGORIES.includes(c))]
}

export function addCustomNoteCategory(name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return getNoteCategories()

  const custom = loadCustomCategories()
  if (!custom.includes(trimmed) && !DEFAULT_NOTE_CATEGORIES.includes(trimmed)) {
    custom.push(trimmed)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
  }
  return getNoteCategories()
}

/** 사용자가 직접 추가한 분류만 삭제 가능(기본 제공 분류는 삭제 불가) */
export function removeCustomNoteCategory(name: string): string[] {
  const custom = loadCustomCategories().filter((c) => c !== name)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
  return getNoteCategories()
}

export function isDefaultNoteCategory(name: string): boolean {
  return DEFAULT_NOTE_CATEGORIES.includes(name)
}
