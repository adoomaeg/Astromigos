import clsx from 'clsx'
import { ChevronDown, ClipboardCheck, Keyboard, LayoutDashboard, Presentation, RotateCcw, UserRound, Wrench } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { useUiStore } from '../../app/uiStore'
import { useDismiss } from '../../components/ui'
import { MissionOverviewButton } from '../mission'
import { HandoverReportButton } from '../report'
import { DataSourcesButton } from '../datasources'
import { MedicalHistoryButton } from '../medicalhistory'
import { useCaseTrackerStore } from '../casetracker/store'
import { useAppStore } from '../../state/store'
import { useActions } from '../shared/hooks'
import { MENU_ITEM, MenuKey, MenuRow } from './menu'

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'

function Switch({ on }: { on: boolean }) {
  return (
    <span className={clsx('relative h-[18px] w-8 shrink-0 rounded-full transition-colors', on ? 'bg-accent' : 'bg-white/15')} aria-hidden>
      <span className={clsx('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all', on ? 'left-[16px]' : 'left-[2px]')} />
    </span>
  )
}

const Separator = () => <div role="separator" className="mx-2 my-1 h-px bg-white/[0.07]" />

const GroupLabel = ({ children }: { children: string }) => (
  <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase" aria-hidden>
    {children}
  </div>
)

/**
 * Tools menu button (WAI-ARIA menu button pattern): Enter, Space or ArrowDown open it on the
 * first item, ArrowUp on the last; arrows, Home and End move; Esc or Tab close it; focus returns
 * to the button. The menu stays mounted while closed (just hidden) so the feature buttons inside
 * keep their dialogs open after the menu closes.
 *
 * When the bar is short of room it also hosts items moved out of the bar (restart, view toggle).
 */
export function ToolsMenu({ showLabel, withRestart, withView }: { showLabel: boolean; withRestart: boolean; withView: boolean }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<'first' | 'last' | null>(null)
  const presentation = useUiStore((s) => s.presentation)
  const togglePresentation = useUiStore((s) => s.togglePresentation)
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)
  const viewMode = useUiStore((s) => s.viewMode)
  const setViewMode = useUiStore((s) => s.setViewMode)
  const { reset } = useActions()
  const selectedId = useAppStore((s) => s.selectedAstronautId)
  const openCaseTracker = useCaseTrackerStore((s) => s.open)

  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])]

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) btn.current?.focus()
  }, [])
  useDismiss(open, () => close(false), [menu, btn])

  const openAt = (where: 'first' | 'last') => {
    pendingFocus.current = where
    setOpen(true)
  }

  useEffect(() => {
    if (!open || !pendingFocus.current) return
    const list = items()
    const target = pendingFocus.current === 'last' ? list[list.length - 1] : list[0]
    pendingFocus.current = null
    target?.focus()
  }, [open])

  const onButtonKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openAt(e.key === 'ArrowUp' ? 'last' : 'first')
    }
  }

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = items()
    const i = list.indexOf(document.activeElement as HTMLElement)
    const move = (to: number) => {
      e.preventDefault()
      list[(to + list.length) % list.length]?.focus()
    }
    switch (e.key) {
      case 'ArrowDown':
        return move(i + 1)
      case 'ArrowUp':
        return move(i < 0 ? list.length - 1 : i - 1)
      case 'Home':
        return move(0)
      case 'End':
        return move(list.length - 1)
      case 'Escape':
        // Handled here: keeps the global Esc shortcut (back from body detail) from also firing.
        e.preventDefault()
        e.stopPropagation()
        return close(true)
      case 'Tab':
        return close(false)
    }
  }

  // Any activated item closes the menu. Focus goes back to the button first, so dialogs opened by
  // the item return focus there when they close.
  const onMenuClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(ITEM_SELECTOR)) close(true)
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={btn}
        type="button"
        data-tour="tools"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="ahi-tools-menu"
        aria-label="Tools: mission overview, medical history, case tracker, shift handover, data and model, presentation mode, shortcuts"
        title="Tools: mission overview, medical history, case tracker, shift handover, data and model, presentation mode, shortcuts"
        onClick={() => (open ? close(false) : openAt('first'))}
        onKeyDown={onButtonKey}
        className={clsx(
          'focus-ring flex h-9 shrink-0 items-center gap-1.5 rounded-xl text-xs font-semibold transition-colors',
          showLabel ? 'px-3' : 'px-2.5',
          open ? 'bg-white/[0.08] text-ink-100 ring-1 ring-white/15' : 'text-ink-300 ring-1 ring-white/[0.08] hover:bg-white/[0.06] hover:text-ink-100',
        )}
      >
        <Wrench size={15} className="text-accent" aria-hidden />
        {showLabel && <span className="whitespace-nowrap">Tools</span>}
        <ChevronDown size={13} className={clsx('text-ink-500 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <div
        ref={menu}
        id="ahi-tools-menu"
        role="menu"
        aria-label="Tools"
        aria-hidden={!open}
        onKeyDown={onMenuKey}
        onClick={onMenuClick}
        className={clsx('glass-strong animate-fade-in absolute top-full right-0 z-50 mt-2 w-[320px] flex-col rounded-2xl p-1.5', open ? 'flex' : 'hidden')}
      >
        <GroupLabel>Mission tools</GroupLabel>
        <MissionOverviewButton variant="menuitem" />
        <MedicalHistoryButton astronautId={selectedId} menuitem />
        <button type="button" role="menuitem" tabIndex={-1} aria-haspopup="dialog" onClick={() => openCaseTracker(selectedId)} className={MENU_ITEM}>
          <MenuRow icon={<ClipboardCheck size={15} />} label="Problem & follow-up tracker" hint="Suggested steps, logged actions, and case review" />
        </button>
        <HandoverReportButton variant="menuitem" />
        <DataSourcesButton variant="menuitem" />
        {(withRestart || withView) && <Separator />}
        {withRestart && (
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => reset()} className={MENU_ITEM}>
            <MenuRow icon={<RotateCcw size={15} />} label="Restart scenario" hint="Start the current scenario again" />
          </button>
        )}
        {withView &&
          (
            [
              { id: 'ground', label: 'Ground view', hint: 'Flight surgeon and mission control, whole crew', icon: LayoutDashboard },
              { id: 'crew', label: 'Crew view', hint: 'One astronaut, plain language', icon: UserRound },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              role="menuitemradio"
              aria-checked={viewMode === v.id}
              tabIndex={-1}
              onClick={() => setViewMode(v.id)}
              className={MENU_ITEM}
            >
              <MenuRow icon={<v.icon size={15} />} label={v.label} hint={v.hint} right={viewMode === v.id ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden /> : <MenuKey k="V" />} />
            </button>
          ))}
        <Separator />
        <GroupLabel>Display</GroupLabel>
        <button type="button" role="menuitemcheckbox" aria-checked={presentation} tabIndex={-1} onClick={togglePresentation} className={MENU_ITEM}>
          <MenuRow
            icon={<Presentation size={15} />}
            label="Presentation mode"
            hint={presentation ? 'On: larger text, fewer details' : 'Larger text, fewer details (P)'}
            right={<Switch on={presentation} />}
          />
        </button>
        <button type="button" role="menuitem" tabIndex={-1} aria-haspopup="dialog" onClick={() => setShortcutsOpen(true)} className={MENU_ITEM}>
          <MenuRow icon={<Keyboard size={15} />} label="Keyboard shortcuts" hint="All keys at a glance" right={<MenuKey k="?" />} />
        </button>
      </div>
    </div>
  )
}
