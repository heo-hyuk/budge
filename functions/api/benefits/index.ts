/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

/** GET /api/benefits?card_id=xxx — 카드별 혜택 규칙 목록 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context
  const userId = (data as Record<string, string>).userId
  const url    = new URL(context.request.url)
  const cardId = url.searchParams.get('card_id') ?? ''

  let sql    = 'SELECT * FROM card_benefits WHERE user_id = ?'
  const bind: string[] = [userId]
  if (cardId) {
    sql += ' AND card_id = ?'
    bind.push(cardId)
  }
  sql += ' ORDER BY created_at ASC'

  const { results } = await env.DB.prepare(sql).bind(...bind).all()
  return Response.json({ data: results ?? [] })
}

interface BenefitBody {
  card_id: string
  name: string
  category?: string
  merchant_pattern?: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  monthly_cap?: number
  min_spend?: number
  memo?: string
}

/** POST /api/benefits — 새 혜택 규칙 등록 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, data, request } = context
  const userId = (data as Record<string, string>).userId
  const body   = await request.json() as BenefitBody

  const id  = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO card_benefits
      (id, user_id, card_id, name, category, merchant_pattern, discount_type, discount_value, monthly_cap, min_spend, memo, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, userId, body.card_id, body.name ?? '',
    body.category ?? '', body.merchant_pattern ?? '',
    body.discount_type, body.discount_value,
    body.monthly_cap ?? 0, body.min_spend ?? 0,
    body.memo ?? '', now,
  ).run()

  return Response.json({ id }, { status: 201 })
}
