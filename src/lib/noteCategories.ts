const DEFAULT_NOTE_CATEGORIES = ['일상', '만남', '기념일', '건강', '기타']

const CUSTOM_KEY = 'budget:noteCategories'
const REMOVED_DEFAULTS_KEY = 'budget:noteCategories:removedDefaults'

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

export function getNoteCategories(): string[] {
  const removedDefaults = loadList(REMOVED_DEFAULTS_KEY)
  const custom = loadList(CUSTOM_KEY)
  const defaults = DEFAULT_NOTE_CATEGORIES.filter((c) => !removedDefaults.includes(c))
  return [...defaults, ...custom.filter((c) => !DEFAULT_NOTE_CATEGORIES.includes(c))]
}

export function addCustomNoteCategory(name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return getNoteCategories()

  // 예전에 삭제했던 기본 분류를 같은 이름으로 다시 추가하면 복원으로 처리
  if (DEFAULT_NOTE_CATEGORIES.includes(trimmed)) {
    const removedDefaults = loadList(REMOVED_DEFAULTS_KEY).filter((c) => c !== trimmed)
    localStorage.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify(removedDefaults))
    return getNoteCategories()
  }

  const custom = loadList(CUSTOM_KEY)
  if (!custom.includes(trimmed)) {
    custom.push(trimmed)
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom))
  }
  return getNoteCategories()
}

/** 분류 삭제 — 기본 제공 분류/사용자 정의 분류 구분 없이 전부 삭제 가능 */
export function removeNoteCategory(name: string): string[] {
  if (DEFAULT_NOTE_CATEGORIES.includes(name)) {
    const removedDefaults = loadList(REMOVED_DEFAULTS_KEY)
    if (!removedDefaults.includes(name)) {
      removedDefaults.push(name)
      localStorage.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify(removedDefaults))
    }
  } else {
    const custom = loadList(CUSTOM_KEY).filter((c) => c !== name)
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom))
  }
  return getNoteCategories()
}
