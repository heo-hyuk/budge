/// <reference types="@cloudflare/workers-types" />
import { hashPassword, parseCookie, verifyPassword } from '../../lib/auth'

interface Env { DB: D1Database }

// 프론트엔드는 항상 same-origin으로만 요청하므로 CORS 헤더 자체가 불필요함
const cors = {
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const cookie    = request.headers.get('Cookie') ?? ''
  const sessionId = parseCookie(cookie, 'session')
  if (!sessionId) return json({ error: '로그인이 필요합니다' }, 401)

  const session = await env.DB.prepare(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?"
  ).bind(sessionId, new Date().toISOString()).first<{ user_id: string }>()
  if (!session) return json({ error: '로그인이 필요합니다' }, 401)

  const body            = await request.json() as { current_password?: string; new_password?: string }
  const currentPassword = body.current_password?.trim()
  const newPassword     = body.new_password?.trim()

  if (!currentPassword || !newPassword) {
    return json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요' }, 400)
  }
  if (newPassword.length < 8) {
    return json({ error: '새 비밀번호는 8자 이상이어야 합니다' }, 400)
  }

  const user = await env.DB.prepare(
    'SELECT password_hash, salt, iterations FROM users WHERE id = ?'
  ).bind(session.user_id).first<{ password_hash: string; salt: string; iterations: number }>()
  if (!user) return json({ error: '로그인이 필요합니다' }, 401)

  const valid = await verifyPassword(currentPassword, user.password_hash, user.salt, user.iterations)
  if (!valid) return json({ error: '현재 비밀번호가 일치하지 않습니다' }, 400)

  const { hash, salt, iterations } = await hashPassword(newPassword)
  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, salt = ?, iterations = ? WHERE id = ?'
  ).bind(hash, salt, iterations, session.user_id).run()

  // 비밀번호 변경 시 다른 기기에 남아있을 수 있는 세션은 전부 무효화(보안),
  // 방금 인증을 마친 현재 세션만 유지해 재로그인 없이 이어서 사용 가능
  await env.DB.prepare(
    'DELETE FROM sessions WHERE user_id = ? AND id != ?'
  ).bind(session.user_id, sessionId).run()

  return json({ ok: true })
}
