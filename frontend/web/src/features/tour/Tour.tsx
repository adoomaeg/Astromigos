import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Check, Pause, Play, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useUiStore } from '../../app/uiStore'
import { Kbd } from '../../components/ui'
import { TOUR_STEPS, restoreAfterTour } from './steps'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 6
const CARD_W = 380
const GAP = 16

function findAnchor(anchors: string[]): HTMLElement | null {
  for (const a of anchors) {
    const els = document.querySelectorAll<HTMLElement>(`[data-tour="${a}"]`)
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  }
  return null
}

function sameRect(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b
  return Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1
}

/** Card placement next to the spotlight: right, left, below, above, else floating bottom center. */
function placeCard(r: Rect | null, cardH: number): { left: number; top: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampX = (x: number) => Math.min(Math.max(12, x), vw - CARD_W - 12)
  const clampY = (y: number) => Math.min(Math.max(12, y), vh - cardH - 12)
  if (!r) return { left: (vw - CARD_W) / 2, top: Math.max(12, (vh - cardH) / 2) }
  const midY = r.top + r.height / 2 - cardH / 2
  const midX = clampX(r.left + r.width / 2 - CARD_W / 2)
  const below = () => (r.top + r.height + GAP + cardH <= vh - 12 ? { left: midX, top: r.top + r.height + GAP } : null)
  const above = () => (r.top - GAP - cardH >= 12 ? { left: midX, top: r.top - GAP - cardH } : null)
  const right = () => (r.left + r.width + GAP + CARD_W <= vw - 12 && r.width < vw * 0.6 ? { left: r.left + r.width + GAP, top: clampY(midY) } : null)
  const left = () => (r.left - GAP - CARD_W >= 12 && r.width < vw * 0.6 ? { left: r.left - GAP - CARD_W, top: clampY(midY) } : null)
  // Short, wide anchors (top bar controls, banners, strips) read best with the card below or above.
  const order = r.height < 160 ? [below, above, right, left] : [right, left, below, above]
  // Never hide the 3D body (the main visual) unless the step is about the body itself.
  const body = document.querySelector('[data-tour="body"]')?.getBoundingClientRect()
  // The spotlight rect is padded, so compare with a tolerance.
  const anchorIsBody = !!body && Math.abs(body.top - r.top) < 24 && Math.abs(body.left - r.left) < 24 && Math.abs(body.width - r.width) < 48
  const coversBody = (p: { left: number; top: number }) =>
    !!body && !anchorIsBody && p.left < body.right - 40 && p.left + CARD_W > body.left + 40 && p.top < body.bottom - 40 && p.top + cardH > body.top + 40
  const candidates = order.map((f) => f()).filter((p): p is { left: number; top: number } => !!p)
  const clear = candidates.find((p) => !coversBody(p))
  if (clear) return clear
  // Fallback: tuck the card in the bottom right corner, clear of the center stage.
  const corner = { left: clampX(vw - CARD_W - 24), top: clampY(vh - cardH - 24) }
  if (!coversBody(corner)) return corner
  return candidates[0] ?? corner
}

export function Tour() {
  const tour = useUiStore((s) => s.tour)
  const setTourStep = useUiStore((s) => s.setTourStep)
  const setTourAutoplay = useUiStore((s) => s.setTourAutoplay)
  const endTour = useUiStore((s) => s.endTour)
  const setViewMode = useUiStore((s) => s.setViewMode)
  const [rect, setRect] = useState<Rect | null>(null)
  const [cardH, setCardH] = useState(220)
  const cardRef = useRef<HTMLDivElement>(null)
  const total = TOUR_STEPS.length
  const step = TOUR_STEPS[Math.min(tour.step, total - 1)]!
  const last = tour.step >= total - 1

  const exit = useCallback(() => {
    restoreAfterTour()
    endTour()
  }, [endTour])
  const go = useCallback(
    (i: number) => {
      if (i < 0) return
      if (i >= total) {
        exit()
        return
      }
      setTourStep(i)
    },
    [total, exit, setTourStep],
  )

  // Scene setup on entering a step.
  useEffect(() => {
    if (!tour.active) return
    setViewMode(step.view)
    step.setup?.()
  }, [tour.active, tour.step, step, setViewMode])

  // Track the anchor every frame: layouts shift (banner appears, view switches, panels load).
  useEffect(() => {
    if (!tour.active) return
    let raf = 0
    let prev: Rect | null = null
    let scrolled = false
    const loop = () => {
      const el = findAnchor(step.anchors)
      let next: Rect | null = null
      if (el) {
        const r = el.getBoundingClientRect()
        if (!scrolled && (r.bottom > window.innerHeight || r.top < 0)) {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          scrolled = true
        }
        const top = Math.max(4, r.top - PAD)
        const left = Math.max(4, r.left - PAD)
        next = { top, left, width: Math.min(window.innerWidth - 4, r.right + PAD) - left, height: Math.min(window.innerHeight - 4, r.bottom + PAD) - top }
      }
      if (!sameRect(prev, next)) {
        prev = next
        setRect(next)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [tour.active, step])

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
  }, [tour.step, tour.active, rect])

  // Keyboard: arrows move, Esc exits. Ignored while typing.
  useEffect(() => {
    if (!tour.active) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(tour.step + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(tour.step - 1)
      } else if (e.key === 'Escape') {
        // Let an open popover or drawer close first.
        const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter((d) => !cardRef.current?.contains(d) && d !== cardRef.current)
        if (dialogs.length) return
        exit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tour.active, tour.step, go, exit])

  // Auto-play.
  useEffect(() => {
    if (!tour.active || !tour.autoplay) return
    if (last) {
      setTourAutoplay(false)
      return
    }
    const id = window.setTimeout(() => go(tour.step + 1), step.durationMs)
    return () => window.clearTimeout(id)
  }, [tour.active, tour.autoplay, tour.step, last, step, go, setTourAutoplay])

  useEffect(() => {
    if (tour.active) cardRef.current?.focus({ preventScroll: true })
  }, [tour.active])

  if (!tour.active) return null
  const pos = placeCard(rect, cardH)

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-live="polite">
      {rect ? (
        <div className="tour-spotlight" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden />
      ) : (
        <div className="animate-fade-in absolute inset-0 bg-space-950/60" aria-hidden />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Guided demo, step ${tour.step + 1} of ${total}: ${step.title}`}
        tabIndex={-1}
        className="glass-strong pointer-events-auto fixed rounded-2xl p-5 outline-none"
        style={{ width: CARD_W, left: pos.left, top: pos.top, transition: 'left 320ms cubic-bezier(0.2,0.8,0.2,1), top 320ms cubic-bezier(0.2,0.8,0.2,1)', boxShadow: '0 0 0 1px rgba(94,234,212,0.25), 0 30px 80px -20px rgba(0,0,0,0.85)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">
            Guided demo <span className="tabular text-ink-500">{tour.step + 1} / {total}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTourAutoplay(!tour.autoplay)}
              aria-pressed={tour.autoplay}
              title={tour.autoplay ? 'Pause auto-play' : 'Auto-play: advance every few seconds'}
              className={clsx(
                'focus-ring flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ring-1 transition-colors',
                tour.autoplay ? 'bg-accent/15 text-accent ring-accent/35' : 'text-ink-300 ring-white/10 hover:bg-white/[0.06]',
              )}
            >
              {tour.autoplay ? <Pause size={12} aria-hidden /> : <Play size={12} aria-hidden />}
              Auto
            </button>
            <button type="button" onClick={exit} aria-label="Exit demo (Esc)" title="Exit demo (Esc)" className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-white/[0.06] hover:text-ink-100">
              <X size={15} />
            </button>
          </div>
        </div>
        <div key={tour.step} className="animate-fade-in">
          <h2 className="mt-2.5 text-[19px] leading-tight font-semibold text-ink-100">{step.title}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-300">{step.caption}</p>
          {step.hint && <p className="mt-2 text-[13px] leading-snug font-medium text-accent">{step.hint}</p>}
        </div>
        {tour.autoplay && !last && (
          <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
            <div key={`bar-${tour.step}`} className="h-full w-full origin-left rounded-full bg-accent/70" style={{ animation: `tour-progress ${step.durationMs}ms linear forwards` }} />
          </div>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Demo steps">
            {TOUR_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === tour.step}
                aria-label={`Step ${i + 1}: ${s.title}`}
                title={s.title}
                onClick={() => go(i)}
                className={clsx('focus-ring h-2 rounded-full transition-all', i === tour.step ? 'w-5 bg-accent' : i < tour.step ? 'w-2 bg-accent/45 hover:bg-accent/70' : 'w-2 bg-white/15 hover:bg-white/30')}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => go(tour.step - 1)}
              disabled={tour.step === 0}
              className="focus-ring flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-ink-300 ring-1 ring-white/10 hover:bg-white/[0.06] hover:text-ink-100 disabled:opacity-35"
            >
              <ArrowLeft size={14} aria-hidden /> Back
            </button>
            <button
              type="button"
              onClick={() => go(tour.step + 1)}
              className="focus-ring flex h-9 items-center gap-1 rounded-xl bg-accent px-3.5 text-xs font-semibold text-space-950 hover:bg-accent-strong"
            >
              {last ? (
                <>
                  Finish <Check size={14} strokeWidth={3} aria-hidden />
                </>
              ) : (
                <>
                  Next <ArrowRight size={14} aria-hidden />
                </>
              )}
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-500 present:hidden">
          <Kbd>←</Kbd>
          <Kbd>→</Kbd> to move, <Kbd>Esc</Kbd> to exit. Exiting resets to a nominal day.
        </div>
      </div>
    </div>
  )
}
