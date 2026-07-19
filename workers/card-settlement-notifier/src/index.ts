import { buildPushPayload, type PushMessage, type PushSubscription as WebPushSubscription, type VapidKeys } from '@block65/webcrypto-web-push'
import { daysInMonth, getCardBillingPeriod, shiftDateStr, toKstDateStr } from './billing'

interface Env {
  DB: D1Database
  VAPID_PUBLIC_KEY: string
  VAPID_SUBJECT: string
  VAPID_PRIVATE_KEY: string
}

interface CardRow {
  id: string
  user_id: string
  name: string
  billing_day: number
  closing_day: number
}

interface SubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface ClosedCardSettlement {
  card_id: string
  card_name: string
  year_month: string  // getCardBillingPeriod의 month(결제월) 기준
  start: string
  end: string
  billingDate: string
  total: number
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

/** 어제(KST) 마감된 카드인지 확인 — 말일 클램핑된 closing_day와 어제 날짜를 비교 */
function closedYesterday(card: CardRow, yesterday: string): boolean {
  const [yy, ym, yd] = yesterday.split('-').map(Number)
  const clampedClosing = Math.min(card.closing_day, daysInMonth(yy, ym))
  return clampedClosing === yd
}

/** 어제 마감된 카드의 청구기간(start~end)과 결제일을 계산 — closing_day/billing_day 대소로
 * 어느 결제월에 속하는지 판단 후 getCardBillingPeriod에 그 결제월을 넘겨 재사용 */
function computeSettlementPeriod(card: CardRow, yesterday: string) {
  const [yy, ym] = yesterday.split('-').map(Number)
  const paymentMonthOffset = card.billing_day < card.closing_day ? 1 : 0
  const paymentDate = new Date(yy, ym - 1 + paymentMonthOffset, 1)
  const paymentMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`
  const period = getCardBillingPeriod(paymentMonth, card)
  return { yearMonth: paymentMonth, ...period }
}

async function sumCardExpense(env: Env, cardId: string, start: string, end: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE card_id = ? AND type = 'expense' AND date >= ? AND date <= ?"
  ).bind(cardId, start, end).first<{ total: number }>()
  return row?.total ?? 0
}

async function alreadyNotified(env: Env, userId: string, cardId: string, yearMonth: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT 1 FROM notification_log WHERE user_id = ? AND type = 'card_settlement' AND reference_id = ? AND year_month = ?"
  ).bind(userId, cardId, yearMonth).first()
  return !!row
}

async function logNotified(env: Env, userId: string, cardId: string, yearMonth: string, sentAt: string) {
  await env.DB.prepare(`
    INSERT INTO notification_log (id, user_id, type, reference_id, year_month, sent_at)
    VALUES (?, ?, 'card_settlement', ?, ?, ?)
  `).bind(crypto.randomUUID(), userId, cardId, yearMonth, sentAt).run()
}

/** 카드 1개면 개별 문구, 여러 개면 묶어서 하나의 알림으로 (사용자 요청대로 묶는 방향 채택) */
function buildMessage(items: ClosedCardSettlement[]): { title: string; body: string } {
  if (items.length === 1) {
    const c = items[0]
    return {
      title: `${c.card_name} 정산 완료`,
      body: `이번 청구기간(${c.start}~${c.end}) 사용액 ${won(c.total)}, ${c.billingDate}에 결제됩니다`,
    }
  }
  return {
    title: `오늘 마감된 카드 ${items.length}개 정산 완료`,
    body: items.map((c) => `${c.card_name} ${won(c.total)}`).join(', '),
  }
}

async function sendPush(env: Env, sub: SubscriptionRow, message: PushMessage): Promise<{ expired: boolean }> {
  const vapid: VapidKeys = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  }
  const subscription: WebPushSubscription = {
    endpoint: sub.endpoint,
    expirationTime: null,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  }

  try {
    const payload = await buildPushPayload(message, subscription, vapid)
    const res = await fetch(subscription.endpoint, payload)
    // 410 Gone / 404 Not Found = 구독이 만료·삭제됨 → 정리 대상
    return { expired: res.status === 410 || res.status === 404 }
  } catch (err) {
    console.error('push send failed', sub.endpoint, err)
    return { expired: false }
  }
}

async function processUser(
  env: Env,
  userId: string,
  items: ClosedCardSettlement[],
  sentAt: string,
): Promise<void> {
  const { title, body } = buildMessage(items)
  const targetUrl = '/?tab=overview&view=monthly'

  const subsResult = await env.DB.prepare(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
  ).bind(userId).all<SubscriptionRow>()
  const subs = subsResult.results ?? []

  for (const sub of subs) {
    const { expired } = await sendPush(env, sub, { data: JSON.stringify({ title, body, url: targetUrl }), options: { ttl: 60 * 60 * 24 } })
    if (expired) {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run()
    }
  }

  // 구독이 하나도 없어도, "어제 마감"이라는 사실 자체는 다시 재평가할 필요 없는 과거
  // 이벤트이므로 카드별로 기록해 나중에 구독해도 지난 마감이 소급 발송되지 않게 함
  for (const c of items) {
    await logNotified(env, userId, c.card_id, c.year_month, sentAt)
  }
}

async function handleScheduled(env: Env, scheduledTime: number): Promise<void> {
  const nowKst    = toKstDateStr(scheduledTime)
  const yesterday = shiftDateStr(nowKst, -1)

  const cardsResult = await env.DB.prepare('SELECT id, user_id, name, billing_day, closing_day FROM cards').all<CardRow>()
  const cards = cardsResult.results ?? []

  const closedCards = cards.filter((c) => closedYesterday(c, yesterday))
  if (closedCards.length === 0) return

  const byUser = new Map<string, ClosedCardSettlement[]>()

  for (const card of closedCards) {
    const period = computeSettlementPeriod(card, yesterday)
    if (period.end !== yesterday) continue // 방어적 sanity check — 계산 불일치 시 건너뜀

    if (await alreadyNotified(env, card.user_id, card.id, period.yearMonth)) continue

    const total = await sumCardExpense(env, card.id, period.start, period.end)
    const list = byUser.get(card.user_id) ?? []
    list.push({
      card_id: card.id,
      card_name: card.name,
      year_month: period.yearMonth,
      start: period.start,
      end: period.end,
      billingDate: period.billingDate,
      total,
    })
    byUser.set(card.user_id, list)
  }

  const sentAt = new Date().toISOString()
  for (const [userId, items] of byUser) {
    await processUser(env, userId, items, sentAt)
  }
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(env, controller.scheduledTime))
  },
} satisfies ExportedHandler<Env>
