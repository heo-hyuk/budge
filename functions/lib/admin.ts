/// <reference types="@cloudflare/workers-types" />

// 관리자 여부 판별 — users.is_admin 컬럼 하나로만 관리한다(별도 역할 테이블 없음).
// 관리자 계정은 migration 032에서 시드되며, 이메일 없이 로그인 아이디로만 로그인한다.

interface Env { DB: D1Database }

/** 주어진 user_id가 관리자면 true */
export async function isAdmin(env: Env, userId: string): Promise<boolean> {
  if (!userId) return false
  const row = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?')
    .bind(userId)
    .first<{ is_admin: number }>()
  return !!row?.is_admin
}
