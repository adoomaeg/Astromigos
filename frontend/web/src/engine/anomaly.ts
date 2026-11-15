/**
 * Streaming anomaly detection for one subject + metric.
 *
 * Methods (all compared with the PERSONAL baseline, never a population norm):
 *  - ROBUST_Z: robust z of the median of the last 3 values vs the baseline of the
 *    current activity context. Catches fast changes (acute rules).
 *  - EWMA: exponentially weighted mean of the per sample z (half-life 3 sim hours).
 *    Catches slow drifts that no single value would flag.
 *  - PERSISTENCE: drift or out-of-band values that last (hours, nights, sessions).
 *  - fixed demo thresholds from config.ts (safety net, not official limits).
 *  - DATA_QUALITY: stale or missing data is NO_DATA, never "normal".
 *
 * Work per sample is O(1). Baselines are recomputed from a bounded reservoir only
 * every BASELINE.recomputeEvery accepted samples, so nothing re-sorts days of data
 * on every tick.
 */
import type { ActivityContext, Anomaly, Baseline, MetricCode, QualityStatus, RiskLevel, Status } from '../types/domain'
import { METRIC_CATALOG } from './catalog'
import { ANOMALY, BASELINE, FIXED_THRESHOLDS, METRIC_RULES, SIM, type FixedThreshold, type MetricRuleConfig } from './config'
import { Reservoir, baselineScale, computeBaseline } from './baseline'
import { MetricSeries } from './series'
import { badZ, clamp, ewmaAlpha, ewmaUpdate } from './stats'
import { HOUR_MS, MIN_MS, fmtDuration, fmtValue, inlineLabel, sentenceLabel } from './text'

export type Bucket = 'ALL' | 'SLEEP' | 'REST' | 'WORK' | 'EXERCISE'
export const BUCKETS: Bucket[] = ['ALL', 'SLEEP', 'REST', 'WORK', 'EXERCISE']

export function bucketCode(b: Bucket): number {
  return BUCKETS.indexOf(b)
}

export function bucketFromCode(c: number): Bucket {
  return BUCKETS[c] ?? 'ALL'
}

/** Context bucket for a sample. Recovery after exercise counts as exercise so a workout never alarms. */
export function bucketFor(activity: ActivityContext, recovering: boolean, bucketed: boolean): Bucket {
  if (!bucketed) return 'ALL'
  if (activity === 'EXERCISE' || activity === 'EVA' || recovering) return 'EXERCISE'
  if (activity === 'SLEEP') return 'SLEEP'
  if (activity === 'WORK') return 'WORK'
  return 'REST'
}

export const BUCKET_PHRASE: Record<Bucket, string> = {
  ALL: '',
  SLEEP: 'during sleep',
  REST: 'at rest',
  WORK: 'during work',
  EXERCISE: 'for exercise',
}

const BUCKET_WINDOW: Record<Bucket, string> = {
  ALL: 'all contexts',
  SLEEP: 'sleep context',
  REST: 'rest context',
  WORK: 'work context',
  EXERCISE: 'exercise and recovery context',
}

export type AnomalyMethod = Anomaly['method']

/** Result of evaluating one metric at one moment. */
export interface MetricAssessment {
  metric: MetricCode
  status: Status
  /** Rule level (LOW when nothing triggered or no data). */
  level: RiskLevel
  method: AnomalyMethod | null
  ruleId: string | null
  /** Factor label with numbers, e.g. "HRV 28% below your normal for 3 days". */
  label: string | null
  /** Crew phrase, e.g. "HRV has been below your normal for 3 days". */
  phrase: string | null
  value: number | null
  z: number | null
  noData: boolean
  questionable: boolean
  baseline: Baseline | null
  bucket: Bucket
  driftZ: number | null
  deviationPct: number | null
  persistenceHours: number | null
}

const LEVEL_RANK: Record<RiskLevel, number> = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 }

/** Wording for self reported check-in metrics ("You reported more fatigue than usual"). */
const SELF_REPORT_NOUN: Partial<Record<MetricCode, { up: string; down: string }>> = {
  MOOD: { up: 'a better mood', down: 'a lower mood' },
  PERCEIVED_FATIGUE: { up: 'more fatigue', down: 'less fatigue' },
  STRESS: { up: 'more stress', down: 'less stress' },
}

export function levelRank(l: RiskLevel): number {
  return LEVEL_RANK[l]
}

export function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b
}

interface Candidate {
  level: RiskLevel
  method: AnomalyMethod
  ruleId: string
  label: string
  phrase: string
}

/** Median of up to 3 values without allocation. */
function median3(r: number[]): number {
  const n = r.length
  if (n === 1) return r[0]!
  if (n === 2) return (r[0]! + r[1]!) / 2
  const a = r[0]!
  const b = r[1]!
  const c = r[2]!
  return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c))
}

export class MetricTracker {
  readonly metric: MetricCode
  readonly cfg: MetricRuleConfig
  readonly series: MetricSeries
  readonly subjectId: string
  /** Device that last delivered a value (for data quality explanations). */
  deviceId: string | null = null
  recomputeEvery: number = BASELINE.recomputeEvery

  private readonly reservoirs = new Map<Bucket, Reservoir>()
  private readonly added = new Map<Bucket, number>()
  private readonly baselines = new Map<Bucket, Baseline>()
  private readonly fixed: FixedThreshold[]

  lastT = -Infinity
  lastValidT = -Infinity
  lastValue: number | null = null
  lastBucket: Bucket = 'ALL'
  lastQuality: QualityStatus = 'MISSING'
  private recent: number[] = []
  /** Ring of the last ANOMALY.questionableWindow quality flags (1 = questionable). */
  private readonly qual = new Uint8Array(ANOMALY.questionableWindow)
  private qualN = 0
  private qualI = 0
  private qualSum = 0
  readonly dir: 'up' | 'down' | 'both'
  private alphaDt = NaN
  private alphaDisplay = 0
  private alphaDrift = 0

  /** Signed robust z of the recent median vs the current bucket baseline. */
  z: number | null = null
  /** Display EWMA of the raw value (half-life ANOMALY.ewmaDisplayHalfLifeMin). */
  ewma: number | null = null
  /** Drift indicator: EWMA of the per sample robust z (signed). */
  driftZ = 0
  /** EWMA of relative deviation from the bucket median, in %. */
  driftPct = 0
  /** EWMA of absolute deviation from the bucket median, in metric units. */
  driftDiff = 0
  driftSince: number | null = null

  /** Event metrics: consecutive values outside the band in the bad direction. */
  run = 0
  private runPctSum = 0
  private runDiffSum = 0

  constructor(subjectId: string, metric: MetricCode) {
    this.subjectId = subjectId
    this.metric = metric
    this.cfg = METRIC_RULES[metric]
    this.series = new MetricSeries(this.cfg.kind)
    this.fixed = FIXED_THRESHOLDS.filter((f) => f.metric === metric)
    this.dir = METRIC_CATALOG[metric].badDirection
  }


  baselineFor(bucket: Bucket): Baseline | null {
    return this.baselines.get(bucket) ?? null
  }

  readyBaseline(bucket: Bucket): Baseline | null {
    const b = this.baselines.get(bucket)
    return b && b.status === 'READY' ? b : null
  }

  allBaselines(): Partial<Record<Bucket, Baseline>> {
    const out: Partial<Record<Bucket, Baseline>> = {}
    for (const [k, v] of this.baselines) out[k] = v
    return out
  }

  /** Push a missing marker (gap) into history. */
  ingestMissing(t: number, bucket: Bucket): void {
    this.lastT = t
    this.series.push(t, null, bucketCode(bucket))
    this.pushQual(false)
  }

  private pushQual(q: boolean): void {
    const w = this.qual.length
    if (this.qualN === w) this.qualSum -= this.qual[this.qualI]!
    else this.qualN++
    this.qual[this.qualI] = q ? 1 : 0
    this.qualSum += q ? 1 : 0
    this.qualI = (this.qualI + 1) % w
  }

  ingest(t: number, v: number | null, bucket: Bucket, quality: QualityStatus, deviceId: string): void {
    this.series.push(t, v, bucketCode(bucket))
    this.lastT = t
    if (v === null || quality === 'MISSING' || quality === 'INVALID') {
      this.pushQual(false)
      return
    }
    this.deviceId = deviceId
    const questionable = quality === 'QUESTIONABLE'
    this.pushQual(questionable)
    const dtMin = Number.isFinite(this.lastValidT) ? clamp((t - this.lastValidT) / MIN_MS, 0, 60) : 1
    if (bucket !== this.lastBucket) this.recent = []
    this.recent.push(v)
    if (this.recent.length > ANOMALY.recentWindow) this.recent.shift()
    this.lastValidT = t
    this.lastValue = v
    this.lastBucket = bucket
    this.lastQuality = quality
    if (dtMin !== this.alphaDt) {
      this.alphaDt = dtMin
      this.alphaDisplay = ewmaAlpha(dtMin, ANOMALY.ewmaDisplayHalfLifeMin)
      this.alphaDrift = ewmaAlpha(dtMin, ANOMALY.drift.halfLifeMin)
    }
    this.ewma = ewmaUpdate(this.ewma, v, this.alphaDisplay)

    const b = this.readyBaseline(bucket)
    let accept: boolean
    if (this.cfg.kind === 'event') {
      if (b) {
        const scale = baselineScale(b, this.cfg.minScale)
        const z = (v - b.median) / scale
        this.z = z
        if (badZ(z, this.dir) >= BASELINE.bandK) {
          this.run++
          this.runPctSum += b.median !== 0 ? (v / b.median - 1) * 100 : 0
          this.runDiffSum += v - b.median
        } else {
          this.run = 0
          this.runPctSum = 0
          this.runDiffSum = 0
        }
        accept = Math.abs(z) < BASELINE.gateEventZ
      } else {
        this.z = null
        accept = true
      }
    } else {
      if (b) {
        const scale = baselineScale(b, this.cfg.minScale)
        const zs = (v - b.median) / scale
        this.z = (median3(this.recent) - b.median) / scale
        const a = this.alphaDrift
        this.driftZ += a * (clamp(zs, -ANOMALY.drift.zClamp, ANOMALY.drift.zClamp) - this.driftZ)
        this.driftPct += a * ((b.median !== 0 ? (v / b.median - 1) * 100 : 0) - this.driftPct)
        this.driftDiff += a * (v - b.median - this.driftDiff)
        const bd = badZ(this.driftZ, this.dir)
        if (bd >= ANOMALY.drift.moderate) {
          if (this.driftSince === null) this.driftSince = t
        } else if (bd < ANOMALY.drift.clear) {
          this.driftSince = null
        }
        accept = !questionable && Math.abs(zs) < BASELINE.gateZ && Math.abs(this.driftZ) < BASELINE.gateDrift
      } else {
        this.z = null
        accept = !questionable
      }
      if (t % (SIM.coarseResolutionMin * MIN_MS) !== 0) accept = false
    }
    if (accept) this.addToBaseline(bucket, v)
  }

  private addToBaseline(bucket: Bucket, v: number): void {
    let r = this.reservoirs.get(bucket)
    if (!r) {
      r = new Reservoir(this.cfg.kind === 'event' ? BASELINE.eventReservoirSize : BASELINE.reservoirSize)
      this.reservoirs.set(bucket, r)
    }
    r.push(v)
    const added = (this.added.get(bucket) ?? 0) + 1
    this.added.set(bucket, added)
    const minN = this.minN(bucket)
    const ready = this.baselines.get(bucket)?.status === 'READY'
    const every = this.cfg.kind === 'event' ? 1 : this.recomputeEvery
    if (added >= every || (!ready && r.size >= minN && added >= 6) || !this.baselines.has(bucket)) {
      this.recompute(bucket)
    }
  }

  private minN(bucket: Bucket): number {
    if (this.cfg.kind === 'event') return BASELINE.minN.event
    return bucket === 'EXERCISE' ? BASELINE.minN.exercise : BASELINE.minN.continuous
  }

  /** Recompute one bucket (or all) from the reservoir. */
  recompute(bucket?: Bucket): void {
    const list = bucket ? [bucket] : [...this.reservoirs.keys()]
    for (const bk of list) {
      const r = this.reservoirs.get(bk)
      if (!r) continue
      const label =
        this.cfg.kind === 'event'
          ? `Last ${r.size} ${this.cfg.eventUnit?.[1] ?? 'values'} (personal)`
          : `Last ${SIM.historyDays} days, ${BUCKET_WINDOW[bk]} (personal)`
      this.baselines.set(
        bk,
        computeBaseline(r.values(), {
          metric: this.metric,
          minN: this.minN(bk),
          minScale: this.cfg.minScale,
          windowLabel: label,
          physicalMin: this.cfg.physicalMin,
          physicalMax: this.cfg.physicalMax,
        }),
      )
      this.added.set(bk, 0)
    }
  }

  questionableShare(): number {
    return this.qualN === 0 ? 0 : this.qualSum / this.qualN
  }

  /** Evaluate the metric at `now`. `deviceDown` forces NO_DATA (device stale or offline). */
  assess(now: number, deviceDown: boolean): MetricAssessment {
    const def = METRIC_CATALOG[this.metric]
    const baseline = this.baselineFor(this.lastBucket)
    const stale = now - this.lastValidT > this.cfg.staleMin * MIN_MS
    const base: MetricAssessment = {
      metric: this.metric,
      status: 'LOW',
      level: 'LOW',
      method: null,
      ruleId: null,
      label: null,
      phrase: null,
      value: this.lastValue,
      z: this.z,
      noData: false,
      questionable: this.lastQuality === 'QUESTIONABLE',
      baseline,
      bucket: this.lastBucket,
      driftZ: this.cfg.kind === 'continuous' && this.cfg.drift ? this.driftZ : null,
      deviationPct: null,
      persistenceHours: null,
    }
    if (deviceDown || stale || this.lastValue === null) {
      const since = Number.isFinite(this.lastValidT) ? now - this.lastValidT : null
      return {
        ...base,
        status: 'NO_DATA',
        value: null,
        z: null,
        noData: true,
        method: 'DATA_QUALITY',
        ruleId: 'R-DQ-01',
        label: since !== null ? `No ${inlineLabel(this.metric)} data for ${fmtDuration(since)}` : `No ${inlineLabel(this.metric)} data yet`,
        phrase: `${sentenceLabel(this.metric)} is not being received`,
      }
    }

    const v = this.lastValue
    const candidates: Candidate[] = []
    const recentMedian = this.cfg.kind === 'event' ? v : median3(this.recent)

    // Fixed demo thresholds (config.ts). First match per rule is the most severe.
    for (const f of this.fixed) {
      if (f.restOnly && this.lastBucket === 'EXERCISE') continue
      const hit = f.op === 'above' ? recentMedian > f.value : recentMedian < f.value
      if (!hit) continue
      const word = f.op === 'above' ? 'above' : 'below'
      candidates.push({
        level: f.level,
        method: 'PERSISTENCE',
        ruleId: f.ruleId,
        label: `${sentenceLabel(this.metric)} ${fmtValue(this.metric, recentMedian)}, ${word} the ${f.name} of ${fmtValue(this.metric, f.value)}`,
        phrase: `${this.subjectId === 'CABIN' ? 'Cabin' : 'Your'} ${inlineLabel(this.metric).replace('cabin ', '')} is ${word} the ${f.name}`,
      })
      break
    }

    const ctx = BUCKET_PHRASE[this.lastBucket]
    const ctxPart = ctx ? ` ${ctx}` : ''
    const subj = this.subjectId === 'CABIN' ? 'Cabin' : 'Your'
    const pctOrDiff = (pct: number, diff: number): string => {
      if (def.unit === '% of baseline') return `${Math.round(Math.abs(diff))}%`
      if (def.unit === '1-5') return `${Math.abs(diff).toFixed(1)} points`
      const absolute = def.unit === '%' || def.unit === '°C'
      if (absolute) {
        const unitWord = def.unit === '°C' ? ' °C' : ' points'
        return `${Math.abs(diff).toFixed(1)}${unitWord}`
      }
      return `${Math.round(Math.abs(pct))}%`
    }

    if (this.cfg.kind === 'event') {
      if (baseline && baseline.status === 'READY' && this.z !== null) {
        const bz = badZ(this.z, this.dir)
        const run = this.run
        let level: RiskLevel = 'LOW'
        if (run >= ANOMALY.event.highRun) level = 'HIGH'
        else if (run >= ANOMALY.event.moderateRun) level = 'MODERATE'
        else if (run === 1 && bz >= ANOMALY.event.singleValueZ) level = 'MODERATE'
        if (level !== 'LOW') {
          const avgPct = this.runPctSum / Math.max(1, run)
          const avgDiff = this.runDiffSum / Math.max(1, run)
          const word = avgDiff < 0 ? 'below' : 'above'
          const unit = this.cfg.eventUnit ?? ['value', 'values']
          const span = `${run} ${run === 1 ? unit[0] : unit[1]}`
          const what = this.metric === 'SLEEP_DURATION' ? (word === 'below' ? 'shorter than' : 'longer than') : `${word}`
          const self = SELF_REPORT_NOUN[this.metric]
          if (self) {
            // Self report (daily check-in): plain, non-diagnostic wording.
            const more = word === 'above' ? self.up : self.down
            const sentence = `You reported ${more} than usual ${run === 1 ? 'in your last check-in' : `in your last ${span}`}`
            candidates.push({
              level,
              method: 'PERSISTENCE',
              ruleId: this.cfg.acuteRule,
              label: `${sentence} (${pctOrDiff(avgPct, avgDiff)} ${word} your normal on a 1 to 5 scale)`,
              phrase: sentence,
            })
            base.deviationPct = avgPct
            base.persistenceHours = null
          } else candidates.push({
            level,
            method: 'PERSISTENCE',
            ruleId: this.cfg.acuteRule,
            label: `${sentenceLabel(this.metric)} ${pctOrDiff(avgPct, avgDiff)} ${word} your normal for ${span}`,
            phrase:
              this.metric === 'SLEEP_DURATION'
                ? `Sleep has been ${what} your normal for ${span}`
                : `${sentenceLabel(this.metric)} has been ${what} your normal for ${span}`,
          })
          base.deviationPct = avgPct
          base.persistenceHours = null
        }
      }
    } else if (baseline && baseline.status === 'READY') {
      // Acute: robust z of the 3 sample median.
      if (this.cfg.acute && this.z !== null) {
        // The exercise context includes warm-up and recovery, where heart rate, blood pressure and
        // breathing rate are naturally below the exercise median: only an upward deviation counts
        // there for two-sided metrics (found by npm run evaluate, v2).
        const dirNow = this.lastBucket === 'EXERCISE' && this.dir === 'both' ? 'up' : this.dir
        const bz = badZ(this.z, dirNow)
        const t = ANOMALY.acuteZ
        const level: RiskLevel = bz >= t.CRITICAL ? 'CRITICAL' : bz >= t.HIGH ? 'HIGH' : bz >= t.MODERATE ? 'MODERATE' : 'LOW'
        if (level !== 'LOW') {
          const word = this.z > 0 ? 'above' : 'below'
          const adverb = level === 'CRITICAL' ? 'far' : level === 'HIGH' ? 'well' : 'clearly'
          candidates.push({
            level,
            method: 'ROBUST_Z',
            ruleId: this.cfg.acuteRule,
            label: `${sentenceLabel(this.metric)} ${fmtValue(this.metric, recentMedian)}, ${adverb} ${word} your normal${ctxPart} (robust z ${this.z > 0 ? '+' : ''}${this.z.toFixed(1)})`,
            phrase: `${subj} ${inlineLabel(this.metric)} is ${adverb} ${word} your normal${ctxPart}`,
          })
        }
      }
      // Drift: EWMA of z that persists.
      if (this.cfg.drift && this.driftSince !== null) {
        const bd = badZ(this.driftZ, this.dir)
        const durH = (now - this.driftSince) / HOUR_MS
        const d = ANOMALY.drift
        const level: RiskLevel = bd >= d.high && durH >= d.highMinHours ? 'HIGH' : bd >= d.moderate && durH >= d.moderateMinHours ? 'MODERATE' : 'LOW'
        base.persistenceHours = durH
        if (level !== 'LOW') {
          const word = this.driftZ < 0 ? 'below' : 'above'
          const dur = fmtDuration(now - this.driftSince)
          const lead = this.metric === 'HEART_RATE' ? 'Resting heart rate' : sentenceLabel(this.metric)
          candidates.push({
            level,
            method: 'EWMA',
            ruleId: this.cfg.driftRule,
            label: `${lead} ${pctOrDiff(this.driftPct, this.driftDiff)} ${word} your normal for ${dur}`,
            phrase: `${lead} has been ${word} your normal for ${dur}`,
          })
        }
      }
      base.deviationPct = this.driftPct
    }

    let best: Candidate | null = null
    for (const c of candidates) if (!best || LEVEL_RANK[c.level] > LEVEL_RANK[best.level]) best = c
    if (!best) return base

    let level = best.level
    let label = best.label
    if (this.cfg.maxLevel && LEVEL_RANK[level] > LEVEL_RANK[this.cfg.maxLevel]) level = this.cfg.maxLevel
    if (base.questionable && LEVEL_RANK[level] > LEVEL_RANK.MODERATE) {
      // Low quality data cannot escalate beyond MODERATE on its own.
      level = 'MODERATE'
      label = `${label} (questionable signal, capped at Watch)`
    }
    return { ...base, status: level, level, method: best.method, ruleId: best.ruleId, label, phrase: best.phrase }
  }
}
