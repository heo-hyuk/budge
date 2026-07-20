/// <reference types="@cloudflare/workers-types" />
import { DEFAULT_NOTE_CATEGORIES } from '../../lib/noteCategories'

interface Env { DB: D1Database }
interface NoteCategoryRow {
  name: string
  removed_default: number
}

const cors = {
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

// 계정에 저장된 메모 분류 오버라이드 조회 — { custom, removedDefaults } 형태로 반환
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const { results } = await env.DB.prepare(
    'SELECT name, removed_default FROM note_categories WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(userId).all<NoteCategoryRow>()

  const overrides = { custom: [] as string[], removedDefaults: [] as string[] }
  for (const row of results ?? []) {
    const bucket = row.removed_default ? overrides.removedDefaults : overrides.custom
    bucket.push(row.name)
  }
  return json(overrides)
}

// 분류 추가 — 예전에 삭제했던 기본 분류를 같은 이름으로 다시 추가하면 삭제 표시를 지워 복원
export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { name?: string }
  const name = body.name?.trim()

  if (!name) return json({ error: '분류 이름을 입력해주세요' }, 400)

  if (DEFAULT_NOTE_CATEGORIES.includes(name)) {
    await env.DB.prepare(
      'DELETE FROM note_categories WHERE user_id = ? AND name = ? AND removed_default = 1'
    ).bind(userId, name).run()
  } else {
    await env.DB.prepare(
      `INSERT INTO note_categories (id, user_id, name, removed_default, created_at)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(user_id, name) DO NOTHING`
    ).bind(crypto.randomUUID(), userId, name, new Date().toISOString()).run()
  }

  return json({ ok: true }, 201)
}

// 분류 삭제 — 기본 제공 분류는 "삭제됨" 표시 행을 추가, 커스텀 분류는 행 자체를 삭제
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const url = new URL(request.url)
  const name = url.searchParams.get('name')

  if (!name) return json({ error: '분류 이름이 필요합니다' }, 400)

  if (DEFAULT_NOTE_CATEGORIES.includes(name)) {
    await env.DB.prepare(
      `INSERT INTO note_categories (id, user_id, name, removed_default, created_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(user_id, name) DO NOTHING`
    ).bind(crypto.randomUUID(), userId, name, new Date().toISOString()).run()
  } else {
    await env.DB.prepare(
      'DELETE FROM note_categories WHERE user_id = ? AND name = ? AND removed_default = 0'
    ).bind(userId, name).run()
  }

  return json({ ok: true })
}
