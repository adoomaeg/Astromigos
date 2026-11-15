import clsx from 'clsx'
import { AstronautPortrait } from '../../components/AstronautPortrait'
import { Bone, Brain, Droplets, Dumbbell, Heart, Thermometer, Wind, type LucideIcon } from 'lucide-react'
import { lazy, memo, Suspense, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../state/store'
import { STATUS_META } from '../../lib/status'
import type { ActivityContext, BodyRegionId, Status } from '../../types/domain'
import { REGION_LABELS } from '../../engine/catalog'
import { StatusDot, StatusPill } from '../../components/Status'
import { CriticalBanner } from '../alerts/Alerts'
import { PANEL_HEADER, PANEL_TITLE } from '../../components/ui'
import { SIGNAL_LOST_HEADLINE, useAstronaut, useSelectedStructure, useSignalLost } from '../shared/hooks'
import { regionStructureCount } from '../anatomy/atlas/health'
import { CheckInButton } from '../checkin'

// three.js and the anatomy scene load as a separate chunk so the dashboard paints first.
const AnatomyViewer = lazy(() => import('../anatomy').then((m) => ({ default: m.AnatomyViewer })))

function ViewerFallback() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-xs text-ink-500">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent/15 border-t-accent" aria-hidden />
      Building 3D anatomy...
    </div>
  )
}

export const REGION_ICON: Record<BodyRegionId, LucideIcon> = {
  brain: Brain,
  heart: Heart,
  lungs: Wind,
  kidneys: Droplets,
  muscles: Dumbbell,
  bones: Bone,
  skin: Thermometer,
}

export const ACTIVITY_LABEL: Record<ActivityContext, string> = { SLEEP: 'Sleeping', REST: 'Resting', WORK: 'Working', EXERCISE: 'Exercising', EVA: 'On spacewalk (EVA)' }

/** The 3D canvas never re-renders because of page level state. */
export const Stage3D = memo(function Stage3D() {
  return (
    <Suspense fallback={<ViewerFallback />}>
      <AnatomyViewer className="h-full w-full" />
    </Suspense>
  )
})

/** Headline: shared panel header row (identity, activity, check-in) plus the plain-language status sentence. */
function Headline() {
  const id = useAppStore((s) => s.selectedAstronautId)
  const astronaut = useAstronaut(id)
  const { level, headline, activity } = useAppStore(
    useShallow((s) => ({ level: s.health[id]?.risk.risk_level, headline: s.health[id]?.risk.headline, activity: s.health[id]?.activity })),
  )
  const signalLost = useSignalLost(id)
  const override = signalLost && (level == null || level === 'LOW')
  const status: Status = override ? 'NO_DATA' : (level ?? 'NO_DATA')
  if (!astronaut) return null
  return (
    <div data-tour="headline" className="relative z-10 shrink-0">
      <header className={PANEL_HEADER}>
        <h2 className={clsx(PANEL_TITLE, 'flex-1 overflow-hidden')}>
          <AstronautPortrait astronaut={astronaut} className="h-8 w-8 shrink-0 rounded-full" />
          <span className="text-ink-100 normal-case tracking-normal">{astronaut.callsign}</span>
          <span className="truncate font-normal tracking-normal normal-case">
            <span className="hidden @min-[520px]/stage:inline">{astronaut.role} · </span>Mission day {astronaut.missionDay}
          </span>
          {activity && (
            <span className="shrink-0 rounded-md bg-white/[0.05] px-1.5 py-1 font-medium tracking-normal text-ink-300 normal-case ring-1 ring-white/[0.06]">
              {ACTIVITY_LABEL[activity]}
            </span>
          )}
        </h2>
        <CheckInButton astronautId={id} variant="compact" />
      </header>
      <div className="flex items-start gap-3 px-4 pt-1 pb-2">
        <StatusPill status={status} size="lg" className="mt-px" />
        <p
          aria-live="polite"
          className="line-clamp-2 max-w-[720px] text-[19px] leading-snug font-medium text-balance text-ink-100 [text-shadow:0_2px_12px_rgba(4,7,13,0.9)] short:text-[17px]"
        >
          {override ? SIGNAL_LOST_HEADLINE : (headline ?? 'Waiting for data.')}
        </p>
      </div>
    </div>
  )
}

/**
 * Body system chip. Lives in a column beside the body (anatomical callout): icon, name, status dot
 * and a short leader line toward the body. Adapts to the stage width with container queries:
 * icon only under 560 px, name only under 880 px, name plus system subtitle above.
 *
 * Two way sync with the 3D atlas: a structure selected in the viewer selects its region too, so
 * the chip of that region lights up and its subtitle names the structure. A chip always means
 * the whole region: clicking it selects the region and clears the structure.
 */
function RegionChip({
  region,
  astronautId,
  selected,
  side,
  structureName,
  atlasCount,
}: {
  region: BodyRegionId
  astronautId: string
  selected: boolean
  side: 'left' | 'right'
  /** Name of the structure selected inside this region, when there is one. */
  structureName: string | null
  /** Structures of the atlas that report under this region (null while the atlas is not loaded). */
  atlasCount: number | null
}) {
  const { status, summary, monitored } = useAppStore(
    useShallow((s) => {
      const r = s.health[astronautId]?.regions[region]
      return { status: (r?.status ?? 'NO_DATA') as Status, summary: r?.summary ?? '', monitored: !r || r.metrics.length > 0 }
    }),
  )
  const selectRegion = useAppStore((s) => s.selectRegion)
  const selectMetric = useAppStore((s) => s.selectMetric)
  const meta = STATUS_META[status]
  const label = REGION_LABELS[region]
  const Icon = REGION_ICON[region]
  const flagged = status !== 'LOW' && monitored
  const tinted = flagged && !selected && status !== 'NO_DATA'
  const lead = selected ? 'rgba(94,234,212,0.6)' : tinted ? `color-mix(in srgb, ${meta.color} 55%, transparent)` : 'rgba(255,255,255,0.12)'
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${label.label}, ${label.system}. ${monitored ? meta.crewLabel : 'Not monitored'}. ${summary}${structureName ? ` Selected structure: ${structureName}. Press to select the whole system.` : ''}`}
      title={`${label.label}: ${summary || label.description}${atlasCount ? ` (${atlasCount} structures in the anatomy atlas)` : ''}`}
      onClick={() => {
        // With a structure selected inside this region the click widens the selection to the
        // whole region (selectRegion clears the structure) instead of toggling the region off.
        selectRegion(selected && !structureName ? null : region)
        selectMetric(null)
      }}
      className={clsx(
        'system-chip focus-ring relative flex w-full min-w-0 items-center justify-center gap-2 rounded-xl py-2.5 transition-colors @min-[560px]/stage:justify-start @min-[560px]/stage:px-2 @min-[560px]/stage:py-2 @min-[880px]/stage:px-2.5',
        side === 'right' && 'flex-row-reverse text-right',
        // leader line toward the body (callout style)
        "after:pointer-events-none after:absolute after:top-1/2 after:h-px after:w-2 after:bg-(--lead) after:content-['']",
        side === 'left' ? 'after:left-full' : 'after:right-full',
        selected ? 'bg-accent/[0.1] ring-1 ring-accent/50' : 'bg-white/[0.03] ring-1 ring-white/[0.06] hover:bg-white/[0.07]',
        status === 'NO_DATA' && monitored && !selected && 'border border-dashed border-nodata/40',
      )}
      style={{
        ['--lead' as string]: lead,
        ...(tinted ? { boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${meta.color} 40%, transparent)` } : null),
      }}
    >
      <Icon size={16} className={clsx('shrink-0', selected ? 'text-accent' : 'text-ink-300')} aria-hidden />
      <span className="hidden min-w-0 flex-1 leading-tight @min-[560px]/stage:block">
        <span className="block text-xs font-semibold whitespace-nowrap text-ink-100 roomy:text-[13px]">{label.label}</span>
        <span className={clsx('hidden truncate text-[10px] present:hidden @min-[880px]/stage:block roomy:text-[11px]', structureName ? 'text-accent/90' : 'text-ink-500')}>
          {structureName ?? (monitored ? label.system : 'Context only')}
        </span>
      </span>
      <span className={clsx('absolute top-1 flex @min-[560px]/stage:static', side === 'left' ? 'right-1' : 'left-1')}>
        {monitored ? <StatusDot status={status} size={8} pulse /> : <span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-ink-500/60" aria-hidden />}
      </span>
    </button>
  )
}

/** Left column reads head to torso, right column holds the whole-body systems. */
const LEFT_REGIONS: BodyRegionId[] = ['brain', 'lungs', 'heart', 'kidneys']
const RIGHT_REGIONS: BodyRegionId[] = ['muscles', 'bones', 'skin']

function RegionColumn({ side, regions }: { side: 'left' | 'right'; regions: BodyRegionId[] }) {
  const id = useAppStore((s) => s.selectedAstronautId)
  const selected = useAppStore((s) => s.selectedRegion)
  const { structure, manifest } = useSelectedStructure()
  const counts = useMemo(() => (manifest ? Object.fromEntries(regions.map((r) => [r, regionStructureCount(manifest, r)])) : null), [manifest, regions])
  return (
    <div
      role="group"
      aria-label={side === 'left' ? 'Body systems: brain, lungs, heart, kidneys' : 'Body systems: muscles, skeleton, skin'}
      className="relative z-10 flex w-10 shrink-0 flex-col justify-center gap-2 @min-[560px]/stage:w-[108px] @min-[880px]/stage:w-[150px] roomy:gap-3 @min-[1100px]/stage:roomy:w-[168px]"
    >
      {regions.map((r) => (
        <RegionChip key={r} region={r} astronautId={id} selected={selected === r} side={side} structureName={selected === r && structure ? structure.name : null} atlasCount={counts?.[r] ?? null} />
      ))}
    </div>
  )
}

export function CenterStage({ className }: { className?: string }) {
  return (
    <section aria-label="Body overview" className={clsx('body-stage @container/stage glass relative flex min-h-0 flex-col overflow-hidden rounded-2xl', className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_55%,rgba(94,234,212,0.08),transparent_70%)]" aria-hidden />
      {/* A critical alert floats over the headline instead of pushing the stage down, so the 3D body keeps its size. */}
      <div className="relative z-20 shrink-0">
        <Headline />
        <CriticalBanner overlay />
      </div>
      {/* Size container: on very wide stages the row is capped relative to its height so the chips stay close to the body. */}
      <div className="relative min-h-0 flex-1 px-3 pb-3 [container-type:size]">
        <div className="mx-auto flex h-full w-full max-w-[calc(105cqh+360px)] gap-2">
          <RegionColumn side="left" regions={LEFT_REGIONS} />
          <div data-tour="body" className="relative min-h-0 min-w-0 flex-1">
            <Stage3D />
          </div>
          <RegionColumn side="right" regions={RIGHT_REGIONS} />
        </div>
      </div>
    </section>
  )
}
