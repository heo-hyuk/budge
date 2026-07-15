/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

/** PATCH /api/notes/:id — 메모 수정 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, data, params, request } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  const body = await request.json() as { category?: string; content?: string }
  if (body.content !== undefined && !body.content.trim()) {
    return Response.json({ error: '내용을 입력해주세요' }, { status: 400 })
  }

  const sets: string[]    = []
  const values: unknown[] = []
  if (body.category !== undefined) { sets.push('category = ?'); values.push(body.category) }
  if (body.content  !== undefined) { sets.push('content = ?');  values.push(body.content.trim()) }
  if (sets.length === 0) return Response.json({ ok: true })

  sets.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id, userId)

  await env.DB.prepare(
    `UPDATE notes SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run()

  return Response.json({ ok: true })
}

/** DELETE /api/notes/:id — 메모 삭제 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, data, params } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  await env.DB.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()

  return Response.json({ ok: true })
}
