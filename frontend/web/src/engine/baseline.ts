/**
 * Personal baseline.
 *
 * Robust statistics (median, MAD, p05, p95) over the astronaut's own recent values,
 * per activity context when the metric depends on it (sleep, rest, work, exercise).
 * The normal band is median +/- BASELINE.bandK robust SD, where robust SD is
 * 1.4826 x MAD floored by a per metric minimum. Below a minimum sample size the
 * baseline is INSUFFICIENT_DATA and no deviation rule uses it.
 */
import type { Baseline, MetricCode } from '../types/domain'
import { BASELINE, BASELINE_VERSION } from './config'
import { clamp, mad, mean, quantileSorted, robustScale, sd, sortedCopy } from './stats'

export interface BaselineOptions {
  metric: MetricCode
  minN: number
  minScale: number
  bandK?: number
  windowLabel: string
  physicalMin?: number
  physicalMax?: number
}

export function computeBaseline(values: ArrayLike<number>, opts: BaselineOptions): Baseline {
  const n = values.length
  const bandK = opts.bandK ?? BASELINE.bandK
  if (n === 0) {
    return {
      metric: opts.metric,
      status: 'INSUFFICIENT_DATA',
      n: 0,
      mean: 0,
      median: 0,
      sd: 0,
      mad: 0,
      p05: 0,
      p95: 0,
      low: 0,
      high: 0,
      windowLabel: opts.windowLabel,
      version: BASELINE_VERSION,
    }
  }
  const sorted = sortedCopy(values)
  const med = quantileSorted(sorted, 0.5)
  const m = mad(sorted, med)
  const scale = robustScale(m, opts.minScale)
  const lo = opts.physicalMin ?? -Infinity
  const hi = opts.physicalMax ?? Infinity
  return {
    metric: opts.metric,
    status: n >= opts.minN ? 'READY' : 'INSUFFICIENT_DATA',
    n,
    mean: mean(sorted),
    median: med,
    sd: sd(sorted),
    mad: m,
    p05: quantileSorted(sorted, 0.05),
    p95: quantileSorted(sorted, 0.95),
    low: clamp(med - bandK * scale, lo, hi),
    high: clamp(med + bandK * scale, lo, hi),
    windowLabel: opts.windowLabel,
    version: BASELINE_VERSION,
  }
}

/** Robust scale of a baseline (what one z unit means), honoring the metric floor. */
export function baselineScale(b: Baseline, minScale: number): number {
  return robustScale(b.mad, minScale)
}

/** Fixed size ring buffer of accepted baseline samples. O(1) push, no re-sorting on push. */
export class Reservoir {
  private readonly buf: Float64Array
  private next = 0
  size = 0

  constructor(capacity: number) {
    this.buf = new Float64Array(capacity)
  }

  push(v: number): void {
    this.buf[this.next] = v
    this.next = (this.next + 1) % this.buf.length
    if (this.size < this.buf.length) this.size++
  }

  /** Copy of the current contents (order does not matter for quantiles). */
  values(): Float64Array {
    return this.size === this.buf.length ? this.buf.slice() : this.buf.slice(0, this.size)
  }
}
