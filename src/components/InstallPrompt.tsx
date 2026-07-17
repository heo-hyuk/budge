import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'budget:install-prompt-dismissed'

// 표준 lib.dom.d.ts에 아직 없는 이벤트라 최소한의 형태만 직접 선언
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

function isIOSDevice(): boolean {
  const ua = window.navigator.userAgent
  // 아이패드는 iPadOS부터 UA가 데스크탑 Mac Safari와 동일해 터치포인트로 추가 판별
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1')

  useEffect(() => {
    if (dismissed || isStandalone()) return

    if (isIOSDevice()) {
      setShowIOSHint(true)
      return
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    function onAppInstalled() {
      setDeferredPrompt(null)
      dismiss()
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [dismissed])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
    setDeferredPrompt(null)
    setShowIOSHint(false)
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    dismiss()
  }

  if (dismissed || (!deferredPrompt && !showIOSHint)) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-sm">
      <div className="rounded-2xl border border-coral-200 dark:border-coral-900 bg-white dark:bg-neutral-900 p-4 shadow-lg">
        <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">홈 화면에 텅장 추가하기</p>
        {showIOSHint ? (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            공유 버튼을 누른 뒤 "홈 화면에 추가"를 선택하면 앱처럼 바로 열 수 있어요
          </p>
        ) : (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            홈 화면에 추가하면 브라우저 없이 앱처럼 바로 열 수 있어요
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {!showIOSHint && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="min-h-9 flex-1 rounded-xl bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600"
            >
              추가하기
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className={`min-h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 ${
              showIOSHint ? 'flex-1' : 'px-4'
            }`}
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  )
}

export default InstallPrompt
