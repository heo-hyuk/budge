/// <reference types="@cloudflare/workers-types" />
import { DEFAULT_PAYMENT_METHODS } from '../../lib/paymentMethods'

interface Env { DB: D1Database }
interface PaymentMethodRow {
  type: 'expense' | 'income'
  name: string
  removed_default: number
  sort_order: number
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

// functions/api/categories/index.ts의 resolveOrder와 동일한 원리 — 자세한 설명은 그쪽 주석 참고
const ROWED_OFFSET = 100000

function resolveOrder(type: 'expense' | 'income', rows: PaymentMethodRow[]): string[] {
  const typeRows = rows.filter((r) => r.type === type)
  const removedNames = new Set(typeRows.filter((r) => r.removed_default === 1).map((r) => r.name))
  const rowMap = new Map(typeRows.filter((r) => r.removed_default === 0).map((r) => [r.name, r.sort_order]))

  const names = new Set<string>()
  for (const n of DEFAULT_PAYMENT_METHODS[type]) if (!removedNames.has(n)) names.add(n)
  for (const n of rowMap.keys()) names.add(n)

  return Array.from(names).sort((a, b) => {
    const oa = rowMap.has(a) ? ROWED_OFFSET + rowMap.get(a)! : DEFAULT_PAYMENT_METHODS[type].indexOf(a)
    const ob = rowMap.has(b) ? ROWED_OFFSET + rowMap.get(b)! : DEFAULT_PAYMENT_METHODS[type].indexOf(b)
    return oa - ob
  })
}

// 계정에 저장된 결제 방법 목록 조회 — 지출/수입 각각 기본+커스텀을 서버에서
// 병합/정렬까지 끝낸 최종 순서 배열로 반환. 카드는 이 목록과 무관(cards 테이블 별도)
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const { results } = await env.DB.prepare(
    'SELECT type, name, removed_default, sort_order FROM payment_methods WHERE user_id = ?'
  ).bind(userId).all<PaymentMethodRow>()

  const rows = results ?? []
  return json({ expense: resolveOrder('expense', rows), income: resolveOrder('income', rows) })
}

// 결제 방법 추가 — 예전에 삭제했던 기본 항목을 같은 이름으로 다시 추가하면 삭제 표시를 지워 복원
export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { type?: string; name?: string }
  const type = body.type
  const name = body.name?.trim()

  if (type !== 'expense' && type !== 'income') return json({ error: 'Invalid type' }, 400)
  if (!name) return json({ error: '결제 방법 이름을 입력해주세요' }, 400)

  if (DEFAULT_PAYMENT_METHODS[type].includes(name)) {
    await env.DB.prepare(
      'DELETE FROM payment_methods WHERE user_id = ? AND type = ? AND name = ? AND removed_default = 1'
    ).bind(userId, type, name).run()
  } else {
    // 새 커스텀 결제 방법은 항상 마지막 순서로 추가
    const maxRow = await env.DB.prepare(
      'SELECT MAX(sort_order) AS max_order FROM payment_methods WHERE user_id = ? AND type = ? AND removed_default = 0'
    ).bind(userId, type).first<{ max_order: number | null }>()
    const sortOrder = (maxRow?.max_order ?? -1) + 1

    await env.DB.prepare(
      `INSERT INTO payment_methods (id, user_id, type, name, removed_default, sort_order, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(user_id, type, name) DO NOTHING`
    ).bind(crypto.randomUUID(), userId, type, name, sortOrder, new Date().toISOString()).run()
  }

  return json({ ok: true }, 201)
}

// 결제 방법 순서 변경 — 관리 모드 드래그로 정해진 전체 순서(이름 배열, 기본+커스텀 모두 포함)를
// 통째로 저장. 아직 행이 없던 기본 항목은 이 시점에 행으로 물질화(upsert)됨
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { type?: string; order?: string[] }
  const type = body.type

  if (type !== 'expense' && type !== 'income') return json({ error: 'Invalid type' }, 400)
  if (!Array.isArray(body.order)) return json({ error: 'Invalid order' }, 400)

  for (let i = 0; i < body.order.length; i++) {
    await env.DB.prepare(
      `INSERT INTO payment_methods (id, user_id, type, name, removed_default, sort_order, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(user_id, type, name) DO UPDATE SET sort_order = excluded.sort_order, removed_default = 0`
    ).bind(crypto.randomUUID(), userId, type, body.order[i], i, new Date().toISOString()).run()
  }

  return json({ ok: true })
}

// 결제 방법 삭제 — 기본 제공 항목은 "삭제됨" 표시로 갱신(이미 물질화된 행이면 UPDATE,
// 없으면 새로 INSERT), 커스텀 항목은 행 자체를 삭제
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const name = url.searchParams.get('name')

  if (type !== 'expense' && type !== 'income') return json({ error: 'Invalid type' }, 400)
  if (!name) return json({ error: '결제 방법 이름이 필요합니다' }, 400)

  if (DEFAULT_PAYMENT_METHODS[type].includes(name)) {
    await env.DB.prepare(
      `INSERT INTO payment_methods (id, user_id, type, name, removed_default, created_at)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(user_id, type, name) DO UPDATE SET removed_default = 1`
    ).bind(crypto.randomUUID(), userId, type, name, new Date().toISOString()).run()
  } else {
    await env.DB.prepare(
      'DELETE FROM payment_methods WHERE user_id = ? AND type = ? AND name = ? AND removed_default = 0'
    ).bind(userId, type, name).run()
  }

  return json({ ok: true })
}
