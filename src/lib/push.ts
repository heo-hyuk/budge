import { subscribePush, unsubscribePush } from './api'
import { VAPID_PUBLIC_KEY } from './pushConfig'

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// PushManager.subscribe가 요구하는 Uint8Array 형태로 base64url 공개키를 변환
// (new Uint8Array(length)로 직접 할당해야 TS 6의 ArrayBuffer 제네릭 체크를 통과함 —
// Uint8Array.from()은 ArrayBufferLike로 추론돼 subscribe()의 BufferSource와 안 맞음)
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64  = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  const bytes   = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function subscriptionToPayload(sub: PushSubscription) {
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('구독 정보를 읽지 못했습니다')
  }
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }
}

/** 현재 브라우저에 활성 구독이 있으면 반환 (권한 요청 없이 조회만) */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

/** 알림 권한 요청 → 구독 생성 → 서버 저장까지 한 번에 진행 */
export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('브라우저 설정에서 알림을 허용해주세요')
  }

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  await subscribePush(subscriptionToPayload(subscription))
}

/** 구독 해제 + 서버에서 삭제 */
export async function disablePush(): Promise<void> {
  const subscription = await getCurrentSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await unsubscribePush(endpoint)
}
