/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);

  const result = await env.DB.prepare(
    'SELECT * FROM transactions ORDER BY date DESC, created_at DESC LIMIT ?'
  ).bind(limit).all();

  return json({ data: result.results }, 200);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json() as {
    type: 'income' | 'expense';
    category: string;
    amount: number;
    memo?: string;
    date: string;
  };

  if (!body.type || !body.category || !body.amount || !body.date) {
    return json({ error: 'Missing required fields' }, 400);
  }

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO transactions (id, type, category, amount, memo, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.type, body.category, body.amount, body.memo ?? '', body.date, created_at).run();

  return json({ ok: true, id }, 201);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
