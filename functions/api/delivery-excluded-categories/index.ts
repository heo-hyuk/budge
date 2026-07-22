/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }
interface ExcludedRow { category: string }

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

// 배송 탭에서 제외한 지출 분류 목록 조회 — 지출계산기(calc_selections)와는
// 완전히 독립된 상태라 이 계정의 exclude 목록만 반환(기본은 전체 포함이므로
// 여기 없는 분류는 전부 표시 대상)
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const { results } = await env.DB.prepare(
    'SELECT category FROM delivery_excluded_categories WHERE user_id = ?'
  ).bind(userId).all<ExcludedRow>()

  return json({ data: (results ?? []).map((r) => r.category) })
}

// 분류 하나를 배송 탭 목록에서 제외
export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { category?: string }
  const category = body.category

  if (!category) return json({ error: '분류가 필요합니다' }, 400)

  await env.DB.prepare(
    `INSERT INTO delivery_excluded_categories (id, user_id, category, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, category) DO NOTHING`
  ).bind(crypto.randomUUID(), userId, category, new Date().toISOString()).run()

  return json({ ok: true }, 201)
}

// 제외를 해제(다시 표시 대상에 포함)
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const url = new URL(request.url)
  const category = url.searchParams.get('category')

  if (!category) return json({ error: '분류가 필요합니다' }, 400)

  await env.DB.prepare(
    'DELETE FROM delivery_excluded_categories WHERE user_id = ? AND category = ?'
  ).bind(userId, category).run()

  return json({ ok: true })
}
