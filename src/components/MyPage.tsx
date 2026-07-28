import { useEffect, useState } from 'react'
import NotificationSettings from './NotificationSettings'
import Card from './ui/Card'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { useToast } from '../contexts/ToastContext'
import { fetchTaxSettings, updateTaxSettings } from '../lib/api'
import { validateNicknameClient } from '../lib/nickname'
import type { TaxType } from '../types'

const TAX_TYPE_OPTIONS: { value: TaxType; label: string }[] = [
  { value: 'general',       label: '일반과세자' },
  { value: 'simplified',    label: '간이과세자' },
  { value: 'freelance_3_3', label: '프리랜서 (3.3% 원천징수)' },
]

function formatJoinDate(createdAt: string): string {
  const d = new Date(createdAt)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

interface Props {
  onClose: () => void
}

function MyPage({ onClose }: Props) {
  const { user, updateNickname, changePassword, deleteAccount } = useAuth()
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [editingNickname, setEditingNickname] = useState(false)
  const [nicknameInput, setNicknameInput]      = useState(user?.nickname ?? user?.name ?? '')
  const [nicknameError, setNicknameError]      = useState('')
  const [nicknameSaving, setNicknameSaving]    = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError]     = useState('')
  const [passwordSaving, setPasswordSaving]   = useState(false)

  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError]       = useState('')
  const [deleteSaving, setDeleteSaving]     = useState(false)

  // 사업자 세금 설정 — null = 아직 로드 전/미설정. 부가율은 홈택스 확인 없이
  // 임의로 채우면 안 되므로 서버가 null로 내려주면 입력칸도 빈 채로 둔다
  const [taxType, setTaxType]                 = useState<TaxType | null>(null)
  const [vatRateInput, setVatRateInput]       = useState('')
  const [taxSettingsLoading, setTaxSettingsLoading] = useState(true)
  const [taxSettingsSaving, setTaxSettingsSaving]   = useState(false)
  const [taxSettingsError, setTaxSettingsError]     = useState('')

  useEffect(() => {
    fetchTaxSettings()
      .then((s) => {
        setTaxType(s.tax_type)
        setVatRateInput(s.simplified_vat_rate != null ? String(s.simplified_vat_rate) : '')
      })
      .catch(() => { /* 미설정 상태와 동일하게 조용히 폴백 */ })
      .finally(() => setTaxSettingsLoading(false))
  }, [])

  if (!user) return null

  async function handleSaveTaxSettings() {
    if (!taxType) return
    setTaxSettingsError('')
    const trimmedRate = vatRateInput.trim()
    if (taxType === 'simplified' && trimmedRate) {
      const v = Number(trimmedRate)
      if (!Number.isFinite(v) || v <= 0 || v > 100) {
        setTaxSettingsError('부가가치율은 0~100 사이의 숫자로 입력해주세요')
        return
      }
    }
    setTaxSettingsSaving(true)
    try {
      await updateTaxSettings({
        tax_type: taxType,
        simplified_vat_rate: taxType === 'simplified' && trimmedRate ? Number(trimmedRate) : null,
      })
      showToast('세금 설정을 저장했습니다')
    } catch (err) {
      setTaxSettingsError(err instanceof Error ? err.message : '세금 설정을 저장하지 못했습니다')
    } finally {
      setTaxSettingsSaving(false)
    }
  }

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

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault()
    setDeleteError('')
    if (!(await confirm('정말로 계정을 삭제할까요? 모든 가계부 데이터가 영구적으로 삭제되며 되돌릴 수 없습니다.'))) return
    setDeleteSaving(true)
    try {
      await deleteAccount(deletePassword)
      showToast('계정이 삭제되었습니다')
      onClose()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '계정을 삭제하지 못했습니다')
    } finally {
      setDeleteSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 sm:items-center"
      onClick={onClose}
    >
      <div className="w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between rounded-2xl bg-white dark:bg-neutral-900 px-4 py-3 shadow-sm">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">내 정보</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            닫기
          </button>
        </div>

        {/* 닉네임 */}
        <Card>
          <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-1">닉네임</p>
          {editingNickname ? (
            <div className="space-y-2">
              <input
                type="text"
                autoFocus
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="한글/영문/숫자 2~12자"
                className="min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
              />
              {nicknameError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{nicknameError}</p>}
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
                  className="min-h-10 flex-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm font-bold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{user.nickname ?? user.name}</p>
              <button
                type="button"
                onClick={() => setEditingNickname(true)}
                className="min-h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                수정
              </button>
            </div>
          )}
        </Card>

        {/* 이메일 / 가입일 */}
        <Card className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-1">이메일</p>
            <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{user.email}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-1">가입일</p>
            <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{formatJoinDate(user.created_at)}</p>
          </div>
        </Card>

        {/* 사업자 세금 설정 */}
        <Card>
          <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-1">사업자 세금 설정</p>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            1인 사업자 세금 계산에 사용돼요. 정확하지 않으면 계산 결과도 부정확해질 수 있으니 신중하게 선택해주세요
          </p>
          {taxSettingsLoading ? (
            <p className="text-sm text-neutral-400 dark:text-neutral-500">불러오는 중...</p>
          ) : (
            <>
              <div className="space-y-2 mb-3">
                {TAX_TYPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="taxType"
                      checked={taxType === opt.value}
                      onChange={() => setTaxType(opt.value)}
                      className="h-4 w-4 border-neutral-300 dark:border-neutral-700 text-coral-400 focus:ring-coral-400"
                    />
                    <span className="text-base text-neutral-800 dark:text-neutral-200">{opt.label}</span>
                  </label>
                ))}
              </div>

              {taxType === 'simplified' && (
                <div className="mb-3">
                  <label htmlFor="vatRate" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    업종별 부가가치율 (%)
                  </label>
                  <input
                    id="vatRate"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    placeholder="예: 20"
                    value={vatRateInput}
                    onChange={(e) => setVatRateInput(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                  />
                  <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                    모르면 비워두세요 — 임의로 채우지 않아요. 정확한 값은 홈택스 또는 세무사 확인 후 입력해주세요
                  </p>
                </div>
              )}

              {taxSettingsError && <p className="mb-3 text-sm font-semibold text-red-700 dark:text-red-400">{taxSettingsError}</p>}

              <button
                type="button"
                onClick={handleSaveTaxSettings}
                disabled={!taxType || taxSettingsSaving}
                className="min-h-11 w-full rounded-xl bg-coral-400 text-base font-bold text-white transition-colors hover:bg-coral-600 active:bg-coral-800 disabled:opacity-50"
              >
                {taxSettingsSaving ? '저장 중...' : '저장'}
              </button>
            </>
          )}
        </Card>

        {/* 카드 정산 알림 */}
        <NotificationSettings />

        {/* 비밀번호 변경 */}
        <Card>
          <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-2">비밀번호 변경</p>
          <form onSubmit={handleChangePassword} className="space-y-2">
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="현재 비밀번호"
              className="min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
            />
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호 (8자 이상)"
              minLength={8}
              className="min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
            />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 확인"
              minLength={8}
              className="min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
            />
            {passwordError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{passwordError}</p>}
            <button
              type="submit"
              disabled={passwordSaving}
              className="min-h-11 w-full rounded-xl bg-coral-400 text-base font-bold text-white transition-colors hover:bg-coral-600 active:bg-coral-800 disabled:opacity-50"
            >
              {passwordSaving ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        </Card>

        {/* 회원 탈퇴 — 눈에 띄지 않게 다른 설정과 톤을 분리하고, 비밀번호 재확인 +
            확인 다이얼로그 2단계로 실수로 인한 삭제를 방지 */}
        <Card>
          <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-2">회원 탈퇴</p>
          {!showDeleteForm ? (
            <button
              type="button"
              onClick={() => setShowDeleteForm(true)}
              className="text-sm font-semibold text-red-600 dark:text-red-400 hover:underline"
            >
              계정 삭제하기
            </button>
          ) : (
            <form onSubmit={handleDeleteAccount} className="space-y-2">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                탈퇴하면 거래 내역, 카드, 메모, 예산 등 모든 데이터가 즉시 영구 삭제되며 복구할 수 없어요.
              </p>
              <input
                type="password"
                required
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="비밀번호 확인"
                className="min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 text-base transition-colors focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-50 dark:focus:ring-red-900/40"
              />
              {deleteError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={deleteSaving}
                  className="min-h-10 flex-1 rounded-xl bg-red-600 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteSaving ? '삭제 중...' : '탈퇴하기'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDeleteForm(false); setDeletePassword(''); setDeleteError('') }}
                  className="min-h-10 flex-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm font-bold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </Card>

        <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:underline">이용약관</a>
          {' · '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline">개인정보처리방침</a>
        </p>
      </div>
    </div>
  )
}

export default MyPage
