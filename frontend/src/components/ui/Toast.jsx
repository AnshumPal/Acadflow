import { useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'

/** Success message pinned to the bottom of the screen. `onDismiss` must be stable (useCallback). */
export default function Toast({ message, action, onDismiss, duration = action ? 12000 : 6000 }) {
  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [message, duration, onDismiss])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:justify-end"
    >
      {message && (
        <div
          role="status"
          className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-emerald-200/80 bg-white/95 px-4 py-3 text-sm text-slate-800 shadow-glow backdrop-blur motion-safe:animate-fade-up"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <p className="min-w-0 flex-1 leading-relaxed">{message}</p>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              {action.label}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
