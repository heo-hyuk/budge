/// <reference types="@cloudflare/workers-types" />
import { DEFAULT_CATEGORIES } from '../../lib/categories'

interface Env { DB: D1Database }

// index.ts의 resolveOrder와 동일한 상수 — 아직 물질화되지 않은 기본 분류를 이
// 토글로 처음 물질화할 때, "물질화된 행은 ROWED_OFFSET + sort_order로 정렬된다"는
// 규칙을 역이용해 원래(비물질화 상태) 순서를 그대로 보존하기 위해 사용
const ROWED_OFFSET = 100000

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

// 지출 분류 하나의 "세무 경비 포함" 여부 토글. 기본 분류는 이 토글이 처음
// 눌리는 순간 행이 없을 수 있으므로(다른 이유로 한 번도 재정렬/삭제된 적 없음)
// upsert로 물질화하되, sort_order를 ROWED_OFFSET 역산값으로 채워 넣어
// index.ts의 resolveOrder가 계산하는 최종 순서(ROWED_OFFSET + sort_order)가
// 원래 기본 분류 순서(DEFAULT_CATEGORIES의 인덱스)와 정확히 같아지도록 함
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { name?: string; is_tax_deductible?: boolean }
  const name = body.name?.trim()

  if (!name) return json({ error: '분류 이름이 필요합니다' }, 400)
  if (typeof body.is_tax_deductible !== 'boolean') return json({ error: 'Invalid is_tax_deductible' }, 400)

  const defaultIndex = DEFAULT_CATEGORIES.expense.indexOf(name)
  const fallbackSortOrder = defaultIndex >= 0 ? defaultIndex - ROWED_OFFSET : 0

  await env.DB.prepare(
    `INSERT INTO categories (id, user_id, type, name, removed_default, sort_order, is_tax_deductible, created_at)
     VALUES (?, ?, 'expense', ?, 0, ?, ?, ?)
     ON CONFLICT(user_id, type, name) DO UPDATE SET is_tax_deductible = excluded.is_tax_deductible`
  ).bind(crypto.randomUUID(), userId, name, fallbackSortOrder, body.is_tax_deductible ? 1 : 0, new Date().toISOString()).run()

  return json({ ok: true })
}
