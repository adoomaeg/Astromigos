/**
 * "True" simulated physiology of one astronaut, stepped once per sim step.
 * Devices (adapters.ts) sample this state and turn it into canonical observations.
 *
 * Model: target value from schedule context + circadian rhythm + scenario effects,
 * approached through a first order lag (the body does not jump), plus smooth
 * Ornstein-Uhlenbeck noise. Plausible for a demo, not a validated physiological model.
 */
import type { ActivityContext } from '../../types/domain'
import { OUProcess, hashSeed } from '../random'
import { clamp, lerp } from '../stats'
import { DAY_MS, HOUR_MS } from '../text'
import type { PhysioProfile } from './profiles'
import { CrewSchedule, type ExerciseDeviceKind, type ScheduleEffects, type SessionPlan } from './schedule'

export interface PhysioEnv {
  co2: number
  cabinTemp: number
}

export interface PhysioEffects {
  fatigue: number
  acute: number
  perfLoss: number
  hydrationBoost: number
}

export interface PhysioTruth {
  t: number
  activity: ActivityContext
  recovering: boolean
  awakeInBed: boolean
  session: SessionPlan | null
  hr: number
  hrv: number
  spo2: number
  rr: number
  sbp: number
  dbp: number
  skin: number
  activityLevel: number
  hydration: number
}

const DEVICE_INTENSITY: Record<ExerciseDeviceKind, number> = {
  EXERCISE_CEVIS: 0.73,
  EXERCISE_T2: 0.77,
  EXERCISE_ARED: 0.6,
}

/** 0..1 intensity profile across a 60 minute session: warm-up, main set, cool-down. */
export function sessionIntensity(minuteInto: number, device: ExerciseDeviceKind): number {
  if (minuteInto < 5) return 0.45 + 0.55 * (minuteInto / 5)
  if (minuteInto < 50) {
    if (device === 'EXERCISE_ARED') return 0.75 + 0.25 * Math.max(0, Math.sin((2 * Math.PI * minuteInto) / 4))
    return 1
  }
  return Math.max(0.3, 1 - (0.65 * (minuteInto - 50)) / 10)
}

/** CO2 effect factor used by physiology and the reaction test (0 at nominal cabin air). */
export function co2Effect(co2: number): number {
  return clamp((co2 - 2800) / 3500, 0, 1.4)
}

export interface RestingEquivalent {
  hr: number
  hrv: number
  spo2: number
  rr: number
  hydration: number
}

/**
 * Noise free resting equivalent of the model below (REST context, daily rhythm removed, no
 * exercise or sweat), used by the intervention comparison. Mirrors the REST branch of step():
 * keep the coefficients in sync when the model changes.
 */
export function restingEquivalent(P: PhysioProfile, fx: PhysioEffects, co2: number): RestingEquivalent {
  const c = co2Effect(co2)
  const f = fx.fatigue
  const acute = fx.acute
  return {
    hr: lerp(P.restHR + 8 * f + 2 * c + 1, 146, acute),
    hrv: lerp(P.hrvBase * (1 - 0.38 * f) * (1 - 0.06 * c), 14, acute),
    spo2: Math.min(99.9, lerp(P.spo2Base, 89, acute)),
    rr: lerp(P.rrBase + 3.2 * c + 0.5 * f, 25, acute),
    hydration: clamp(P.hydrationBase - 6 * f + fx.hydrationBoost, 30, 100),
  }
}

export class AstronautPhysiology {
  readonly id: string
  readonly profile: PhysioProfile
  readonly schedule: CrewSchedule
  private readonly n: Record<'hr' | 'hrFast' | 'hrv' | 'spo2' | 'rr' | 'bp' | 'skin' | 'act' | 'hyd', OUProcess>
  private hrLag = NaN
  private hrvLag = NaN
  private spo2Lag = NaN
  private rrLag = NaN
  private sbpLag = NaN
  private dbpLag = NaN
  private skinLag = NaN
  private sweat = 0
  truth: PhysioTruth | null = null

  constructor(id: string, profile: PhysioProfile, seed: number, fx: ScheduleEffects) {
    this.id = id
    this.profile = profile
    this.schedule = new CrewSchedule(id, profile, seed, fx)
    const ou = (name: string, tau: number) => new OUProcess(hashSeed(seed, id, 'ou', name), tau)
    this.n = {
      hr: ou('hr', 20),
      hrFast: ou('hrFast', 3),
      hrv: ou('hrv', 25),
      spo2: ou('spo2', 12),
      rr: ou('rr', 8),
      bp: ou('bp', 25),
      skin: ou('skin', 45),
      act: ou('act', 6),
      hyd: ou('hyd', 60),
    }
  }

  step(t: number, dtMin: number, env: PhysioEnv, fx: PhysioEffects): PhysioTruth {
    const P = this.profile
    const info = this.schedule.activityAt(t)
    let activity = info.activity
    let session = info.session
    let exercising = activity === 'EXERCISE'
    const acute = fx.acute
    if (acute > 0.3 && activity !== 'SLEEP') {
      // During the acute event the crew member stops working or exercising.
      activity = 'REST'
      exercising = false
      session = null
    }
    const sleeping = activity === 'SLEEP'
    const recovering = info.recovering && acute <= 0.3
    const hourUtc = (((t % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS
    /** +1 at 16:00 UTC, -1 at 04:00 UTC. */
    const circ = Math.cos((2 * Math.PI * (hourUtc - 16)) / 24)
    const c = co2Effect(env.co2)
    const f = fx.fatigue
    const perfNorm = fx.perfLoss / 0.32
    const device = session?.device ?? 'EXERCISE_CEVIS'
    const prof = exercising ? sessionIntensity(info.minuteIntoSession, device) : 0

    // Step all noise channels every step (keeps runs reproducible).
    const nHr = this.n.hr.step(dtMin)
    const nHrF = this.n.hrFast.step(dtMin)
    const nHrv = this.n.hrv.step(dtMin)
    const nSpo2 = this.n.spo2.step(dtMin)
    const nRr = this.n.rr.step(dtMin)
    const nBp = this.n.bp.step(dtMin)
    const nSkin = this.n.skin.step(dtMin)
    const nAct = this.n.act.step(dtMin)
    const nHyd = this.n.hyd.step(dtMin)

    // Heart rate
    let hrT = P.restHR + 1.5 * circ + 8 * f + 2 * c
    if (sleeping) hrT += -8 + (info.awakeInBed ? 3 : 0)
    else if (activity === 'WORK') hrT += 6
    else if (activity === 'REST') hrT += 1
    if (exercising) {
      const exTarget = P.restHR + (P.hrMax * DEVICE_INTENSITY[device] - P.restHR) * prof
      hrT = exTarget * (1 + 0.05 * perfNorm) + 2 * c
    }
    if (recovering) hrT += 8 * Math.exp(-info.minutesSinceSessionEnd / 6)
    hrT = lerp(hrT, 146, acute)
    this.hrLag = lag(this.hrLag, hrT, dtMin, hrT > this.hrLag ? 1 : 2.5)
    const noiseScale = sleeping ? 0.6 : exercising ? 1.3 : 1
    const hr = this.hrLag + (2.6 * nHr + 1.2 * nHrF) * noiseScale

    // HRV (RMSSD)
    let hrvF = 1
    if (sleeping) hrvF = info.awakeInBed ? 1.05 : 1.32
    else if (activity === 'WORK') hrvF = 0.86
    if (exercising) hrvF = device === 'EXERCISE_ARED' ? 0.42 : 0.32
    if (recovering) hrvF = 0.6
    let hrvT = P.hrvBase * hrvF * (1 - 0.38 * f) * (1 - 0.06 * c)
    hrvT = lerp(hrvT, 14, acute)
    this.hrvLag = lag(this.hrvLag, hrvT, dtMin, 4)
    const hrv = Math.max(4, this.hrvLag * Math.exp(0.13 * nHrv))

    // SpO2
    let spo2T = P.spo2Base - (sleeping ? 0.6 : 0) - (exercising ? 0.5 * prof : 0)
    spo2T = lerp(spo2T, 89, acute)
    this.spo2Lag = lag(this.spo2Lag, spo2T, dtMin, 2)
    const spo2 = Math.min(99.9, this.spo2Lag + 0.45 * nSpo2)

    // Respiratory rate
    let rrT = P.rrBase + 3.2 * c + 0.5 * f
    if (sleeping) rrT -= 1.5
    else if (activity === 'WORK') rrT += 1
    if (exercising) rrT += (device === 'EXERCISE_ARED' ? 6 : 11) * prof
    if (recovering) rrT += 2
    rrT = lerp(rrT, 25, acute)
    this.rrLag = lag(this.rrLag, rrT, dtMin, 1.5)
    const rr = Math.max(5, this.rrLag + 0.7 * nRr)

    // Blood pressure estimate
    let sbpT = P.sbpBase + 2 * circ + 3 * f
    let dbpT = P.dbpBase + 1 * circ + 2 * f
    if (sleeping) {
      sbpT -= 10
      dbpT -= 7
    } else if (activity === 'WORK') {
      sbpT += 4
      dbpT += 3
    }
    if (exercising) {
      sbpT += (device === 'EXERCISE_ARED' ? 40 : 32) * prof
      dbpT += (device === 'EXERCISE_ARED' ? 10 : 4) * prof
    }
    sbpT += 20 * acute
    dbpT += 9 * acute
    this.sbpLag = lag(this.sbpLag, sbpT, dtMin, 3)
    this.dbpLag = lag(this.dbpLag, dbpT, dtMin, 3)
    const sbp = this.sbpLag + 3.5 * nBp
    const dbp = this.dbpLag + 2.4 * nBp

    // Skin temperature
    let skinT = P.skinBase + 0.15 * circ + 0.25 * (env.cabinTemp - 22.5)
    if (sleeping) skinT += 0.9
    if (exercising) skinT += 0.4 * prof
    skinT -= 0.4 * acute
    this.skinLag = lag(this.skinLag, skinT, dtMin, 20)
    const skin = this.skinLag + 0.12 * nSkin

    // Activity (wrist score)
    let actT = 16
    if (sleeping) actT = info.awakeInBed ? 10 : 3
    else if (activity === 'WORK') actT = 40
    if (exercising) actT = (device === 'EXERCISE_ARED' ? 70 : device === 'EXERCISE_T2' ? 90 : 82) * Math.max(prof, 0.4)
    if (!sleeping) actT *= (1 - 0.15 * f) * (1 - 0.1 * perfNorm)
    actT = lerp(actT, 8, acute)
    const activityLevel = clamp(actT + 6 * nAct, 0, 100)

    // Hydration index (fluid logs, simulated)
    if (exercising) this.sweat += 0.05 * dtMin
    else this.sweat *= Math.exp(-dtMin / 150)
    const hydration = clamp(P.hydrationBase + 1.5 * circ - this.sweat - 6 * f + fx.hydrationBoost + 1.5 * nHyd, 30, 100)

    this.truth = {
      t,
      activity,
      recovering,
      awakeInBed: sleeping && info.awakeInBed,
      session: exercising ? session : null,
      hr,
      hrv,
      spo2,
      rr,
      sbp,
      dbp,
      skin,
      activityLevel,
      hydration,
    }
    return this.truth
  }
}

function lag(prev: number, target: number, dtMin: number, tauMin: number): number {
  if (Number.isNaN(prev)) return target
  return prev + (target - prev) * (1 - Math.exp(-dtMin / tauMin))
}
