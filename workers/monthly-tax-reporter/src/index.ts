import { buildPushPayload, type PushMessage, type PushSubscription as WebPushSubscription, type VapidKeys } from '@block65/webcrypto-web-push'
import { calculateTaxEstimate, TaxEstimateError, type TaxEstimateResult } from './tax'

interface Env {
  DB: D1Database
  VAPID_PUBLIC_KEY: string
  VAPID_SUBJECT: string
  VAPID_PRIVATE_KEY: string
}

interface SubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

/** UTC epoch ms를 한국시간(KST, UTC+9) 기준 'YYYY-MM-DD'로 변환 — card-settlement-notifier/src/billing.ts와 동일 로직(복사) */
function toKstDateStr(utcMs: number): string {
  const kst = new Date(utcMs + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/** 'YYYY-MM'의 전달을 'YYYY-MM'으로 */
function prevMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function alreadyNotified(env: Env, userId: string, yearMonth: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT 1 FROM notification_log WHERE user_id = ? AND type = 'monthly_tax_report' AND reference_id = 'monthly' AND year_month = ?"
  ).bind(userId, yearMonth).first()
  return !!row
}

// reference_id는 card_settlement의 card_id처럼 항목별로 구분할 대상이 없어(유저당 월 1건
// 고정) 'monthly' 고정값을 씀 — UNIQUE(user_id, type, reference_id, year_month) 제약은
// user_id+year_month만으로도 이미 유저당 월 1건을 보장하지만 스키마 형태를 그대로 따름
async function logNotified(env: Env, userId: string, yearMonth: string, sentAt: string) {
  await env.DB.prepare(`
    INSERT INTO notification_log (id, user_id, type, reference_id, year_month, sent_at)
    VALUES (?, ?, 'monthly_tax_report', 'monthly', ?, ?)
  `).bind(crypto.randomUUID(), userId, yearMonth, sentAt).run()
}

// vat_calculable=false(간이과세자 부가율 미입력/프리랜서 3.3%)일 땐 부가세를 뺀
// "세금 예비비"가 실제보다 적게 잡혀 오히려 과소저축을 유도할 수 있어, 그 경우엔
// 예비비 추천 자체를 생략하고 순수익만 안내한다(요청 사항: "부가세 관련 문구 생략하고
// 순수익만 안내"). 어느 경우든 "추천해요"/"추정치" 톤을 유지하고 단정적 표현은 쓰지 않는다
function buildMessage(monthNum: number, estimate: TaxEstimateResult): { title: string; body: string } {
  const title = `[텅장] ${monthNum}월 자금 마감 리포트`
  const body = estimate.vat_calculable
    ? `이번 달 예상 순수익은 ${won(estimate.real_net_income)}이에요. 세금 예비비 ${won(estimate.tax_reserve_fund)} 정도는 따로 두시는 걸 추천해요 (추정치, 실제와 다를 수 있어요)`
    : `이번 달 예상 순수익은 ${won(estimate.real_net_income)}이에요. 부가세는 마이페이지에서 정보를 입력하면 함께 안내해드려요`
  return { title, body }
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

async function processUser(env: Env, userId: string, yearMonth: string, monthNum: number, sentAt: string): Promise<void> {
  let estimate: TaxEstimateResult
  try {
    estimate = await calculateTaxEstimate(env.DB, userId, yearMonth)
  } catch (err) {
    // 세금 설정 미저장이거나 해당 연도 세율 데이터가 없음 — 임의 추정치를 만들 수
    // 없으니 이번 달은 조용히 건너뜀(다음 달 마감 때 재시도됨, 별도 알림/로그 없음)
    if (err instanceof TaxEstimateError) return
    throw err
  }

  const { title, body } = buildMessage(monthNum, estimate)
  // SPA가 경로 라우팅이 아니라 ?tab= 쿼리로 화면을 고르는 구조라(card-settlement-notifier의
  // '/?tab=overview&view=monthly'와 동일 패턴) "세금 계산기" 탭 id로 이동시킴
  const targetUrl = '/?tab=taxCalculator'

  const subsResult = await env.DB.prepare(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
  ).bind(userId).all<SubscriptionRow>()
  const subs = subsResult.results ?? []
  if (subs.length === 0) return  // 방어적 — 호출부 조회 이후 그 사이 구독 해지됐을 수 있음

  for (const sub of subs) {
    const { expired } = await sendPush(env, sub, { data: JSON.stringify({ title, body, url: targetUrl }), options: { ttl: 60 * 60 * 24 } })
    if (expired) {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run()
    }
  }

  await logNotified(env, userId, yearMonth, sentAt)
}

async function handleScheduled(env: Env, scheduledTime: number): Promise<void> {
  const nowKst = toKstDateStr(scheduledTime)
  const day = Number(nowKst.slice(8, 10))
  // "매월 말일 자정"은 "다음 달 1일 00:00"과 정확히 같은 시각이다. Cloudflare Cron은
  // "매월 말일"을 직접 표현할 수 없어(표준 5필드, "L" 미지원) card-settlement-notifier와
  // 동일하게 매일 도는 크론 + 날짜 체크 방식을 쓴다 — KST 기준 오늘이 1일일 때만
  // "방금 끝난 달(전월)"을 마감 리포트로 처리
  if (day !== 1) return

  const currentMonth = nowKst.slice(0, 7)
  const yearMonth = prevMonth(currentMonth)
  const monthNum  = Number(yearMonth.slice(5, 7))

  const usersResult = await env.DB.prepare('SELECT DISTINCT user_id FROM push_subscriptions').all<{ user_id: string }>()
  const userIds = (usersResult.results ?? []).map((r) => r.user_id)
  if (userIds.length === 0) return

  const sentAt = new Date().toISOString()
  for (const userId of userIds) {
    if (await alreadyNotified(env, userId, yearMonth)) continue
    await processUser(env, userId, yearMonth, monthNum, sentAt)
  }
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(env, controller.scheduledTime))
  },
} satisfies ExportedHandler<Env>
