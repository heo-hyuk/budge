import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { validateNicknameClient } from '../lib/nickname'

type Mode = 'login' | 'register'

const SAVED_EMAIL_KEY = 'budget:savedEmail'

function AuthPage() {
  const { login, register } = useAuth()
  const [mode, setMode]     = useState<Mode>('login')
  const [email, setEmail]   = useState(() => localStorage.getItem(SAVED_EMAIL_KEY) ?? '')
  const [password, setPassword] = useState('')
  const [name, setName]     = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [saveEmail, setSaveEmail] = useState(() => localStorage.getItem(SAVED_EMAIL_KEY) !== null)
  const [autoLogin, setAutoLogin] = useState(true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        if (saveEmail) localStorage.setItem(SAVED_EMAIL_KEY, email)
        else localStorage.removeItem(SAVED_EMAIL_KEY)
        await login(email, password, autoLogin)
      } else {
        const nicknameError = validateNicknameClient(nickname)
        if (nicknameError) {
          setError(nicknameError)
          setLoading(false)
          return
        }
        await register(email, password, name, nickname)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* 로고/타이틀 — 심볼+텅장 워드마크가 하나로 합쳐진 로고 */}
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="텅장" className="mx-auto h-20 w-auto" />
          <p className="mt-2 text-sm text-neutral-500">나만의 가계부 서비스</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          {/* 탭 */}
          <div className="flex rounded-xl bg-neutral-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 min-h-9 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'login' ? 'bg-white text-coral-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError('') }}
              className={`flex-1 min-h-9 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'register' ? 'bg-white text-coral-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이름 (회원가입만) */}
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">이름</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
                />
              </div>
            )}

            {/* 닉네임 (회원가입만) — 헤더에 표시될 이름 */}
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">닉네임</label>
                <input
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="한글/영문/숫자 2~12자"
                  className="min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
                />
              </div>
            )}

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">이메일</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">비밀번호</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? '8자 이상' : ''}
                minLength={mode === 'register' ? 8 : undefined}
                className="min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
              />
            </div>

            {/* 아이디 저장 / 자동 로그인 (로그인 모드만) — 체크박스 자체는 작아도
                라벨 전체를 터치 영역으로 넓혀서 탭하기 쉽게 함 */}
            {mode === 'login' && (
              <div className="-ml-2 flex items-center gap-2">
                <label className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-neutral-600">
                  <input
                    type="checkbox"
                    checked={saveEmail}
                    onChange={(e) => setSaveEmail(e.target.checked)}
                    className="h-4 w-4 rounded border-2 border-neutral-300 accent-coral-400"
                  />
                  아이디 저장
                </label>
                <label className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-neutral-600">
                  <input
                    type="checkbox"
                    checked={autoLogin}
                    onChange={(e) => setAutoLogin(e.target.checked)}
                    className="h-4 w-4 rounded border-2 border-neutral-300 accent-coral-400"
                  />
                  자동 로그인
                </label>
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="min-h-12 w-full rounded-xl bg-coral-400 text-base font-bold text-white transition-colors hover:bg-coral-600 active:bg-coral-800 disabled:opacity-50"
            >
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AuthPage
