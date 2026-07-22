/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }
interface SourceRow { category: string }

const cors = {
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

// 카드 정산기에서 추적할 카드매출(정산 대기) 수입 분류 목록 조회 — 배송 탭
// (delivery-excluded-categories)과 완전히 독립된 상태. 기본은 전체 미선택(옵트인)이라
// 여기 있는 분류만 카드 정산기 목록에 표시됨
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const { results } = await env.DB.prepare(
    'SELECT category FROM card_settlement_source_categories WHERE user_id = ?'
  ).bind(userId).all<SourceRow>()

  return json({ data: (results ?? []).map((r) => r.category) })
}

// 분류 하나를 카드매출 추적 대상으로 추가
export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { category?: string }
  const category = body.category

  if (!category) return json({ error: '분류가 필요합니다' }, 400)

  await env.DB.prepare(
    `INSERT INTO card_settlement_source_categories (id, user_id, category, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, category) DO NOTHING`
  ).bind(crypto.randomUUID(), userId, category, new Date().toISOString()).run()

  return json({ ok: true }, 201)
}

// 추적 대상에서 제거
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const url = new URL(request.url)
  const category = url.searchParams.get('category')

  if (!category) return json({ error: '분류가 필요합니다' }, 400)

  await env.DB.prepare(
    'DELETE FROM card_settlement_source_categories WHERE user_id = ? AND category = ?'
  ).bind(userId, category).run()

  return json({ ok: true })
}
