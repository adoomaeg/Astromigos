/**
 * Per astronaut physiological profile (simulated).
 * Slight, plausible differences by age and sex plus a seeded individual offset.
 * These are simulation parameters, not reference values for real people.
 */
import type { Astronaut } from '../../types/domain'
import { hashNormal } from '../random'

export interface PhysioProfile {
  /** Seated, awake resting heart rate (bpm). */
  restHR: number
  /** Age predicted maximum heart rate (Tanaka: 208 - 0.7 x age). */
  hrMax: number
  /** Awake resting RMSSD (ms). */
  hrvBase: number
  spo2Base: number
  rrBase: number
  sbpBase: number
  dbpBase: number
  skinBase: number
  /** Reaction time on the short test (ms). */
  rtBase: number
  /** Typical sleep efficiency (0..1). */
  sleepEff: number
  /** Personal bedtime offset vs 22:00 UTC (minutes). */
  bedOffsetMin: number
  /** Exercise block start (minutes after 00:00 UTC). */
  exerciseStartMin: number
  /** Rotation offset for CEVIS / ARED / T2. */
  deviceOffset: number
  hydrationBase: number
  /** Personal dosimeter factor (sleep station shielding, EVA history). */
  shieldFactor: number
}

const EXERCISE_START = [13 * 60 + 30, 9 * 60, 15 * 60 + 30, 10 * 60 + 30]

export function buildProfile(a: Astronaut, index: number, seed: number): PhysioProfile {
  const j = (key: string, sd: number) => hashNormal(seed, a.id, 'profile', key) * sd
  const female = a.sex === 'F'
  return {
    restHR: 60 + (female ? 4 : 0) + (a.age - 40) * 0.1 + j('hr', 2.5),
    hrMax: 208 - 0.7 * a.age,
    hrvBase: Math.max(25, 78 - 0.85 * a.age + (female ? 3 : 0) + j('hrv', 3)),
    spo2Base: 97.9 - (a.age - 35) * 0.02 + j('spo2', 0.25),
    rrBase: 14 + j('rr', 0.8),
    sbpBase: 112 + (female ? 0 : 6) + (a.age - 35) * 0.4 + j('sbp', 3),
    dbpBase: 72 + (a.age - 35) * 0.25 + j('dbp', 2),
    skinBase: 33.6 + j('skin', 0.25),
    rtBase: 265 + (a.age - 35) * 1.5 + j('rt', 10),
    sleepEff: 0.89 + j('eff', 0.015),
    bedOffsetMin: j('bed', 12),
    exerciseStartMin: EXERCISE_START[index % EXERCISE_START.length]!,
    deviceOffset: index,
    hydrationBase: 80 + j('hyd', 2.5),
    shieldFactor: 1 + j('shield', 0.05),
  }
}
