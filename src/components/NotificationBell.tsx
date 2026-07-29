import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchNotifications, markNotificationsRead } from '../lib/api'
import type { NotificationLogEntry } from '../types'

function formatSentAt(sentAt: string): string {
  const d = new Date(sentAt)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function NotificationBell() {
  const [open, setOpen]           = useState(false)
  const [items, setItems]         = useState<NotificationLogEntry[] | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  // 뱃지 표시를 위해 패널을 열기 전에도 안 읽은 개수는 미리 알아야 함
  useEffect(() => {
    fetchNotifications().then((res) => setUnreadCount(res.unread_count)).catch(() => {})
  }, [])

  async function handleToggle() {
    const next = !open
    setOpen(next)
    if (next) {
      try {
        const res = await fetchNotifications()
        setItems(res.data)
        // 패널을 여는 즉시 전체 읽음 처리 — 항목별 읽음 상태 구분 없이 "열람=읽음"
        if (res.unread_count > 0) await markNotificationsRead()
        setUnreadCount(0)
      } catch {
        setItems([])
      }
    }
  }

  function handleItemClick(url: string) {
    window.location.href = url
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="알림"
        className="relative min-h-8 min-w-8 flex items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <Bell size={17} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 min-w-3.5 h-3.5 rounded-full bg-coral-400 px-0.5 text-[9px] font-bold leading-3.5 text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg">
            <div className="border-b border-neutral-100 dark:border-neutral-800 px-3 py-2">
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">알림</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items === null ? (
                <p className="px-4 py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">불러오는 중...</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">아직 받은 알림이 없어요</p>
              ) : (
                <ul>
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleItemClick(n.url)}
                        className="block w-full border-b border-neutral-100 dark:border-neutral-800 px-3 py-2.5 text-left last:border-b-0 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{n.title}</p>
                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{n.body}</p>
                        <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">{formatSentAt(n.sent_at)}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationBell
