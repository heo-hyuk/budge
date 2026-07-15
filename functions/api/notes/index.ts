/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

interface NoteRow {
  id: string
  user_id: string
  date: string
  category: string
  content: string
  created_at: string
  updated_at: string
}

/** GET /api/notes?month=YYYY-MM — 해당 월 메모 전체 조회 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data, request } = context
  const userId = (data as Record<string, string>).userId
  const url    = new URL(request.url)
  const month  = url.searchParams.get('month')

  let query = 'SELECT * FROM notes WHERE user_id = ?'
  const binds: unknown[] = [userId]
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    query += ' AND date LIKE ?'
    binds.push(`${month}-%`)
  }
  query += ' ORDER BY date ASC'

  const result = await env.DB.prepare(query).bind(...binds).all<NoteRow>()
  return Response.json({ data: result.results })
}

interface NoteBody {
  date: string
  category: string
  content: string
}

/** POST /api/notes — 날짜별 upsert (이미 있으면 내용 갱신) */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, data, request } = context
  const userId = (data as Record<string, string>).userId
  const body   = await request.json() as NoteBody

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return Response.json({ error: '날짜가 올바르지 않습니다' }, { status: 400 })
  }
  if (!body.content || !body.content.trim()) {
    return Response.json({ error: '내용을 입력해주세요' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const existing = await env.DB.prepare(
    'SELECT id FROM notes WHERE user_id = ? AND date = ?'
  ).bind(userId, body.date).first<{ id: string }>()

  if (existing) {
    await env.DB.prepare(
      'UPDATE notes SET category = ?, content = ?, updated_at = ? WHERE id = ?'
    ).bind(body.category || '일상', body.content.trim(), now, existing.id).run()
    return Response.json({ id: existing.id })
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(`
    INSERT INTO notes (id, user_id, date, category, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, userId, body.date, body.category || '일상', body.content.trim(), now, now).run()

  return Response.json({ id }, { status: 201 })
}
