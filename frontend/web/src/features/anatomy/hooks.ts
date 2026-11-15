/** Small DOM hooks shared by the atlas viewer and the procedural fallback. */
import { useEffect, useState } from 'react'

/** Width of an element, tracked with a ResizeObserver (0 until measured). */
export function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [ref])
  return w
}

/** true while the app runs in presentation mode (<html data-present="true">). */
export function usePresentationMode(): boolean {
  const read = () => typeof document !== 'undefined' && document.documentElement.dataset.present === 'true'
  const [on, setOn] = useState(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setOn(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-present'] })
    return () => obs.disconnect()
  }, [])
  return on
}

/** Closes a popover on Escape or on a pointer press outside of `ref`. */
export function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, close])
}
