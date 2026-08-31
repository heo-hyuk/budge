/// <reference types="@cloudflare/workers-types" />
import { isAdmin } from '../../lib/admin'

interface Env { DB: D1Database }

interface BoardRow {
  id: string
  type: 'notice' | 'qna'
  user_id: string
  author_name: string
  title: string
  content: string
  is_private: number
  is_pinned: number
  answer: string | null
  answered_at: string | null
  created_at: string
  updated_at: string
}

const TITLE_MAX = 200
const CONTENT_MAX = 10_000
const ANSWER_MAX = 10_000

function toClient(row: BoardRow, viewerId: string, viewerIsAdmin: boolean) {
  return {
    id: row.id,
    type: row.type,
    user_id: row.user_id,
    author_name: row.author_name,
    title: row.title,
    content: row.content,
    is_private: !!row.is_private,
    is_pinned: !!row.is_pinned,
    answer: row.answer,
    answered_at: row.answered_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_mine: row.user_id === viewerId,
    can_edit: viewerIsAdmin || row.user_id === viewerId,
  }
}

/** GET /api/board/:id — 단건 조회 (비공개 문의는 작성자/관리자만) */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data, params } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  const row = await env.DB.prepare('SELECT * FROM board_posts WHERE id = ?')
    .bind(id)
    .first<BoardRow>()
  if (!row) return Response.json({ error: '글을 찾을 수 없습니다' }, { status: 404 })

  const admin = await isAdmin(env, userId)
  if (row.type === 'qna' && row.is_private && row.user_id !== userId && !admin) {
    return Response.json({ error: '비공개 글입니다' }, { status: 403 })
  }

  return Response.json({ data: toClient(row, userId, admin) })
}

/**
 * PATCH /api/board/:id — 수정
 *  - 작성자: title / content / is_private (문의, 답변 달리기 전까지)
 *  - 관리자: 위 전부 + answer(문의 답변) + is_pinned(공지 고정)
 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, data, params, request } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  const row = await env.DB.prepare('SELECT * FROM board_posts WHERE id = ?')
    .bind(id)
    .first<BoardRow>()
  if (!row) return Response.json({ error: '글을 찾을 수 없습니다' }, { status: 404 })

  const admin   = await isAdmin(env, userId)
  const isOwner = row.user_id === userId
  if (!admin && !isOwner) {
    return Response.json({ error: '수정 권한이 없습니다' }, { status: 403 })
  }

  const body = await request.json() as {
    title?: string
    content?: string
    is_private?: boolean
    answer?: string | null
    is_pinned?: boolean
  }

  const sets: string[]    = []
  const values: unknown[] = []

  if (typeof body.title === 'string') {
    const title = body.title.trim()
    if (!title) return Response.json({ error: '제목을 입력해주세요' }, { status: 400 })
    if (title.length > TITLE_MAX) return Response.json({ error: `제목은 ${TITLE_MAX}자 이하여야 합니다` }, { status: 400 })
    sets.push('title = ?'); values.push(title)
  }

  if (typeof body.content === 'string') {
    const content = body.content.trim()
    if (!content) return Response.json({ error: '내용을 입력해주세요' }, { status: 400 })
    if (content.length > CONTENT_MAX) return Response.json({ error: `내용은 ${CONTENT_MAX}자 이하여야 합니다` }, { status: 400 })
    sets.push('content = ?'); values.push(content)
  }

  if (typeof body.is_private === 'boolean') {
    // 비공개 토글은 문의에서만 의미 있음
    if (row.type === 'qna') { sets.push('is_private = ?'); values.push(body.is_private ? 1 : 0) }
  }

  // ── 관리자 전용 필드 ──
  if (body.answer !== undefined) {
    if (!admin) return Response.json({ error: '답변은 관리자만 달 수 있습니다' }, { status: 403 })
    if (row.type !== 'qna') return Response.json({ error: '문의 글에만 답변할 수 있습니다' }, { status: 400 })
    const answer = typeof body.answer === 'string' ? body.answer.trim() : ''
    if (answer.length > ANSWER_MAX) return Response.json({ error: `답변은 ${ANSWER_MAX}자 이하여야 합니다` }, { status: 400 })
    if (answer) {
      sets.push('answer = ?', 'answered_at = ?')
      values.push(answer, new Date().toISOString())
    } else {
      // 빈 문자열/null → 답변 취소
      sets.push('answer = ?', 'answered_at = ?')
      values.push(null, null)
    }
  }

  if (typeof body.is_pinned === 'boolean') {
    if (!admin) return Response.json({ error: '고정은 관리자만 할 수 있습니다' }, { status: 403 })
    if (row.type !== 'notice') return Response.json({ error: '공지 글만 고정할 수 있습니다' }, { status: 400 })
    sets.push('is_pinned = ?'); values.push(body.is_pinned ? 1 : 0)
  }

  if (sets.length === 0) return Response.json({ ok: true })

  sets.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  await env.DB.prepare(`UPDATE board_posts SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  return Response.json({ ok: true })
}

/** DELETE /api/board/:id — 작성자 본인 또는 관리자만 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, data, params } = context
  const userId = (data as Record<string, string>).userId
  const id     = params.id as string

  const row = await env.DB.prepare('SELECT user_id FROM board_posts WHERE id = ?')
    .bind(id)
    .first<{ user_id: string }>()
  if (!row) return Response.json({ error: '글을 찾을 수 없습니다' }, { status: 404 })

  const admin = await isAdmin(env, userId)
  if (!admin && row.user_id !== userId) {
    return Response.json({ error: '삭제 권한이 없습니다' }, { status: 403 })
  }

  await env.DB.prepare('DELETE FROM board_posts WHERE id = ?').bind(id).run()
  return Response.json({ ok: true })
}
