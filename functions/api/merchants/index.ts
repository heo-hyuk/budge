/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }
interface MerchantRow { name: string }

const cors = {
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

// 계정에 저장된 구매처 관리 목록 조회 — 분류와 달리 기본값이 없어 이름 배열만 반환.
// sort_order 순서(관리 모드에서 사용자가 정한 순서)로 반환됨
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const { results } = await env.DB.prepare(
    'SELECT name FROM merchants WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).bind(userId).all<MerchantRow>()

  return json({ data: (results ?? []).map((r) => r.name) })
}

// 구매처 추가 — 항상 마지막 순서로 추가
export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { name?: string }
  const name = body.name?.trim()

  if (!name) return json({ error: '구매처 이름을 입력해주세요' }, 400)

  const maxRow = await env.DB.prepare(
    'SELECT MAX(sort_order) AS max_order FROM merchants WHERE user_id = ?'
  ).bind(userId).first<{ max_order: number | null }>()
  const sortOrder = (maxRow?.max_order ?? -1) + 1

  await env.DB.prepare(
    `INSERT INTO merchants (id, user_id, name, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, name) DO NOTHING`
  ).bind(crypto.randomUUID(), userId, name, sortOrder, new Date().toISOString()).run()

  return json({ ok: true }, 201)
}

// 구매처 순서 변경 — 관리 모드에서 위/아래로 이동한 뒤 전체 순서(이름 배열)를 통째로 저장
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { order?: string[] }

  if (!Array.isArray(body.order)) return json({ error: 'Invalid order' }, 400)

  for (let i = 0; i < body.order.length; i++) {
    await env.DB.prepare(
      'UPDATE merchants SET sort_order = ? WHERE user_id = ? AND name = ?'
    ).bind(i, userId, body.order[i]).run()
  }

  return json({ ok: true })
}

// 구매처 삭제 — 이미 저장된 거래의 구매처 텍스트는 그대로 유지(분류 삭제와 동일한 원칙)
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const url = new URL(request.url)
  const name = url.searchParams.get('name')

  if (!name) return json({ error: '구매처 이름이 필요합니다' }, 400)

  await env.DB.prepare(
    'DELETE FROM merchants WHERE user_id = ? AND name = ?'
  ).bind(userId, name).run()

  return json({ ok: true })
}
