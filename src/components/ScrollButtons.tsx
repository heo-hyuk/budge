import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useState } from 'react'

const TOP_THRESHOLD = 300     // 이만큼 내려가야 "맨 위로" 버튼이 뜸
const BOTTOM_MARGIN = 300     // 맨 아래에서 이 정도 안쪽이면 "맨 아래로" 버튼을 숨김

/** 내용이 길어진 화면에서 맨 위/맨 아래로 빠르게 이동하는 플로팅 버튼 — 탭 전환과 무관하게 항상 표시 */
function ScrollButtons() {
  const [scrollY, setScrollY] = useState(0)
  const [nearBottom, setNearBottom] = useState(true)

  useEffect(() => {
    function update() {
      setScrollY(window.scrollY)
      setNearBottom(window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - BOTTOM_MARGIN)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const showTop = scrollY > TOP_THRESHOLD
  const showBottom = !nearBottom

  if (!showTop && !showBottom) return null

  return (
    <div className="fixed bottom-6 right-4 z-20 flex flex-col gap-2">
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="맨 위로"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 shadow-lg transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          <ChevronUp size={20} strokeWidth={2} />
        </button>
      )}
      {showBottom && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
          aria-label="맨 아래로"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 shadow-lg transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          <ChevronDown size={20} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

export default ScrollButtons
