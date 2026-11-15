/**
 * Daily crew schedule (sim time is UTC, like ISS GMT):
 *   22:00 to 06:00  sleep period (bedtime shifts later with fatigue)
 *   06:00 to 07:00  post-sleep, hygiene, breakfast (REST)
 *   07:00 to 12:00  work
 *   12:00 to 13:00  lunch (REST)
 *   13:00 to 19:00  work
 *   19:00 to bed    evening (REST)
 * Plus a 1 hour exercise block per astronaut (CEVIS, ARED or T2, rotating daily)
 * followed by 20 minutes of recovery. Two short reaction tests per day.
 */
import type { ActivityContext } from '../../types/domain'
import { clamp } from '../stats'
import { hash01, hashNormal } from '../random'
import { DAY_MS, HOUR_MS, MIN_MS } from '../text'
import type { PhysioProfile } from './profiles'

export const SCHEDULE = {
  wakeMin: 6 * 60,
  workStartMin: 7 * 60,
  lunchStartMin: 12 * 60,
  lunchEndMin: 13 * 60,
  workEndMin: 19 * 60,
  bedtimeMin: 22 * 60,
  exerciseDurationMin: 60,
  recoveryMin: 20,
  reactionTestMins: [7 * 60 + 30, 19 * 60 + 30],
} as const

export type ExerciseDeviceKind = 'EXERCISE_CEVIS' | 'EXERCISE_ARED' | 'EXERCISE_T2'
export const EXERCISE_ROTATION: ExerciseDeviceKind[] = ['EXERCISE_CEVIS', 'EXERCISE_ARED', 'EXERCISE_T2']

export function dayIndex(t: number): number {
  return Math.floor(t / DAY_MS)
}

export function minuteOfDay(t: number): number {
  return Math.floor((t - dayIndex(t) * DAY_MS) / MIN_MS)
}

export interface NightPlan {
  day: number
  bedtime: number
  wake: number
  efficiency: number
  durationH: number
}

export interface SessionPlan {
  day: number
  start: number
  end: number
  device: ExerciseDeviceKind
  /** Output relative to the personal usual (1 = usual). */
  perf: number
  skipped: boolean
}

export interface ScheduleEffects {
  fatigue(t: number): number
  acute(t: number): number
  perfLoss(t: number): number
}

export interface ActivityInfo {
  activity: ActivityContext
  recovering: boolean
  awakeInBed: boolean
  session: SessionPlan | null
  minuteIntoSession: number
  minutesSinceSessionEnd: number
}

export class CrewSchedule {
  readonly astronautId: string
  private readonly profile: PhysioProfile
  private readonly seed: number
  private readonly fx: ScheduleEffects
  private readonly nights = new Map<number, NightPlan>()
  private readonly sessions = new Map<number, SessionPlan>()

  constructor(astronautId: string, profile: PhysioProfile, seed: number, fx: ScheduleEffects) {
    this.astronautId = astronautId
    this.profile = profile
    this.seed = seed
    this.fx = fx
  }

  /**
   * Sleep period that starts on the evening of day d. Scenario effects are read at the
   * nominal bedtime; the plan is cached only once that moment has passed (causality).
   */
  night(d: number, queryT: number): NightPlan {
    const cached = this.nights.get(d)
    if (cached) return cached
    const evalT = d * DAY_MS + SCHEDULE.bedtimeMin * MIN_MS
    const f = this.fx.fatigue(evalT)
    const id = this.astronautId
    const jitter = hashNormal(this.seed, id, 'bed', d) * 12
    const bedtime = d * DAY_MS + (SCHEDULE.bedtimeMin + this.profile.bedOffsetMin + jitter + f * 95) * MIN_MS
    const wake = (d + 1) * DAY_MS + SCHEDULE.wakeMin * MIN_MS
    const efficiency = clamp(this.profile.sleepEff + hashNormal(this.seed, id, 'eff', d) * 0.015 - 0.15 * f, 0.55, 0.97)
    const durationH = Math.max(0, ((wake - bedtime) / HOUR_MS) * efficiency + hashNormal(this.seed, id, 'dur', d) * 0.08)
    const plan: NightPlan = { day: d, bedtime, wake, efficiency, durationH }
    if (queryT >= evalT) this.nights.set(d, plan)
    return plan
  }

  session(d: number, queryT: number): SessionPlan {
    const cached = this.sessions.get(d)
    if (cached) return cached
    const start = d * DAY_MS + this.profile.exerciseStartMin * MIN_MS
    const end = start + SCHEDULE.exerciseDurationMin * MIN_MS
    const device = EXERCISE_ROTATION[(((d + this.profile.deviceOffset) % 3) + 3) % 3]!
    const skipped = this.fx.acute(start) > 0.2
    const perf = 1 - this.fx.perfLoss(start) - 0.05 * this.fx.fatigue(start) + hashNormal(this.seed, this.astronautId, 'perf', d) * 0.025
    const plan: SessionPlan = { day: d, start, end, device, perf, skipped }
    if (queryT >= start) this.sessions.set(d, plan)
    return plan
  }

  activityAt(t: number): ActivityInfo {
    const d = dayIndex(t)
    const m = minuteOfDay(t)
    let night: NightPlan | null = null
    if (m < SCHEDULE.wakeMin) {
      const n = this.night(d - 1, t)
      if (t >= n.bedtime) night = n
    } else if (m >= SCHEDULE.bedtimeMin - 60) {
      const n = this.night(d, t)
      if (t >= n.bedtime) night = n
    }
    const none = { session: null, minuteIntoSession: -1, minutesSinceSessionEnd: Infinity }
    if (night) {
      const slot = Math.floor(t / (10 * MIN_MS))
      const awakeInBed = hash01(this.seed, this.astronautId, 'wk', slot) < (1 - night.efficiency) * 0.8
      return { activity: 'SLEEP', recovering: false, awakeInBed, ...none }
    }
    const s = this.session(d, t)
    if (!s.skipped && t >= s.start && t < s.end) {
      return {
        activity: 'EXERCISE',
        recovering: false,
        awakeInBed: false,
        session: s,
        minuteIntoSession: (t - s.start) / MIN_MS,
        minutesSinceSessionEnd: Infinity,
      }
    }
    const sinceEnd = (t - s.end) / MIN_MS
    const recovering = !s.skipped && sinceEnd >= 0 && sinceEnd < SCHEDULE.recoveryMin
    let activity: ActivityContext = 'REST'
    if (m >= SCHEDULE.workStartMin && m < SCHEDULE.lunchStartMin) activity = 'WORK'
    else if (m >= SCHEDULE.lunchEndMin && m < SCHEDULE.workEndMin) activity = 'WORK'
    return {
      activity,
      recovering,
      awakeInBed: false,
      session: recovering ? s : null,
      minuteIntoSession: -1,
      minutesSinceSessionEnd: recovering ? sinceEnd : Infinity,
    }
  }
}
