/**
 * Bounded history storage for one subject + metric.
 *
 * Continuous metrics keep two tiers: the last SIM.fineWindowMin minutes at full
 * (1 minute) resolution, and older points decimated to SIM.coarseResolutionMin,
 * for at most SIM.historyDays days. Event metrics (sleep, exercise sessions,
 * reaction tests) keep the last SIM.maxEventPoints points.
 *
 * TimePoint objects are created once and shared with the published history, so
 * publishing a snapshot only copies references, never re-creates points.
 */
import type { TimePoint } from '../types/domain'
import { SIM } from './config'
import { DAY_MS, MIN_MS } from './text'

export type SeriesKind = 'continuous' | 'event'

/** Context bucket codes stored alongside each point (see anomaly.ts). */
export type BucketCode = number

export class MetricSeries {
  readonly kind: SeriesKind
  private coarse: TimePoint[] = []
  private coarseB: BucketCode[] = []
  private coarseHead = 0
  private fine: TimePoint[] = []
  private fineB: BucketCode[] = []
  private fineHead = 0
  private cache: TimePoint[] | null = null
  lastPushT = -Infinity
  private readonly fineWindowMs: number
  private readonly retentionMs: number
  private readonly coarseMs: number

  constructor(kind: SeriesKind, retentionDays: number = SIM.historyDays) {
    this.kind = kind
    this.fineWindowMs = SIM.fineWindowMin * MIN_MS
    this.retentionMs = retentionDays * DAY_MS
    this.coarseMs = SIM.coarseResolutionMin * MIN_MS
  }

  push(t: number, v: number | null, bucket: BucketCode): void {
    this.lastPushT = t
    this.cache = null
    const p: TimePoint = { t, v }
    if (this.kind === 'event') {
      this.coarse.push(p)
      this.coarseB.push(bucket)
      const excess = this.coarse.length - this.coarseHead - SIM.maxEventPoints
      if (excess > 0) this.coarseHead += excess
      this.compact()
      return
    }
    this.fine.push(p)
    this.fineB.push(bucket)
    if (t % this.coarseMs === 0) {
      this.coarse.push(p)
      this.coarseB.push(bucket)
    }
    const fineCut = t - this.fineWindowMs
    while (this.fineHead < this.fine.length && this.fine[this.fineHead]!.t < fineCut) this.fineHead++
    const coarseCut = t - this.retentionMs
    while (this.coarseHead < this.coarse.length && this.coarse[this.coarseHead]!.t < coarseCut) this.coarseHead++
    this.compact()
  }

  private compact(): void {
    if (this.fineHead > 512) {
      this.fine = this.fine.slice(this.fineHead)
      this.fineB = this.fineB.slice(this.fineHead)
      this.fineHead = 0
    }
    if (this.coarseHead > 512 || (this.kind === 'event' && this.coarseHead > 64)) {
      this.coarse = this.coarse.slice(this.coarseHead)
      this.coarseB = this.coarseB.slice(this.coarseHead)
      this.coarseHead = 0
    }
  }

  private fineStartT(): number {
    return this.fineHead < this.fine.length ? this.fine[this.fineHead]!.t : Infinity
  }

  /** Published, immutable view. Same array reference until the next push. */
  toTimePoints(): TimePoint[] {
    if (this.cache) return this.cache
    const fineStart = this.fineStartT()
    let end = this.coarse.length
    while (end > this.coarseHead && this.coarse[end - 1]!.t >= fineStart) end--
    const out = this.fineHead < this.fine.length ? this.coarse.slice(this.coarseHead, end).concat(this.fine.slice(this.fineHead)) : this.coarse.slice(this.coarseHead, end)
    this.cache = out
    return out
  }

  /** Iterate points with t >= t0 in time order (no allocation of the full view). */
  forEachSince(t0: number, fn: (t: number, v: number | null, bucket: BucketCode) => void): void {
    const fineStart = this.fineStartT()
    for (let i = this.coarseHead; i < this.coarse.length; i++) {
      const p = this.coarse[i]!
      if (p.t >= fineStart) break
      if (p.t >= t0) fn(p.t, p.v, this.coarseB[i]!)
    }
    for (let i = this.fineHead; i < this.fine.length; i++) {
      const p = this.fine[i]!
      if (p.t >= t0) fn(p.t, p.v, this.fineB[i]!)
    }
  }

  /** Valid (non null) points, newest last, at most `max`. */
  lastValid(max: number): TimePoint[] {
    const out: TimePoint[] = []
    const arrs: Array<[TimePoint[], number]> = this.kind === 'event' ? [[this.coarse, this.coarseHead]] : [[this.fine, this.fineHead]]
    for (const [arr, head] of arrs) {
      for (let i = arr.length - 1; i >= head && out.length < max; i--) {
        const p = arr[i]!
        if (p.v !== null) out.push(p)
      }
    }
    return out.reverse()
  }

  get length(): number {
    return this.toTimePoints().length
  }
}
