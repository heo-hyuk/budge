/// <reference types="@cloudflare/workers-types" />
import { parseCookie } from '../lib/auth'

interface Env { DB: D1Database }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context
  const url = new URL(request.url)

  // OPTIONS preflight — 모든 경로에서 허용
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  // /api/auth/* 경로는 인증 없이 통과
  if (url.pathname.startsWith('/api/auth')) {
    return next()
  }

  // 세션 쿠키 확인
  const cookie    = request.headers.get('Cookie') ?? ''
  const sessionId = parseCookie(cookie, 'session')

  if (!sessionId) return unauthorized()

  const session = await env.DB.prepare(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?"
  ).bind(sessionId, new Date().toISOString()).first<{ user_id: string }>()

  if (!session) return unauthorized()

  // user_id를 다음 핸들러로 전달
  context.data.userId = session.user_id
  return next()
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
