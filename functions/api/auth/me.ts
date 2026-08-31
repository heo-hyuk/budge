/// <reference types="@cloudflare/workers-types" />
import { clearSessionCookie, parseCookie, validateNickname, verifyPassword } from '../../lib/auth'

interface Env { DB: D1Database; NOTE_IMAGES: R2Bucket }

// 프론트엔드는 항상 same-origin으로만 요청하므로 CORS 헤더 자체가 불필요함
const cors = {
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
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

  const row = await env.DB.prepare(
    'SELECT id, email, name, nickname, created_at, is_admin FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string; email: string; name: string; nickname: string | null; created_at: string; is_admin: number }>()

  const user = row ? { ...row, is_admin: !!row.is_admin } : null
  return json({ user })
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

// 회원 탈퇴 — 비밀번호 재확인 후 계정 및 연결된 모든 데이터를 영구 삭제.
// D1은 foreign_keys PRAGMA를 켜두지 않아 실제 FK cascade가 동작하지 않으므로
// (기존 카드/거래 삭제 로직과 동일한 이유) user_id를 참조하는 모든 테이블을 직접 정리한다.
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const userId = await getUserId(request, env)
  if (!userId) return json({ error: '로그인이 필요합니다' }, 401)

  const body     = await request.json() as { password?: string }
  const password = body.password?.trim()
  if (!password) return json({ error: '비밀번호를 입력해주세요' }, 400)

  const user = await env.DB.prepare(
    'SELECT password_hash, salt, iterations FROM users WHERE id = ?'
  ).bind(userId).first<{ password_hash: string; salt: string; iterations: number }>()
  if (!user) return json({ error: '로그인이 필요합니다' }, 401)

  const valid = await verifyPassword(password, user.password_hash, user.salt, user.iterations)
  if (!valid) return json({ error: '비밀번호가 일치하지 않습니다' }, 400)

  // R2에 저장된 메모 첨부 이미지는 D1 배치 삭제로는 정리가 안 되므로 먼저 개별 삭제
  const { results: noteRows } = await env.DB.prepare(
    'SELECT image_key FROM notes WHERE user_id = ? AND image_key IS NOT NULL'
  ).bind(userId).all<{ image_key: string }>()
  for (const row of noteRows ?? []) {
    await env.NOTE_IMAGES.delete(row.image_key)
  }

  await env.DB.batch([
    // benefit_groups는 user_id가 없어 카드 소유 여부로 판별(카드 삭제 API와 동일한 이유)
    env.DB.prepare('DELETE FROM benefit_groups WHERE card_id IN (SELECT id FROM cards WHERE user_id = ?)').bind(userId),
    env.DB.prepare('DELETE FROM card_benefits WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM cards WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM transactions WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM recurring_transactions WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM budgets WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM notes WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM quick_templates WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM notification_log WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM categories WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM note_categories WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM user_settings WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM merchants WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM payment_methods WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM calc_selections WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM delivery_excluded_categories WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM card_settlement_source_payment_methods WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM user_tax_settings WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ])

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json', 'Set-Cookie': clearSessionCookie() },
  })
}
