import clsx from 'clsx'
import { AstronautPortrait } from '../../components/AstronautPortrait'
import { BookOpen, Check, Earth, ListChecks, PartyPopper, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../state/store'
import { STATUS_META } from '../../lib/status'
import type { Astronaut, MetricCode, Recommendation, Status } from '../../types/domain'
import { METRIC_CATALOG, REGION_LABELS } from '../../engine/catalog'
import { MetricValue } from '../../components/MetricValue'
import { StatusIcon, StatusPill, isUrgent } from '../../components/Status'
import { BaselineInfo } from '../../components/BaselineInfo'
import { deltaVsNormal } from '../../components/format'
import { CriticalBanner } from '../alerts/Alerts'
import { AutonomyBadge } from '../attention/AutonomyBadge'
import { MedicalEscalation, RecommendationSteps, useNeedsMedicalAttention } from '../attention/MedicalGuidance'
import { ACTIVITY_LABEL, REGION_ICON, Stage3D } from '../stage/CenterStage'
import {
  SIGNAL_LOST_HEADLINE,
  clearSelection,
  earthLinkSentence,
  useActions,
  useCommDelaySec,
  useCrewStatus,
  useEscapeClearsStructure,
  usePendingActions,
  useSelectedStructure,
  useSignalLost,
} from '../shared/hooks'
import { CONTEXT_ONLY_TEXT, CONTEXT_ONLY_TITLE, SYSTEM_INFO, sideLabel } from '../anatomy/atlas/health'
import { CheckInButton } from '../checkin'
import { MedicalHistoryButton } from '../medicalhistory'
import { CaseTrackerButton } from '../casetracker'
import { WhatIfButton } from '../whatif'

/**
 * Crew view: one astronaut looking at their own health. Plain language, big type,
 * at most two things to do, no risk score or model details. Tablet friendly.
 */

function CrewAvatar({ astronaut, size = 36 }: { astronaut: Astronaut; size?: number }) {
  const status = useCrewStatus(astronaut.id)
  const meta = STATUS_META[status]
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={clsx('absolute inset-0 rounded-full', status === 'CRITICAL' && 'animate-pulse-ring-fast')}
        style={{ border: `2px ${status === 'NO_DATA' ? 'dashed' : 'solid'} ${meta.color}`, ['--ring-color' as string]: meta.glow }}
        aria-hidden
      />
      <span
        className="absolute inset-[3px] flex items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: `color-mix(in srgb, ${astronaut.color} 18%, #0a1120)`, color: astronaut.color }}
        aria-hidden
      >
        <AstronautPortrait astronaut={astronaut} className="h-full w-full rounded-full" />
      </span>
    </span>
  )
}

function PersonSwitcher() {
  const crew = useAppStore((s) => s.crew)
  const selectedId = useAppStore((s) => s.selectedAstronautId)
  const selectAstronaut = useAppStore((s) => s.selectAstronaut)
  return (
    <div data-tour="crew" role="radiogroup" aria-label="Whose health to show" className="flex flex-wrap items-center gap-1 rounded-2xl bg-white/[0.03] p-1 ring-1 ring-white/[0.06]">
      {crew.map((a, i) => {
        const sel = a.id === selectedId
        return (
          <PersonButton key={a.id} astronaut={a} selected={sel} index={i} onSelect={() => selectAstronaut(a.id)} />
        )
      })}
    </div>
  )
}

function PersonButton({ astronaut, selected, index, onSelect }: { astronaut: Astronaut; selected: boolean; index: number; onSelect: () => void }) {
  const status = useCrewStatus(astronaut.id)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      title={`${astronaut.callsign}, ${astronaut.role} (key ${index + 1})`}
      aria-label={`${astronaut.callsign}, ${STATUS_META[status].crewLabel}`}
      className={clsx(
        'focus-ring flex items-center gap-2 rounded-xl py-1 pr-3 pl-1 transition-all',
        selected ? 'bg-white/[0.08] ring-1 ring-white/20' : 'opacity-75 hover:bg-white/[0.05] hover:opacity-100',
      )}
    >
      <CrewAvatar astronaut={astronaut} size={selected ? 34 : 30} />
      <span className={clsx('text-xs font-bold tracking-wide', selected ? 'text-ink-100' : 'text-ink-300')}>{astronaut.callsign}</span>
    </button>
  )
}

function Hero() {
  const id = useAppStore((s) => s.selectedAstronautId)
  const astronaut = useAppStore((s) => s.crew.find((c) => c.id === id))
  const { headline, activity } = useAppStore(useShallow((s) => ({ headline: s.health[id]?.risk.headline, activity: s.health[id]?.activity })))
  const status = useCrewStatus(id)
  const signalLost = useSignalLost(id)
  const meta = STATUS_META[status]
  if (!astronaut) return null
  return (
    <div data-tour="headline" className="relative z-10 shrink-0 px-6 pt-5 pb-2 short:pt-3 short:pb-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PersonSwitcher />
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <span>{astronaut.role}</span>
          <span aria-hidden>·</span>
          <span>Mission day {astronaut.missionDay}</span>
          {activity && <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-ink-300 ring-1 ring-white/[0.06]">{ACTIVITY_LABEL[activity]}</span>}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3.5 short:mt-3">
        <span
          className={clsx('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl short:h-11 short:w-11', status === 'NO_DATA' && 'border border-dashed border-nodata/50')}
          style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, boxShadow: status === 'NO_DATA' ? undefined : `inset 0 0 0 1px color-mix(in srgb, ${meta.color} 35%, transparent), 0 0 36px -8px ${meta.glow}` }}
        >
          <StatusIcon status={status} size={30} className={clsx(status === 'CRITICAL' && 'animate-breathe')} />
        </span>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold tracking-[0.14em] text-ink-500 uppercase">{astronaut.callsign}, right now</div>
          <div className="text-[44px] leading-[1.05] font-bold tracking-tight short:text-[34px]" style={{ color: meta.color }}>
            {meta.crewLabel}
          </div>
        </div>
      </div>
      <p aria-live="polite" className="mt-3 max-w-[680px] text-[22px] leading-snug short:mt-2 short:text-[18px] font-medium text-balance text-ink-100 [text-shadow:0_2px_12px_rgba(4,7,13,0.9)]">
        {signalLost && (status === 'NO_DATA' || status === 'LOW') ? SIGNAL_LOST_HEADLINE : (headline ?? 'Waiting for data.')}
      </p>
    </div>
  )
}

/**
 * Small card over the body when an organ or an anatomical structure is selected: plain-language
 * summary only. A structure nothing monitors gets a calm "context only" note and never a status.
 */
function RegionCard() {
  const id = useAppStore((s) => s.selectedAstronautId)
  const region = useAppStore((s) => s.selectedRegion)
  const { status, summary } = useAppStore(
    useShallow((s) => {
      const r = region ? s.health[id]?.regions[region] : undefined
      return { status: (r?.status ?? 'NO_DATA') as Status, summary: r?.summary ?? '' }
    }),
  )
  const { structure } = useSelectedStructure()
  useEscapeClearsStructure()
  if (!region && !structure) return null
  const label = region ? REGION_LABELS[region] : null
  const Icon = region ? REGION_ICON[region] : BookOpen
  const system = structure ? (SYSTEM_INFO[structure.system] ?? SYSTEM_INFO.other) : null
  const side = structure ? sideLabel(structure) : null
  const title = structure ? structure.name : label!.label
  const subtitle = structure ? `${system!.label}${side ? ` · ${side}` : ''}` : label!.system
  // "Tracked with: Heart" only says something when the structure is not the organ the region is named after.
  const partOfRegion = !!structure && !!label && structure.name.toLowerCase() !== label.label.toLowerCase()
  return (
    // Lower right of the body area, above the viewer controls: clear of the status legend (bottom left),
    // the controls (bottom center) and the floating organ labels around the chest.
    <div className="glass-strong animate-fade-in absolute right-4 bottom-16 z-20 w-[min(360px,calc(100%-32px))] rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/10">
          <Icon size={18} className={region ? 'text-accent' : 'text-ink-300'} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] leading-tight font-semibold [overflow-wrap:anywhere] text-ink-100">{title}</div>
          <div className="text-xs text-ink-500">{subtitle}</div>
        </div>
        {region && <StatusPill status={status} />}
        <button type="button" aria-label="Close (Esc)" onClick={clearSelection} className="focus-ring rounded-lg p-1 text-ink-500 hover:text-ink-100">
          <X size={16} />
        </button>
      </div>
      {region ? (
        <>
          {partOfRegion && <div className="mt-2.5 text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Tracked with: {label!.label}</div>}
          <p className={clsx('text-[14px] leading-snug text-ink-100', partOfRegion ? 'mt-1' : 'mt-2.5')}>
            {summary || (status === 'NO_DATA' ? 'No recent data. Missing data is never treated as normal.' : label!.description)}
          </p>
        </>
      ) : (
        <p className="mt-2.5 text-[14px] leading-snug text-ink-300">
          <span className="font-semibold text-ink-100">{CONTEXT_ONLY_TITLE}.</span> {CONTEXT_ONLY_TEXT}
        </p>
      )}
    </div>
  )
}

function EarthLink() {
  const delay = useCommDelaySec()
  const { text, far } = earthLinkSentence(delay)
  return (
    <div className="relative z-10 mx-4 mb-4 flex shrink-0 items-center gap-2.5 self-start rounded-xl bg-space-900/70 px-3.5 py-2.5 text-[14px] text-ink-300 ring-1 ring-white/[0.07] backdrop-blur-md">
      <Earth size={17} className={clsx('shrink-0', far ? 'text-sky-300' : 'text-accent')} aria-hidden />
      <span className={clsx(far && 'text-ink-100')}>{text}</span>
    </div>
  )
}

function BigActionCard({ rec, onDone }: { rec: Recommendation; onDone: (title: string) => void }) {
  const { logIntervention, dismissRecommendation } = useActions()
  const meta = STATUS_META[rec.priority]
  return (
    <li className="relative overflow-hidden rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.07]">
      <span className="absolute top-0 bottom-0 left-0 w-1" style={{ background: meta.color }} aria-hidden />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wide uppercase" style={{ color: meta.color }}>
          <StatusIcon status={rec.priority} size={12} />
          {rec.priority === 'CRITICAL' ? 'Do this now' : rec.priority === 'HIGH' ? 'Do this soon' : 'When you can'}
        </span>
        <AutonomyBadge rec={rec} size="lg" />
      </div>
      <div className="mt-2 text-[18px] leading-snug font-semibold text-ink-100">{rec.title}</div>
      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-300">{rec.rationale}</p>
      <RecommendationSteps rec={rec} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {rec.interventionKind ? (
          <button
            type="button"
            onClick={() => {
              logIntervention({ astronautId: rec.astronautId, kind: rec.interventionKind!, recommendationId: rec.id })
              onDone(rec.title)
            }}
            aria-label={`Mark done: ${rec.title}`}
            className="focus-ring inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-space-950 transition-colors hover:bg-accent-strong"
          >
            <Check size={18} strokeWidth={3} aria-hidden /> Mark done
          </button>
        ) : (
          <button
            type="button"
            onClick={() => dismissRecommendation(rec.id)}
            className="focus-ring inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold text-ink-300 ring-1 ring-white/15 hover:bg-white/[0.06] hover:text-ink-100"
          >
            <Check size={16} aria-hidden /> Got it
          </button>
        )}
        <WhatIfButton recommendation={rec} />
      </div>
    </li>
  )
}

function CrewActions() {
  const id = useAppStore((s) => s.selectedAstronautId)
  const pending = usePendingActions(id)
  const top = pending.slice(0, 2)
  const urgent = useNeedsMedicalAttention(id)
  const status = useCrewStatus(id)
  const [done, setDone] = useState<string | null>(null)
  useEffect(() => {
    if (!done) return
    const t = window.setTimeout(() => setDone(null), 5000)
    return () => window.clearTimeout(t)
  }, [done])
  return (
    <section id="attention" data-tour="actions" aria-label="What to do now" className="glass rounded-2xl p-4">
      <h2 className="flex items-center justify-between gap-2 text-[12px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
        What to do now
        {pending.length > 2 && <span className="tracking-normal normal-case">+{pending.length - 2} more on the ground view</span>}
      </h2>
      <div className="mt-3"><MedicalEscalation astronautId={id} /></div>
      {done && (
        <div role="status" className="animate-fade-in mt-3 flex items-center gap-2 rounded-xl bg-accent/[0.08] px-3 py-2 text-[13px] text-ink-100 ring-1 ring-accent/25">
          <PartyPopper size={16} className="shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 truncate">Logged: {done}</span>
        </div>
      )}
      {top.length === 0 ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-4 text-[15px] text-ink-300 ring-1 ring-white/[0.05]">
          <ListChecks size={20} className="shrink-0 text-accent" aria-hidden />
          {urgent ? 'Urgent medical review is required. Follow the emergency guidance above.' : status !== 'LOW' ? 'No automated steps are available. Ask the crew medical officer to review the issue.' : 'Nothing to do right now. Keep your usual routine.'}
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {top.map((r) => (
            <BigActionCard key={r.id} rec={r} onDone={setDone} />
          ))}
        </ul>
      )}
    </section>
  )
}

const CREW_VITALS: { metric: MetricCode; label: string }[] = [
  { metric: 'HEART_RATE', label: 'Heart rate' },
  { metric: 'SPO2', label: 'Blood oxygen' },
  { metric: 'RESPIRATORY_RATE', label: 'Breathing' },
  { metric: 'HRV_RMSSD', label: 'Heart variability' },
]

function BigVital({ astronautId, metric, label }: { astronautId: string; metric: MetricCode; label: string }) {
  const ms = useAppStore((s) => s.health[astronautId]?.metrics[metric])
  const def = METRIC_CATALOG[metric]
  const status: Status = !ms || ms.current == null ? 'NO_DATA' : ms.status
  const meta = STATUS_META[status]
  const noData = status === 'NO_DATA'
  const delta = deltaVsNormal(ms, status)
  return (
    <div
      className={clsx('relative rounded-2xl px-4 pt-3 pb-3', noData ? 'border border-dashed border-nodata/45' : 'bg-white/[0.035] ring-1 ring-white/[0.06]')}
      style={isUrgent(status) ? { boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${meta.color} 45%, transparent)` } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink-300">{label}</span>
        <BaselineInfo metric={metric} baseline={ms?.baseline} prefer="top" />
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        {noData ? (
          <span className="text-[22px] leading-[40px] font-semibold text-nodata">Signal lost</span>
        ) : (
          <>
            <MetricValue value={ms?.current} decimals={def.decimals} className="text-[34px] leading-[40px] font-semibold tracking-tight text-ink-100" />
            <span className="text-[13px] text-ink-500">{def.unit}</span>
          </>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: noData ? undefined : delta.tone === 'in' ? '#a9b6cf' : meta.color }}>
        <StatusIcon status={status} size={14} />
        <span className={clsx(noData && 'text-nodata')}>{noData ? 'Check the sensor' : delta.tone === 'in' ? 'Normal for you' : `${delta.text}`}</span>
      </div>
    </div>
  )
}

function CrewVitals() {
  const id = useAppStore((s) => s.selectedAstronautId)
  return (
    <section data-tour="vitals" aria-label="Your vitals" className="glass rounded-2xl p-4">
      <h2 className="text-[12px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Your body vs your normal</h2>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {CREW_VITALS.map((v) => (
          <BigVital key={v.metric} astronautId={id} metric={v.metric} label={v.label} />
        ))}
      </div>
    </section>
  )
}

export function CrewView() {
  const id = useAppStore((s) => s.selectedAstronautId)
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3">
      <CriticalBanner />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_392px] xl:grid-cols-[minmax(0,1fr)_440px] 2xl:grid-cols-[minmax(0,1fr)_500px]">
        <section aria-label="Your status" className="glass relative flex min-h-[720px] flex-col overflow-hidden rounded-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_55%,rgba(94,234,212,0.09),transparent_70%)]" aria-hidden />
          <Hero />
          <div data-tour="body" className="relative min-h-0 flex-1">
            <Stage3D />
            <RegionCard />
          </div>
          <EarthLink />
        </section>
        <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto [&>*]:shrink-0">
          <MedicalHistoryButton astronautId={id} />
          <CaseTrackerButton astronautId={id} />
          <CrewActions />
          <CheckInButton astronautId={id} variant="prominent" />
          <CrewVitals />
        </div>
      </div>
    </main>
  )
}
