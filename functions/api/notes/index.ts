/// <reference types="@cloudflare/workers-types" />
import { validateNoteImage } from '../../lib/noteImages'

interface Env { DB: D1Database; NOTE_IMAGES: R2Bucket }

interface NoteRow {
  id: string
  user_id: string
  date: string
  category: string
  content: string
  image_key: string | null
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
  query += ' ORDER BY date ASC, created_at ASC'

  const result = await env.DB.prepare(query).bind(...binds).all<NoteRow>()
  return Response.json({ data: result.results })
}

/** POST /api/notes — 새 메모 생성 (하루 여러 건 가능, 항상 새 행 추가, 이미지 첨부 1장 가능) */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, data, request } = context
  const userId = (data as Record<string, string>).userId
  const form   = await request.formData()

  const date     = form.get('date')
  const category = form.get('category')
  const content  = form.get('content')
  const image    = form.get('image')

  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: '날짜가 올바르지 않습니다' }, { status: 400 })
  }
  if (typeof content !== 'string' || !content.trim()) {
    return Response.json({ error: '내용을 입력해주세요' }, { status: 400 })
  }
  if (image instanceof File && image.size > 0) {
    const imageError = validateNoteImage(image)
    if (imageError) return Response.json({ error: imageError }, { status: 400 })
  }

  const now = new Date().toISOString()
  const id  = crypto.randomUUID()

  let imageKey: string | null = null
  if (image instanceof File && image.size > 0) {
    imageKey = `notes/${id}`
    await env.NOTE_IMAGES.put(imageKey, await image.arrayBuffer(), {
      httpMetadata: { contentType: image.type },
    })
  }

  await env.DB.prepare(`
    INSERT INTO notes (id, user_id, date, category, content, image_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, userId, date, (typeof category === 'string' && category) || '일상', content.trim(), imageKey, now, now).run()

  return Response.json({ id }, { status: 201 })
}
