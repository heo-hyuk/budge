/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

/**
 * GET /api/export?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * 기간 내 거래 내역 + 카드 정보를 JSON으로 반환 (프론트에서 xlsx 생성)
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context
  const userId    = (data as Record<string, string>).userId
  const url       = new URL(context.request.url)
  const startDate = url.searchParams.get('start_date')
  const endDate   = url.searchParams.get('end_date')

  // 거래 내역 조회 (카드명 LEFT JOIN)
  let sql = `
    SELECT
      t.id, t.type, t.category, t.amount,
      COALESCE(t.original_amount, 0) AS original_amount,
      COALESCE(t.discount_amount, 0) AS discount_amount,
      COALESCE(t.cashback_amount, 0) AS cashback_amount,
      t.memo, t.date, t.merchant,
      t.payment_method, t.card_id,
      COALESCE(c.name, '') AS card_name,
      COALESCE(c.billing_day, 0) AS card_billing_day,
      COALESCE(c.closing_day, 0)  AS card_closing_day,
      COALESCE(c.color, '')       AS card_color,
      t.created_at
    FROM transactions t
    LEFT JOIN cards c ON t.card_id = c.id AND c.user_id = t.user_id
    WHERE t.user_id = ? AND t.unsettled = 0
  `
  const binds: unknown[] = [userId]

  if (startDate) { sql += ' AND t.date >= ?'; binds.push(startDate) }
  if (endDate)   { sql += ' AND t.date <= ?'; binds.push(endDate) }
  sql += ' ORDER BY t.date ASC, t.created_at ASC'

  const { results: transactions } = await env.DB.prepare(sql).bind(...binds).all()

  // 카드 목록 (카드별정산 시트용)
  const { results: cards } = await env.DB
    .prepare('SELECT * FROM cards WHERE user_id = ? ORDER BY created_at ASC')
    .bind(userId)
    .all()

  return Response.json({
    transactions: transactions ?? [],
    cards: cards ?? [],
    exported_at: new Date().toISOString(),
    start_date: startDate,
    end_date: endDate,
  })
}
