import { createContext, useContext, useState } from 'react'

interface ConfirmRequest {
  message: string
  resolve: (value: boolean) => void
}

interface ConfirmContextValue {
  request: ConfirmRequest | null
  confirm: (message: string) => Promise<boolean>
  respond: (value: boolean) => void
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

// 홈 화면에 설치한 PWA(standalone 모드)에서는 window.confirm()이 아예 표시되지
// 않고 조용히 무시되는 플랫폼이 있어(즉시 false 반환), 네이티브 confirm 대신
// 앱 안에서 렌더되는 모달로 대체 — ToastContext와 동일한 컨텍스트+Promise 패턴
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  function confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => setRequest({ message, resolve }))
  }

  function respond(value: boolean) {
    request?.resolve(value)
    setRequest(null)
  }

  return (
    <ConfirmContext.Provider value={{ request, confirm, respond }}>
      {children}
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.confirm
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirmDialogState() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirmDialogState must be used within ConfirmProvider')
  return ctx
}
