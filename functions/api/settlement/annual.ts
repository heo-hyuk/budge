/// <reference types="@cloudflare/workers-types" />
import { calculateAnnualSettlement } from '../../lib/settlement'

interface Env { DB: D1Database }

/** GET /api/settlement/annual?year=YYYY */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context
  const userId = (data as Record<string, string>).userId
  const url    = new URL(context.request.url)
  const year   = url.searchParams.get('year') ?? ''

  if (!/^\d{4}$/.test(year)) {
    return Response.json({ error: '연도 형식이 올바르지 않습니다' }, { status: 400 })
  }

  const result = await calculateAnnualSettlement(env.DB, userId, year)
  return Response.json(result)
}
