import { Keyboard, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useAppStore } from '../state/store'
import { Kbd } from '../components/ui'
import { useUiStore } from './uiStore'

/**
 * Global keyboard shortcuts. Ignored while typing in a field and when a modifier key is held.
 * Esc never fights an open popover, drawer or modal: those close first (they own Esc).
 */
function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function isActivatable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el) return false
  if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SUMMARY') return true
  const role = el.getAttribute?.('role')
  return !!role && ['button', 'switch', 'radio', 'checkbox', 'option', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'slider'].includes(role)
}

export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (isTyping(e.target)) return
      const ui = useUiStore.getState()
      const app = useAppStore.getState()
      const key = e.key
      if (key === 'Escape') {
        if (ui.tour.active || ui.shortcutsOpen) return
        if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return
        if (app.selectedRegion) {
          app.selectRegion(null)
          app.selectMetric(null)
        }
        return
      }
      if (ui.shortcutsOpen && key !== '?') return
      if (key >= '1' && key <= '9') {
        const a = app.crew[Number(key) - 1]
        if (a) app.selectAstronaut(a.id)
        return
      }
      switch (key) {
        case 'a':
        case 'A':
          ui.setAlertsOpen(!ui.alertsOpen)
          break
        case 'p':
        case 'P':
          ui.togglePresentation()
          break
        case 'v':
        case 'V':
          ui.toggleViewMode()
          break
        case '?':
          ui.setShortcutsOpen(!ui.shortcutsOpen)
          break
        case ' ':
          if (isActivatable(e.target)) return
          e.preventDefault()
          if (app.clock.running) app.pause()
          else app.play()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['1', '2', '3', '4'], label: 'Select crew member' },
  { keys: ['V'], label: 'Switch Ground / Crew view' },
  { keys: ['P'], label: 'Presentation mode (also in Tools)' },
  { keys: ['A'], label: 'Open or close alerts' },
  { keys: ['Space'], label: 'Play or pause the simulation' },
  { keys: ['Esc'], label: 'Close a panel, or back from body detail' },
  { keys: ['?'], label: 'Show this help' },
  { keys: ['←', '→'], label: 'Previous / next step in the guided demo' },
]

export function ShortcutsOverlay() {
  const open = useUiStore((s) => s.shortcutsOpen)
  const setOpen = useUiStore((s) => s.setShortcutsOpen)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    // Return focus to whatever opened the overlay (Tools menu button, or the page for the ? key).
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener && opener !== document.body && document.contains(opener)) opener.focus()
    }
  }, [open, setOpen])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-space-950/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="glass-strong animate-drop-in relative w-[min(440px,100%)] rounded-2xl p-5 outline-none">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-100">
            <Keyboard size={17} className="text-accent" aria-hidden /> Keyboard shortcuts
          </h2>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="focus-ring rounded-lg p-1 text-ink-500 hover:text-ink-100">
            <X size={16} />
          </button>
        </div>
        <ul className="mt-4 flex flex-col gap-1">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[13px] text-ink-300 odd:bg-white/[0.025]">
              <span>{s.label}</span>
              <span className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-ink-500">Shortcuts are ignored while you type in a field.</p>
      </div>
    </div>
  )
}
