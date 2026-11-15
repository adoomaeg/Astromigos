import clsx from 'clsx'
import { X } from 'lucide-react'
import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/**
 * Shared panel header row: same height, padding and type for every top level panel
 * (Crew, the stage headline row, What needs attention) so their titles sit on one baseline.
 */
export const PANEL_HEADER = 'panel-heading flex h-10 shrink-0 items-center justify-between gap-2 px-4 pt-1'
export const PANEL_TITLE = 'flex min-w-0 items-center gap-2 text-[11px] leading-none font-semibold tracking-[0.14em] whitespace-nowrap text-ink-500 uppercase'

/** Glass panel with optional header. */
export function Panel({
  title,
  icon,
  actions,
  children,
  className,
  bodyClassName,
  as: Tag = 'section',
  ariaLabel,
  tourId,
}: {
  title?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  as?: 'section' | 'aside' | 'div' | 'nav'
  ariaLabel?: string
  /** Anchor name for the guided demo tour (data-tour). */
  tourId?: string
}) {
  return (
    <Tag aria-label={ariaLabel} data-tour={tourId} className={clsx('glass flex min-h-0 flex-col rounded-2xl', className)}>
      {(title || actions) && (
        <header className={PANEL_HEADER}>
          <h2 className={PANEL_TITLE}>
            {icon}
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className={clsx('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </Tag>
  )
}

/** Small section label used inside panels. */
export function SectionLabel({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-center justify-between gap-2', className)}>
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">{children}</h3>
      {right}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
  title,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'sim' | 'warn' | 'muted'
  icon?: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase',
        tone === 'neutral' && 'bg-white/[0.06] text-ink-300 ring-1 ring-white/10',
        tone === 'muted' && 'bg-white/[0.03] text-ink-500 ring-1 ring-white/[0.06]',
        tone === 'accent' && 'bg-accent/10 text-accent ring-1 ring-accent/25',
        tone === 'sim' && 'bg-violet-400/10 text-violet-200 ring-1 ring-violet-300/30',
        tone === 'warn' && 'bg-amber-400/10 text-amber-200 ring-1 ring-amber-300/30',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; size?: 'sm' | 'md' }

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'focus-ring relative inline-flex shrink-0 items-center justify-center rounded-xl text-ink-300 transition-colors',
        'hover:bg-white/[0.07] hover:text-ink-100 disabled:opacity-40',
        size === 'md' ? 'h-9 w-9' : 'h-7 w-7',
        active ? 'bg-white/[0.08] text-ink-100 ring-1 ring-white/15' : 'ring-1 ring-white/[0.06]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

export function Button({
  children,
  variant = 'ghost',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'subtle' | 'danger' }) {
  return (
    <button
      type="button"
      className={clsx(
        'focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-space-950 hover:bg-accent-strong',
        variant === 'ghost' && 'text-ink-300 ring-1 ring-white/10 hover:bg-white/[0.06] hover:text-ink-100',
        variant === 'subtle' && 'text-ink-500 hover:bg-white/[0.05] hover:text-ink-100',
        variant === 'danger' && 'bg-critical text-white hover:bg-rose-600',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Closes on Escape and outside pointer down. */
export function useDismiss(open: boolean, onClose: () => void, refs: RefObject<HTMLElement | null>[]) {
  const cb = useRef(onClose)
  useEffect(() => {
    cb.current = onClose
  }, [onClose])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cb.current()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (refs.some((r) => r.current?.contains(t))) return
      cb.current()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])
}

/** Anchored popover. The trigger owns the open state. */
export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  align = 'right',
  side = 'bottom',
  className,
  label,
}: {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  align?: 'left' | 'right'
  side?: 'bottom' | 'top'
  className?: string
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(open, onClose, [ref, anchorRef])
  if (!open) return null
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={clsx(
        'glass-strong animate-fade-in absolute z-50 rounded-2xl',
        side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Right side drawer with scrim. Non-modal for the rest of the app state (simulation keeps running). */
export function Drawer({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="animate-fade-in absolute inset-0 bg-space-950/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass-strong animate-slide-in absolute top-3 right-3 bottom-3 flex w-[min(440px,calc(100vw-24px))] flex-col rounded-2xl outline-none"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-100">
            {icon}
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} size="sm">
            <X size={16} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-white/[0.07] px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

/**
 * Popover rendered in a portal with fixed positioning, so scroll containers and
 * overflow-hidden panels never clip it. Flips above/below and clamps to the viewport.
 */
export function FloatingPopover({
  open,
  onClose,
  anchorRef,
  children,
  className,
  label,
  width = 320,
  prefer = 'bottom',
}: {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  className?: string
  label: string
  width?: number
  prefer?: 'bottom' | 'top'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; side: 'top' | 'bottom' } | null>(null)
  useDismiss(open, onClose, [ref, anchorRef])
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect()
      const h = ref.current?.offsetHeight ?? 160
      if (!a) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const left = Math.min(Math.max(8, a.left + a.width / 2 - width / 2), vw - width - 8)
      const roomBelow = vh - a.bottom
      const roomAbove = a.top
      const side: 'top' | 'bottom' = prefer === 'top' ? (roomAbove >= h + 12 || roomAbove > roomBelow ? 'top' : 'bottom') : roomBelow >= h + 12 || roomBelow > roomAbove ? 'bottom' : 'top'
      const top = side === 'bottom' ? Math.min(a.bottom + 8, vh - h - 8) : Math.max(8, a.top - h - 8)
      setPos({ left, top, side })
    }
    place()
    const raf = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchorRef, width, prefer])
  if (!open) return null
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      // Portal content still bubbles through the React tree: keep clicks from reaching the trigger's parents.
      onClick={(e) => e.stopPropagation()}
      className={clsx('glass-strong animate-fade-in fixed z-[80] rounded-2xl', className)}
      style={{ width, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
    >
      {children}
    </div>,
    document.body,
  )
}

/** Keyboard key glyph. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}
