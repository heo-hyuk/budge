/// <reference types="@cloudflare/workers-types" />
import { parseCookie, sessionCookie, verifyPassword } from '../../lib/auth'

interface Env { DB: D1Database }

const cors = {
  'Access-Control-Allow-Origin': '*',
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
  // 이미 유효한 세션이 있으면 재사용
  const cookie    = request.headers.get('Cookie') ?? ''
  const sessionId = parseCookie(cookie, 'session')
  if (sessionId) {
    const existing = await env.DB.prepare(
      "SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?"
    ).bind(sessionId, new Date().toISOString()).first<{ user_id: string }>()
    if (existing) {
      const user = await env.DB.prepare(
        'SELECT id, email, name FROM users WHERE id = ?'
      ).bind(existing.user_id).first<{ id: string; email: string; name: string }>()
      if (user) return json({ ok: true, user })
    }
  }

  const body = await request.json() as { email?: string; password?: string }
  const email    = body.email?.trim().toLowerCase()
  const password = body.password?.trim()

  if (!email || !password) return json({ error: '이메일과 비밀번호를 입력해주세요' }, 400)

  const user = await env.DB.prepare(
    'SELECT id, email, name, password_hash, salt FROM users WHERE email = ?'
  ).bind(email).first<{ id: string; email: string; name: string; password_hash: string; salt: string }>()

  if (!user) return json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401)

  const valid = await verifyPassword(password, user.password_hash, user.salt)
  if (!valid)  return json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401)

  // 세션 발급 (30일)
  const newSessionId = crypto.randomUUID()
  const now          = new Date().toISOString()
  const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).bind(newSessionId, user.id, expiresAt, now).run()

  return json(
    { ok: true, user: { id: user.id, email: user.email, name: user.name } },
    200,
    { 'Set-Cookie': sessionCookie(newSessionId) }
  )
}
