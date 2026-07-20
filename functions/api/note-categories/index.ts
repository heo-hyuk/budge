/// <reference types="@cloudflare/workers-types" />
import { DEFAULT_NOTE_CATEGORIES } from '../../lib/noteCategories'

interface Env { DB: D1Database }
interface NoteCategoryRow {
  name: string
  removed_default: number
}

const cors = {
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors })

// 계정에 저장된 메모 분류 오버라이드 조회 — { custom, removedDefaults } 형태로 반환.
// custom은 sort_order 순서(관리 모드에서 사용자가 정한 순서)로 반환됨
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const { results } = await env.DB.prepare(
    'SELECT name, removed_default FROM note_categories WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC'
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
    // 새 커스텀 분류는 항상 마지막 순서로 추가
    const maxRow = await env.DB.prepare(
      'SELECT MAX(sort_order) AS max_order FROM note_categories WHERE user_id = ? AND removed_default = 0'
    ).bind(userId).first<{ max_order: number | null }>()
    const sortOrder = (maxRow?.max_order ?? -1) + 1

    await env.DB.prepare(
      `INSERT INTO note_categories (id, user_id, name, removed_default, sort_order, created_at)
       VALUES (?, ?, ?, 0, ?, ?)
       ON CONFLICT(user_id, name) DO NOTHING`
    ).bind(crypto.randomUUID(), userId, name, sortOrder, new Date().toISOString()).run()
  }

  return json({ ok: true }, 201)
}

// 커스텀 분류 순서 변경 — 관리 모드에서 위/아래로 이동한 뒤 전체 순서(이름 배열)를 통째로 저장
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { order?: string[] }

  if (!Array.isArray(body.order)) return json({ error: 'Invalid order' }, 400)

  for (let i = 0; i < body.order.length; i++) {
    await env.DB.prepare(
      'UPDATE note_categories SET sort_order = ? WHERE user_id = ? AND name = ? AND removed_default = 0'
    ).bind(i, userId, body.order[i]).run()
  }

  return json({ ok: true })
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
