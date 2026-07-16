/// <reference types="@cloudflare/workers-types" />
import { calculateDailySettlement } from '../../lib/settlement'

interface Env { DB: D1Database }

/** GET /api/settlement/daily?date=YYYY-MM-DD */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context
  const userId = (data as Record<string, string>).userId
  const url    = new URL(context.request.url)
  const date   = url.searchParams.get('date') ?? ''

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: '날짜 형식이 올바르지 않습니다' }, { status: 400 })
  }

  const result = await calculateDailySettlement(env.DB, userId, date)
  return Response.json(result)
}
