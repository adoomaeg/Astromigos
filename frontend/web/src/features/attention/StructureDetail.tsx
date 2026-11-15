import { ArrowRight, BookOpen, ChevronLeft, Info, Layers } from 'lucide-react'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../state/store'
import type { BodyRegionId, Status } from '../../types/domain'
import { REGION_LABELS } from '../../engine/catalog'
import { StatusPill } from '../../components/Status'
import { Badge, IconButton, SectionLabel } from '../../components/ui'
import { REGION_ICON } from '../stage/CenterStage'
import { structureById } from '../anatomy/atlas/manifest'
import type { AtlasManifest, AtlasStructure } from '../anatomy/atlas/types'
import {
  CONTEXT_ONLY_TEXT,
  CONTEXT_ONLY_TITLE,
  ORIGIN_INFO,
  REFERENCE_MODEL_NOTE,
  REGION_RELATION,
  SYSTEM_INFO,
  atlasCoverage,
  regionOfStructure,
  sideLabel,
} from '../anatomy/atlas/health'
import { RegionDetail } from './RegionDetail'

function BackRow() {
  const selectStructure = useAppStore((s) => s.selectStructure)
  return (
    <div className="flex items-center gap-2">
      {/* selectStructure(null) clears the structure, its region and the open metric in one update. */}
      <IconButton label="Back to overview (clear selection)" size="sm" onClick={() => selectStructure(null)}>
        <ChevronLeft size={16} />
      </IconButton>
      <span className="text-xs text-ink-500">Overview</span>
    </div>
  )
}

/** Identity of the selected structure: name, system, side and where its 3D shape comes from. */
function StructureCard({ structure, manifest }: { structure: AtlasStructure; manifest: AtlasManifest }) {
  const selectStructure = useAppStore((s) => s.selectStructure)
  const region = regionOfStructure(structure)
  const system = SYSTEM_INFO[structure.system] ?? SYSTEM_INFO.other
  const side = sideLabel(structure)
  const origin = ORIGIN_INFO[structure.origin] ?? ORIGIN_INFO['z-anatomy']
  const coverage = useMemo(() => atlasCoverage(manifest, structure), [manifest, structure])
  const parent = structureById(manifest, structure.parent)
  const Icon = region ? REGION_ICON[region] : BookOpen
  const count = `${coverage.systemCount} ${coverage.systemCount === 1 ? 'structure' : 'structures'} in the atlas`
  return (
    <div className="rounded-xl bg-white/[0.035] p-3.5 ring-1 ring-white/[0.07] short:p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/10">
          <Icon size={19} className={region ? 'text-accent' : 'text-ink-300'} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Selected structure</div>
          <h3 className="text-lg leading-tight font-semibold [overflow-wrap:anywhere] text-ink-100">{structure.name}</h3>
          <div className="mt-0.5 text-xs text-ink-300">
            {system.label}
            {side ? ` · ${side}` : ''}
          </div>
        </div>
        {!region && (
          <Badge tone="muted" title={CONTEXT_ONLY_TEXT}>
            {CONTEXT_ONLY_TITLE}
          </Badge>
        )}
      </div>
      <dl className="mt-3 flex flex-col gap-1.5 border-t border-white/[0.06] pt-2.5 text-xs short:mt-2.5 short:pt-2">
        <div className="flex items-center justify-between gap-3">
          <dt className="shrink-0 text-ink-500">Reference anatomy</dt>
          <dd className="min-w-0">
            <Badge tone="neutral" title={`${origin.detail} ${REFERENCE_MODEL_NOTE}`}>
              {origin.label}
            </Badge>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="flex min-w-0 items-center gap-1 text-ink-500">
            <Layers size={11} className="shrink-0" aria-hidden />
            <span className="truncate">{system.label}</span>
          </dt>
          <dd className="tabular shrink-0 text-right text-ink-300">{count}</dd>
        </div>
        {parent && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-ink-500">Part of</dt>
            <dd className="min-w-0 text-right">
              <button
                type="button"
                onClick={() => selectStructure(parent.id, regionOfStructure(parent))}
                className="focus-ring rounded font-semibold text-accent hover:underline"
                aria-label={`Select ${parent.name}`}
              >
                {parent.name}
              </button>
            </dd>
          </div>
        )}
      </dl>
      <details className="group mt-2 text-[11px] text-ink-500 present:hidden short:hidden">
        <summary className="focus-ring inline-flex cursor-pointer list-none items-center gap-1 rounded hover:text-ink-300 [&::-webkit-details-marker]:hidden">
          <Info size={11} aria-hidden />
          About this reference model
        </summary>
        <p className="mt-1 leading-relaxed">
          {origin.detail} {REFERENCE_MODEL_NOTE}
        </p>
      </details>
    </div>
  )
}

/** The region a structure is monitored with: name, status of that region and the way to open it. */
function MonitoredWith({ astronautId, region, structure, manifest }: { astronautId: string; region: BodyRegionId; structure: AtlasStructure; manifest: AtlasManifest }) {
  const { status, summary } = useAppStore(
    useShallow((s) => {
      const r = s.health[astronautId]?.regions[region]
      return { status: (r?.status ?? 'NO_DATA') as Status, summary: r?.summary ?? '' }
    }),
  )
  const selectRegion = useAppStore((s) => s.selectRegion)
  const label = REGION_LABELS[region]
  const relation = REGION_RELATION[region]
  const coverage = useMemo(() => atlasCoverage(manifest, structure), [manifest, structure])
  const Icon = REGION_ICON[region]
  return (
    <section aria-label={`Monitored with ${label.label}`}>
      <SectionLabel
        right={
          <button
            type="button"
            onClick={() => selectRegion(region)}
            aria-label={`View the whole ${label.label} region, ${coverage.monitoredCount} structures. Clears the selected structure.`}
            title="Select the whole region in the 3D body and clear this structure"
            className="focus-ring flex items-center gap-1 rounded px-1 text-[11px] font-semibold text-accent hover:underline"
          >
            Whole region
            <span className="tabular font-normal text-ink-500">({coverage.monitoredCount})</span>
            <ArrowRight size={12} aria-hidden />
          </button>
        }
      >
        Monitored with
      </SectionLabel>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={16} className="shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            <div className="truncate text-[14px] leading-tight font-semibold text-ink-100">{label.label}</div>
            <div className="truncate text-[11px] text-ink-500">{label.system}</div>
          </div>
        </div>
        <StatusPill status={status} />
      </div>
      <p className="mt-2 text-[14px] leading-snug text-ink-100">{summary || (status === 'NO_DATA' ? 'No recent data for this system. Missing data is never treated as normal.' : label.description)}</p>
      <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-ink-500">
        <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          {relation.basis} {relation.caveat}
        </span>
      </p>
    </section>
  )
}

/** Calm explanation for structures nothing monitors. Never a status, never a warning color. */
function ContextOnlyCard({ structure }: { structure: AtlasStructure }) {
  const system = SYSTEM_INFO[structure.system] ?? SYSTEM_INFO.other
  return (
    <section aria-label="Context only" className="rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.07]">
      <div className="flex items-center gap-2 text-[14px] font-semibold text-ink-100">
        <BookOpen size={15} className="shrink-0 text-ink-300" aria-hidden />
        {CONTEXT_ONLY_TITLE}: not monitored
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-300">{CONTEXT_ONLY_TEXT}</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-500">
        {system.description} {system.monitoring}
      </p>
      <p className="mt-2 border-t border-white/[0.06] pt-2 text-xs leading-relaxed text-ink-500">No status is shown here because nothing is measured. That is not the same as normal.</p>
    </section>
  )
}

/**
 * Right panel content for a structure selected in the 3D atlas: what it is, then either the
 * health data of the region it is monitored with (the regular RegionDetail, reused) or a calm
 * "context only" explanation.
 */
export function StructureDetail({ astronautId, structure, manifest }: { astronautId: string; structure: AtlasStructure; manifest: AtlasManifest }) {
  const region = regionOfStructure(structure)
  return (
    <div className="flex flex-col gap-4 short:gap-3">
      <BackRow />
      <StructureCard structure={structure} manifest={manifest} />
      {region ? (
        <>
          <MonitoredWith astronautId={astronautId} region={region} structure={structure} manifest={manifest} />
          <RegionDetail astronautId={astronautId} region={region} embedded />
        </>
      ) : (
        <ContextOnlyCard structure={structure} />
      )}
    </div>
  )
}

/** Shown when a structure id is selected but the atlas cannot describe it (still loading, or unavailable). */
export function StructureUnavailable({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <BackRow />
      <div className="rounded-xl bg-white/[0.03] px-3 py-3 text-[13px] leading-relaxed text-ink-300 ring-1 ring-white/[0.06]" role="status">
        {loading ? 'Loading the anatomy reference...' : 'The anatomy reference is not available, so this structure cannot be described. Body systems stay available from the chips beside the body.'}
      </div>
    </div>
  )
}
