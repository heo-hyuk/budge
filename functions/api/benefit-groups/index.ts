/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

/** GET /api/benefit-groups?card_id=xxx — 카드별 혜택 그룹 목록 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context
  const userId = (data as Record<string, string>).userId
  const url    = new URL(context.request.url)
  const cardId = url.searchParams.get('card_id') ?? ''

  let sql = `
    SELECT g.* FROM benefit_groups g
    JOIN cards c ON g.card_id = c.id
    WHERE c.user_id = ?
  `
  const bind: string[] = [userId]
  if (cardId) {
    sql += ' AND g.card_id = ?'
    bind.push(cardId)
  }
  sql += ' ORDER BY g.created_at ASC'

  const { results } = await env.DB.prepare(sql).bind(...bind).all()
  return Response.json({ data: results ?? [] })
}

interface BenefitGroupBody {
  card_id: string
  name: string
  monthly_cap: number
}

/** POST /api/benefit-groups — 새 혜택 그룹 등록 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, data, request } = context
  const userId = (data as Record<string, string>).userId
  const body   = await request.json() as BenefitGroupBody

  if (!body.card_id || !body.name?.trim()) {
    return Response.json({ error: '카드, 그룹 이름은 필수입니다' }, { status: 400 })
  }
  if (typeof body.monthly_cap !== 'number' || body.monthly_cap <= 0) {
    return Response.json({ error: '통합 월 한도는 0보다 커야 합니다' }, { status: 400 })
  }
  // 해당 카드가 본인 소유인지 확인
  const card = await env.DB.prepare(
    'SELECT id FROM cards WHERE id = ? AND user_id = ?'
  ).bind(body.card_id, userId).first()
  if (!card) return Response.json({ error: '존재하지 않는 카드입니다' }, { status: 404 })

  const id  = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO benefit_groups (id, card_id, name, monthly_cap, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, body.card_id, body.name.trim(), body.monthly_cap, now).run()

  return Response.json({ id }, { status: 201 })
}
