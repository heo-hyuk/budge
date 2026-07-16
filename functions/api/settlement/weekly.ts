/// <reference types="@cloudflare/workers-types" />
import { calculateWeeklySettlement } from '../../lib/settlement'

interface Env { DB: D1Database }

/** GET /api/settlement/weekly?week_start=YYYY-MM-DD (월요일 기준) */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context
  const userId    = (data as Record<string, string>).userId
  const url       = new URL(context.request.url)
  const weekStart = url.searchParams.get('week_start') ?? ''

  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return Response.json({ error: '날짜 형식이 올바르지 않습니다' }, { status: 400 })
  }

  const result = await calculateWeeklySettlement(env.DB, userId, weekStart)
  return Response.json(result)
}
