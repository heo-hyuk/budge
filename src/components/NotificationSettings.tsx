import { useEffect, useState } from 'react'
import Card from './ui/Card'
import { useToast } from '../contexts/ToastContext'
import { disablePush, enablePush, getCurrentSubscription, isPushSupported } from '../lib/push'

function NotificationSettings() {
  const { showToast } = useToast()
  const [supported, setSupported]   = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false)
      setLoading(false)
      return
    }
    getCurrentSubscription()
      .then((sub) => setSubscribed(!!sub))
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle() {
    setSaving(true)
    try {
      if (subscribed) {
        await disablePush()
        setSubscribed(false)
        showToast('카드 정산 알림을 껐습니다')
      } else {
        await enablePush()
        setSubscribed(true)
        showToast('카드 정산 알림을 켰습니다')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '알림 설정을 변경하지 못했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">카드 정산 알림 받기</p>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            카드 청구 마감일이 지나면 이번 청구기간 사용액을 알려드려요
          </p>
        </div>
        {supported && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading || saving}
            className={`min-h-8 shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
              subscribed
                ? 'bg-coral-50 dark:bg-coral-900/30 text-coral-800 dark:text-coral-200 hover:bg-coral-100 dark:hover:bg-coral-900/50'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {loading ? '확인 중...' : subscribed ? '켜짐' : '꺼짐'}
          </button>
        )}
      </div>
      {!supported && (
        <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
          이 브라우저는 알림을 지원하지 않아요. iOS는 홈 화면에 추가한 앱에서만 알림을
          받을 수 있어요
        </p>
      )}
      {supported && !loading && typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">
          브라우저 설정에서 알림을 허용해주세요
        </p>
      )}
    </Card>
  )
}

export default NotificationSettings
