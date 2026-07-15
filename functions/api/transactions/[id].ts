/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(params.id).run();
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

// 거래 수정 — 변경할 필드만 받아서 업데이트
export const onRequestPatch: PagesFunction<Env> = async ({ params, request, env }) => {
  const body = await request.json() as {
    type?: 'income' | 'expense';
    category?: string;
    amount?: number;
    memo?: string;
    date?: string;
  };

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.type !== undefined)     { fields.push('type = ?');     values.push(body.type); }
  if (body.category !== undefined) { fields.push('category = ?'); values.push(body.category); }
  if (body.amount !== undefined)   { fields.push('amount = ?');   values.push(body.amount); }
  if (body.memo !== undefined)     { fields.push('memo = ?');     values.push(body.memo); }
  if (body.date !== undefined)     { fields.push('date = ?');     values.push(body.date); }

  if (fields.length === 0) {
    return new Response(JSON.stringify({ error: 'No fields to update' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  values.push(params.id);
  await env.DB.prepare(
    `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};
