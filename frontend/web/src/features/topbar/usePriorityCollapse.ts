import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * Measurement based priority collapse for the top bar.
 *
 * The bar is split in zones, each wrapping its controls in a `w-max` element, so the zone's
 * width is its natural (unclipped) width. `level` counts how many collapse steps are applied
 * (0 = everything expanded). After every render the hook measures what the zones need against
 * what the bar offers and moves one step up (too wide) or tries one step down (room again).
 * Widths seen at each level are cached so growing the window does not flicker; when content
 * changes at the same level (presentation mode, a longer label, fonts loading) the cache is
 * dropped and the levels are re-tested. Layout effects run before paint, so the user never
 * sees an overflowing frame on render driven changes; resize driven changes are applied in
 * the next animation frame.
 */
export function usePriorityCollapse(maxLevel: number, zoneCount: number) {
  const barRef = useRef<HTMLElement>(null)
  const zoneRefs = useRef<(HTMLElement | null)[]>([])
  const [level, setLevel] = useState(0)
  const levelRef = useRef(0)
  const widths = useRef(new Map<number, number>())

  const measure = useCallback((): { need: number; avail: number } | null => {
    const bar = barRef.current
    if (!bar) return null
    const cs = getComputedStyle(bar)
    const avail = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const gap = parseFloat(cs.columnGap) || 0
    let need = gap * Math.max(0, zoneCount - 1)
    for (let i = 0; i < zoneCount; i++) need += zoneRefs.current[i]?.getBoundingClientRect().width ?? 0
    return { need, avail }
  }, [zoneCount])

  const decide = useCallback(
    (lvl: number): number => {
      const m = measure()
      if (!m) return lvl
      widths.current.set(lvl, m.need)
      // 1 px tolerance for sub pixel rounding at browser zoom levels.
      if (m.need > m.avail + 0.5) return Math.min(maxLevel, lvl + 1)
      if (lvl > 0) {
        const below = widths.current.get(lvl - 1)
        // Unknown: try it (verified on the next layout pass). Known: step down only with a small margin (hysteresis).
        if (below === undefined || below <= m.avail - 2) return lvl - 1
      }
      return lvl
    },
    [measure, maxLevel],
  )

  useLayoutEffect(() => {
    levelRef.current = level
    const next = decide(level)
    if (next !== level) setLevel(next)
  }, [level, decide])

  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar || typeof ResizeObserver === 'undefined') return
    let raf = 0
    let timer = 0
    const run = () => {
      if (raf) cancelAnimationFrame(raf)
      if (timer) window.clearTimeout(timer)
      raf = 0
      timer = 0
      const lvl = levelRef.current
      const m = measure()
      const known = widths.current.get(lvl)
      // Same level but different width: the content changed, cached widths of other levels are stale.
      if (m && known !== undefined && Math.abs(known - m.need) > 1) widths.current.clear()
      const next = decide(lvl)
      if (next !== lvl) flushSync(() => setLevel(next))
    }
    // The bar itself resized (window, zoom): apply right away, so no overflowing frame is painted.
    // That is safe because a level change only resizes the zones, which sit deeper in the tree.
    // Zone only changes (content) are deferred to the next frame: resizing a zone from inside
    // the observer callback would trigger "ResizeObserver loop" warnings. The timer is a fallback
    // for hidden or background pages, where animation frames are paused.
    const ro = new ResizeObserver((entries) => {
      if (entries.some((e) => e.target === bar)) {
        run()
        return
      }
      if (raf || timer) return
      raf = requestAnimationFrame(run)
      timer = window.setTimeout(run, 60)
    })
    ro.observe(bar)
    for (let i = 0; i < zoneCount; i++) {
      const z = zoneRefs.current[i]
      if (z) ro.observe(z)
    }
    return () => {
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
      if (timer) window.clearTimeout(timer)
    }
  }, [measure, decide, zoneCount])

  // Stable ref callbacks, one per zone.
  const zoneSetters = useMemo(
    () =>
      Array.from({ length: zoneCount }, (_, i) => (el: HTMLElement | null) => {
        zoneRefs.current[i] = el
      }),
    [zoneCount],
  )

  return { barRef, zoneSetters, level }
}
