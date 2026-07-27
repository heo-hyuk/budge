import { Fragment, type ReactNode } from 'react'
import { todayStr } from './format'

// 배송 탭 체크/카드 정산기 확인 시 메모에 자동으로 붙는 완료 문구들(완료 날짜 포함,
// 예: "배송완료(2026-07-27)"). 사용자가 메모에 직접 같은 단어를 적어도(날짜 없이)
// 동일하게 강조된다 — 예전(날짜 도입 전)에 이미 저장된 문구와도 호환됨
const HIGHLIGHT_WORDS = ['배송완료', '입금완료']
const HIGHLIGHT_PATTERN = new RegExp(`((?:${HIGHLIGHT_WORDS.join('|')})(?:\\(\\d{4}-\\d{2}-\\d{2}\\))?)`, 'g')

export function renderMemoWithHighlights(memo: string): ReactNode {
  return memo.split(HIGHLIGHT_PATTERN).map((part, i) =>
    HIGHLIGHT_WORDS.some((w) => part === w || part.startsWith(`${w}(`))
      ? <span key={i} className="font-semibold text-green-600 dark:text-green-400">{part}</span>
      : <Fragment key={i}>{part}</Fragment>
  )
}

/** 완료 문구를 메모 끝에 이어붙임(예: "배송완료(2026-07-27)") — 이미 붙어있으면 지우고 오늘 날짜로 새로 붙임 */
export function appendDoneTag(memo: string, label: string): string {
  const stripped = stripDoneTag(memo, label)
  const tag = `${label}(${todayStr()})`
  return stripped ? `${stripped} ${tag}` : tag
}

/** 메모 끝에 붙은 완료 문구만 제거 — 날짜 없이 저장된 예전 형식도 함께 처리 */
export function stripDoneTag(memo: string, label: string): string {
  const pattern = new RegExp(`\\s*${label}(?:\\(\\d{4}-\\d{2}-\\d{2}\\))?\\s*$`)
  return memo.replace(pattern, '').trim()
}

/** 메모에 완료 문구가 이미 붙어있는지(날짜 유무 무관) */
export function hasDoneTag(memo: string, label: string): boolean {
  return stripDoneTag(memo, label) !== memo.trim()
}
