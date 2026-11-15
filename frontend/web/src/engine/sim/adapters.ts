/**
 * Device adapters (PROJECT_MASTER.md 5.3, adapter pattern).
 *
 * Every adapter has an id, a kind, a status, and read(simNow) which returns canonical
 * HealthObservation[] with data_origin 'SIMULATED', a quality block and an activity
 * context. Adapters sample the simulated "true" physiology / cabin state and add the
 * device behavior on top (cadence, battery, signal, failure, estimation flags).
 *
 * Swapping a simulator for a real integration later means writing another adapter
 * that returns the same canonical observations; nothing downstream changes.
 */
import type { ActivityContext, DeviceKind, DeviceState, HealthObservation, MetricCode, QualityStatus } from '../../types/domain'
import { METRIC_CATALOG } from '../catalog'
import { hash01, hashNormal, OUProcess, hashSeed } from '../random'
import { clamp, round } from '../stats'
import { DAY_MS, MIN_MS, fmtClock } from '../text'
import type { CabinTruth } from './cabin'
import { co2Effect, type AstronautPhysiology } from './physiology'
import type { ScenarioModel, SensorStage } from './scenarios'
import { EXERCISE_ROTATION, SCHEDULE, dayIndex, type ExerciseDeviceKind } from './schedule'

/** Software sources are adapters too, but not hardware devices listed in the UI. */
export type AdapterKind = DeviceKind | 'COGNITIVE_TEST' | 'INTAKE_LOG'

export interface AdapterStatus {
  state: DeviceState
  batteryPct: number | null
  signalPct: number | null
  lastSeenAt: number
  detail: string
}

export interface DeviceAdapter {
  readonly id: string
  readonly kind: AdapterKind
  readonly name: string
  readonly assignedTo: string | null
  readonly metrics: MetricCode[]
  /** True for hardware devices published in AppState.devices. */
  readonly listed: boolean
  read(simNow: number): HealthObservation[]
  /** Event-only read over a past window (used to backfill daily metrics). */
  readEvents?(from: number, to: number): HealthObservation[]
  status(simNow: number): AdapterStatus
}

/** What adapters can see of the simulated world. */
export interface SimWorld {
  readonly seed: number
  readonly missionId: string
  readonly crewIds: string[]
  readonly scenario: ScenarioModel
  physio(id: string): AstronautPhysiology
  cabin(): CabinTruth | null
  personalDose(id: string): number
  iso(t: number): string
}

// ---------------------------------------------------------------------------
// Canonical observation factory (shared immutable sub-objects keep it cheap)
// ---------------------------------------------------------------------------

const SOURCE_REF = Object.freeze({ repository: null, dataset_accession: null, file_name: null, record_reference: null })
const CONTEXTS = Object.freeze({
  SLEEP: Object.freeze({ mission_phase: 'IN_FLIGHT' as const, activity: 'SLEEP' as const }),
  REST: Object.freeze({ mission_phase: 'IN_FLIGHT' as const, activity: 'REST' as const }),
  WORK: Object.freeze({ mission_phase: 'IN_FLIGHT' as const, activity: 'WORK' as const }),
  EXERCISE: Object.freeze({ mission_phase: 'IN_FLIGHT' as const, activity: 'EXERCISE' as const }),
  EVA: Object.freeze({ mission_phase: 'IN_FLIGHT' as const, activity: 'EVA' as const }),
})
type Quality = HealthObservation['quality']
export const Q_VALID: Quality = Object.freeze({ status: 'VALID' as QualityStatus, confidence: 0.97, is_estimated: false })
export const Q_ESTIMATED: Quality = Object.freeze({ status: 'VALID' as QualityStatus, confidence: 0.85, is_estimated: true })
export const Q_QUESTIONABLE: Quality = Object.freeze({ status: 'QUESTIONABLE' as QualityStatus, confidence: 0.5, is_estimated: false })
const META_EMPTY = Object.freeze({}) as Record<string, unknown>
export const META_RECOVERING = Object.freeze({ recovering: true }) as Record<string, unknown>

export function makeObservation(
  world: SimWorld,
  deviceId: string,
  subjectId: string,
  metric: MetricCode,
  value: number | null,
  t: number,
  activity: ActivityContext,
  quality: Quality = Q_VALID,
  metadata: Record<string, unknown> = META_EMPTY,
): HealthObservation {
  return {
    observation_id: `${deviceId}:${metric}:${t}`,
    subject_id: subjectId,
    mission_id: world.missionId,
    device_id: deviceId,
    metric_code: metric,
    value: value === null ? null : round(value, Math.max(METRIC_CATALOG[metric].decimals, 1) + 1),
    unit: METRIC_CATALOG[metric].unit,
    measured_at: world.iso(t),
    received_at: world.iso(t),
    data_origin: 'SIMULATED',
    source_reference: SOURCE_REF,
    quality,
    context: CONTEXTS[activity],
    metadata,
  }
}

/** True if a boundary of `periodMs` (shifted by offsetMs) lies in (prev, t]. */
export function crossed(prev: number, t: number, periodMs: number, offsetMs = 0): boolean {
  return Math.floor((t - offsetMs) / periodMs) > Math.floor((prev - offsetMs) / periodMs)
}

abstract class BaseAdapter implements DeviceAdapter {
  readonly id: string
  readonly kind: AdapterKind
  readonly name: string
  readonly assignedTo: string | null
  readonly metrics: MetricCode[]
  readonly listed: boolean
  protected readonly world: SimWorld
  protected lastReadAt: number
  lastSeenAt: number

  constructor(world: SimWorld, o: { id: string; kind: AdapterKind; name: string; assignedTo: string | null; metrics: MetricCode[]; listed?: boolean; startAt: number }) {
    this.world = world
    this.id = o.id
    this.kind = o.kind
    this.name = o.name
    this.assignedTo = o.assignedTo
    this.metrics = o.metrics
    this.listed = o.listed ?? true
    this.lastReadAt = o.startAt
    this.lastSeenAt = o.startAt
  }

  abstract read(simNow: number): HealthObservation[]

  status(simNow: number): AdapterStatus {
    const stale = simNow - this.lastSeenAt > 6 * MIN_MS
    return {
      state: stale ? 'DATA_STALE' : 'ONLINE',
      batteryPct: null,
      signalPct: null,
      lastSeenAt: this.lastSeenAt,
      detail: stale ? `No data since ${fmtClock(this.lastSeenAt)}` : 'Streaming',
    }
  }
}

// ---------------------------------------------------------------------------
// Bio-Monitor smart shirt: HR, HRV, SpO2, RR, skin temperature, BP estimate
// ---------------------------------------------------------------------------

export class BioMonitorAdapter extends BaseAdapter {
  private battery: number
  private readonly signalNoise: OUProcess
  private signal = 95
  private stage: SensorStage = 'OK'

  constructor(world: SimWorld, astronautId: string, startAt: number) {
    super(world, {
      id: `DEV-BIO-${astronautId}`,
      kind: 'BIO_MONITOR',
      name: 'Bio-Monitor shirt (sim)',
      assignedTo: astronautId,
      metrics: ['HEART_RATE', 'HRV_RMSSD', 'SPO2', 'RESPIRATORY_RATE', 'SKIN_TEMPERATURE', 'SYSTOLIC_BP', 'DIASTOLIC_BP'],
      startAt,
    })
    this.battery = 70 + 25 * hash01(world.seed, this.id, 'battery')
    this.signalNoise = new OUProcess(hashSeed(world.seed, this.id, 'signal'), 30)
  }

  read(simNow: number): HealthObservation[] {
    const prev = this.lastReadAt
    this.lastReadAt = simNow
    const dtMin = Math.max(0, (simNow - prev) / MIN_MS)
    const astro = this.assignedTo!
    // Battery: worn continuously, swapped for a charged unit at 07:00 UTC.
    if (crossed(prev, simNow, DAY_MS, 7 * 60 * MIN_MS)) this.battery = 100
    else this.battery = Math.max(0, this.battery - (1.6 * dtMin) / 60)
    const stage = this.world.scenario.sensorStage(astro, simNow)
    this.stage = stage
    const sn = this.signalNoise.step(Math.max(dtMin, 0.01))
    this.signal = stage === 'OK' ? clamp(95 + 2.5 * sn, 80, 100) : stage === 'DEGRADED' ? clamp(34 + 5 * sn, 15, 50) : 0
    if (stage === 'STALE' || stage === 'OFFLINE') return []
    const seed = this.world.seed
    if (stage === 'DEGRADED' && hash01(seed, this.id, 'drop', simNow) < 0.3) return []
    const truth = this.world.physio(astro).truth
    if (!truth) return []
    const degraded = stage === 'DEGRADED'
    const q = degraded ? Q_QUESTIONABLE : Q_VALID
    const art = (metric: MetricCode, sdv: number) => (degraded ? hashNormal(seed, this.id, metric, simNow) * sdv : 0)
    const act = truth.activity
    const meta = truth.recovering ? META_RECOVERING : META_EMPTY
    const out: HealthObservation[] = [
      makeObservation(this.world, this.id, astro, 'HEART_RATE', truth.hr + art('HEART_RATE', 6), simNow, act, q, meta),
      makeObservation(this.world, this.id, astro, 'HRV_RMSSD', Math.max(3, truth.hrv + art('HRV_RMSSD', 8)), simNow, act, q, meta),
      makeObservation(this.world, this.id, astro, 'SPO2', Math.min(100, truth.spo2 + art('SPO2', 1.5)), simNow, act, q, meta),
      makeObservation(this.world, this.id, astro, 'RESPIRATORY_RATE', truth.rr + art('RESPIRATORY_RATE', 2), simNow, act, q, meta),
      makeObservation(this.world, this.id, astro, 'SKIN_TEMPERATURE', truth.skin + art('SKIN_TEMPERATURE', 0.4), simNow, act, q, meta),
    ]
    if (crossed(prev, simNow, 5 * MIN_MS)) {
      const qe = degraded ? Q_QUESTIONABLE : Q_ESTIMATED
      out.push(makeObservation(this.world, this.id, astro, 'SYSTOLIC_BP', truth.sbp + art('SYSTOLIC_BP', 8), simNow, act, qe, meta))
      out.push(makeObservation(this.world, this.id, astro, 'DIASTOLIC_BP', truth.dbp + art('DIASTOLIC_BP', 6), simNow, act, qe, meta))
    }
    this.lastSeenAt = simNow
    return out
  }

  override status(simNow: number): AdapterStatus {
    const battery = Math.round(this.battery)
    const signal = Math.round(this.signal)
    const base = { batteryPct: battery, signalPct: signal, lastSeenAt: this.lastSeenAt }
    switch (this.stage) {
      case 'DEGRADED':
        return { ...base, state: 'DEGRADED', detail: 'Weak signal: values marked questionable' }
      case 'STALE':
        return { ...base, state: 'DATA_STALE', signalPct: 0, detail: `No data since ${fmtClock(this.lastSeenAt)}` }
      case 'OFFLINE':
        return { ...base, state: 'OFFLINE', signalPct: 0, detail: `Offline since ${fmtClock(this.lastSeenAt)}` }
      default: {
        const stale = simNow - this.lastSeenAt > 6 * MIN_MS
        if (stale) return { ...base, state: 'DATA_STALE', detail: `No data since ${fmtClock(this.lastSeenAt)}` }
        if (battery < 10) return { ...base, state: 'DEGRADED', detail: 'Low battery' }
        return { ...base, state: 'ONLINE', detail: 'Streaming' }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Actigraphy watch: activity (continuous), sleep duration and efficiency (daily)
// ---------------------------------------------------------------------------

export class ActigraphyAdapter extends BaseAdapter {
  private battery: number

  constructor(world: SimWorld, astronautId: string, startAt: number) {
    super(world, {
      id: `DEV-ACT-${astronautId}`,
      kind: 'ACTIGRAPHY',
      name: 'Actigraphy watch (sim)',
      assignedTo: astronautId,
      metrics: ['ACTIVITY_LEVEL', 'SLEEP_DURATION', 'SLEEP_EFFICIENCY'],
      startAt,
    })
    this.battery = 55 + 40 * hash01(world.seed, this.id, 'battery')
  }

  read(simNow: number): HealthObservation[] {
    const prev = this.lastReadAt
    this.lastReadAt = simNow
    const dtMin = Math.max(0, (simNow - prev) / MIN_MS)
    this.battery -= (0.25 * dtMin) / 60
    if (this.battery < 15) this.battery = 100
    const astro = this.assignedTo!
    const out: HealthObservation[] = []
    const truth = this.world.physio(astro).truth
    if (truth) {
      out.push(makeObservation(this.world, this.id, astro, 'ACTIVITY_LEVEL', truth.activityLevel, simNow, truth.activity, Q_VALID, truth.recovering ? META_RECOVERING : META_EMPTY))
    }
    out.push(...this.readEvents(prev, simNow))
    this.lastSeenAt = simNow
    return out
  }

  /** Sleep summary is produced at wake time (06:00 UTC) for the night that just ended. */
  readEvents(from: number, to: number): HealthObservation[] {
    const astro = this.assignedTo!
    const sched = this.world.physio(astro).schedule
    const out: HealthObservation[] = []
    for (let d = dayIndex(from); d <= dayIndex(to); d++) {
      const wake = d * DAY_MS + SCHEDULE.wakeMin * MIN_MS
      if (wake <= from || wake > to) continue
      const night = sched.night(d - 1, to)
      out.push(makeObservation(this.world, this.id, astro, 'SLEEP_DURATION', night.durationH, wake, 'REST', Q_ESTIMATED, { bedtime: this.world.iso(night.bedtime) }))
      out.push(makeObservation(this.world, this.id, astro, 'SLEEP_EFFICIENCY', night.efficiency * 100, wake, 'REST', Q_ESTIMATED))
    }
    return out
  }

  override status(simNow: number): AdapterStatus {
    return { ...super.status(simNow), batteryPct: Math.round(this.battery), signalPct: 92 }
  }
}

// ---------------------------------------------------------------------------
// Exercise devices (shared): one EXERCISE_LOAD value per completed session
// ---------------------------------------------------------------------------

const EXERCISE_NAMES: Record<ExerciseDeviceKind, string> = {
  EXERCISE_CEVIS: 'CEVIS cycle ergometer (sim)',
  EXERCISE_ARED: 'ARED resistive exercise device (sim)',
  EXERCISE_T2: 'T2 treadmill (sim)',
}

export class ExerciseDeviceAdapter extends BaseAdapter {
  constructor(world: SimWorld, kind: ExerciseDeviceKind, startAt: number) {
    super(world, { id: `DEV-${kind.replace('EXERCISE_', 'EX-')}`, kind, name: EXERCISE_NAMES[kind], assignedTo: null, metrics: ['EXERCISE_LOAD'], startAt })
  }

  read(simNow: number): HealthObservation[] {
    const prev = this.lastReadAt
    this.lastReadAt = simNow
    return this.readEvents(prev, simNow)
  }

  readEvents(from: number, to: number): HealthObservation[] {
    const out: HealthObservation[] = []
    for (const astro of this.world.crewIds) {
      const ph = this.world.physio(astro)
      const endOffset = (ph.profile.exerciseStartMin + SCHEDULE.exerciseDurationMin) * MIN_MS
      for (let d = dayIndex(from) - 1; d <= dayIndex(to); d++) {
        const end = d * DAY_MS + endOffset
        if (end <= from || end > to) continue
        const s = ph.schedule.session(d, to)
        if (s.device !== this.kind || s.skipped || s.end <= from || s.end > to) continue
        out.push(
          makeObservation(this.world, this.id, astro, 'EXERCISE_LOAD', 100 * s.perf, s.end, 'EXERCISE', Q_VALID, {
            session_minutes: SCHEDULE.exerciseDurationMin,
            device_kind: this.kind,
          }),
        )
        this.lastSeenAt = Math.max(this.lastSeenAt, s.end)
      }
    }
    return out
  }

  override status(): AdapterStatus {
    return { state: 'ONLINE', batteryPct: null, signalPct: null, lastSeenAt: this.lastSeenAt, detail: `Last session logged ${fmtClock(this.lastSeenAt)}` }
  }
}

export const EXERCISE_DEVICE_KINDS = EXERCISE_ROTATION

// ---------------------------------------------------------------------------
// Reaction self-test (software, twice a day) and fluid intake log (software)
// ---------------------------------------------------------------------------

export class ReactionTestAdapter extends BaseAdapter {
  constructor(world: SimWorld, astronautId: string, startAt: number) {
    super(world, { id: `APP-RST-${astronautId}`, kind: 'COGNITIVE_TEST', name: 'Reaction self-test (sim)', assignedTo: astronautId, metrics: ['REACTION_TIME'], listed: false, startAt })
  }

  read(simNow: number): HealthObservation[] {
    const prev = this.lastReadAt
    this.lastReadAt = simNow
    return this.readEvents(prev, simNow)
  }

  readEvents(from: number, to: number): HealthObservation[] {
    const astro = this.assignedTo!
    const sc = this.world.scenario
    const P = this.world.physio(astro).profile
    const cabin = this.world.cabin()
    const out: HealthObservation[] = []
    for (let d = dayIndex(from); d <= dayIndex(to); d++) {
      for (const m of SCHEDULE.reactionTestMins) {
        const tt = d * DAY_MS + m * MIN_MS
        if (tt <= from || tt > to) continue
        const co2 = cabin && Math.abs(cabin.t - tt) <= 15 * MIN_MS ? cabin.co2 : 2600
        const f = sc.fatigue(astro, tt)
        const a = sc.acute(astro, tt)
        const evening = m > 12 * 60 ? 0.02 : 0
        const rt = P.rtBase * (1 + 0.17 * f + 0.11 * co2Effect(co2) + 0.3 * a + evening) * (1 + 0.035 * hashNormal(this.world.seed, astro, 'rt', tt))
        out.push(makeObservation(this.world, this.id, astro, 'REACTION_TIME', rt, tt, 'WORK', Q_VALID, { test: 'reaction self-test, 3 min' }))
        this.lastSeenAt = Math.max(this.lastSeenAt, tt)
      }
    }
    return out
  }
}

export class IntakeLogAdapter extends BaseAdapter {
  constructor(world: SimWorld, astronautId: string, startAt: number) {
    super(world, { id: `APP-H2O-${astronautId}`, kind: 'INTAKE_LOG', name: 'Fluid intake log (sim)', assignedTo: astronautId, metrics: ['HYDRATION'], listed: false, startAt })
  }

  read(simNow: number): HealthObservation[] {
    const prev = this.lastReadAt
    this.lastReadAt = simNow
    if (!crossed(prev, simNow, 30 * MIN_MS)) return []
    const astro = this.assignedTo!
    const truth = this.world.physio(astro).truth
    if (!truth) return []
    this.lastSeenAt = simNow
    return [makeObservation(this.world, this.id, astro, 'HYDRATION', truth.hydration, simNow, truth.activity, Q_ESTIMATED)]
  }
}

// ---------------------------------------------------------------------------
// Cabin environment sensor and dosimeters
// ---------------------------------------------------------------------------

export class EnvSensorAdapter extends BaseAdapter {
  constructor(world: SimWorld, startAt: number) {
    super(world, { id: 'DEV-ENV-01', kind: 'ENV_SENSOR', name: 'Cabin environment sensor (sim)', assignedTo: null, metrics: ['CO2', 'CABIN_TEMPERATURE', 'RELATIVE_HUMIDITY'], startAt })
  }

  read(simNow: number): HealthObservation[] {
    this.lastReadAt = simNow
    const c = this.world.cabin()
    if (!c) return []
    this.lastSeenAt = simNow
    return [
      makeObservation(this.world, this.id, 'CABIN', 'CO2', c.co2, simNow, 'WORK'),
      makeObservation(this.world, this.id, 'CABIN', 'CABIN_TEMPERATURE', c.temp, simNow, 'WORK'),
      makeObservation(this.world, this.id, 'CABIN', 'RELATIVE_HUMIDITY', c.rh, simNow, 'WORK'),
    ]
  }
}

export class AreaDosimeterAdapter extends BaseAdapter {
  constructor(world: SimWorld, startAt: number) {
    super(world, { id: 'DEV-DOS-AREA', kind: 'DOSIMETER', name: 'Area radiation monitor (sim)', assignedTo: null, metrics: ['RADIATION_DOSE_RATE'], startAt })
  }

  read(simNow: number): HealthObservation[] {
    this.lastReadAt = simNow
    const c = this.world.cabin()
    if (!c) return []
    this.lastSeenAt = simNow
    return [makeObservation(this.world, this.id, 'CABIN', 'RADIATION_DOSE_RATE', c.doseRate, simNow, 'WORK')]
  }
}

export class PersonalDosimeterAdapter extends BaseAdapter {
  constructor(world: SimWorld, astronautId: string, startAt: number) {
    super(world, { id: `DEV-DOS-${astronautId}`, kind: 'DOSIMETER', name: 'Personal dosimeter (sim)', assignedTo: astronautId, metrics: ['RADIATION_DOSE'], startAt })
  }

  read(simNow: number): HealthObservation[] {
    const prev = this.lastReadAt
    this.lastReadAt = simNow
    if (!crossed(prev, simNow, 15 * MIN_MS)) return []
    const astro = this.assignedTo!
    const act = this.world.physio(astro).truth?.activity ?? 'REST'
    this.lastSeenAt = simNow
    return [makeObservation(this.world, this.id, astro, 'RADIATION_DOSE', this.world.personalDose(astro), simNow, act)]
  }

  override status(simNow: number): AdapterStatus {
    const s = super.status(simNow)
    const stale = simNow - this.lastSeenAt > 20 * MIN_MS
    return { ...s, state: stale ? 'DATA_STALE' : 'ONLINE', detail: stale ? s.detail : 'Logging every 15 min', batteryPct: 88 }
  }
}
