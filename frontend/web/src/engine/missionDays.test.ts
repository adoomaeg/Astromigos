import { beforeAll, describe, expect, it } from 'vitest'
import { CREW, MISSION } from './catalog'
import { HealthEngine } from './engine'
import { synthDay, typicalSleepHours } from './missionDays'
import { buildProfile } from './sim/profiles'
import { DAY_MS, MIN_MS } from './text'

function run(e: HealthEngine, minutes: number, stepMin = 30): void {
  const end = e.simTime + minutes * MIN_MS
  while (e.simTime < end) {
    e.advanceTo(Math.min(end, e.simTime + stepMin * MIN_MS))
    e.evaluate()
  }
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

describe('mission days (long-term view)', () => {
  let e: HealthEngine
  beforeAll(() => {
    e = new HealthEngine({ scenarioId: 'NOMINAL' })
  }, 60000)

  it('covers mission day 1 .. current mission day for every astronaut, ascending', () => {
    const current = e.crew[0]!.missionDay
    expect(current).toBe(44)
    for (const a of CREW) {
      const days = e.missionDays[a.id]!
      expect(days.map((d) => d.missionDay)).toEqual(Array.from({ length: current }, (_, i) => i + 1))
      expect(days[0]!.date).toBe('2026-10-02')
      expect(days[current - 1]!.date).toBe('2026-11-14')
      expect(days.every((d) => d.data_origin === 'SIMULATED' && d.astronautId === a.id)).toBe(true)
      expect(days[0]!.synthesized).toBe(true)
      expect(days[current - 1]!.synthesized).toBe(false)
    }
  })

  it('has plausible, consistent values (ISS-like dose, sleep, exercise around plan)', () => {
    const days = e.missionDays['AST-01']!
    const full = days.slice(0, -1)
    for (let i = 1; i < days.length; i++) expect(days[i]!.cumulativeDoseMgy).toBeGreaterThanOrEqual(days[i - 1]!.cumulativeDoseMgy)
    const doses = full.map((d) => d.radiationDoseMgy)
    expect(mean(doses)).toBeGreaterThan(0.25)
    expect(mean(doses)).toBeLessThan(0.7)
    expect(Math.min(...doses)).toBeGreaterThan(0.1)
    // cumulative dose of today = the personal dosimeter reading
    const dosimeter = e.health['AST-01']!.metrics.RADIATION_DOSE!.current!
    expect(Math.abs(days[days.length - 1]!.cumulativeDoseMgy - dosimeter)).toBeLessThan(0.05)
    for (const d of full) {
      expect(d.sleepHours!).toBeGreaterThan(3)
      expect(d.sleepHours!).toBeLessThan(9.5)
      expect([0, 60].includes(d.exerciseMinutes!) || (d.exerciseMinutes! >= 30 && d.exerciseMinutes! <= 50)).toBe(true)
      expect(d.exercisePlannedMinutes).toBe(60)
      expect(d.restingHr!).toBeGreaterThan(50)
      expect(d.restingHr!).toBeLessThan(80)
      expect(d.hrv!).toBeGreaterThan(15)
    }
    expect(full.filter((d) => d.exerciseMinutes === 0).length).toBeLessThan(10)
    expect(full.filter((d) => d.riskLevel !== 'LOW').length).toBeLessThan(10)
  })

  it('synthesis is deterministic and follows the profile', () => {
    const P = buildProfile(CREW[1]!, 1, 99)
    expect(synthDay(99, 'AST-02', P, 7)).toEqual(synthDay(99, 'AST-02', P, 7))
    const sleeps = Array.from({ length: 200 }, (_, d) => synthDay(99, 'AST-02', P, d).sleepHours)
    expect(Math.abs(mean(sleeps) - typicalSleepHours(P))).toBeLessThan(0.25)
  })

  it('updates the current day live and keeps completed days by reference', () => {
    const before = e.missionDays['AST-01']!
    const old = before[10]!
    const today = before[before.length - 1]!
    run(e, 3 * 60, 30)
    const after = e.missionDays['AST-01']!
    expect(after[10]).toBe(old)
    expect(after[after.length - 1]).not.toBe(today)
    expect(after[after.length - 1]!.cumulativeDoseMgy).toBeGreaterThan(today.cumulativeDoseMgy)
    // a day change appends a new day
    run(e, 24 * 60, 60)
    const next = e.missionDays['AST-01']!
    expect(next.length).toBe(45)
    expect(next[44]!.date).toBe(new Date(Date.parse(MISSION.startedAt) + 45 * DAY_MS).toISOString().slice(0, 10))
    expect(next[43]!.exerciseMinutes).not.toBeNull()
  })
})

describe('scenarios show up in the recent days', () => {
  it('PROGRESSIVE_FATIGUE lowers sleep on the recent days', () => {
    const e = new HealthEngine({ scenarioId: 'PROGRESSIVE_FATIGUE' })
    run(e, 3 * 24 * 60 + 60, 60)
    const days = e.missionDays['AST-02']!
    const early = mean(days.slice(0, 30).map((d) => d.sleepHours!))
    const last = days[days.length - 1]!.sleepHours!
    expect(last).toBeLessThan(early - 1.5)
    expect(['MODERATE', 'HIGH']).toContain(days[days.length - 2]!.riskLevel)
  }, 60000)

  it('PERFORMANCE_DECLINE lowers exercise output on the recent days', () => {
    const e = new HealthEngine({ scenarioId: 'PERFORMANCE_DECLINE' })
    run(e, 3 * 24 * 60, 60)
    const days = e.missionDays['AST-04']!
    const loads = days.map((d) => d.exerciseLoadPct).filter((x): x is number => x !== null)
    expect(loads[loads.length - 1]!).toBeLessThan(mean(loads.slice(0, 30)) - 10)
  }, 60000)
})
