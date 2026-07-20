/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }
interface CalcSelectionRow {
  type: 'expense' | 'income'
  category: string
  sign: number
}

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

// 개인화 수익 계산기에 선택된 분류 칩 전체 조회 — 기본값/순서 개념이 없어
// categories와 달리 병합 없이 저장된 행을 그대로 반환
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const { results } = await env.DB.prepare(
    'SELECT type, category, sign FROM calc_selections WHERE user_id = ?'
  ).bind(userId).all<CalcSelectionRow>()

  return json({ selections: results ?? [] })
}

// 칩 선택/부호 변경 — 이미 선택돼 있으면 부호만 갱신(+ -> - 전환 등)
export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { type?: string; category?: string; sign?: number }
  const { type, category, sign } = body

  if (type !== 'expense' && type !== 'income') return json({ error: 'Invalid type' }, 400)
  if (!category) return json({ error: '분류가 필요합니다' }, 400)
  if (sign !== 1 && sign !== -1) return json({ error: 'Invalid sign' }, 400)

  await env.DB.prepare(
    `INSERT INTO calc_selections (id, user_id, type, category, sign, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, type, category) DO UPDATE SET sign = excluded.sign`
  ).bind(crypto.randomUUID(), userId, type, category, sign, new Date().toISOString()).run()

  return json({ ok: true }, 201)
}

// 칩 선택 해제
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const category = url.searchParams.get('category')

  if (type !== 'expense' && type !== 'income') return json({ error: 'Invalid type' }, 400)
  if (!category) return json({ error: '분류가 필요합니다' }, 400)

  await env.DB.prepare(
    'DELETE FROM calc_selections WHERE user_id = ? AND type = ? AND category = ?'
  ).bind(userId, type, category).run()

  return json({ ok: true })
}
