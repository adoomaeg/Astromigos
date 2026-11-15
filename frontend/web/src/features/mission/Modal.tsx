import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from '../../components/ui'

/**
 * Centered modal dialog shared by the v2 feature buttons (mission overview, handover report,
 * check-in, what-if). Portaled to <body>, closes on Escape and scrim click, restores focus
 * to the element that opened it. The simulation keeps running underneath.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'md',
  hostClassName,
  headerExtra,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Extra class on the portal host (used by the print stylesheet of the handover report). */
  hostClassName?: string
  headerExtra?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key === 'Tab' && panelRef.current) {
        // Keep keyboard focus inside the dialog.
        const items = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])')
        if (items.length === 0) return
        const first = items[0]!
        const last = items[items.length - 1]!
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [open])
  if (!open) return null
  return createPortal(
    <div className={clsx('ahi-modal-host fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6', hostClassName)}>
      <div className="ahi-modal-scrim animate-fade-in absolute inset-0 bg-space-950/65 backdrop-blur-[3px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'ahi-modal-panel glass-strong animate-drop-in relative flex max-h-full w-full flex-col rounded-2xl outline-none',
          size === 'sm' && 'max-w-[440px]',
          size === 'md' && 'max-w-[600px]',
          size === 'lg' && 'max-w-[860px]',
          size === 'xl' && 'max-w-[1180px]',
        )}
      >
        <header className="ahi-no-print flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink-100">
              {icon}
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-xs text-ink-500">{subtitle}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerExtra}
            <IconButton label="Close" onClick={onClose} size="sm">
              <X size={16} />
            </IconButton>
          </div>
        </header>
        <div className="ahi-modal-body min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="ahi-no-print border-t border-white/[0.07] px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

/** Top bar trigger style shared by the v2 buttons, matching the existing top bar controls. */
export const TOPBAR_BUTTON =
  'focus-ring flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-300 ring-1 ring-white/[0.07] transition-colors hover:bg-white/[0.05] hover:text-ink-100'
