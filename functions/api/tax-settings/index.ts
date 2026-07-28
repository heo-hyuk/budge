/// <reference types="@cloudflare/workers-types" />

interface Env { DB: D1Database }

type TaxType = 'general' | 'simplified' | 'freelance_3_3'
const TAX_TYPES: TaxType[] = ['general', 'simplified', 'freelance_3_3']

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

// 아직 설정 안 한 계정은 tax_type도 simplified_vat_rate도 null로 반환 —
// 프론트에서 임의 기본값을 보여주지 않고 "설정 안 함" 상태를 그대로 드러내기 위함
export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as { userId: string }).userId
  const row = await env.DB.prepare(
    'SELECT tax_type, simplified_vat_rate FROM user_tax_settings WHERE user_id = ?'
  ).bind(userId).first<{ tax_type: TaxType; simplified_vat_rate: number | null }>()

  return json({
    tax_type: row?.tax_type ?? null,
    simplified_vat_rate: row?.simplified_vat_rate ?? null,
  })
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as { userId: string }).userId
  const body = await request.json() as { tax_type?: string; simplified_vat_rate?: number | null }

  if (!body.tax_type || !TAX_TYPES.includes(body.tax_type as TaxType)) {
    return json({ error: '과세 유형을 선택해주세요' }, 400)
  }
  const taxType = body.tax_type as TaxType

  // 간이과세자가 아니면 부가율은 의미가 없으므로 항상 비움 — 과세 유형을 바꿨을 때
  // 이전 업종 부가율이 남아있다가 나중에 다시 간이과세자로 돌아왔을 때 잘못된
  // 값처럼 오해되는 걸 방지
  let vatRate: number | null = null
  if (taxType === 'simplified' && body.simplified_vat_rate != null) {
    const v = Number(body.simplified_vat_rate)
    if (!Number.isFinite(v) || v <= 0 || v > 100) {
      return json({ error: '부가가치율은 0~100 사이의 숫자로 입력해주세요' }, 400)
    }
    vatRate = v
  }

  await env.DB.prepare(
    `INSERT INTO user_tax_settings (user_id, tax_type, business_type, simplified_vat_rate, has_yellow_umbrella, updated_at)
     VALUES (?, ?, NULL, ?, 0, ?)
     ON CONFLICT(user_id) DO UPDATE SET tax_type = excluded.tax_type, simplified_vat_rate = excluded.simplified_vat_rate, updated_at = excluded.updated_at`
  ).bind(userId, taxType, vatRate, new Date().toISOString()).run()

  return json({ ok: true })
}
