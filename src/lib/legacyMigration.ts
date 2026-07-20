import { addCustomCategory, removeCategory } from './categories'
import { addCustomNoteCategory, removeNoteCategory } from './noteCategories'
import { setMonthlyBasis } from './settings'
import type { TransactionType } from '../types'

const MIGRATED_FLAG = 'budget:legacyMigratedToServer'

// 여러 컴포넌트(App.tsx, TransactionForm, NotesView, MonthlyReport)가 각자 마운트
// 시점에 이 함수를 부를 수 있는데, 실제 마이그레이션은 한 번만 실행돼야 하고 —
// 특히 어느 컴포넌트가 먼저 시작하든 그 뒤에 이어지는 loadCategories() 등의
// 조회가 마이그레이션 완료 *이후* 값을 받도록 이 Promise를 공유해야 함(안 그러면
// 마이그레이션 전에 캐시가 먼저 채워져버려 방금 올린 데이터가 누락될 수 있음)
let migratePromise: Promise<void> | null = null

export function migrateLegacyLocalStorage(): Promise<void> {
  if (!migratePromise) migratePromise = runMigration()
  return migratePromise
}

function loadLegacyList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/**
 * 58~59차 이전엔 거래 분류/메모 분류/카드 정산 집계 기준을 이 기기의 localStorage에만
 * 저장했음 — 그 흔적이 남아있으면 최초 1회 서버로 밀어올려 기존 고객이 이미 만들어둔
 * 분류를 잃지 않게 한다. 기기별로 한 번만 실행되도록 플래그로 방지하고, 여러 기기가
 * 각자 다른 데이터를 갖고 있어도 add/remove가 멱등이라 순서 상관없이 안전하게 합쳐짐.
 */
async function runMigration(): Promise<void> {
  if (localStorage.getItem(MIGRATED_FLAG)) return

  const tasks: Promise<unknown>[] = []

  for (const type of ['expense', 'income'] as TransactionType[]) {
    for (const name of loadLegacyList(`budget:categories:${type}`)) {
      tasks.push(addCustomCategory(type, name))
    }
    for (const name of loadLegacyList(`budget:categories:${type}:removedDefaults`)) {
      tasks.push(removeCategory(type, name))
    }
  }

  for (const name of loadLegacyList('budget:noteCategories')) {
    tasks.push(addCustomNoteCategory(name))
  }
  for (const name of loadLegacyList('budget:noteCategories:removedDefaults')) {
    tasks.push(removeNoteCategory(name))
  }

  const basis = localStorage.getItem('budget:monthlyBasis')
  if (basis === 'billing' || basis === 'transaction') {
    tasks.push(setMonthlyBasis(basis))
  }

  await Promise.allSettled(tasks)
  localStorage.setItem(MIGRATED_FLAG, '1')

  // 더 이상 쓰이지 않는 예전 키 정리
  for (const type of ['expense', 'income'] as TransactionType[]) {
    localStorage.removeItem(`budget:categories:${type}`)
    localStorage.removeItem(`budget:categories:${type}:removedDefaults`)
  }
  localStorage.removeItem('budget:noteCategories')
  localStorage.removeItem('budget:noteCategories:removedDefaults')
  localStorage.removeItem('budget:monthlyBasis')
}
