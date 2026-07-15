/// <reference types="@cloudflare/workers-types" />
import { clearSessionCookie, parseCookie } from '../../lib/auth'

interface Env { DB: D1Database }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const cookie    = request.headers.get('Cookie') ?? ''
  const sessionId = parseCookie(cookie, 'session')

  if (sessionId) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    },
  })
}
