import type { MetricCode, MetricState, Status, TimePoint } from '../types/domain'
import { METRIC_CATALOG } from '../engine/catalog'

export const NO_VALUE = '--'

export function fmtNum(v: number | null | undefined, decimals: number): string {
  if (v == null || !Number.isFinite(v)) return NO_VALUE
  return v.toFixed(decimals)
}

export function fmtMetric(code: MetricCode, v: number | null | undefined): string {
  return fmtNum(v, METRIC_CATALOG[code].decimals)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Mission elapsed time as "44d 08:12:33". */
export function formatMET(startIso: string, simNow: number): string {
  const start = Date.parse(startIso)
  let s = Math.max(0, Math.floor((simNow - start) / 1000))
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`
}

export function formatUtcTime(ms: number, seconds = true): string {
  const d = new Date(ms)
  const base = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  return seconds ? `${base}:${pad(d.getUTCSeconds())}` : base
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function formatUtcDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function relTime(ms: number, now: number): string {
  const diff = Math.max(0, now - ms)
  const min = diff / 60000
  if (min < 1) return 'just now'
  if (min < 60) return `${Math.round(min)} min ago`
  const h = min / 60
  if (h < 48) return `${Math.round(h)} h ago`
  return `${Math.round(h / 24)} d ago`
}

export function formatHours(h: number): string {
  if (h < 1) return 'less than 1 h'
  if (h < 10) return `~${(Math.round(h * 2) / 2).toString()} h`
  return `~${Math.round(h)} h`
}

export const SPEEDS: { value: number; label: string; hint: string }[] = [
  { value: 1, label: 'Real time', hint: '1 second per second' },
  { value: 60, label: '1 min/s', hint: '1 simulated minute per second' },
  { value: 3600, label: '1 h/s', hint: '1 simulated hour per second' },
  { value: 21600, label: '6 h/s', hint: '6 simulated hours per second' },
]

export function speedLabel(speed: number): string {
  return SPEEDS.find((s) => s.value === speed)?.label ?? `${speed}x`
}

export interface NormalDelta {
  text: string
  short: string
  tone: 'in' | 'above' | 'below' | 'none' | 'learning'
  pct: number | null
}

/**
 * Plain-language comparison against the personal baseline.
 * Within the band reads as normal; outside it reads as % from the person's typical value.
 */
export function deltaVsNormal(ms: MetricState | undefined, status?: Status): NormalDelta {
  if (!ms || ms.current == null || status === 'NO_DATA') return { text: 'Signal lost', short: 'Signal lost', tone: 'none', pct: null }
  const b = ms.baseline
  if (!b || b.status !== 'READY') return { text: 'Learning your normal', short: 'Learning', tone: 'learning', pct: null }
  const ref = Number.isFinite(b.median) && b.median !== 0 ? b.median : b.mean
  const pct = ref ? ((ms.current - ref) / Math.abs(ref)) * 100 : null
  if (ms.current >= b.low && ms.current <= b.high) {
    return { text: 'Within your normal range', short: 'In your normal', tone: 'in', pct }
  }
  const above = ms.current > b.high
  const mag = pct == null ? '' : `${Math.max(1, Math.round(Math.abs(pct)))}% `
  return {
    text: `${mag}${above ? 'above' : 'below'} your normal`,
    short: `${above ? '+' : '−'}${mag.trim() || ''} vs normal`,
    tone: above ? 'above' : 'below',
    pct,
  }
}

/** Keeps the points within the last `hours` relative to the newest point. */
export function lastHours(points: TimePoint[] | undefined, hours: number): TimePoint[] {
  if (!points || points.length === 0) return []
  const end = points[points.length - 1]!.t
  const from = end - hours * 3600000
  let i = points.length - 1
  while (i > 0 && points[i - 1]!.t >= from) i--
  return points.slice(i)
}

/** Bucketed downsample that preserves gaps (a bucket with any null stays null). */
export function downsample(points: TimePoint[], max: number): TimePoint[] {
  if (points.length <= max) return points
  const size = points.length / max
  const out: TimePoint[] = []
  for (let b = 0; b < max; b++) {
    const s = Math.floor(b * size)
    const e = Math.min(points.length, Math.floor((b + 1) * size))
    let sum = 0
    let n = 0
    let hasNull = false
    for (let i = s; i < e; i++) {
      const v = points[i]!.v
      if (v == null) hasNull = true
      else {
        sum += v
        n++
      }
    }
    out.push({ t: points[e - 1]!.t, v: hasNull && n < (e - s) / 2 ? null : n ? sum / n : null })
  }
  return out
}

export const QUALITY_LABEL: Record<string, string> = {
  VALID: 'Good signal',
  QUESTIONABLE: 'Questionable',
  INVALID: 'Invalid',
  MISSING: 'Missing',
}

export const ORIGIN_LABEL: Record<string, string> = {
  SIMULATED: 'Simulated',
  REAL_PUBLIC: 'Public dataset',
  DERIVED: 'Derived',
  MANUAL: 'Manual entry',
}
