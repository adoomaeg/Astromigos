import clsx from 'clsx'
import { BellRing, Check, ChevronDown, Eye, History, OctagonAlert, Siren, Volume2, VolumeX, X } from 'lucide-react'
import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useAppStore } from '../../state/store'
import { RISK_ORDER, STATUS_META } from '../../lib/status'
import type { Alert, AuditEvent, RiskLevel } from '../../types/domain'
import { METRIC_CATALOG, REGION_LABELS } from '../../engine/catalog'
import { StatusIcon, StatusPill } from '../../components/Status'
import { Button, Drawer } from '../../components/ui'
import { formatUtcTime, relTime } from '../../components/format'
import { useUiStore } from '../../app/uiStore'
import { focusTarget } from '../shared/hooks'
import { playAlertTone, primeAlertAudio } from './sound'

function useCallsign() {
  const crew = useAppStore((s) => s.crew)
  return (id: string | null) => (id ? (crew.find((c) => c.id === id)?.callsign ?? id) : 'Cabin')
}

function where(a: Alert): string | null {
  if (a.metric) return METRIC_CATALOG[a.metric].label
  if (a.region && a.region !== 'environment') return REGION_LABELS[a.region].label
  if (a.region === 'environment') return 'Cabin environment'
  return null
}

/** Body system the alert belongs to (used to group the drawer). */
function systemOf(a: Alert): string {
  const region = a.region ?? (a.metric ? METRIC_CATALOG[a.metric].region : null)
  if (region === 'environment') return 'Cabin environment'
  if (region) return REGION_LABELS[region].system
  return 'General'
}

const isOpenAlert = (a: Alert) => a.acknowledgedAt == null && a.resolvedAt == null

function minutesText(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** "Unacknowledged for 6 min. Escalated." or null when it is fresh and not escalated. */
export function escalationText(a: Alert, now: number): string | null {
  if (!isOpenAlert(a)) return null
  const level = a.escalationLevel ?? 0
  const age = now - a.createdAt
  if (level > 0) return `Unacknowledged for ${minutesText(age)}. Escalated${level > 1 ? ` (level ${level})` : ''}.`
  if (age >= 2 * 60000) return `Unacknowledged for ${minutesText(age)}.`
  return null
}

function EscalatedBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-critical/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rose-200 uppercase ring-1 ring-critical/40">
      <Siren size={10} aria-hidden /> Escalated{level > 1 ? ` x${level}` : ''}
    </span>
  )
}

function AlertItem({ alert, now, callsign, showWho = true }: { alert: Alert; now: number; callsign: (id: string | null) => string; showWho?: boolean }) {
  const acknowledgeAlert = useAppStore((s) => s.acknowledgeAlert)
  const setAlertsOpen = useUiStore((s) => s.setAlertsOpen)
  const meta = STATUS_META[alert.severity]
  const acked = !isOpenAlert(alert)
  const loc = where(alert)
  const level = alert.escalationLevel ?? 0
  const esc = escalationText(alert, now)
  return (
    <li
      className={clsx('relative overflow-hidden rounded-xl p-3 ring-1', acked ? 'bg-white/[0.02] ring-white/[0.05]' : level > 0 ? 'bg-critical/[0.06] ring-critical/30' : 'bg-white/[0.04] ring-white/[0.08]')}
    >
      {!acked && <span className="absolute top-0 bottom-0 left-0 w-[3px]" style={{ background: meta.color }} aria-hidden />}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <StatusPill status={alert.severity} variant="technical" size="sm" />
          {!acked && level > 0 && <EscalatedBadge level={level} />}
        </span>
        <span className="tabular text-[11px] text-ink-500" title={`${formatUtcTime(alert.createdAt)} UTC (sim)`}>
          {relTime(alert.createdAt, now)} · {formatUtcTime(alert.createdAt, false)}
        </span>
      </div>
      {(showWho || loc) && (
        <div className="mt-1.5 text-[11px] font-semibold tracking-wide text-ink-300">
          {showWho && callsign(alert.astronautId)}
          {loc && (
            <span className="font-normal text-ink-500">
              {showWho ? ' · ' : ''}
              {loc}
            </span>
          )}
        </div>
      )}
      <div className={clsx('mt-0.5 text-[14px] leading-snug font-semibold', acked ? 'text-ink-300' : 'text-ink-100')}>{alert.title}</div>
      {!acked && <p className="mt-1 text-xs leading-relaxed text-ink-300">{alert.detail}</p>}
      {esc && <p className={clsx('mt-1 text-xs font-semibold', level > 0 ? 'text-rose-200' : 'text-watch')}>{esc}</p>}
      {acked ? (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-500">
          <Check size={12} aria-hidden />{' '}
          {alert.acknowledgedAt != null
            ? `Acknowledged by ${alert.acknowledgedBy ?? 'crew'} ${relTime(alert.acknowledgedAt, now)}`
            : `Resolved, back in normal range ${relTime(alert.resolvedAt!, now)}`}
        </div>
      ) : (
        <div className="mt-2.5 flex gap-2">
          <Button variant="primary" onClick={() => acknowledgeAlert(alert.id)}>
            <Check size={13} strokeWidth={3} /> Acknowledge
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              focusTarget({ astronautId: alert.astronautId, region: alert.region, metric: alert.metric })
              setAlertsOpen(false)
            }}
          >
            <Eye size={13} /> View
          </Button>
        </div>
      )}
    </li>
  )
}

interface Group {
  key: string
  astronautId: string | null
  system: string
  worst: RiskLevel
  items: Alert[]
}

function groupAlerts(list: Alert[]): Group[] {
  const map = new Map<string, Group>()
  for (const a of list) {
    const system = systemOf(a)
    const key = `${a.astronautId ?? 'CABIN'}|${system}`
    let g = map.get(key)
    if (!g) {
      g = { key, astronautId: a.astronautId, system, worst: a.severity, items: [] }
      map.set(key, g)
    }
    g.items.push(a)
    if (RISK_ORDER.indexOf(a.severity) > RISK_ORDER.indexOf(g.worst)) g.worst = a.severity
  }
  return [...map.values()].sort((a, b) => RISK_ORDER.indexOf(b.worst) - RISK_ORDER.indexOf(a.worst) || b.items[0]!.createdAt - a.items[0]!.createdAt)
}

function AlertGroup({ group, now, callsign }: { group: Group; now: number; callsign: (id: string | null) => string }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <li>
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
        className="focus-ring mb-1.5 flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-white/[0.03]"
      >
        <StatusIcon status={group.worst} size={14} />
        <span className="text-[13px] font-bold tracking-wide text-ink-100">{callsign(group.astronautId)}</span>
        <span className="truncate text-xs text-ink-500">{group.system}</span>
        <span className="tabular ml-auto rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold text-ink-300">{group.items.length}</span>
        <ChevronDown size={14} className={clsx('shrink-0 text-ink-500 transition-transform', !collapsed && 'rotate-180')} aria-hidden />
      </button>
      {!collapsed && (
        <ul className="flex flex-col gap-2 pl-2">
          {group.items.map((a) => (
            <AlertItem key={a.id} alert={a} now={now} callsign={callsign} showWho={false} />
          ))}
        </ul>
      )}
    </li>
  )
}

function SoundToggle() {
  const soundOn = useUiStore((s) => s.soundOn)
  const setSoundOn = useUiStore((s) => s.setSoundOn)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={soundOn}
      onClick={() => {
        const next = !soundOn
        setSoundOn(next)
        if (next) {
          primeAlertAudio()
          playAlertTone()
        }
      }}
      className={clsx(
        'focus-ring flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs ring-1 transition-colors',
        soundOn ? 'bg-accent/[0.07] text-ink-100 ring-accent/30' : 'bg-white/[0.03] text-ink-300 ring-white/[0.06] hover:bg-white/[0.05]',
      )}
    >
      {soundOn ? <Volume2 size={15} className="text-accent" aria-hidden /> : <VolumeX size={15} className="text-ink-500" aria-hidden />}
      <span className="flex-1">Sound for new critical alerts</span>
      <span className={clsx('relative h-[18px] w-8 rounded-full transition-colors', soundOn ? 'bg-accent' : 'bg-white/15')} aria-hidden>
        <span className={clsx('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all', soundOn ? 'left-[16px]' : 'left-[2px]')} />
      </span>
      <span className="sr-only">{soundOn ? 'On' : 'Off'}</span>
    </button>
  )
}

type AuditAction = AuditEvent['action']
type ShownAction = Exclude<AuditAction, 'RULE_EVALUATED'>

/** Plain labels for the activity log. RULE_EVALUATED is engine bookkeeping and never shown. */
const AUDIT_LABEL: Record<ShownAction, string> = {
  ALERT_ACK: 'Alert acknowledged',
  INTERVENTION_LOGGED: 'Action logged',
  SCENARIO_CHANGED: 'Scenario changed',
  RECOMMENDATION_UPDATED: 'Recommendation updated',
  ALERT_ESCALATED: 'Alert escalated',
  // Both directions use these (crew to Earth and Earth to crew); the detail line says which.
  COMM_SENT: 'Message sent',
  COMM_RECEIVED: 'Message received',
  COMM_PROFILE_CHANGED: 'Earth link changed',
  CHECKIN_RECORDED: 'Check-in recorded',
}

const AUDIT_DOT: Partial<Record<AuditAction, string>> = {
  ALERT_ACK: 'bg-nominal',
  INTERVENTION_LOGGED: 'bg-accent',
  ALERT_ESCALATED: 'bg-critical',
  CHECKIN_RECORDED: 'bg-sky-300',
  COMM_SENT: 'bg-sky-300',
  COMM_RECEIVED: 'bg-sky-300',
}

/** Activity log (audit trail of human actions and notable system events), newest first. */
function ActivityLog({ now }: { now: number }) {
  const audit = useAppStore((s) => s.audit)
  const items = useMemo(() => audit.filter((a) => a.action !== 'RULE_EVALUATED').sort((a, b) => b.at - a.at), [audit])
  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-white/[0.03] px-3 py-3 text-[13px] text-ink-500 ring-1 ring-white/[0.06]">
        Acknowledged alerts, logged actions, check-ins and messages to Earth will appear here.
      </p>
    )
  }
  return (
    <ol className="flex flex-col" aria-label="Activity log, newest first">
      {items.map((a, i) => (
        <li key={a.id} className="relative flex gap-3 pb-3 last:pb-0">
          {i < items.length - 1 && <span className="absolute top-3.5 bottom-0 left-[4px] w-px bg-white/[0.08]" aria-hidden />}
          <span className={clsx('relative mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full ring-2 ring-space-900', AUDIT_DOT[a.action] ?? 'bg-ink-500')} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink-100">{AUDIT_LABEL[a.action as ShownAction] ?? a.action}</span>
              <span className="tabular shrink-0 text-[11px] text-ink-500" title={`${formatUtcTime(a.at)} UTC (sim)`}>
                {formatUtcTime(a.at, false)} · {relTime(a.at, now)}
              </span>
            </div>
            {a.detail && <p className="mt-0.5 text-xs leading-snug break-words text-ink-300">{a.detail}</p>}
            {a.actor && <p className="mt-0.5 text-[11px] text-ink-500">by {a.actor}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

type DrawerTab = 'open' | 'history'

/** Open / History tabs (WAI-ARIA tabs: arrows, Home and End move between them). */
function DrawerTabs({ tab, setTab, openCount }: { tab: DrawerTab; setTab: (t: DrawerTab) => void; openCount: number }) {
  const refs = useRef<Record<DrawerTab, HTMLButtonElement | null>>({ open: null, history: null })
  const tabs: { id: DrawerTab; label: string }[] = [
    { id: 'open', label: `Open (${openCount})` },
    { id: 'history', label: 'History' },
  ]
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    // Keep the guided demo's arrow keys from also firing.
    e.preventDefault()
    e.stopPropagation()
    const next: DrawerTab = e.key === 'Home' ? 'open' : e.key === 'End' ? 'history' : tab === 'open' ? 'history' : 'open'
    setTab(next)
    refs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label="Alerts" onKeyDown={onKey} className="mt-4 flex h-9 items-center gap-0.5 rounded-xl bg-white/[0.035] p-[3px] ring-1 ring-white/[0.08]">
      {tabs.map((t) => {
        const sel = tab === t.id
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el
            }}
            type="button"
            role="tab"
            id={`alerts-tab-${t.id}`}
            aria-selected={sel}
            aria-controls={`alerts-panel-${t.id}`}
            tabIndex={sel ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={clsx(
              'focus-ring flex h-full flex-1 items-center justify-center gap-1.5 rounded-[9px] text-xs font-semibold whitespace-nowrap transition-all',
              sel ? 'bg-accent/[0.14] text-accent shadow-[inset_0_0_0_1px_rgba(94,234,212,0.35)]' : 'text-ink-500 hover:text-ink-100',
            )}
          >
            {t.id === 'history' ? <History size={13} aria-hidden /> : <BellRing size={13} aria-hidden />}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function AlertsDrawer() {
  const open = useUiStore((s) => s.alertsOpen)
  const setAlertsOpen = useUiStore((s) => s.setAlertsOpen)
  const alerts = useAppStore((s) => s.alerts)
  const now = useAppStore((s) => Math.floor(s.clock.simNow / 30000) * 30000)
  const callsign = useCallsign()
  const [showAcked, setShowAcked] = useState(false)
  const [tab, setTab] = useState<DrawerTab>('open')
  const { groups, openCount, ackedList } = useMemo(() => {
    const sorted = [...alerts].sort((a, b) => b.createdAt - a.createdAt)
    const openList = sorted.filter(isOpenAlert)
    return { groups: groupAlerts(openList), openCount: openList.length, ackedList: sorted.filter((a) => !isOpenAlert(a)) }
  }, [alerts])
  const ack = useAppStore((s) => s.acknowledgeAlert)
  return (
    <Drawer
      open={open}
      onClose={() => setAlertsOpen(false)}
      title="Alerts"
      icon={<BellRing size={17} className="text-accent" aria-hidden />}
      footer={
        <div className="flex items-center justify-between gap-2 text-[11px] text-ink-500">
          <span>Decision support only. Not a diagnosis. Simulated data.</span>
          {tab === 'open' && openCount > 1 && (
            <Button variant="subtle" onClick={() => groups.forEach((g) => g.items.forEach((a) => ack(a.id)))}>
              Acknowledge all
            </Button>
          )}
        </div>
      }
    >
      <SoundToggle />
      <DrawerTabs tab={tab} setTab={setTab} openCount={openCount} />
      {tab === 'open' ? (
        <div role="tabpanel" id="alerts-panel-open" aria-labelledby="alerts-tab-open">
          <div className="mt-4 mb-2 flex items-center justify-between text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
            <span>Open ({openCount})</span>
            {groups.length > 1 && <span className="tracking-normal normal-case">by crew member and body system</span>}
          </div>
          {openCount === 0 ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-nominal/[0.06] px-3 py-3 text-[13px] text-ink-300 ring-1 ring-nominal/20">
              <StatusIcon status="LOW" size={16} /> No open alerts.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {groups.map((g) => (
                <AlertGroup key={g.key} group={g} now={now} callsign={callsign} />
              ))}
            </ul>
          )}
          {ackedList.length > 0 && (
            <div className="mt-5">
              <button
                type="button"
                aria-expanded={showAcked}
                onClick={() => setShowAcked((v) => !v)}
                className="focus-ring flex w-full items-center justify-between rounded-lg py-1 text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase hover:text-ink-300"
              >
                Acknowledged or resolved ({ackedList.length})
                <ChevronDown size={14} className={clsx('transition-transform', showAcked && 'rotate-180')} aria-hidden />
              </button>
              {showAcked && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {ackedList.map((a) => (
                    <AlertItem key={a.id} alert={a} now={now} callsign={callsign} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        <div role="tabpanel" id="alerts-panel-history" aria-labelledby="alerts-tab-history">
          <div className="mt-4 mb-3 flex items-center justify-between text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
            <span>Activity log</span>
            <span className="tracking-normal normal-case">newest first</span>
          </div>
          <ActivityLog now={now} />
        </div>
      )}
    </Drawer>
  )
}

/** Prominent, non-blocking banner for the newest unacknowledged CRITICAL alert. Stronger once escalated. */
/**
 * overlay: float over the stage header (absolute, opaque) instead of taking layout space, so a
 * critical alert never shrinks the 3D body. The parent must be `relative`.
 */
export function CriticalBanner({ className, overlay = false }: { className?: string; overlay?: boolean }) {
  const alerts = useAppStore((s) => s.alerts)
  const now = useAppStore((s) => Math.floor(s.clock.simNow / 30000) * 30000)
  const acknowledgeAlert = useAppStore((s) => s.acknowledgeAlert)
  const hidden = useUiStore((s) => s.bannerHidden)
  const hideBanner = useUiStore((s) => s.hideBanner)
  const callsign = useCallsign()
  const { top, count } = useMemo(() => {
    const crit = alerts
      .filter((a) => a.severity === 'CRITICAL' && isOpenAlert(a) && (!hidden.includes(a.id) || (a.escalationLevel ?? 0) > 0))
      .sort((a, b) => (b.escalationLevel ?? 0) - (a.escalationLevel ?? 0) || b.createdAt - a.createdAt)
    return { top: crit[0], count: crit.length }
  }, [alerts, hidden])
  if (!top) return null
  const loc = where(top)
  const level = top.escalationLevel ?? 0
  const escalated = level > 0
  const esc = escalationText(top, now)
  return (
    <div
      data-tour="banner"
      role="alert"
      aria-live="assertive"
      className={clsx(
        'animate-drop-in z-30 flex items-center gap-3 rounded-2xl px-4 py-3',
        overlay ? 'absolute inset-x-2 top-2 bottom-1.5' : 'relative w-full shrink-0',
        className,
      )}
      style={{
        // Opaque base color under the gradient: in overlay mode nothing underneath may show through.
        background: escalated
          ? 'linear-gradient(90deg, rgba(244,63,94,0.42) 0%, rgba(64,10,26,0.95) 50%, rgba(30,10,22,0.95) 100%), #1a0b16'
          : 'linear-gradient(90deg, rgba(244,63,94,0.24) 0%, rgba(30,12,22,0.94) 45%, rgba(16,14,26,0.94) 100%), #140d19',
        boxShadow: escalated ? '0 0 0 2px rgba(244,63,94,0.85), 0 18px 56px -10px rgba(244,63,94,0.55)' : '0 0 0 1px rgba(244,63,94,0.55), 0 18px 48px -12px rgba(244,63,94,0.35)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <span className="animate-pulse-ring-fast flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-critical text-white" style={{ ['--ring-color' as string]: 'rgba(244,63,94,0.6)' }}>
        {escalated ? <Siren size={19} aria-hidden /> : <OctagonAlert size={19} aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold tracking-[0.14em] text-rose-200 uppercase">
          Critical · Act now · {callsign(top.astronautId)}
          {loc && <span className="font-medium tracking-normal normal-case text-rose-200/80">{loc}</span>}
          {escalated && <EscalatedBadge level={level} />}
          {count > 1 && <span className="rounded bg-white/10 px-1.5 font-semibold tracking-normal text-white normal-case">+{count - 1} more</span>}
        </div>
        <div className="truncate text-[15px] font-semibold text-white">{top.title}</div>
        <div className={clsx('truncate text-xs', esc ? 'font-semibold text-rose-100' : 'text-rose-100/80')}>{esc ?? top.detail}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" className="text-white ring-white/25" onClick={() => focusTarget({ astronautId: top.astronautId, region: top.region, metric: top.metric })}>
          <Eye size={13} /> View
        </Button>
        <Button variant="danger" onClick={() => acknowledgeAlert(top.id)}>
          <Check size={13} strokeWidth={3} /> Acknowledge
        </Button>
        {!escalated && (
          <button type="button" aria-label="Hide banner (alert stays open)" title="Hide banner (alert stays open)" onClick={() => hideBanner(top.id)} className="focus-ring rounded-lg p-1 text-rose-200/70 hover:text-white">
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
