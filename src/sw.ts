/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision: string | null; url: string }>
}

self.skipWaiting()

// 정적 자산(JS/CSS/HTML) 프리캐시 — 오프라인 시 마지막으로 로드된 화면 유지용
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//],
  }),
)

// functions/api/*는 거래·정산 데이터라 실시간성이 중요해 절대 캐시하지 않음
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly(), 'GET')

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ── 카드 정산 알림 (Push) ─────────────────────────────────────

interface CardSettlementPushData {
  title: string
  body: string
  url?: string
}

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload: CardSettlementPushData
  try {
    payload = event.data.json()
  } catch {
    return
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url ?? '/' },
    }),
  )
})

// 알림 클릭 시 앱을 열되, 이미 열린 탭이 있으면 그 탭을 목적지로 이동시키고 포커스
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) void (client as WindowClient).navigate(targetUrl)
          return (client as WindowClient).focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
