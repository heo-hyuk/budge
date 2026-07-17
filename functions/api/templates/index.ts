/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

// 프론트엔드는 항상 same-origin으로만 요청하므로 CORS 헤더 자체가 불필요함
const cors = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

// 빠른 입력 템플릿 목록 조회 (순서대로)
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const result = await env.DB.prepare(
    'SELECT * FROM quick_templates WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).bind(userId).all()
  return json({ data: result.results })
}

// 빠른 입력 템플릿 등록 — amount 미지정(null) 시 라벨/분류/구매처/결제수단만 저장하고
// 적용할 때마다 금액을 새로 입력하게 함
export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body   = await request.json() as {
    label: string
    type: 'income' | 'expense'
    category: string
    amount?: number | null
    merchant?: string
    payment_method?: string
    card_id?: string
    memo?: string
  }

  if (!body.label?.trim() || !body.type || !body.category) {
    return json({ error: 'Missing required fields' }, 400)
  }
  if (body.amount !== undefined && body.amount !== null) {
    if (typeof body.amount !== 'number' || body.amount === 0) {
      return json({ error: '금액을 입력해주세요' }, 400)
    }
    // 지출은 항상 양수, 수입은 차감(음수) 항목을 허용
    if (body.type === 'expense' && body.amount < 0) {
      return json({ error: '지출 금액은 0보다 커야 합니다' }, 400)
    }
  }

  // 새 템플릿은 항상 마지막 순서로 추가
  const maxRow = await env.DB.prepare(
    'SELECT MAX(sort_order) AS max_order FROM quick_templates WHERE user_id = ?'
  ).bind(userId).first<{ max_order: number | null }>()
  const sortOrder = (maxRow?.max_order ?? -1) + 1

  const id         = crypto.randomUUID()
  const created_at = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO quick_templates
       (id, user_id, label, type, category, amount, merchant, payment_method, card_id, sort_order, created_at, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, body.label.trim(), body.type, body.category, body.amount ?? null,
    body.merchant ?? '', body.payment_method ?? '현금', body.card_id ?? '',
    sortOrder, created_at, body.memo ?? ''
  ).run()

  return json({ ok: true, id }, 201)
}
