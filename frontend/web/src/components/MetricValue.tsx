import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { NO_VALUE } from './format'

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Live numeric value with a short tween between updates.
 * Writes straight to the DOM in rAF so tweening never re-renders React trees.
 */
export function MetricValue({ value, decimals, className, duration = 380 }: { value: number | null | undefined; decimals: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (ref.current && ref.current.textContent === '') {
      ref.current.textContent = value == null ? NO_VALUE : value.toFixed(decimals)
      shown.current = value ?? null
    }
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (value == null || !Number.isFinite(value)) {
      shown.current = null
      el.textContent = NO_VALUE
      return
    }
    const from = shown.current
    const snap = () => {
      shown.current = value
      el.textContent = value.toFixed(decimals)
    }
    // Snap (no tween) when: first value, reduced motion, no visible change, or the page is hidden
    // (rAF is paused in background tabs and a monitoring display must never show a stale number).
    if (from == null || reducedMotion() || document.hidden || Math.abs(from - value) < Math.pow(10, -decimals) / 2) {
      snap()
      return
    }
    // Use the rAF clock for both ends and clamp progress to [0, 1]. A rAF timestamp can be
    // earlier than performance.now() taken here; a negative k would overshoot away from the
    // target and, with updates faster than the tween, diverge.
    let start = -1
    let raf = 0
    const step = (now: number) => {
      if (start < 0) start = now
      const k = Math.max(0, Math.min(1, (now - start) / duration))
      const e = 1 - Math.pow(1 - k, 3)
      const v = from + (value - from) * e
      shown.current = v
      el.textContent = v.toFixed(decimals)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    // Safety net: if rAF is throttled or paused, land on the true value anyway.
    const fallback = window.setTimeout(snap, duration + 120)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(fallback)
      // Superseded before a single frame ran: rAF is paused, so show this target now instead of
      // letting the next tween start from a stale number (updates arrive faster than the tween).
      if (start < 0) snap()
    }
  }, [value, decimals, duration])

  return <span ref={ref} className={clsx('tabular', className)} />
}
