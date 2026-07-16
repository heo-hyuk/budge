// 서버(functions/lib/auth.ts validateNickname)와 동일한 규칙
export const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9]{2,12}$/

export function validateNicknameClient(nickname: string): string | null {
  if (!NICKNAME_PATTERN.test(nickname)) {
    return '닉네임은 공백 없이 한글/영문/숫자로 2~12자여야 합니다'
  }
  return null
}
