/** Plain-language formatting helpers shared by the engine. */
import type { MetricCode } from '../types/domain'
import { METRIC_CATALOG } from './catalog'

export const MIN_MS = 60_000
export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000

export function fmtValue(metric: MetricCode, v: number): string {
  const def = METRIC_CATALOG[metric]
  const s = v.toFixed(def.decimals)
  return def.unit === '%' ? `${s}%` : def.unit === 'score' || def.unit === '% of baseline' ? s : `${s} ${def.unit}`
}

/** "25 min", "5 hours", "3 days". */
export function fmtDuration(ms: number): string {
  const min = Math.max(0, ms) / MIN_MS
  if (min < 60) return `${Math.max(1, Math.round(min))} min`
  const h = min / 60
  if (h < 36) {
    const r = Math.round(h)
    return `${r} hour${r === 1 ? '' : 's'}`
  }
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'}`
}

/** Lower case label used inside sentences ("heart rate", "HRV"). */
export function inlineLabel(metric: MetricCode): string {
  const def = METRIC_CATALOG[metric]
  if (metric === 'HRV_RMSSD') return 'HRV'
  if (metric === 'CO2') return 'cabin CO₂'
  return def.label.charAt(0).toLowerCase() + def.label.slice(1)
}

/** Sentence case label ("Heart rate", "HRV"). */
export function sentenceLabel(metric: MetricCode): string {
  const s = inlineLabel(metric)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fmtClock(t: number): string {
  return new Date(t).toISOString().slice(11, 16) + ' UTC'
}
