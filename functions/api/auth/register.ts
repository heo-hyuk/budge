/// <reference types="@cloudflare/workers-types" />
import { hashPassword, sessionCookie } from '../../lib/auth'

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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json() as { email?: string; password?: string; name?: string }

  const email    = body.email?.trim().toLowerCase()
  const password = body.password?.trim()
  const name     = body.name?.trim()

  if (!email || !password || !name) {
    return json({ error: '이메일, 비밀번호, 이름을 모두 입력해주세요' }, 400)
  }
  if (password.length < 8) {
    return json({ error: '비밀번호는 8자 이상이어야 합니다' }, 400)
  }

  // 이메일 중복 확인
  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first()
  if (existing) return json({ error: '이미 사용 중인 이메일입니다' }, 409)

  // 비밀번호 해싱
  const { hash, salt, iterations } = await hashPassword(password)
  const userId = crypto.randomUUID()
  const now    = new Date().toISOString()

  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, salt, iterations, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, email, hash, salt, iterations, name, now).run()

  // 회원가입 후 자동 로그인 — 세션 발급
  const sessionId  = crypto.randomUUID()
  const expiresAt  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, userId, expiresAt, now).run()

  return json(
    { ok: true, user: { id: userId, email, name } },
    201,
    { 'Set-Cookie': sessionCookie(sessionId) }
  )
}
