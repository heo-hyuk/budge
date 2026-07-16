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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // 항상 이메일/비밀번호를 검증한다. 기존 세션 쿠키가 남아있다는 이유로
  // 검증을 건너뛰면, 공유 PC에서 이전 사용자의 세션이 남아있을 때 다른
  // 계정으로 로그인 시도해도 이전 사용자로 로그인되는 문제가 생김
  const body = await request.json() as { email?: string; password?: string; remember?: boolean }
  const email    = body.email?.trim().toLowerCase()
  const password = body.password?.trim()
  const remember = body.remember !== false  // 기본값 true (자동 로그인)

  if (!email || !password) return json({ error: '이메일과 비밀번호를 입력해주세요' }, 400)

  const user = await env.DB.prepare(
    'SELECT id, email, name, nickname, created_at, password_hash, salt, iterations FROM users WHERE email = ?'
  ).bind(email).first<{ id: string; email: string; name: string; nickname: string | null; created_at: string; password_hash: string; salt: string; iterations: number }>()

  if (!user) return json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401)

  const valid = await verifyPassword(password, user.password_hash, user.salt, user.iterations)
  if (!valid)  return json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401)

  // 예전에 더 적은 반복횟수로 해싱된 계정이면 로그인 성공한 김에 최신 기준으로 재해싱
  if (needsRehash(user.iterations)) {
    const rehashed = await hashPassword(password)
    await env.DB.prepare(
      'UPDATE users SET password_hash = ?, salt = ?, iterations = ? WHERE id = ?'
    ).bind(rehashed.hash, rehashed.salt, rehashed.iterations, user.id).run()
  }

  // 세션 발급 (30일)
  const newSessionId = crypto.randomUUID()
  const now          = new Date().toISOString()
  const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).bind(newSessionId, user.id, expiresAt, now).run()

  return json(
    { ok: true, user: { id: user.id, email: user.email, name: user.name, nickname: user.nickname, created_at: user.created_at } },
    200,
    { 'Set-Cookie': sessionCookie(newSessionId, remember) }
  )
}
