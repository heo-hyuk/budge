/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }
interface SettingRow { key: string; value: string }

// 허용된 설정 key와 기본값/유효값 — 새 설정을 추가할 땐 여기에만 등록하면 됨(스키마 변경 불필요)
const SETTINGS: Record<string, { default: string; values: string[] }> = {
  monthlyBasis: { default: 'billing', values: ['billing', 'transaction'] },
}

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

// 계정별 설정 조회 — 저장 안 된 key는 기본값으로 채워서 항상 전체 key를 반환
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const { results } = await env.DB.prepare(
    'SELECT key, value FROM user_settings WHERE user_id = ?'
  ).bind(userId).all<SettingRow>()

  const saved = new Map((results ?? []).map((r) => [r.key, r.value]))
  const settings: Record<string, string> = {}
  for (const [key, def] of Object.entries(SETTINGS)) {
    settings[key] = saved.get(key) ?? def.default
  }
  return json(settings)
}

// 설정 변경 — { key, value } 하나씩 upsert
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { key?: string; value?: string }
  const key   = body.key
  const value = body.value

  if (!key || !(key in SETTINGS)) return json({ error: 'Invalid key' }, 400)
  if (!value || !SETTINGS[key].values.includes(value)) return json({ error: 'Invalid value' }, 400)

  await env.DB.prepare(
    `INSERT INTO user_settings (user_id, key, value, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(userId, key, value, new Date().toISOString()).run()

  return json({ ok: true })
}
