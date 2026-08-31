/// <reference types="@cloudflare/workers-types" />
import { hashPassword, needsRehash, sessionCookie, verifyPassword } from '../../lib/auth'

interface Env { DB: D1Database }

// 프론트엔드는 항상 same-origin으로만 요청하므로 CORS 헤더 자체가 불필요함
const cors = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200, extra?: HeadersInit) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', ...extra },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

/**
 * POST /api/auth/admin-login — 관리자 전용 로그인
 * 일반 로그인(/api/auth/login)과 분리. 이메일이 아니라 로그인 아이디(username)를 받고,
 * is_admin=1 계정만 통과시킨다. users.email 컬럼에 로그인 아이디가 저장돼 있다(migration 032).
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json() as { username?: string; password?: string; remember?: boolean }
  const username = body.username?.trim()
  const password = body.password?.trim()
  const remember = body.remember !== false

  if (!username || !password) return json({ error: '아이디와 비밀번호를 입력해주세요' }, 400)

  const user = await env.DB.prepare(
    'SELECT id, email, name, nickname, created_at, password_hash, salt, iterations, is_admin FROM users WHERE email = ? AND is_admin = 1'
  ).bind(username).first<{ id: string; email: string; name: string; nickname: string | null; created_at: string; password_hash: string; salt: string; iterations: number; is_admin: number }>()

  // 아이디 없음 / 관리자 아님 / 비번 불일치를 모두 같은 메시지로(계정 존재 여부 노출 방지)
  if (!user) return json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' }, 401)

  const valid = await verifyPassword(password, user.password_hash, user.salt, user.iterations)
  if (!valid) return json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' }, 401)

  if (needsRehash(user.iterations)) {
    const rehashed = await hashPassword(password)
    await env.DB.prepare(
      'UPDATE users SET password_hash = ?, salt = ?, iterations = ? WHERE id = ?'
    ).bind(rehashed.hash, rehashed.salt, rehashed.iterations, user.id).run()
  }

  const newSessionId = crypto.randomUUID()
  const now          = new Date().toISOString()
  const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).bind(newSessionId, user.id, expiresAt, now).run()

  return json(
    { ok: true, user: { id: user.id, email: user.email, name: user.name, nickname: user.nickname, created_at: user.created_at, is_admin: true } },
    200,
    { 'Set-Cookie': sessionCookie(newSessionId, remember) }
  )
}
