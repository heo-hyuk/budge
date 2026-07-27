import { Fragment, type ReactNode } from 'react'

// 배송 탭 체크/카드 정산기 확인 시 메모에 자동으로 붙는 완료 문구들.
// 사용자가 메모에 직접 같은 단어를 적어도 동일하게 강조된다.
const HIGHLIGHT_WORDS = ['배송완료', '입금완료']
const HIGHLIGHT_PATTERN = new RegExp(`(${HIGHLIGHT_WORDS.join('|')})`, 'g')

export function renderMemoWithHighlights(memo: string): ReactNode {
  return memo.split(HIGHLIGHT_PATTERN).map((part, i) =>
    HIGHLIGHT_WORDS.includes(part)
      ? <span key={i} className="font-semibold text-green-600 dark:text-green-400">{part}</span>
      : <Fragment key={i}>{part}</Fragment>
  )
}
