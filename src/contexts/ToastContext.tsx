import { createContext, useCallback, useContext, useState } from 'react'

export type ToastType = 'success' | 'error'

export interface ToastOptions {
  actionLabel?: string   // 예: "되돌리기" (텍스트만, 아이콘 없음)
  onAction?: () => void
  durationMs?: number    // 기본 3000ms
}

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  actionLabel?: string
  onAction?: () => void
}

interface ToastContextValue {
  toasts: ToastItem[]
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 3000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'success', options?: ToastOptions) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type, actionLabel: options?.actionLabel, onAction: options?.onAction }])
    setTimeout(() => dismissToast(id), options?.durationMs ?? AUTO_DISMISS_MS)
  }, [dismissToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
