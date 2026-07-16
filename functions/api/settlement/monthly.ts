/// <reference types="@cloudflare/workers-types" />
import { calculateMonthlySettlement } from '../../lib/settlement'

interface Env { DB: D1Database }

/** GET /api/settlement/monthly?month=YYYY-MM */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context
  const userId = (data as Record<string, string>).userId
  const url    = new URL(context.request.url)
  const month  = url.searchParams.get('month') ?? ''

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: '월 형식이 올바르지 않습니다' }, { status: 400 })
  }

  const result = await calculateMonthlySettlement(env.DB, userId, month)
  return Response.json(result)
}
