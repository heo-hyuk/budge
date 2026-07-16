/// <reference types="@cloudflare/workers-types" />
import { generateDueRecurringTransactions } from '../../lib/recurring'

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

export const onRequestGet: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId

  // 고정지출 자동 생성 — 매 조회 시 실행 (중복 방지 로직 내장)
  await generateDueRecurringTransactions(env.DB, userId)

  const url    = new URL(request.url)
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '500', 10), 1000)
  const month      = url.searchParams.get('month')
  const year       = url.searchParams.get('year')
  const q          = url.searchParams.get('q')
  const cardId     = url.searchParams.get('card_id')
  const dateStart  = url.searchParams.get('date_start')
  const dateEnd    = url.searchParams.get('date_end')
  const minAmount  = url.searchParams.get('min_amount')
  const maxAmount  = url.searchParams.get('max_amount')

  let query = 'SELECT * FROM transactions WHERE user_id = ?'
  const binds: unknown[] = [userId]

  if (month && /^\d{4}-\d{2}$/.test(month)) { query += ' AND date LIKE ?'; binds.push(`${month}-%`) }
  else if (year && /^\d{4}$/.test(year))      { query += ' AND date LIKE ?'; binds.push(`${year}-%`) }

  if (q)         { query += ' AND (category LIKE ? OR merchant LIKE ? OR memo LIKE ?)'; const l = `%${q}%`; binds.push(l, l, l) }
  // card_id='cash'는 결제수단이 현금(카드 미연결)인 거래만 필터하는 센티널 —
  // 앱 전역에서 결제수단을 card_id로 표현하는 기존 방식(빈 값=현금)을 그대로 재사용
  if (cardId === 'cash') { query += " AND (card_id = '' OR card_id IS NULL)" }
  else if (cardId)       { query += ' AND card_id = ?'; binds.push(cardId) }
  if (dateStart)  { query += ' AND date >= ?';   binds.push(dateStart) }
  if (dateEnd)    { query += ' AND date <= ?';   binds.push(dateEnd) }
  if (minAmount)  { query += ' AND amount >= ?'; binds.push(parseInt(minAmount, 10)) }
  if (maxAmount)  { query += ' AND amount <= ?'; binds.push(parseInt(maxAmount, 10)) }

  query += ' ORDER BY date DESC, created_at DESC LIMIT ?'
  binds.push(limit)

  const result = await env.DB.prepare(query).bind(...binds).all()
  return json({ data: result.results })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body   = await request.json() as {
    type: 'income' | 'expense'; category: string; amount: number
    memo?: string; date: string; merchant?: string; payment_method?: string; card_id?: string
    original_amount?: number; discount_amount?: number; benefit_id?: string
  }

  if (!body.type || !body.category || !body.amount || !body.date) {
    return json({ error: 'Missing required fields' }, 400)
  }
  if (typeof body.amount !== 'number' || body.amount <= 0) {
    return json({ error: '금액은 0보다 커야 합니다' }, 400)
  }

  const id         = crypto.randomUUID()
  const created_at = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, category, amount, memo, date, merchant, payment_method, card_id,
        original_amount, discount_amount, benefit_id, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.type, body.category, body.amount,
    body.memo ?? '', body.date,
    body.merchant ?? '', body.payment_method ?? '현금', body.card_id ?? '',
    body.original_amount ?? 0, body.discount_amount ?? 0, body.benefit_id ?? '',
    userId, created_at
  ).run()

  return json({ ok: true, id }, 201)
}
