/**
 * Daily crew check-in (NASA Standard Measures style questionnaire, simplified). SIMULATED.
 *
 * Each sim morning (CHECKIN.minuteOfDay, about 07:00 UTC, after wake, with a personal offset)
 * every astronaut answers mood, fatigue, stress and sleep quality on a 1..5 scale plus optional
 * symptom tags. Simulated answers follow the person's simulated state with seeded noise:
 *   - progressive fatigue: fatigue and stress up, mood and sleep quality down over the days
 *   - cabin CO2: a reported headache becomes more likely, stress slightly up
 *   - performance decline: muscle soreness more likely, mood slightly down
 *   - sleep quality follows last night's simulated sleep efficiency and duration
 * The answers are SUBJECTIVE data. They corroborate objective signals; the engine never lets
 * them raise the attention level above MODERATE on their own (config.ts, risk.ts).
 */
import type { CheckIn, DataOrigin, MetricCode } from '../types/domain'
import { CHECKIN, RISK } from './config'
import { hash01, hashNormal } from './random'
import { clamp } from './stats'
import { DAY_MS, HOUR_MS, MIN_MS } from './text'
import type { PhysioProfile } from './sim/profiles'
import type { NightPlan } from './sim/schedule'
import { co2Effect } from './sim/physiology'
import type { SelfReportSummary } from './risk'

/** Sim time of the simulated check-in of `day` (absolute UTC day index) for one astronaut. */
export function checkInTime(seed: number, astronautId: string, day: number): number {
  const personal = (hash01(seed, astronautId, 'checkin-offset') * 2 - 1) * CHECKIN.jitterMin
  const daily = (hash01(seed, astronautId, 'checkin-day', day) * 2 - 1) * 5
  return day * DAY_MS + Math.round(CHECKIN.minuteOfDay + personal + daily) * MIN_MS
}

export interface CheckInState {
  /** Progressive fatigue severity 0..1. */
  fatigue: number
  /** Cabin CO2 in ppm at check-in time. */
  co2: number
  /** Exercise performance loss 0..0.32. */
  perfLoss: number
  /** The sleep period that ended this morning. */
  night: NightPlan
}

const answer = (x: number) => clamp(Math.round(x), 1, 5)

/** Simulated answers for one astronaut on one day. Deterministic for (seed, astronaut, day, state). */
export function simulateCheckIn(seed: number, astronautId: string, profile: PhysioProfile, day: number, t: number, s: CheckInState): Omit<CheckIn, 'id'> {
  const n = (k: string) => hashNormal(seed, astronautId, 'checkin', k, day)
  const base = (k: string, sd: number) => hashNormal(seed, astronautId, 'checkin-base', k) * sd
  const f = s.fatigue
  const c = Math.min(1, co2Effect(s.co2))
  const perf = clamp(s.perfLoss / 0.32, 0, 1)
  const deficit = Math.max(0, 7 - s.night.durationH)

  const fatigue = answer(2 + base('fatigue', 0.25) + 2.2 * f + 0.6 * deficit + 0.3 * c + 0.3 * perf + 0.45 * n('fatigue'))
  const mood = answer(4 + base('mood', 0.25) - 1.4 * f - 0.35 * c - 0.6 * perf - 0.2 * deficit + 0.45 * n('mood'))
  const stress = answer(2 + base('stress', 0.25) + 1.4 * f + 0.6 * c + 0.4 * perf + 0.45 * n('stress'))
  const sleepQuality = answer(3.9 + (s.night.efficiency - profile.sleepEff) * 18 + (s.night.durationH - 8 * profile.sleepEff) * 0.5 + 0.4 * n('sleep'))

  const symptoms: string[] = []
  const chance = (tag: string, prob: number) => {
    if (hash01(seed, astronautId, 'symptom', tag, day) < prob) symptoms.push(tag)
  }
  chance('headache', 0.03 + 0.55 * c + 0.1 * f)
  chance('congestion', 0.05)
  chance('back pain', 0.04)
  chance('muscle soreness', 0.03 + 0.4 * perf)

  let note = ''
  if (c > 0.4 && symptoms.includes('headache')) note = 'Headache since waking, the air feels stuffy.'
  else if (f > 0.5) note = 'Feeling tired, sleep was short.'
  else if (perf > 0.5) note = 'Workout felt harder than usual.'

  return { astronautId, at: t, mood, fatigue, stress, sleepQuality, symptoms, note, data_origin: 'SIMULATED' }
}

/** Observations produced by one check-in (event metrics, compared with the person's own answers). */
export function checkInValues(c: CheckIn): Array<{ metric: MetricCode; value: number }> {
  return [
    { metric: 'MOOD', value: c.mood },
    { metric: 'PERCEIVED_FATIGUE', value: c.fatigue },
    { metric: 'STRESS', value: c.stress },
  ]
}

/** Normalize a check-in typed in the UI (1..5 integers, trimmed tags). */
export function sanitizeCheckIn(input: Omit<CheckIn, 'id' | 'at' | 'data_origin'>, at: number, origin: DataOrigin): Omit<CheckIn, 'id'> {
  const tags = [...new Set(input.symptoms.map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0 && x.length <= 40))].slice(0, 8)
  return {
    astronautId: input.astronautId,
    at,
    mood: answer(input.mood),
    fatigue: answer(input.fatigue),
    stress: answer(input.stress),
    sleepQuality: answer(input.sleepQuality),
    symptoms: tags,
    note: (input.note ?? '').slice(0, 500),
    data_origin: origin,
  }
}

/** Self report summary for the risk rules. `list` is one astronaut's check-ins, newest first. */
export function selfReportSummary(list: CheckIn[], now: number): SelfReportSummary {
  let run = 0
  for (const c of list) {
    if (c.at > now) continue
    if (now - c.at > 3 * DAY_MS) break
    if (c.fatigue >= RISK.selfReportHighFatigue) run++
    else break
  }
  const latest = list.find((c) => c.at <= now)
  const symptoms = latest && now - latest.at <= CHECKIN.symptomWindowHours * HOUR_MS ? latest.symptoms : []
  return { highFatigueRun: run, symptoms }
}
