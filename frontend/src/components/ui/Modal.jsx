import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-xl',
  xl: 'sm:max-w-3xl',
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog shell for AcadFlow modals. Esc and the backdrop close it, Tab stays inside it, focus
 * returns to the trigger on close and the page behind stops scrolling. Renders as a bottom sheet
 * on phones and as a centred card from `sm` up. Put `data-autofocus` on the field to focus first.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  iconClassName = 'bg-indigo-100 text-indigo-700',
  size = 'md',
  dismissible = true,
  footer,
  children,
}) {
  const panelRef = useRef(null)
  const bodyRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  // Read the latest values from the keydown handler without re-running the open/close effect.
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  onCloseRef.current = onClose
  dismissibleRef.current = dismissible

  useEffect(() => {
    if (!open) return undefined
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const initial =
      panel?.querySelector('[data-autofocus]') || bodyRef.current?.querySelector(FOCUSABLE) || panel
    initial?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (dismissibleRef.current) onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-hidden
        onClick={() => dismissible && onClose?.()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-slate-200/80 bg-white shadow-2xl outline-none ring-1 ring-slate-900/[0.04] motion-safe:animate-fade-up sm:rounded-3xl ${SIZES[size] ?? SIZES.md}`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-7 sm:pt-7">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-sm text-slate-500">
                  {description}
                </p>
              )}
            </div>
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-7">
          {children}
        </div>

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
