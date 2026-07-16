import { CheckCircle2, X, XCircle } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

function Toast() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 space-y-2 px-4 sm:left-auto sm:right-4 sm:translate-x-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`toast-enter flex items-start gap-2 rounded-xl border p-3 shadow-lg ${
            t.type === 'success'
              ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300'
              : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300'
          }`}
        >
          {t.type === 'success'
            ? <CheckCircle2 size={18} strokeWidth={2.25} className="mt-0.5 shrink-0" />
            : <XCircle size={18} strokeWidth={2.25} className="mt-0.5 shrink-0" />}
          <p className="min-w-0 flex-1 text-sm font-semibold">{t.message}</p>
          {t.actionLabel && t.onAction && (
            <button
              type="button"
              onClick={() => { t.onAction?.(); dismissToast(t.id) }}
              className="shrink-0 text-sm font-bold underline underline-offset-2 opacity-90 transition-opacity hover:opacity-100"
            >
              {t.actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="알림 닫기"
            className="shrink-0 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}

export default Toast
