/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database; NOTE_IMAGES: R2Bucket }

/** GET /api/notes/image/:id — 메모에 첨부된 이미지 조회 (본인 메모만, R2에서 스트리밍) */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data, params } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  const note = await env.DB.prepare(
    'SELECT image_key FROM notes WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<{ image_key: string | null }>()

  if (!note?.image_key) {
    return Response.json({ error: '이미지를 찾을 수 없습니다' }, { status: 404 })
  }

  const object = await env.NOTE_IMAGES.get(note.image_key)
  if (!object) {
    return Response.json({ error: '이미지를 찾을 수 없습니다' }, { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'private, max-age=3600')
  headers.set('ETag', object.httpEtag)

  return new Response(object.body, { headers })
}
