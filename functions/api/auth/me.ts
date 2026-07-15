/// <reference types="@cloudflare/workers-types" />
import { parseCookie } from '../../lib/auth'

interface Env { DB: D1Database }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const cookie    = request.headers.get('Cookie') ?? ''
  const sessionId = parseCookie(cookie, 'session')
  if (!sessionId) return json({ user: null }, 200)

  const session = await env.DB.prepare(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?"
  ).bind(sessionId, new Date().toISOString()).first<{ user_id: string }>()

  if (!session) return json({ user: null }, 200)

  const user = await env.DB.prepare(
    'SELECT id, email, name FROM users WHERE id = ?'
  ).bind(session.user_id).first<{ id: string; email: string; name: string }>()

  return json({ user: user ?? null })
}
