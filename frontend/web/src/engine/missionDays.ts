/**
 * Long-term mission view (mission day 1 .. current mission day). SIMULATED.
 *
 * Three tiers, so the view is cheap and consistent with the rest of the simulation:
 *  1. Older days (before the daily backfill window): deterministic seeded synthesis consistent
 *     with each person's profile. Sleep around the profile mean (8 h in bed x sleep efficiency)
 *     with occasional short nights; one 60 min exercise block with some missed sessions;
 *     resting heart rate and HRV around the profile; absorbed dose in the order of a few
 *     tenths of a mGy per day (ISS-like) with occasional higher days. The synthesized daily
 *     doses are scaled so they add up exactly to the personal dosimeter reading at the start
 *     of the minute level history (no jump between tiers).
 *  2. Days inside the daily backfill window: sleep and exercise come from the same simulated
 *     nightly plans and sessions as the SLEEP_DURATION and EXERCISE_LOAD metrics.
 *  3. Days inside the minute level history: resting heart rate and HRV are the means of the
 *     simulated rest context values, dose comes from the personal dosimeter, and the attention
 *     level is the worst status frame of that day when frames exist.
 * The current day is refreshed live. Scenarios therefore show up in the recent days only.
 */
import type { MissionDaySummary, Status } from '../types/domain'
import { MISSION_DAYS, MISSION_PLAN } from './config'
import { hash01, hashNormal } from './random'
import { clamp, round } from './stats'
import type { PhysioProfile } from './sim/profiles'

export interface SynthDay {
  sleepHours: number
  exerciseMinutes: number
  exerciseLoadPct: number | null
  restingHr: number
  hrv: number
  /** Unscaled daily dose (mGy). */
  doseRaw: number
}

/** Typical simulated sleep for a profile (hours): 8 h in bed x efficiency. */
export function typicalSleepHours(p: PhysioProfile): number {
  return 8 * p.sleepEff
}

/** Seeded synthesis of one older mission day. */
export function synthDay(seed: number, astronautId: string, p: PhysioProfile, missionDay: number): SynthDay {
  const n = (k: string) => hashNormal(seed, astronautId, 'mday', k, missionDay)
  const u = (k: string) => hash01(seed, astronautId, 'mday', k, missionDay)
  let sleep = typicalSleepHours(p) + 0.35 * n('sleep')
  if (u('badnight') < 0.05) sleep -= 1.2 + 0.8 * u('badnight-depth')
  const missed = u('missed') < MISSION_DAYS.missedSessionShare
  const partial = !missed && u('partial') < 0.05
  const exerciseMinutes = missed ? 0 : partial ? 30 + Math.round(20 * u('partial-min')) : MISSION_PLAN.exercisePlanMinutesPerDay
  const exerciseLoadPct = missed ? null : round(100 + 2.5 * n('load'), 1)
  const restingHr = p.restHR + 1 + 1.2 * n('hr') + (sleep < typicalSleepHours(p) - 1 ? 2 : 0)
  const hrv = p.hrvBase * Math.exp(0.07 * n('hrv')) * (sleep < typicalSleepHours(p) - 1 ? 0.9 : 1)
  let dose = MISSION_DAYS.doseMgyPerDay * p.shieldFactor * (1 + 0.08 * n('dose'))
  if (u('dose-high') < MISSION_DAYS.highDoseDayShare) dose *= 1.5 + 1.5 * u('dose-high-x')
  return {
    sleepHours: round(clamp(sleep, 3, 9.5), 2),
    exerciseMinutes,
    exerciseLoadPct,
    restingHr: round(restingHr, 1),
    hrv: round(hrv, 1),
    doseRaw: dose,
  }
}

/** Simple attention heuristic for days without status frames (not the risk engine). */
export function heuristicLevel(p: PhysioProfile, sleepHours: number | null, exerciseLoadPct: number | null): Status {
  if (sleepHours !== null && sleepHours < typicalSleepHours(p) - 1.4) return 'MODERATE'
  if (exerciseLoadPct !== null && exerciseLoadPct < 85) return 'MODERATE'
  return 'LOW'
}

export function isoDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

/** True when two summaries carry the same values (used to keep references stable). */
export function sameDay(a: MissionDaySummary | undefined, b: MissionDaySummary): boolean {
  if (!a) return false
  return (
    a.missionDay === b.missionDay &&
    a.sleepHours === b.sleepHours &&
    a.exerciseMinutes === b.exerciseMinutes &&
    a.exerciseLoadPct === b.exerciseLoadPct &&
    a.restingHr === b.restingHr &&
    a.hrv === b.hrv &&
    a.radiationDoseMgy === b.radiationDoseMgy &&
    a.cumulativeDoseMgy === b.cumulativeDoseMgy &&
    a.riskLevel === b.riskLevel
  )
}
