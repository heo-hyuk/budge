/// <reference types="@cloudflare/workers-types" />
import { parseCookie, validateNickname } from '../../lib/auth'

interface Env { DB: D1Database }

// 프론트엔드는 항상 same-origin으로만 요청하므로 CORS 헤더 자체가 불필요함
const cors = {
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

/** 세션 쿠키에서 로그인한 user_id를 조회, 없으면 null */
async function getUserId(request: Request, env: Env): Promise<string | null> {
  const cookie    = request.headers.get('Cookie') ?? ''
  const sessionId = parseCookie(cookie, 'session')
  if (!sessionId) return null

  const session = await env.DB.prepare(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?"
  ).bind(sessionId, new Date().toISOString()).first<{ user_id: string }>()

  return session?.user_id ?? null
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const userId = await getUserId(request, env)
  if (!userId) return json({ user: null }, 200)

  const user = await env.DB.prepare(
    'SELECT id, email, name, nickname, created_at FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string; email: string; name: string; nickname: string | null; created_at: string }>()

  return json({ user: user ?? null })
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: '로그인이 필요합니다' }, 401)

  const body     = await request.json() as { nickname?: string }
  const nickname = body.nickname?.trim()
  if (!nickname) return json({ error: '닉네임을 입력해주세요' }, 400)

  const nicknameError = validateNickname(nickname)
  if (nicknameError) return json({ error: nicknameError }, 400)

  await env.DB.prepare('UPDATE users SET nickname = ? WHERE id = ?').bind(nickname, userId).run()

  const user = await env.DB.prepare(
    'SELECT id, email, name, nickname, created_at FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string; email: string; name: string; nickname: string | null; created_at: string }>()

  return json({ ok: true, user })
}
