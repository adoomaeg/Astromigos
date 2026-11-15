import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../state/store'
import { useUiStore } from '../../app/uiStore'
import type { BodyRegionId, MetricCode, Recommendation, Status } from '../../types/domain'
import { RISK_ORDER } from '../../lib/status'
import { METRIC_CATALOG } from '../../engine/catalog'
import type { ChartEvent } from '../../components/TrendChart'
import { structureById, useAtlasManifest } from '../anatomy/atlas/manifest'
import type { AtlasManifest, AtlasStructure } from '../anatomy/atlas/types'

export const BODY_REGIONS: BodyRegionId[] = ['brain', 'heart', 'lungs', 'kidneys', 'muscles', 'bones', 'skin']

export function regionMetricsFromCatalog(region: BodyRegionId): MetricCode[] {
  return (Object.keys(METRIC_CATALOG) as MetricCode[]).filter((m) => METRIC_CATALOG[m].region === region)
}

export const useSelectedId = () => useAppStore((s) => s.selectedAstronautId)

export function useAstronaut(id: string) {
  return useAppStore((s) => s.crew.find((c) => c.id === id))
}

export function useMetric(astronautId: string, metric: MetricCode) {
  return useAppStore((s) => s.health[astronautId]?.metrics[metric])
}

export function useHistory(subjectId: string, metric: MetricCode) {
  return useAppStore((s) => s.history[subjectId]?.[metric])
}

export function useRisk(astronautId: string) {
  return useAppStore((s) => s.health[astronautId]?.risk)
}

export const SIGNAL_LOST_HEADLINE = 'No live readings from the wearable. Missing data is never treated as normal: check the sensor.'

/** True when the core wearable vitals are missing for this astronaut. */
export function useSignalLost(astronautId: string): boolean {
  return useAppStore((s) => {
    const m = s.health[astronautId]?.metrics
    if (!m) return true
    const hr = m.HEART_RATE
    const spo2 = m.SPO2
    return (hr?.status === 'NO_DATA' || hr?.current == null) && (spo2?.status === 'NO_DATA' || spo2?.current == null)
  })
}

export function useActions() {
  return useAppStore(
    useShallow((s) => ({
      selectAstronaut: s.selectAstronaut,
      selectRegion: s.selectRegion,
      selectMetric: s.selectMetric,
      setScenario: s.setScenario,
      play: s.play,
      pause: s.pause,
      setSpeed: s.setSpeed,
      reset: s.reset,
      acknowledgeAlert: s.acknowledgeAlert,
      logIntervention: s.logIntervention,
      dismissRecommendation: s.dismissRecommendation,
    })),
  )
}

/**
 * Select an astronaut, region and metric in one go (used by alerts, factors and tiles).
 * Alerts and metrics are region level, so this selects the region and clears any selected
 * anatomical structure. One exception: when a structure of that same region is already
 * selected it stays selected (its panel shows the region data), and only the metric changes.
 */
export function focusTarget(target: { astronautId?: string | null; region?: BodyRegionId | 'environment' | null; metric?: MetricCode | null }) {
  const s = useAppStore.getState()
  if (target.astronautId && s.crew.some((c) => c.id === target.astronautId) && target.astronautId !== s.selectedAstronautId) {
    s.selectAstronaut(target.astronautId)
  }
  let region = target.region ?? null
  if (!region && target.metric) region = METRIC_CATALOG[target.metric].region
  if (region && region !== 'environment') {
    const cur = useAppStore.getState()
    if (!(cur.selectedStructureId && cur.selectedRegion === region)) cur.selectRegion(region)
    useAppStore.getState().selectMetric(target.metric ?? null)
  }
}

/** Back to the overview: clears the selected structure, region and metric in one update. */
export function clearSelection() {
  useAppStore.getState().selectStructure(null)
}

/**
 * The anatomical structure selected in the 3D atlas, resolved against the atlas manifest.
 * `structure` is null while the manifest loads, when the atlas is unavailable (procedural
 * fallback) or when the id is unknown; `pending` tells loading apart from unavailable.
 */
export function useSelectedStructure(): { structureId: string | null; structure: AtlasStructure | null; manifest: AtlasManifest | null; pending: boolean } {
  const structureId = useAppStore((s) => s.selectedStructureId)
  const { manifest, error } = useAtlasManifest()
  const structure = useMemo(() => (manifest ? structureById(manifest, structureId) : null), [manifest, structureId])
  return { structureId, structure, manifest, pending: !manifest && !error }
}

/**
 * Esc clears a selected structure that has no monitored region (context only). When a region is
 * selected the global shortcut already handles Esc (selectRegion(null) also clears the structure).
 * Like the global shortcuts, it never fights an open dialog, the guided demo or a text field.
 */
export function useEscapeClearsStructure() {
  const active = useAppStore((s) => s.selectedStructureId != null && s.selectedRegion == null)
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      const ui = useUiStore.getState()
      if (ui.tour.active || ui.shortcutsOpen) return
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return
      clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}

/** One-way Earth link delay in seconds: the active comm profile, else the mission default. */
export function useCommDelaySec(): number {
  return useAppStore((s) => s.commProfiles?.find((p) => p.id === s.commProfileId)?.oneWayDelaySec ?? s.mission.commDelaySec ?? 0)
}

/** A one-way delay above this (seconds) makes ground support a slow loop worth calling out. */
export const LARGE_DELAY_SEC = 60

/** Earliest round trip to Earth in plain words, e.g. "44 min". */
export function roundTripText(oneWaySec: number): string {
  const rt = oneWaySec * 2
  if (rt < 10) return `${rt.toFixed(1)} s`
  if (rt < 120) return `${Math.round(rt)} s`
  return `${Math.round(rt / 60)} min`
}

/** Calm sentence about the Earth link for the crew. */
export function earthLinkSentence(oneWaySec: number): { text: string; far: boolean } {
  if (oneWaySec >= LARGE_DELAY_SEC) return { text: `Earth replies take at least ${roundTripText(oneWaySec)}. Follow on-board steps first.`, far: true }
  if (oneWaySec >= 1) return { text: `Earth link delay is about ${Math.round(oneWaySec * 10) / 10} s each way. Ground support is close at hand.`, far: false }
  return { text: 'Mission Control is a near real time call away.', far: false }
}

/** Status of one astronaut for cards and avatars (missing core vitals never read as normal). */
export function useCrewStatus(astronautId: string): Status {
  const level = useAppStore((s) => s.health[astronautId]?.risk.risk_level)
  const lost = useSignalLost(astronautId)
  return level == null ? 'NO_DATA' : lost && level === 'LOW' ? 'NO_DATA' : level
}

const SCALE_WORD = ['', 'very low', 'low', 'okay', 'good', 'very good']
const FATIGUE_WORD = ['', 'rested', 'a little tired', 'tired', 'very tired', 'exhausted']

/** Alerts, logged actions and check-ins for one astronaut, as chart markers. */
export function useChartEvents(astronautId: string, metric: MetricCode | null, region: BodyRegionId | null): ChartEvent[] {
  const alerts = useAppStore((s) => s.alerts)
  const interventions = useAppStore((s) => s.interventions)
  const checkIns = useAppStore((s) => s.checkIns)
  return useMemo(() => {
    const out: ChartEvent[] = []
    for (const a of alerts) {
      if (a.astronautId !== astronautId) continue
      const aRegion = a.region ?? (a.metric ? METRIC_CATALOG[a.metric].region : null)
      if (metric && a.metric !== metric && aRegion !== region) continue
      out.push({ id: `a-${a.id}`, t: a.createdAt, kind: 'alert', label: a.title, severity: a.severity, detail: a.acknowledgedAt != null ? 'Acknowledged' : a.resolvedAt != null ? 'Resolved' : 'Open' })
    }
    for (const i of interventions) {
      if (i.astronautId !== astronautId) continue
      const kind = i.kind.replaceAll('_', ' ').toLowerCase()
      out.push({ id: `i-${i.id}`, t: i.loggedAt, kind: 'intervention', label: kind.charAt(0).toUpperCase() + kind.slice(1), detail: i.note || `Logged by ${i.actor}` })
    }
    for (const c of checkIns ?? []) {
      if (c.astronautId !== astronautId) continue
      out.push({
        id: `c-${c.id}`,
        t: c.at,
        kind: 'checkin',
        label: `Mood ${SCALE_WORD[c.mood] ?? c.mood}, feeling ${FATIGUE_WORD[c.fatigue] ?? c.fatigue}`,
        detail: c.symptoms.length ? `Symptoms: ${c.symptoms.join(', ')}` : c.note || undefined,
      })
    }
    return out
  }, [alerts, interventions, checkIns, astronautId, metric, region])
}

/** Pending, active recommendations for one astronaut (plus cabin-wide ones), most urgent first. */
export function usePendingActions(astronautId: string): Recommendation[] {
  const recommendations = useAppStore((s) => s.recommendations)
  return useMemo(
    () =>
      recommendations
        .filter((r) => r.status === 'PENDING' && r.active !== false && (r.astronautId === astronautId || r.astronautId === 'CABIN'))
        .sort((a, b) => RISK_ORDER.indexOf(b.priority) - RISK_ORDER.indexOf(a.priority) || b.createdAt - a.createdAt),
    [recommendations, astronautId],
  )
}
