import clsx from 'clsx'
import { ArrowRight, Check, ClipboardList, Info, ListChecks, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../state/store'
import { STATUS_META } from '../../lib/status'
import type { BodyRegionId, MetricCode, Prediction, Recommendation, Status } from '../../types/domain'
import { METRIC_CATALOG, REGION_LABELS } from '../../engine/catalog'
import { RiskGauge } from '../../components/RiskGauge'
import { StatusIcon } from '../../components/Status'
import { Badge, Button, PANEL_HEADER, PANEL_TITLE, SectionLabel } from '../../components/ui'
import { WhatIfButton } from '../whatif'
import { CaseTrackerButton } from '../casetracker'
import { AutonomyBadge } from './AutonomyBadge'
import { MedicalEscalation, RecommendationSteps, useNeedsMedicalAttention } from './MedicalGuidance'
import { formatHours, formatUtcTime, relTime } from '../../components/format'
import { BODY_REGIONS, focusTarget, useActions, useEscapeClearsStructure, usePendingActions, useSelectedStructure, useSignalLost } from '../shared/hooks'
import { RegionDetail } from './RegionDetail'
import { StructureDetail, StructureUnavailable } from './StructureDetail'

export const DISCLAIMER = 'Decision support only. Not a diagnosis. Simulated data.'

function StatusCard({ astronautId }: { astronautId: string }) {
  const risk = useAppStore((s) => s.health[astronautId]?.risk)
  const signalLost = useSignalLost(astronautId)
  if (!risk) return null
  const status: Status = signalLost && risk.risk_level === 'LOW' ? 'NO_DATA' : risk.risk_level
  const meta = STATUS_META[status]
  const lowConf = risk.confidence < 0.6
  return (
    <div
      className="relative overflow-hidden rounded-xl p-4 ring-1"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${meta.color} 13%, transparent) 0%, rgba(255,255,255,0.02) 70%)`,
        ['--tw-ring-color' as string]: `color-mix(in srgb, ${meta.color} 30%, transparent)`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Overall status</div>
          <div className="mt-1 flex items-center gap-2">
            <StatusIcon status={status} size={24} className={clsx(status === 'CRITICAL' && 'animate-breathe')} />
            <span className="text-[28px] leading-none font-bold tracking-tight" style={{ color: meta.color }}>
              {meta.crewLabel}
            </span>
          </div>
          <div className="mt-2 text-xs text-ink-300">
            {status === 'NO_DATA' ? (
              <span>Core vitals missing. Status cannot be confirmed.</span>
            ) : (
              <>
                Level: <span className="font-semibold text-ink-100">{meta.label}</span>
              </>
            )}
          </div>
        </div>
        <RiskGauge score={risk.risk_score} status={status} size={120} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2.5 text-[11px] text-ink-500 present:hidden">
        <span className={clsx('tabular', lowConf && 'font-semibold text-watch')} title="Lower when data quality is poor or data is missing">
          Confidence {Math.round(risk.confidence * 100)}%{lowConf ? ' (low, check sensors)' : ''}
        </span>
        <span aria-hidden>·</span>
        <span title={risk.data_window}>Model {risk.model_version}</span>
        <span aria-hidden>·</span>
        <span className="tabular">Updated {formatUtcTime(risk.evaluated_at, false)} UTC</span>
      </div>
    </div>
  )
}

interface Issue {
  key: string
  label: string
  status: Status
  weight: number | null
  metric: MetricCode | null
  region: BodyRegionId | null
}

function Issues({ astronautId }: { astronautId: string }) {
  const { factors, regions, metrics } = useAppStore(
    useShallow((s) => ({ factors: s.health[astronautId]?.risk.contributing_factors, regions: s.health[astronautId]?.regions, metrics: s.health[astronautId]?.metrics })),
  )
  const issues = useMemo<Issue[]>(() => {
    const out: Issue[] = []
    const covered = new Set<string>()
    for (const f of [...(factors ?? [])].sort((a, b) => b.weight - a.weight)) {
      const region = f.metric ? METRIC_CATALOG[f.metric].region : null
      const ms = f.metric ? metrics?.[f.metric] : undefined
      if (region && region !== 'environment') covered.add(region)
      out.push({
        key: `f-${f.label}`,
        label: f.label,
        status: ms?.status && ms.status !== 'LOW' ? ms.status : 'MODERATE',
        weight: f.weight,
        metric: f.metric,
        region: region && region !== 'environment' ? region : null,
      })
    }
    const missing = (Object.values(metrics ?? {}) as { metric: MetricCode; current: number | null; status: Status }[])
      .filter((m) => m && (m.current == null || m.status === 'NO_DATA'))
      .map((m) => m.metric)
    if (missing.length) {
      const names = missing.map((m) => METRIC_CATALOG[m].label.toLowerCase())
      const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ')
      const first = METRIC_CATALOG[missing[0]!].region
      out.unshift({
        key: 'missing',
        label: `No live data for ${list}. Missing data is never treated as normal: check the sensor.`,
        status: 'NO_DATA',
        weight: null,
        metric: missing[0]!,
        region: first === 'environment' ? null : first,
      })
      for (const m of missing) {
        const r = METRIC_CATALOG[m].region
        if (r !== 'environment') covered.add(r)
      }
    }
    if (regions) {
      for (const r of BODY_REGIONS) {
        const rs = regions[r]
        if (!rs || rs.status === 'LOW' || rs.metrics.length === 0 || covered.has(r)) continue
        out.push({
          key: `r-${r}`,
          label: `${REGION_LABELS[r].label}: ${rs.status === 'NO_DATA' ? 'no recent data. Missing data is not treated as normal.' : rs.summary}`,
          status: rs.status,
          weight: null,
          metric: null,
          region: r,
        })
      }
    }
    return out
  }, [factors, regions, metrics])

  const [showAllIssues, setShowAllIssues] = useState(false)
  const shownIssues = showAllIssues ? issues : issues.slice(0, 3)
  return (
    <section aria-label="Why">
      <SectionLabel right={issues.length > 0 ? <span className="tabular text-[11px] text-ink-500">{issues.length}</span> : null}>Why</SectionLabel>
      {issues.length === 0 ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-nominal/[0.06] px-3 py-2.5 text-[13px] text-ink-300 ring-1 ring-nominal/20">
          <StatusIcon status="LOW" size={16} />
          Nothing stands out. All tracked signals are within your normal range.
        </div>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {shownIssues.map((it) => (
            <li key={it.key}>
              <button
                type="button"
                onClick={() => focusTarget({ astronautId, region: it.region, metric: it.metric })}
                disabled={!it.region}
                className="focus-ring group flex w-full items-start gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5 text-left ring-1 ring-white/[0.05] transition-colors enabled:hover:bg-white/[0.06]"
              >
                <StatusIcon status={it.status} size={15} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-snug text-ink-100">{it.label}</span>
                  {it.weight != null && (
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <span className="block h-full rounded-full" style={{ width: `${Math.round(it.weight * 100)}%`, background: STATUS_META[it.status].color, opacity: 0.8 }} />
                      </span>
                      <span className="tabular text-[10px] text-ink-500 present:hidden">{Math.round(it.weight * 100)}% of score</span>
                    </span>
                  )}
                </span>
                {it.region && <ArrowRight size={14} className="mt-0.5 shrink-0 text-ink-500 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {issues.length > 3 && (
        <button type="button" onClick={() => setShowAllIssues((v) => !v)} className="focus-ring mt-1.5 rounded px-2 text-[11px] font-semibold text-accent hover:underline">
          {showAllIssues ? 'Show less' : 'Show ' + (issues.length - 3) + ' more'}
        </button>
      )}
    </section>
  )
}

const AUDIENCE_LABEL: Record<Recommendation['audience'], string> = { CREW: 'For crew', FLIGHT_SURGEON: 'Flight surgeon', MISSION_CONTROL: 'Mission control' }
const PRIORITY_LABEL: Record<Recommendation['priority'], string> = { LOW: 'Low priority', MODERATE: 'Medium priority', HIGH: 'High priority', CRITICAL: 'Urgent' }

function ActionCard({ rec }: { rec: Recommendation }) {
  const { logIntervention, dismissRecommendation } = useActions()
  const meta = STATUS_META[rec.priority]
  return (
    <li className="relative overflow-hidden rounded-xl bg-white/[0.035] p-3 ring-1 ring-white/[0.06]">
      <span className="absolute top-0 bottom-0 left-0 w-[3px]" style={{ background: meta.color }} aria-hidden />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase" style={{ color: meta.color }}>
          <StatusIcon status={rec.priority} size={11} />
          {PRIORITY_LABEL[rec.priority]}
        </span>
        {!(rec.audience === 'FLIGHT_SURGEON' && (rec.autonomy ?? (rec.requiresHumanReview ? 'GROUND_REVIEW' : null)) === 'GROUND_REVIEW') && (
          <Badge tone="muted" className="present:hidden">
            {AUDIENCE_LABEL[rec.audience]}
          </Badge>
        )}
        <AutonomyBadge rec={rec} />
      </div>
      <div className="mt-1.5 text-[14px] leading-snug font-semibold text-ink-100">{rec.title}</div>
      <p className="mt-1 text-xs leading-relaxed text-ink-300">{rec.rationale}</p>
      <RecommendationSteps rec={rec} />
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {rec.interventionKind && (
          <Button
            variant="primary"
            onClick={() => logIntervention({ astronautId: rec.astronautId, kind: rec.interventionKind!, recommendationId: rec.id })}
            aria-label={`Mark done: ${rec.title}`}
          >
            <Check size={13} strokeWidth={3} /> Mark done
          </Button>
        )}
        <Button variant="subtle" onClick={() => dismissRecommendation(rec.id)} aria-label={`Dismiss: ${rec.title}`}>
          <X size={13} /> Dismiss
        </Button>
        <CaseTrackerButton astronautId={rec.astronautId} ruleId={rec.ruleId} compact />
        <span className="ml-auto">
          <WhatIfButton recommendation={rec} />
        </span>
      </div>
    </li>
  )
}

function Actions({ astronautId }: { astronautId: string }) {
  const interventions = useAppStore((s) => s.interventions)
  const simNow = useAppStore((s) => Math.floor(s.clock.simNow / 60000) * 60000)
  const pending = usePendingActions(astronautId)
  const urgent = useNeedsMedicalAttention(astronautId)
  const status = useAppStore((s) => s.health[astronautId]?.risk.risk_level)
  const signalLost = useSignalLost(astronautId)
  const [showAllActions, setShowAllActions] = useState(false)
  const shownActions = showAllActions ? pending : pending.slice(0, 2)
  const logged = useMemo(() => interventions.filter((i) => i.astronautId === astronautId).sort((a, b) => b.loggedAt - a.loggedAt), [interventions, astronautId])
  return (
    <section aria-label="Recommended actions" data-tour="actions">
      <SectionLabel right={pending.length > 0 ? <span className="tabular text-[11px] text-ink-500">{pending.length} to do</span> : null}>Recommended actions</SectionLabel>
      {pending.length === 0 ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5 text-[13px] text-ink-300 ring-1 ring-white/[0.05]">
          <ListChecks size={16} className="text-ink-500" aria-hidden />
          {urgent ? 'Urgent medical review is required. Follow the emergency guidance above.' : status && (status !== 'LOW' || signalLost) ? 'No automated steps are available for this issue. Request crew medical officer review and continue monitoring.' : !status ? 'Waiting for health data before suggesting next steps.' : 'No actions needed right now.'}
        </div>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {shownActions.map((r) => (
            <ActionCard key={r.id} rec={r} />
          ))}
        </ul>
      )}
      {pending.length > 2 && (
        <button type="button" onClick={() => setShowAllActions((v) => !v)} className="focus-ring mt-1.5 rounded px-2 text-[11px] font-semibold text-accent hover:underline">
          {showAllActions ? 'Show less' : 'Show ' + (pending.length - 2) + ' more'}
        </button>
      )}
      {logged.length > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-lg px-1 text-[11px] text-ink-500">
          <ClipboardList size={12} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Last logged: <span className="text-ink-300">{logged[0]!.kind.replaceAll('_', ' ').toLowerCase()}</span>, {relTime(logged[0]!.loggedAt, simNow)}
            {logged.length > 1 ? ` (${logged.length} total)` : ''}
          </span>
        </div>
      )}
    </section>
  )
}

function ForecastRow({ p, astronautId, className }: { p: Prediction; astronautId: string; className?: string }) {
  const def = METRIC_CATALOG[p.metric]
  const exits = p.eligible && p.hoursToBandExit != null
  const message = !p.eligible ? 'Not enough data to forecast yet' : exits ? `Projected to leave your normal range in ${formatHours(p.hoursToBandExit!)}` : `Stable over next ${p.horizonHours} h`
  const last = p.points[p.points.length - 1]
  const first = p.points[0]
  const rising = last && first ? last.v > first.v : false
  const TrendIcon = rising ? TrendingUp : TrendingDown
  return (
    <li className={className}>
      <button
        type="button"
        onClick={() => focusTarget({ astronautId, metric: p.metric })}
        className="focus-ring flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span
          className={clsx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', exits ? 'bg-watch/10 text-watch' : p.eligible ? 'bg-nominal/10 text-nominal' : 'bg-white/[0.05] text-nodata')}
          aria-hidden
        >
          {exits ? <TrendIcon size={13} /> : p.eligible ? <Check size={13} /> : <Info size={13} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-ink-100">
            <span className="font-semibold">{def.label}.</span> <span className={clsx(exits ? 'text-watch' : 'text-ink-300')}>{message}</span>
          </span>
          {p.eligible && (
            <span className="mt-0.5 block text-[10px] text-ink-500 present:hidden">
              {p.method} · {p.intervalLabel}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

function Forecasts({ astronautId }: { astronautId: string }) {
  const predictions = useAppStore((s) => s.health[astronautId]?.predictions)
  const list = useMemo(() => {
    const arr = Object.values(predictions ?? {}).filter((p): p is Prediction => !!p)
    const rank = (p: Prediction) => (!p.eligible ? 2 : p.hoursToBandExit != null ? 0 : 1)
    return arr.sort((a, b) => rank(a) - rank(b) || (a.hoursToBandExit ?? 0) - (b.hoursToBandExit ?? 0))
  }, [predictions])
  const exits = list.filter((p) => p.eligible && p.hoursToBandExit != null).length
  const [showAll, setShowAll] = useState(false)
  // Large screens (roomy) show every forecast: the extra rows are rendered but hidden by CSS elsewhere.
  const base = Math.max(3, exits)
  return (
    <section aria-label="Forecast">
      <SectionLabel
        right={
          <span className="flex items-center gap-1 text-[11px] text-ink-500">
            <Sparkles size={11} aria-hidden /> next hours
          </span>
        }
      >
        Forecast
      </SectionLabel>
      {list.length === 0 ? (
        <div className="mt-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-[13px] text-ink-500 ring-1 ring-white/[0.05]">Forecasts appear once enough data is collected.</div>
      ) : (
        <>
          <ul className="mt-1 -mx-1 flex flex-col">
            {list.map((p, i) => (
              <ForecastRow key={p.metric} p={p} astronautId={astronautId} className={!showAll && i >= base ? 'hidden roomy:block' : undefined} />
            ))}
          </ul>
          {list.length > base ? (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="focus-ring mt-1 rounded px-2 text-[11px] font-semibold text-accent hover:underline roomy:hidden">
              {showAll ? 'Show less' : `Show all ${list.length}`}
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}

function Overview({ astronautId }: { astronautId: string }) {
  return (
    <div className="flex flex-col gap-5">
      <StatusCard astronautId={astronautId} />
      <Actions astronautId={astronautId} />
      <Issues astronautId={astronautId} />
      <Forecasts astronautId={astronautId} />
    </div>
  )
}

/**
 * Right panel. Three levels, most specific first:
 * a structure selected in the 3D atlas (what it is, plus the data of the region it is monitored
 * with, or a "context only" note), a body region (metrics, alerts and flags), or the overview.
 */
export function AttentionPanel({ className }: { className?: string }) {
  const astronautId = useAppStore((s) => s.selectedAstronautId)
  const callsign = useAppStore((s) => s.crew.find((c) => c.id === s.selectedAstronautId)?.callsign)
  const region = useAppStore((s) => s.selectedRegion)
  const { structureId, structure, manifest, pending } = useSelectedStructure()
  useEscapeClearsStructure()
  let title = 'What needs attention'
  let body = <Overview astronautId={astronautId} />
  if (structure && manifest) {
    title = 'Anatomy detail'
    body = <StructureDetail astronautId={astronautId} structure={structure} manifest={manifest} />
  } else if (region) {
    // Also the fallback while the atlas loads or when it is unavailable: the region data never waits for anatomy.
    title = 'Body system detail'
    body = <RegionDetail astronautId={astronautId} region={region} />
  } else if (structureId) {
    title = 'Anatomy detail'
    body = <StructureUnavailable loading={pending} />
  }
  return (
    <aside aria-label="What needs attention" data-tour="attention" className={clsx('glass flex min-h-0 flex-col rounded-2xl', className)}>
      <header className={PANEL_HEADER}>
        <h2 className={PANEL_TITLE}>{title}</h2>
        <span className="text-[11px] leading-none font-semibold tracking-wide text-ink-300">{callsign}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" key={`${astronautId}-${structure ? `s-${structure.id}` : (region ?? (structureId ? 'structure' : 'overview'))}`}>
        <div className="animate-fade-in"><MedicalEscalation astronautId={astronautId} />{body}</div>
      </div>
      <footer className="flex items-center gap-1.5 border-t border-white/[0.06] px-4 py-2 text-[10.5px] text-ink-500 present:py-1.5">
        <Info size={11} className="shrink-0" aria-hidden />
        {DISCLAIMER}
      </footer>
    </aside>
  )
}

