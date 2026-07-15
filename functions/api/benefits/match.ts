/// <reference types="@cloudflare/workers-types" />
import { findMatchingBenefits } from '../../lib/benefitMatcher'

interface Env { DB: D1Database }

/**
 * GET /api/benefits/match
 * 정적 라우트 — [id].ts보다 우선 처리됨
 * query: card_id, merchant, category, amount, month(YYYY-MM)
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context
  const userId = (data as Record<string, string>).userId
  const url    = new URL(context.request.url)

  const cardId   = url.searchParams.get('card_id') ?? ''
  const merchant = url.searchParams.get('merchant') ?? ''
  const category = url.searchParams.get('category') ?? ''
  const amount   = parseInt(url.searchParams.get('amount') ?? '0', 10)
  const month    = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  if (!cardId || cardId === '현금') {
    return Response.json({ data: [] })
  }

  const matches = await findMatchingBenefits(env.DB, userId, cardId, merchant, category, amount, month)
  return Response.json({ data: matches })
}
