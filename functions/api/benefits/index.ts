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
  benefit_group_id?: string
  benefit_type?: 'discount' | 'cashback'
  active?: number
}

/** POST /api/benefits — 새 혜택 규칙 등록 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, data, request } = context
  const userId = (data as Record<string, string>).userId
  const body   = await request.json() as BenefitBody

  if (!body.card_id || !body.name?.trim() || !body.discount_type) {
    return Response.json({ error: '카드, 이름, 할인 유형은 필수입니다' }, { status: 400 })
  }
  if (typeof body.discount_value !== 'number' || body.discount_value <= 0) {
    return Response.json({ error: '할인율/금액은 0보다 커야 합니다' }, { status: 400 })
  }
  if (body.benefit_type && !['discount', 'cashback'].includes(body.benefit_type)) {
    return Response.json({ error: '혜택 유형이 올바르지 않습니다' }, { status: 400 })
  }
  // 해당 카드가 본인 소유인지 확인 (다른 유저의 card_id로 혜택 등록 방지)
  const card = await env.DB.prepare(
    'SELECT id FROM cards WHERE id = ? AND user_id = ?'
  ).bind(body.card_id, userId).first()
  if (!card) return Response.json({ error: '존재하지 않는 카드입니다' }, { status: 404 })

  // 그룹 지정 시 같은 카드 소속인지 확인
  if (body.benefit_group_id) {
    const group = await env.DB.prepare(
      'SELECT id FROM benefit_groups WHERE id = ? AND card_id = ?'
    ).bind(body.benefit_group_id, body.card_id).first()
    if (!group) return Response.json({ error: '존재하지 않거나 다른 카드의 혜택 그룹입니다' }, { status: 400 })
  }

  const id  = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO card_benefits
      (id, user_id, card_id, name, category, merchant_pattern, discount_type, discount_value, monthly_cap, min_spend, memo, benefit_group_id, benefit_type, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, userId, body.card_id, body.name ?? '',
    body.category ?? '', body.merchant_pattern ?? '',
    body.discount_type, body.discount_value,
    body.monthly_cap ?? 0, body.min_spend ?? 0,
    body.memo ?? '', body.benefit_group_id ?? null,
    body.benefit_type ?? 'discount', body.active ?? 1, now,
  ).run()

  return Response.json({ id }, { status: 201 })
}
