// PBKDF2 기반 비밀번호 해싱 (Web Crypto API — Cloudflare Workers 지원)

const ITERATIONS = 10_000
const KEY_LENGTH = 256

/** 비밀번호 해시 생성 (회원가입 시) */
export async function hashPassword(
  password: string
): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomUUID()
  const hash = await derive(password, salt)
  return { hash, salt }
}

/** 비밀번호 검증 (로그인 시) */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const hash = await derive(password, salt)
  return hash === storedHash
}

async function derive(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_LENGTH
  )
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── 쿠키 유틸 ────────────────────────────────────────

/** Cookie 헤더에서 특정 키 값 추출 */
export function parseCookie(cookieHeader: string, key: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [k, v] = part.trim().split('=')
    if (k === key) return v ?? null
  }
  return null
}

/**
 * 세션 쿠키 Set-Cookie 헤더 값 생성
 * persist=false면 Max-Age를 생략해 브라우저 종료 시 사라지는 세션 쿠키로 발급
 * (자동 로그인 체크 해제 시 사용)
 */
export function sessionCookie(token: string, persist = true): string {
  const base = `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/`
  return persist ? `${base}; Max-Age=${60 * 60 * 24 * 30}` : base
}

/** 세션 쿠키 삭제용 헤더 값 */
export function clearSessionCookie(): string {
  return 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
}
