import clsx from 'clsx'
import { ArrowDown, BellRing, CircleCheck, FlaskConical } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../state/store'
import { useUiStore } from '../../app/uiStore'
import { STATUS_META } from '../../lib/status'
import type { Alert, Anomaly, BodyRegionId, DataOrigin } from '../../types/domain'
import { METRIC_CATALOG, REGION_LABELS } from '../../engine/catalog'
import { StatusIcon, StatusPill } from '../../components/Status'
import { Badge, SectionLabel } from '../../components/ui'
import { ORIGIN_LABEL, fmtMetric, formatUtcTime, relTime } from '../../components/format'
import { ANOMALY_METHOD_LABEL, observedAt, regionAlerts, regionAnomalies } from '../anatomy/atlas/health'

/** Statistical flags older than this (sim time) are history, not part of the current picture. */
const ANOMALY_WINDOW_MS = 24 * 3_600_000
const SHOWN_ALERTS = 2
const SHOWN_FLAGS = 2
/** DOM id of the section, so the jump link above the metrics can scroll to it. */
const EVENTS_ID = 'region-events'

/** Origin of the data behind an alert or flag. Simulated data always carries the violet badge. */
function OriginBadge({ origin }: { origin: DataOrigin }) {
  return (
    <Badge tone={origin === 'SIMULATED' ? 'sim' : 'neutral'} icon={origin === 'SIMULATED' ? <FlaskConical size={10} aria-hidden /> : undefined} title="Data origin of the readings behind this item">
      {ORIGIN_LABEL[origin] ?? origin}
    </Badge>
  )
}

/** Observed value when the alert was raised, next to the personal reference of that metric. */
function ObservedVsNormal({ astronautId, alert }: { astronautId: string; alert: Alert }) {
  const metric = alert.metric
  // Primitive snapshots: the row re-renders only when one of these values changes.
  const observed = useAppStore((s) => (metric ? observedAt(s.history[astronautId]?.[metric], alert.createdAt) : null))
  const { low, high, ready, origin } = useAppStore(
    useShallow((s) => {
      const ms = metric ? s.health[astronautId]?.metrics[metric] : undefined
      const b = ms?.baseline
      return { low: b?.low ?? null, high: b?.high ?? null, ready: b?.status === 'READY', origin: (ms?.data_origin ?? 'SIMULATED') as DataOrigin }
    }),
  )
  if (!metric) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <OriginBadge origin="SIMULATED" />
        <span className="text-[10px] text-ink-500 present:hidden">Rule {alert.ruleId}</span>
      </div>
    )
  }
  const def = METRIC_CATALOG[metric]
  return (
    <>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 ring-1 ring-white/[0.05]">
          <dt className="text-ink-500">Observed when raised</dt>
          <dd className={clsx('tabular mt-0.5 text-[13px] font-semibold', observed == null ? 'text-nodata' : 'text-ink-100')}>
            {observed == null ? 'No reading' : `${fmtMetric(metric, observed)} ${def.unit}`}
          </dd>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 ring-1 ring-white/[0.05]">
          <dt className="text-ink-500">Personal normal</dt>
          <dd className="tabular mt-0.5 text-[13px] font-semibold text-ink-100">
            {ready && low != null && high != null ? `${fmtMetric(metric, low)} to ${fmtMetric(metric, high)} ${def.unit}` : <span className="font-medium text-ink-300">Still learning</span>}
          </dd>
        </div>
      </dl>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <OriginBadge origin={origin} />
        <span className="text-[10px] text-ink-500 present:hidden">Rule {alert.ruleId}</span>
      </div>
    </>
  )
}

function AlertRow({ astronautId, alert, now }: { astronautId: string; alert: Alert; now: number }) {
  const selectMetric = useAppStore((s) => s.selectMetric)
  const def = alert.metric ? METRIC_CATALOG[alert.metric] : null
  const level = alert.escalationLevel ?? 0
  return (
    <li className={clsx('relative overflow-hidden rounded-xl p-3 ring-1', level > 0 ? 'bg-critical/[0.06] ring-critical/30' : 'bg-white/[0.035] ring-white/[0.07]')}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <StatusPill status={alert.severity} variant="technical" size="sm" />
          {level > 0 && <span className="text-[10px] font-bold tracking-wide text-rose-200 uppercase">Escalated</span>}
        </span>
        <span className="tabular shrink-0 text-[11px] text-ink-500" title={`${formatUtcTime(alert.createdAt)} UTC (simulated clock)`}>
          {formatUtcTime(alert.createdAt, false)} UTC · {relTime(alert.createdAt, now)}
        </span>
      </div>
      <div className="mt-1.5 text-[13px] leading-snug font-semibold text-ink-100">{alert.title}</div>
      {def && (
        <button
          type="button"
          onClick={() => selectMetric(alert.metric)}
          aria-label={`Triggered by ${def.label}. Show its chart.`}
          className="focus-ring mt-0.5 rounded text-left text-xs text-ink-300 hover:text-accent"
        >
          Triggered by <span className="font-semibold underline decoration-white/20 underline-offset-2">{def.label}</span>
        </button>
      )}
      <ObservedVsNormal astronautId={astronautId} alert={alert} />
    </li>
  )
}

function FlagRow({ astronautId, flag }: { astronautId: string; flag: Anomaly }) {
  const origin = useAppStore((s) => (s.health[astronautId]?.metrics[flag.metric]?.data_origin ?? 'SIMULATED') as DataOrigin)
  return (
    <li className="rounded-xl bg-white/[0.025] px-3 py-2.5 ring-1 ring-white/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink-100">
          <StatusIcon status={flag.severity} size={13} className="shrink-0" />
          <span className="truncate">{METRIC_CATALOG[flag.metric].label}</span>
        </span>
        <span className="tabular shrink-0 text-[11px] text-ink-500">{formatUtcTime(flag.detectedAt, false)} UTC</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-300">{flag.explanation}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <OriginBadge origin={origin} />
        <span className="text-[10px] text-ink-500 present:hidden">{ANOMALY_METHOD_LABEL[flag.method]}</span>
      </div>
    </li>
  )
}

/**
 * One line above the metrics when the region has open alerts: how many, how severe, and a jump
 * to their details (which sit below the metrics). Renders nothing when there is no open alert.
 */
export function RegionAlertsJump({ astronautId, region }: { astronautId: string; region: BodyRegionId }) {
  const allAlerts = useAppStore((s) => s.alerts)
  const alerts = useMemo(() => regionAlerts(allAlerts, astronautId, region), [allAlerts, astronautId, region])
  if (alerts.length === 0) return null
  const worst = alerts[0]!.severity
  const color = STATUS_META[worst].color
  return (
    <button
      type="button"
      onClick={() => document.getElementById(EVENTS_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className="focus-ring flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-ink-100 ring-1 transition-colors hover:bg-white/[0.04]"
      style={{ background: `color-mix(in srgb, ${color} 8%, transparent)`, ['--tw-ring-color' as string]: `color-mix(in srgb, ${color} 30%, transparent)` }}
    >
      <StatusIcon status={worst} size={13} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="tabular">{alerts.length}</span> open {alerts.length === 1 ? 'alert' : 'alerts'} for this system
        <span className="font-normal text-ink-300"> · {STATUS_META[worst].label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 font-normal text-ink-300">
        Details <ArrowDown size={12} aria-hidden />
      </span>
    </button>
  )
}

/**
 * Alerts and statistical flags of one body region for one astronaut: what triggered them, the
 * observed value against the personal normal, when, and where the data comes from.
 * Wording stays non diagnostic: these are prompts to review, never conclusions.
 */
export function RegionEvents({ astronautId, region }: { astronautId: string; region: BodyRegionId }) {
  const allAlerts = useAppStore((s) => s.alerts)
  const allAnomalies = useAppStore((s) => s.anomalies)
  // Minute resolution: enough for "12 min ago" and for the 24 h window, without a render per tick.
  const now = useAppStore((s) => Math.floor(s.clock.simNow / 60000) * 60000)
  const setAlertsOpen = useUiStore((s) => s.setAlertsOpen)
  const alerts = useMemo(() => regionAlerts(allAlerts, astronautId, region), [allAlerts, astronautId, region])
  const since = Math.floor((now - ANOMALY_WINDOW_MS) / 3_600_000) * 3_600_000
  const flags = useMemo(() => regionAnomalies(allAnomalies, astronautId, region, since), [allAnomalies, astronautId, region, since])
  const [showAll, setShowAll] = useState(false)
  const shownAlerts = showAll ? alerts : alerts.slice(0, SHOWN_ALERTS)
  const shownFlags = showAll ? flags : flags.slice(0, SHOWN_FLAGS)
  const hidden = alerts.length - shownAlerts.length + (flags.length - shownFlags.length)
  const total = alerts.length + flags.length
  const name = REGION_LABELS[region].label.toLowerCase()

  return (
    <section id={EVENTS_ID} aria-label={`Alerts and flags for ${name}`} className="scroll-mt-2">
      <SectionLabel
        right={
          alerts.length > 0 ? (
            <button type="button" onClick={() => setAlertsOpen(true)} className="focus-ring flex items-center gap-1 rounded px-1 text-[11px] font-semibold text-accent hover:underline">
              <BellRing size={11} aria-hidden /> Open alerts
            </button>
          ) : total > 0 ? (
            <span className="tabular text-[11px] text-ink-500">{total}</span>
          ) : null
        }
      >
        Alerts and flags
      </SectionLabel>
      {total === 0 ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5 text-[13px] text-ink-300 ring-1 ring-white/[0.05]">
          <CircleCheck size={15} className="shrink-0 text-ink-500" aria-hidden />
          No open alerts and no flags in the last 24 h for this system.
        </div>
      ) : (
        <>
          {shownAlerts.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2" aria-label="Open alerts">
              {shownAlerts.map((a) => (
                <AlertRow key={a.id} astronautId={astronautId} alert={a} now={now} />
              ))}
            </ul>
          )}
          {shownFlags.length > 0 && (
            <>
              <div className="mt-2.5 text-[11px] text-ink-500">
                Statistical flags, last 24 h <span className="tabular">({flags.length})</span>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1.5" aria-label="Statistical flags in the last 24 hours">
                {shownFlags.map((f) => (
                  <FlagRow key={f.id} astronautId={astronautId} flag={f} />
                ))}
              </ul>
            </>
          )}
          {(alerts.length > SHOWN_ALERTS || flags.length > SHOWN_FLAGS) && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="focus-ring mt-1.5 rounded px-2 text-[11px] font-semibold text-accent hover:underline">
              {showAll ? 'Show less' : `Show ${hidden} more`}
            </button>
          )}
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">Alerts and flags compare readings with the personal normal. They ask for a review and are not a diagnosis.</p>
        </>
      )}
    </section>
  )
}
