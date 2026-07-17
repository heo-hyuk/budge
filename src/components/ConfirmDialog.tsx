import { useConfirmDialogState } from '../contexts/ConfirmContext'

function ConfirmDialog() {
  const { request, respond } = useConfirmDialogState()

  if (!request) return null

  return (
    <div
      role="presentation"
      onClick={() => respond(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-xl"
      >
        <p className="whitespace-pre-line text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          {request.message}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => respond(false)}
            className="min-h-10 flex-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            취소
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => respond(true)}
            className="min-h-10 flex-1 rounded-xl bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
