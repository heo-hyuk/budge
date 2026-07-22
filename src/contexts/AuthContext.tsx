import { createContext, useContext, useEffect, useState } from 'react'
import { resetCalcSelections } from '../lib/calcSelections'
import { resetCardSettlementSourcePaymentMethods } from '../lib/cardSettlementPaymentMethods'
import { resetCategories } from '../lib/categories'
import { resetDeliveryExcludedCategories } from '../lib/deliveryCategories'
import { resetMerchants } from '../lib/merchants'
import { resetNoteCategories } from '../lib/noteCategories'
import { resetPaymentMethods } from '../lib/paymentMethods'
import { resetSettings } from '../lib/settings'

interface User {
  id: string
  email: string
  name: string
  nickname: string | null
  created_at: string
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string, remember?: boolean) => Promise<void>
  register: (email: string, password: string, name: string, nickname: string) => Promise<void>
  logout: () => Promise<void>
  updateNickname: (nickname: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // 앱 시작 시 현재 로그인 상태 확인
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((body: { user: User | null }) => setUser(body.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string, remember = true) {
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember }),
    })
    const body = (await res.json()) as { ok?: boolean; user?: User; error?: string }
    if (!res.ok || !body.user) throw new Error(body.error ?? '로그인에 실패했습니다')
    setUser(body.user)
  }

  async function register(email: string, password: string, name: string, nickname: string) {
    const res  = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, nickname }),
    })
    const body = (await res.json()) as { ok?: boolean; user?: User; error?: string }
    if (!res.ok || !body.user) throw new Error(body.error ?? '회원가입에 실패했습니다')
    setUser(body.user)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    // 다음 로그인(다른 계정일 수도)에 이전 계정 분류/설정/구매처가 새지 않게
    resetCategories()
    resetNoteCategories()
    resetSettings()
    resetMerchants()
    resetPaymentMethods()
    resetCalcSelections()
    resetDeliveryExcludedCategories()
    resetCardSettlementSourcePaymentMethods()
  }

  async function updateNickname(nickname: string) {
    const res  = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
    })
    const body = (await res.json()) as { ok?: boolean; user?: User; error?: string }
    if (!res.ok || !body.user) throw new Error(body.error ?? '닉네임 변경에 실패했습니다')
    setUser(body.user)
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const res  = await fetch('/api/auth/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
    const body = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok || !body.ok) throw new Error(body.error ?? '비밀번호 변경에 실패했습니다')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateNickname, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
