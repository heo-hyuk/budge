/// <reference types="@cloudflare/workers-types" />
import { validateNoteImage } from '../../lib/noteImages'

interface Env { DB: D1Database; NOTE_IMAGES: R2Bucket }

/** PATCH /api/notes/:id — 메모 수정 (내용/카테고리, 이미지 첨부/교체/제거) */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, data, params, request } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  const form = await request.formData()
  const category    = form.get('category')
  const content     = form.get('content')
  const image       = form.get('image')
  const removeImage = form.get('removeImage')

  if (typeof content === 'string' && !content.trim()) {
    return Response.json({ error: '내용을 입력해주세요' }, { status: 400 })
  }
  if (image instanceof File && image.size > 0) {
    const imageError = validateNoteImage(image)
    if (imageError) return Response.json({ error: imageError }, { status: 400 })
  }

  const existing = await env.DB.prepare(
    'SELECT image_key FROM notes WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<{ image_key: string | null }>()
  if (!existing) return Response.json({ error: '메모를 찾을 수 없습니다' }, { status: 404 })

  const sets: string[]    = []
  const values: unknown[] = []
  if (typeof category === 'string') { sets.push('category = ?'); values.push(category) }
  if (typeof content  === 'string') { sets.push('content = ?');  values.push(content.trim()) }

  if (image instanceof File && image.size > 0) {
    const imageKey = `notes/${id}`
    await env.NOTE_IMAGES.put(imageKey, await image.arrayBuffer(), {
      httpMetadata: { contentType: image.type },
    })
    sets.push('image_key = ?')
    values.push(imageKey)
  } else if (removeImage === '1' && existing.image_key) {
    await env.NOTE_IMAGES.delete(existing.image_key)
    sets.push('image_key = ?')
    values.push(null)
  }

  if (sets.length === 0) return Response.json({ ok: true })

  sets.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id, userId)

  await env.DB.prepare(
    `UPDATE notes SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run()

  return Response.json({ ok: true })
}

/** DELETE /api/notes/:id — 메모 삭제 (첨부 이미지가 있으면 R2 오브젝트도 함께 삭제) */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, data, params } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  const existing = await env.DB.prepare(
    'SELECT image_key FROM notes WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<{ image_key: string | null }>()

  await env.DB.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()

  if (existing?.image_key) {
    await env.NOTE_IMAGES.delete(existing.image_key)
  }

  return Response.json({ ok: true })
}
