/// <reference types="@cloudflare/workers-types" />
import { calculateTaxEstimate, TaxEstimateError } from '../../lib/tax'

interface Env { DB: D1Database }

/**
 * GET /api/tax/estimate?month=YYYY-MM
 * 1인 사업자 부가세/종합소득세 추정 — 세무 신고를 대체하지 않는 참고용 계산(is_estimate: true 고정)
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context
  const userId = (data as Record<string, string>).userId
  const url    = new URL(context.request.url)
  const month  = url.searchParams.get('month') ?? ''

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: '월 형식이 올바르지 않습니다 (YYYY-MM)' }, { status: 400 })
  }

  try {
    const result = await calculateTaxEstimate(env.DB, userId, month)
    return Response.json(result)
  } catch (err) {
    if (err instanceof TaxEstimateError) {
      return Response.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}
