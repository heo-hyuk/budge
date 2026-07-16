import { useState } from 'react'
import Card from './ui/Card'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { validateNicknameClient } from '../lib/nickname'

function formatJoinDate(createdAt: string): string {
  const d = new Date(createdAt)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

interface Props {
  onClose: () => void
}

function MyPage({ onClose }: Props) {
  const { user, updateNickname, changePassword } = useAuth()
  const { showToast } = useToast()

  const [editingNickname, setEditingNickname] = useState(false)
  const [nicknameInput, setNicknameInput]      = useState(user?.nickname ?? user?.name ?? '')
  const [nicknameError, setNicknameError]      = useState('')
  const [nicknameSaving, setNicknameSaving]    = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError]     = useState('')
  const [passwordSaving, setPasswordSaving]   = useState(false)

  if (!user) return null

  async function handleSaveNickname() {
    const validationError = validateNicknameClient(nicknameInput)
    setNicknameError(validationError ?? '')
    if (validationError) return
    setNicknameSaving(true)
    try {
      await updateNickname(nicknameInput)
      showToast('닉네임이 변경되었습니다')
      setEditingNickname(false)
    } catch (err) {
      setNicknameError(err instanceof Error ? err.message : '닉네임 변경에 실패했습니다')
    } finally {
      setNicknameSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    if (newPassword.length < 8) {
      setPasswordError('새 비밀번호는 8자 이상이어야 합니다')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다')
      return
    }
    setPasswordSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      showToast('비밀번호가 변경되었습니다')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 sm:items-center">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">내 정보</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 rounded-lg px-3 text-sm font-semibold text-neutral-500 transition-colors hover:bg-white/60"
          >
            닫기
          </button>
        </div>

        {/* 닉네임 */}
        <Card>
          <p className="text-xs font-semibold text-neutral-400 mb-1">닉네임</p>
          {editingNickname ? (
            <div className="space-y-2">
              <input
                type="text"
                autoFocus
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="한글/영문/숫자 2~12자"
                className="min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
              />
              {nicknameError && <p className="text-sm font-semibold text-red-700">{nicknameError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveNickname}
                  disabled={nicknameSaving}
                  className="min-h-10 flex-1 rounded-xl bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600 disabled:opacity-50"
                >
                  {nicknameSaving ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNickname(false)
                    setNicknameInput(user.nickname ?? user.name)
                    setNicknameError('')
                  }}
                  className="min-h-10 flex-1 rounded-xl bg-neutral-100 text-sm font-bold text-neutral-600 transition-colors hover:bg-neutral-200"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-neutral-900">{user.nickname ?? user.name}</p>
              <button
                type="button"
                onClick={() => setEditingNickname(true)}
                className="min-h-9 rounded-lg bg-neutral-100 px-3 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-200"
              >
                수정
              </button>
            </div>
          )}
        </Card>

        {/* 이메일 / 가입일 */}
        <Card className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-neutral-400 mb-1">이메일</p>
            <p className="text-base font-semibold text-neutral-900">{user.email}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-400 mb-1">가입일</p>
            <p className="text-base font-semibold text-neutral-900">{formatJoinDate(user.created_at)}</p>
          </div>
        </Card>

        {/* 비밀번호 변경 */}
        <Card>
          <p className="text-xs font-semibold text-neutral-400 mb-2">비밀번호 변경</p>
          <form onSubmit={handleChangePassword} className="space-y-2">
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="현재 비밀번호"
              className="min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
            />
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호 (8자 이상)"
              minLength={8}
              className="min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
            />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 확인"
              minLength={8}
              className="min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50"
            />
            {passwordError && <p className="text-sm font-semibold text-red-700">{passwordError}</p>}
            <button
              type="submit"
              disabled={passwordSaving}
              className="min-h-11 w-full rounded-xl bg-coral-400 text-base font-bold text-white transition-colors hover:bg-coral-600 active:bg-coral-800 disabled:opacity-50"
            >
              {passwordSaving ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}

export default MyPage
