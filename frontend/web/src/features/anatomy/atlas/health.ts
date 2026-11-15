/**
 * Health mapping: relates anatomical structures to the body regions and metrics the platform
 * monitors. This is the only place that links anatomy to health data. It reuses the existing
 * contracts (BodyRegionId, METRIC_CATALOG, AstronautHealth) and adds no data of its own.
 *
 * A structure with no monitored region is "context only": it can be explored, but the platform
 * has no device or metric for it, and it never shows a health status.
 *
 * Mapping rules (structure -> region -> metrics). Metrics always come from METRIC_CATALOG, by the
 * region each metric already declares there; this file never lists or invents indicators.
 *
 * | Structures                                   | Region  | Why                                                         |
 * |----------------------------------------------|---------|-------------------------------------------------------------|
 * | integumentary (skin)                         | skin    | Skin temperature is read on the body surface (smart shirt). |
 * | skeletal: bones, cartilage, joints           | bones   | Accumulated radiation dose (personal dosimeter) is whole    |
 * |                                              |         | body exposure, shown as long term bone health context.      |
 * | skeletal: teeth                              | none    | Nothing relates to teeth. Context only.                     |
 * | muscular: muscles and tendons                | muscles | Activity (wrist sensor) and exercise performance describe   |
 * |                                              |         | the muscles as a whole.                                     |
 * | cardiovascular: heart, arteries, veins       | heart   | Heart rate, HRV and arterial blood pressure describe the    |
 * |                                              |         | heart and circulation as a whole, not one vessel.           |
 * | respiratory: lungs, airways, larynx,         | lungs   | Breathing rate and blood oxygen describe breathing and gas  |
 * | diaphragm                                    |         | exchange as a whole.                                        |
 * | nervous: brain structures only               | brain   | Sleep, reaction time and self report are RELATED INDICATORS |
 * |                                              |         | of alertness and recovery, never neurological measurements. |
 * | nervous: spinal cord, nerves, plexuses       | none    | Context only.                                               |
 * | urinary: kidneys only                        | kidneys | Hydration index, estimated from fluid intake logs. A        |
 * |                                              |         | related indicator, not a kidney function measurement.       |
 * | urinary: ureters, bladder, urethra           | none    | Context only.                                               |
 * | digestive, other (glands, lymphoid, senses)  | none    | Context only.                                               |
 *
 * Everything here is pure TypeScript (no React, no three.js), so it is unit tested in node.
 */
import type { Alert, Anomaly, AppState, AstronautHealth, BodyRegionId, MetricCode, MetricState, Status, TimePoint } from '../../../types/domain'
import { METRIC_CATALOG } from '../../../engine/catalog'
import type { AnatomySystemId, AtlasManifest, AtlasStructure } from './types'

// ---------------------------------------------------------------------------
// Structure -> region
// ---------------------------------------------------------------------------

/** Ids of brain structures (whole brain, its parts and lobes). */
const BRAIN_IDS = /^(brain|cerebrum|cerebral|cerebellum|cerebellar|brainstem|diencephalon|midbrain|pons|medulla-oblongata|thalamus|hypothalamus)(-|$)/
/** Nervous structures that are never the brain, whatever material the viewer gives them. */
const NOT_BRAIN_IDS = /(^|-)(spinal|nerve|nerves|plexus|ganglion|ganglia|cauda)(-|$)/

/**
 * True for structures of the brain itself. Only these map to the 'brain' region; the spinal
 * cord and peripheral nerves do not, because no indicator of the platform relates to them.
 */
export function isBrainStructure(s: AtlasStructure): boolean {
  if (s.system !== 'nervous' || NOT_BRAIN_IDS.test(s.id)) return false
  return BRAIN_IDS.test(s.id) || s.tissue === 'brain'
}

/** Body region a structure reports under, or null when nothing monitors it. */
export function regionOfStructure(s: AtlasStructure): BodyRegionId | null {
  switch (s.system) {
    case 'integumentary':
      return 'skin'
    case 'skeletal':
      return s.tissue === 'tooth' ? null : 'bones'
    case 'muscular':
      return 'muscles'
    case 'cardiovascular':
      return 'heart'
    case 'respiratory':
      return 'lungs'
    case 'nervous':
      return isBrainStructure(s) ? 'brain' : null
    case 'urinary':
      return s.tissue === 'kidney' ? 'kidneys' : null
    default:
      return null
  }
}

/** True when no device or metric of the platform relates to the structure. */
export function isContextOnly(s: AtlasStructure): boolean {
  return regionOfStructure(s) === null
}

export function structuresOfRegion(manifest: AtlasManifest, region: BodyRegionId): AtlasStructure[] {
  return manifest.structures.filter((s) => regionOfStructure(s) === region)
}

/** Metric codes of the catalog that belong to a body region, in catalog order. */
export function metricsOfRegion(region: BodyRegionId): MetricCode[] {
  return (Object.keys(METRIC_CATALOG) as MetricCode[]).filter((code) => METRIC_CATALOG[code].region === region)
}

/** Metric codes of the catalog that belong to the structure's region (empty when context only). */
export function relatedMetrics(s: AtlasStructure): MetricCode[] {
  const region = regionOfStructure(s)
  return region ? metricsOfRegion(region) : []
}

/** Status of the structure's region for one astronaut. null = context only (not monitored). */
export function structureStatus(health: AstronautHealth | undefined, s: AtlasStructure): Status | null {
  const region = regionOfStructure(s)
  if (!region) return null
  return health?.regions?.[region]?.status ?? 'NO_DATA'
}

/**
 * Candidate ids of the structure that best stands for a region: the organ the region is named
 * after. Paired organs prefer a merged id, then the left one, then the right one. Whole body
 * systems (muscles, bones) have no single representative: they stay a region level selection.
 */
const PRIMARY_IDS: Record<BodyRegionId, string[]> = {
  brain: ['brain'],
  heart: ['heart'],
  lungs: ['lungs', 'lung-left', 'lung-right'],
  kidneys: ['kidneys', 'kidney-left', 'kidney-right'],
  skin: ['skin'],
  muscles: [],
  bones: [],
}

/**
 * Structure to use when a region needs one representative (camera target, default selection).
 * null for muscles and bones (on purpose) and when the atlas does not hold the organ.
 */
export function primaryStructureOfRegion(manifest: AtlasManifest, region: BodyRegionId): AtlasStructure | null {
  for (const id of PRIMARY_IDS[region]) {
    const s = manifest.structures.find((x) => x.id === id)
    if (s && regionOfStructure(s) === region) return s
  }
  return null
}

// ---------------------------------------------------------------------------
// Plain language: systems, sides, origin, how the indicators relate
// ---------------------------------------------------------------------------

export interface SystemInfo {
  /** Display label, e.g. "Cardiovascular system". */
  label: string
  /** One plain sentence about what the system is. */
  description: string
  /**
   * How much of the system the platform relates to health data: every structure ('monitored'),
   * some of them ('partial') or none ('context').
   */
  coverage: 'monitored' | 'partial' | 'context'
  /** One plain sentence about what the platform tracks for the system (or that it tracks nothing). */
  monitoring: string
}

export const SYSTEM_INFO: Record<AnatomySystemId, SystemInfo> = {
  integumentary: {
    label: 'Integumentary system',
    description: 'The skin: the body surface and its first barrier.',
    coverage: 'monitored',
    monitoring: 'Tracked through skin temperature from the smart shirt.',
  },
  skeletal: {
    label: 'Skeletal system',
    description: 'Bones, cartilage and joints that support and protect the body.',
    coverage: 'partial',
    monitoring: 'Tracked through accumulated radiation dose, as long term bone health context. Teeth are shown for reference only.',
  },
  muscular: {
    label: 'Muscular system',
    description: 'Skeletal muscles and tendons that move the body.',
    coverage: 'monitored',
    monitoring: 'Tracked through activity and exercise performance against the personal usual.',
  },
  cardiovascular: {
    label: 'Cardiovascular system',
    description: 'The heart and the blood vessels that carry blood around the body.',
    coverage: 'monitored',
    monitoring: 'Tracked through heart rate, heart rate variability and blood pressure.',
  },
  respiratory: {
    label: 'Respiratory system',
    description: 'Airways and lungs: breathing and gas exchange.',
    coverage: 'monitored',
    monitoring: 'Tracked through breathing rate and blood oxygen.',
  },
  nervous: {
    label: 'Nervous system',
    description: 'Brain, spinal cord and nerves.',
    coverage: 'partial',
    monitoring: 'Only brain structures have related indicators (sleep, reaction time, self report). The spinal cord and nerves are shown for reference only.',
  },
  digestive: {
    label: 'Digestive system',
    description: 'Organs that take in and process food.',
    coverage: 'context',
    monitoring: 'No device or metric of this prototype relates to the digestive system.',
  },
  urinary: {
    label: 'Urinary system',
    description: 'Kidneys, ureters and bladder: fluid balance and waste removal.',
    coverage: 'partial',
    monitoring: 'Only the kidneys have a related indicator (hydration index from fluid intake logs). Ureters and bladder are shown for reference only.',
  },
  other: {
    label: 'Other organs',
    description: 'Endocrine glands, lymphoid organs and sense organs.',
    coverage: 'context',
    monitoring: 'No device or metric of this prototype relates to these organs.',
  },
}

/** "Left side", "Right side" or null for midline or merged structures. */
export function sideLabel(s: Pick<AtlasStructure, 'side'>): string | null {
  return s.side === 'L' ? 'Left side' : s.side === 'R' ? 'Right side' : null
}

/** Where the geometry of a structure comes from, for the "Reference anatomy" note. */
export const ORIGIN_INFO: Record<AtlasStructure['origin'], { label: string; detail: string }> = {
  'z-anatomy': {
    label: 'Z-Anatomy atlas',
    detail: 'Open 3D atlas of human anatomy (CC BY-SA 4.0), based on BodyParts3D.',
  },
  'ahi-procedural': {
    label: 'AHI procedural',
    detail: 'Shape built by AHI code and fitted to the position and size of the atlas organ, because the upstream model is not redistributable.',
  },
}

/** The atlas is one reference body, never the crew member's own anatomy. */
export const REFERENCE_MODEL_NOTE = 'One adult reference model is used for every crew member. It is not a scan of this astronaut.'

/** Text for structures nothing monitors. Calm on purpose: it is not a warning and not a status. */
export const CONTEXT_ONLY_TITLE = 'Context only'
export const CONTEXT_ONLY_TEXT = 'No device or metric monitors this structure in the current prototype. It is shown for anatomical reference.'

/**
 * How the indicators of a region relate to its structures, in plain words. `basis` says where
 * the numbers come from, `caveat` says what they are not (so an indicator is never read as a
 * measurement of the selected structure, and never as a diagnosis).
 */
export const REGION_RELATION: Record<BodyRegionId, { basis: string; caveat: string }> = {
  brain: {
    basis: 'Sleep, reaction time and the daily self report are related indicators of alertness and recovery.',
    caveat: 'They are behavioral and self reported signals, not neurological measurements.',
  },
  heart: {
    basis: 'Heart rate, heart rate variability and blood pressure describe the heart and circulation as a whole.',
    caveat: 'They are not measurements of this structure.',
  },
  lungs: {
    basis: 'Breathing rate and blood oxygen describe breathing and gas exchange as a whole.',
    caveat: 'They are not measurements of this structure.',
  },
  kidneys: {
    basis: 'The hydration index is estimated from fluid intake logs.',
    caveat: 'It is a related indicator, not a measurement of kidney function.',
  },
  muscles: {
    basis: 'Activity and exercise performance describe the muscles as a whole, compared with the personal usual.',
    caveat: 'They are not measurements of this structure.',
  },
  bones: {
    basis: 'Accumulated radiation dose is whole body exposure, shown as long term bone health context.',
    caveat: 'No device measures bone density in this prototype.',
  },
  skin: {
    basis: 'Skin temperature is one surface reading from the smart shirt.',
    caveat: 'It is not a map of the whole skin.',
  },
}

// ---------------------------------------------------------------------------
// Atlas counts (for "Cardiovascular system: 14 structures in the atlas")
// ---------------------------------------------------------------------------

export interface AtlasCoverage {
  system: AnatomySystemId
  /** Structures of the system in the atlas. */
  systemCount: number
  /** Structures of the system that report under the same region (0 when context only). */
  monitoredCount: number
}

/** Counts for the system of a structure: how many structures exist and how many report with it. */
export function atlasCoverage(manifest: AtlasManifest, s: AtlasStructure): AtlasCoverage {
  const region = regionOfStructure(s)
  let systemCount = 0
  let monitoredCount = 0
  for (const x of manifest.structures) {
    if (x.system !== s.system) continue
    systemCount++
    if (region && regionOfStructure(x) === region) monitoredCount++
  }
  return { system: s.system, systemCount, monitoredCount }
}

/** Number of atlas structures that report under a region. */
export function regionStructureCount(manifest: AtlasManifest, region: BodyRegionId): number {
  let n = 0
  for (const s of manifest.structures) if (regionOfStructure(s) === region) n++
  return n
}

// ---------------------------------------------------------------------------
// Alerts and anomalies of a region
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<Alert['severity'], number> = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 }

/** An alert nobody acknowledged and that did not resolve on its own. */
export function isActiveAlert(a: Alert): boolean {
  return a.acknowledgedAt == null && a.resolvedAt == null
}

/** Region an alert belongs to: its own region, else the region of the metric that triggered it. */
export function alertRegion(a: Pick<Alert, 'region' | 'metric'>): BodyRegionId | 'environment' | null {
  return a.region ?? (a.metric ? METRIC_CATALOG[a.metric].region : null)
}

/** Active alerts of one astronaut in one region, most severe first, then newest first. */
export function regionAlerts(alerts: Alert[], astronautId: string, region: BodyRegionId): Alert[] {
  return alerts
    .filter((a) => a.astronautId === astronautId && isActiveAlert(a) && alertRegion(a) === region)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.createdAt - a.createdAt)
}

/**
 * Anomalies (statistical flags) of one astronaut in one region, newest first. With `sinceMs`
 * only the flags detected at or after that sim time are kept.
 */
export function regionAnomalies(anomalies: Anomaly[], astronautId: string, region: BodyRegionId, sinceMs?: number): Anomaly[] {
  return anomalies
    .filter((a) => a.astronautId === astronautId && METRIC_CATALOG[a.metric].region === region && (sinceMs == null || a.detectedAt >= sinceMs))
    .sort((a, b) => b.detectedAt - a.detectedAt)
}

/** Plain words for how an anomaly was found. */
export const ANOMALY_METHOD_LABEL: Record<Anomaly['method'], string> = {
  ROBUST_Z: 'Far from personal normal',
  EWMA: 'Slow drift',
  PERSISTENCE: 'Persistent deviation',
  COMBINED: 'Deviation and drift',
  DATA_QUALITY: 'Data quality',
}

/**
 * Last measured value at or before `t` in an ascending history (binary search). null when the
 * history does not reach that far back or the reading was missing: never a made up number.
 */
export function observedAt(points: TimePoint[] | undefined, t: number): number | null {
  if (!points || points.length === 0 || points[0]!.t > t) return null
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (points[mid]!.t <= t) lo = mid
    else hi = mid - 1
  }
  return points[lo]!.v
}

// ---------------------------------------------------------------------------
// Structure health view
// ---------------------------------------------------------------------------

/** Everything the UI needs to say about one structure for one astronaut. */
export interface StructureHealthView {
  structure: AtlasStructure
  system: SystemInfo
  /** Region the structure reports under, or null when it is context only. */
  region: BodyRegionId | null
  monitored: boolean
  /** Status of the region. null = context only: there is no status to show. */
  status: Status | null
  /** Plain language summary of the region ('' when context only or not computed yet). */
  summary: string
  /** Catalog metrics related to the structure (empty when context only). */
  metricCodes: MetricCode[]
  /** Live state of those metrics, in catalog order. Metrics without state are in `missing`. */
  metrics: MetricState[]
  /** Related metrics with no state at all. Missing data is never treated as normal. */
  missing: MetricCode[]
  /** Active alerts of the region for this astronaut, most severe first. */
  alerts: Alert[]
  /** Anomalies (statistical flags) of the region for this astronaut, newest first. */
  anomalies: Anomaly[]
  /** Explanation for context only structures, null when the structure is monitored. */
  contextNote: string | null
}

export interface StructureHealthOptions {
  /** Keep only anomalies detected at or after this sim time. */
  anomaliesSinceMs?: number
}

/**
 * Pure selector over the store state. It allocates new arrays, so do not pass it straight to
 * `useAppStore` (the snapshot would never be stable): select the slices it needs (`health`,
 * `alerts`, `anomalies`) and memoize, or use the narrow hooks of the attention panel.
 */
export function selectStructureHealth(
  state: Pick<AppState, 'health' | 'alerts' | 'anomalies'>,
  astronautId: string,
  structure: AtlasStructure,
  options: StructureHealthOptions = {},
): StructureHealthView {
  const system = SYSTEM_INFO[structure.system]
  const region = regionOfStructure(structure)
  if (!region) {
    return {
      structure,
      system,
      region: null,
      monitored: false,
      status: null,
      summary: '',
      metricCodes: [],
      metrics: [],
      missing: [],
      alerts: [],
      anomalies: [],
      contextNote: CONTEXT_ONLY_TEXT,
    }
  }
  const health = state.health[astronautId]
  const metricCodes = metricsOfRegion(region)
  const metrics: MetricState[] = []
  const missing: MetricCode[] = []
  for (const code of metricCodes) {
    const ms = health?.metrics?.[code]
    if (ms) metrics.push(ms)
    else missing.push(code)
  }
  return {
    structure,
    system,
    region,
    monitored: true,
    status: structureStatus(health, structure),
    summary: health?.regions?.[region]?.summary ?? '',
    metricCodes,
    metrics,
    missing,
    alerts: regionAlerts(state.alerts, astronautId, region),
    anomalies: regionAnomalies(state.anomalies, astronautId, region, options.anomaliesSinceMs),
    contextNote: null,
  }
}
