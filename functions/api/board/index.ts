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

/** DB row(정수 플래그) → 클라이언트 친화 형태(boolean) */
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
    // 프론트에서 수정/삭제/답변 버튼 노출 판단에 사용
    is_mine: row.user_id === viewerId,
    can_edit: viewerIsAdmin || row.user_id === viewerId,
  }
}

/** GET /api/board?type=notice|qna — 목록 조회 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data, request } = context
  const userId = (data as Record<string, string>).userId
  const type   = new URL(request.url).searchParams.get('type')

  if (type !== 'notice' && type !== 'qna') {
    return Response.json({ error: 'type은 notice 또는 qna여야 합니다' }, { status: 400 })
  }

  const admin = await isAdmin(env, userId)

  let query: string
  const binds: unknown[] = []
  if (type === 'notice') {
    // 공지는 전원 공개. 고정글 먼저, 그다음 최신순
    query = 'SELECT * FROM board_posts WHERE type = ? ORDER BY is_pinned DESC, created_at DESC'
    binds.push('notice')
  } else {
    // 문의: 관리자는 전체, 일반 사용자는 공개글 + 본인 글만
    query = 'SELECT * FROM board_posts WHERE type = ?'
    binds.push('qna')
    if (!admin) {
      query += ' AND (is_private = 0 OR user_id = ?)'
      binds.push(userId)
    }
    query += ' ORDER BY created_at DESC'
  }

  const result = await env.DB.prepare(query).bind(...binds).all<BoardRow>()
  return Response.json({
    data: (result.results ?? []).map((r) => toClient(r, userId, admin)),
    is_admin: admin,
  })
}

/** POST /api/board — 새 글 작성 (공지는 관리자만, 문의는 로그인 사용자 누구나) */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, data, request } = context
  const userId = (data as Record<string, string>).userId

  const body       = await request.json() as { type?: string; title?: string; content?: string; is_private?: boolean }
  const type       = body.type
  const title      = body.title?.trim()
  const content    = body.content?.trim()
  const isPrivate  = body.is_private === true

  if (type !== 'notice' && type !== 'qna') {
    return Response.json({ error: 'type은 notice 또는 qna여야 합니다' }, { status: 400 })
  }
  if (!title)   return Response.json({ error: '제목을 입력해주세요' }, { status: 400 })
  if (!content) return Response.json({ error: '내용을 입력해주세요' }, { status: 400 })
  if (title.length > TITLE_MAX)     return Response.json({ error: `제목은 ${TITLE_MAX}자 이하여야 합니다` }, { status: 400 })
  if (content.length > CONTENT_MAX) return Response.json({ error: `내용은 ${CONTENT_MAX}자 이하여야 합니다` }, { status: 400 })

  const admin = await isAdmin(env, userId)
  if (type === 'notice' && !admin) {
    return Response.json({ error: '공지는 관리자만 작성할 수 있습니다' }, { status: 403 })
  }

  const author = await env.DB.prepare('SELECT nickname, name FROM users WHERE id = ?')
    .bind(userId)
    .first<{ nickname: string | null; name: string }>()
  const authorName = author?.nickname || author?.name || '알 수 없음'

  const id  = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO board_posts (id, type, user_id, author_name, title, content, is_private, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(
    id, type, userId, authorName, title, content,
    // 비공개는 문의에서만 의미 있음
    type === 'qna' && isPrivate ? 1 : 0,
    now, now,
  ).run()

  return Response.json({ id }, { status: 201 })
}
