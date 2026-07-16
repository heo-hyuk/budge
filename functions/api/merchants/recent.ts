/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

// 프론트엔드는 항상 same-origin으로만 요청하므로 CORS 헤더 자체가 불필요함
const cors = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

interface MerchantRow {
  merchant: string
  category: string
}

/**
 * GET /api/merchants/recent — 최근 사용한 구매처를 사용 빈도순으로 반환
 * 최근 90일 내 거래를 우선 사용하되, 90일 내 거래가 너무 적으면(20건 미만)
 * 최근 50건으로 폴백해 자동완성이 텅 비지 않게 함. 구매처별로 가장 많이
 * 짝지어진 category도 함께 계산해 반환(자동완성 선택 시 분류 자동 채움용)
 */
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let rows = (
    await env.DB.prepare(
      `SELECT merchant, category FROM transactions
       WHERE user_id = ? AND merchant != '' AND date >= ?
       ORDER BY date DESC LIMIT 300`
    ).bind(userId, ninetyDaysAgo).all<MerchantRow>()
  ).results ?? []

  if (rows.length < 20) {
    rows = (
      await env.DB.prepare(
        `SELECT merchant, category FROM transactions
         WHERE user_id = ? AND merchant != ''
         ORDER BY date DESC, created_at DESC LIMIT 50`
      ).bind(userId).all<MerchantRow>()
    ).results ?? []
  }

  const stats = new Map<string, { count: number; categoryCounts: Map<string, number> }>()
  for (const row of rows) {
    let stat = stats.get(row.merchant)
    if (!stat) { stat = { count: 0, categoryCounts: new Map() }; stats.set(row.merchant, stat) }
    stat.count++
    stat.categoryCounts.set(row.category, (stat.categoryCounts.get(row.category) ?? 0) + 1)
  }

  const merchants = Array.from(stats.entries())
    .map(([merchant, stat]) => {
      let topCategory = ''
      let topCount = 0
      for (const [category, count] of stat.categoryCounts) {
        if (count > topCount) { topCount = count; topCategory = category }
      }
      return { merchant, category: topCategory, count: stat.count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  return json({ data: merchants })
}
