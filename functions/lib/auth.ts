// PBKDF2 기반 비밀번호 해싱 (Web Crypto API — Cloudflare Workers 지원)

// Cloudflare Workers 무료 요금제는 요청당 CPU 10ms 제한.
// workerd에서 실측한 결과 15,000회 ≈ 5ms로 다른 요청 처리(DB 쿼리 등) 여유를 두고 안전한 상한선.
// (참고: 100,000회는 40ms로 무료 요금제에서 요청 자체가 실패함 — 반드시 실측 후 올릴 것)
const ITERATIONS = 15_000
const KEY_LENGTH = 256

/** 비밀번호 해시 생성 (회원가입 시) — 항상 현재 ITERATIONS로 생성 */
export async function hashPassword(
  password: string
): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = crypto.randomUUID()
  const hash = await derive(password, salt, ITERATIONS)
  return { hash, salt, iterations: ITERATIONS }
}

/**
 * 비밀번호 검증 (로그인 시) — 저장된 반복횟수로 검증
 * 기존 계정은 예전에 더 적은 횟수로 해싱됐을 수 있어 DB에 저장된 값을 그대로 사용
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string,
  iterations: number
): Promise<boolean> {
  const hash = await derive(password, salt, iterations)
  return hash === storedHash
}

/** 현재 저장된 반복횟수가 최신 기준보다 낮은지(재해싱이 필요한지) 확인 */
export function needsRehash(storedIterations: number): boolean {
  return storedIterations < ITERATIONS
}

async function derive(password: string, salt: string, iterations: number): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' },
    key,
    KEY_LENGTH
  )
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** 닉네임 유효성 검증 — 2~12자, 공백 불가, 한글/영문/숫자만 허용. 통과하면 null, 실패하면 에러 메시지 */
export function validateNickname(nickname: string): string | null {
  if (!/^[가-힣a-zA-Z0-9]{2,12}$/.test(nickname)) {
    return '닉네임은 공백 없이 한글/영문/숫자로 2~12자여야 합니다'
  }
  return null
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
