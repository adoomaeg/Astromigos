/**
 * What-if comparison (US-022): two noise free projections from the current simulated state,
 * one with the intervention applied now and one without. Uses the same scenario model and
 * the same HYPOTHETICAL relief curves as the simulator (sim/scenarios.ts), and the noise free
 * resting equivalent of the physiology model (sim/physiology.ts).
 *
 * This is a simulation device for discussion. It is never a claim of clinical efficacy:
 * the relief sizes and time constants are made-up simulation parameters.
 */
import type { Baseline, InterventionComparison, InterventionKind, MetricCode, TimePoint } from '../types/domain'
import { COMPARE } from './config'
import { round } from './stats'
import { DAY_MS, HOUR_MS, MIN_MS } from './text'
import { co2Mean } from './sim/cabin'
import { restingEquivalent } from './sim/physiology'
import type { PhysioProfile } from './sim/profiles'
import type { ScenarioModel } from './sim/scenarios'
import { SCHEDULE } from './sim/schedule'

export interface CompareInput {
  astronautId: string
  kind: InterventionKind
  metric?: MetricCode
  horizonHours?: number
}

export interface CompareContext {
  now: number
  scenario: ScenarioModel
  /** Profile of the astronaut (null for the cabin). */
  profile: PhysioProfile | null
  /** Personal (or cabin) band for the metric, if ready. */
  baseline: Baseline | null
}

const PROJECTABLE: MetricCode[] = ['HEART_RATE', 'HRV_RMSSD', 'SPO2', 'RESPIRATORY_RATE', 'HYDRATION', 'EXERCISE_LOAD', 'CO2']

export function defaultMetricFor(kind: InterventionKind): MetricCode | null {
  return COMPARE.defaultMetric[kind]
}

/** Metric the comparison will use, or null when not applicable. */
export function resolveMetric(input: CompareInput): MetricCode | null {
  const m = input.metric ?? defaultMetricFor(input.kind)
  if (!m || !PROJECTABLE.includes(m)) return null
  if (input.kind === 'SENSOR_CHECK') return null
  return m
}

function stepMinFor(hours: number): number {
  if (hours <= 3) return 5
  if (hours <= 12) return 15
  return 30
}

/** Noise free value of `metric` at t under `sc` (resting equivalent for physiology). */
function valueAt(metric: MetricCode, t: number, sc: ScenarioModel, id: string, P: PhysioProfile | null): number | null {
  const co2 = co2Mean(t) + sc.co2Add(t)
  if (metric === 'CO2') return co2
  if (!P) return null
  const fx = { fatigue: sc.fatigue(id, t), acute: sc.acute(id, t), perfLoss: sc.perfLoss(id, t), hydrationBoost: sc.hydrationBoost(id, t) }
  const r = restingEquivalent(P, fx, co2)
  switch (metric) {
    case 'HEART_RATE':
      return r.hr
    case 'HRV_RMSSD':
      return r.hrv
    case 'SPO2':
      return r.spo2
    case 'RESPIRATORY_RATE':
      return r.rr
    case 'HYDRATION':
      return r.hydration
    default:
      return null
  }
}

/** Exercise output (% of the personal usual) for the planned sessions in (now, end]. */
function sessionPoints(now: number, end: number, sc: ScenarioModel, id: string, P: PhysioProfile): TimePoint[] {
  const load = (t: number) => round(100 * (1 - sc.perfLoss(id, t) - 0.05 * sc.fatigue(id, t)), 1)
  const out: TimePoint[] = [{ t: now, v: load(now) }]
  for (let d = Math.floor(now / DAY_MS); d * DAY_MS <= end; d++) {
    const start = d * DAY_MS + P.exerciseStartMin * MIN_MS
    const sessionEnd = start + SCHEDULE.exerciseDurationMin * MIN_MS
    if (sessionEnd <= now || sessionEnd > end) continue
    out.push({ t: sessionEnd, v: load(start) })
  }
  return out
}

function assumptionsFor(kind: InterventionKind, metric: MetricCode, identical: boolean): string[] {
  const a: string[] = ['Starts from the current simulated state and follows the same scenario model as the simulator.']
  switch (kind) {
    case 'SLEEP_EXTENSION':
      a.push('Assumes the current fatigue pattern continues if nothing changes.')
      break
    case 'REST_PROTOCOL':
    case 'MEDICAL_CONSULT':
      a.push('Assumes the current pattern continues if nothing changes.')
      break
    case 'CABIN_VENTILATION':
      a.push('Assumes the CO₂ scrubber issue continues if the module is not ventilated.')
      break
    case 'EXERCISE_ADJUSTMENT':
      a.push('Assumes the decline continues at the current rate without the adjustment.', 'One point per planned exercise session.')
      break
    case 'HYDRATION':
      a.push('Assumes the usual fluid intake otherwise; sweat losses from exercise are not included.')
      break
    case 'SENSOR_CHECK':
      break
  }
  a.push('Recovery effect size is hypothetical (a simulation parameter, not a measured effect).')
  if (metric !== 'CO2' && metric !== 'EXERCISE_LOAD') a.push('Values are resting equivalents: activity, exercise and the daily rhythm are removed, and there is no measurement noise.')
  if (metric === 'CO2') a.push('Includes the usual daily CO₂ swing; no sensor noise.')
  if (identical) a.push('No active simulated pattern affects this signal right now, so both lines are the same.')
  return a
}

/** Two trajectories (with / without the intervention applied now). Null when not applicable. */
export function compareIntervention(input: CompareInput, ctx: CompareContext): InterventionComparison | null {
  const metric = resolveMetric(input)
  if (!metric) return null
  const cabin = metric === 'CO2'
  const subject = cabin ? 'CABIN' : input.astronautId
  if (!cabin && (!ctx.profile || input.astronautId === 'CABIN')) return null
  const { now } = ctx
  const acuteActive = !cabin && ctx.scenario.acute(subject, now) > 0.02
  let hours = input.horizonHours ?? (acuteActive && (metric === 'HEART_RATE' || metric === 'SPO2' || metric === 'HRV_RMSSD' || metric === 'RESPIRATORY_RATE') ? COMPARE.acuteHorizonHours : (COMPARE.defaultHorizonHours[metric] ?? 24))
  if (!Number.isFinite(hours) || hours <= 0) return null
  hours = Math.min(hours, COMPARE.maxHorizonHours)
  const end = now + hours * HOUR_MS

  const without = ctx.scenario.withIntervention(null)
  const withIt = ctx.scenario.withIntervention({
    id: 'WHAT-IF',
    astronautId: subject,
    kind: input.kind,
    recommendationId: null,
    loggedAt: now,
    actor: 'what-if',
    note: 'Hypothetical intervention for the comparison only',
  })

  let a: TimePoint[]
  let b: TimePoint[]
  if (metric === 'EXERCISE_LOAD') {
    a = sessionPoints(now, end, without, subject, ctx.profile!)
    b = sessionPoints(now, end, withIt, subject, ctx.profile!)
  } else {
    const stepMs = stepMinFor(hours) * MIN_MS
    const decimals = metric === 'CO2' ? 0 : 1
    a = []
    b = []
    for (let t = now; t <= end + 1; t += stepMs) {
      const v0 = valueAt(metric, t, without, subject, ctx.profile)
      const v1 = valueAt(metric, t, withIt, subject, ctx.profile)
      a.push({ t, v: v0 === null ? null : round(v0, decimals) })
      b.push({ t, v: v1 === null ? null : round(v1, decimals) })
    }
  }
  const identical = a.every((p, i) => p.v === b[i]?.v)
  return {
    astronautId: subject,
    metric,
    kind: input.kind,
    horizonHours: hours,
    without: a,
    with: b,
    band: ctx.baseline && ctx.baseline.status === 'READY' ? { low: ctx.baseline.low, high: ctx.baseline.high } : null,
    assumptions: assumptionsFor(input.kind, metric, identical),
    disclaimer: COMPARE.disclaimer,
  }
}
