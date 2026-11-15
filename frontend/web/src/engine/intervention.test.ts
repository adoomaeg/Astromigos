import { beforeAll, describe, expect, it } from 'vitest'
import { HealthEngine } from './engine'
import { MIN_MS } from './text'

function run(e: HealthEngine, minutes: number, stepMin: number): void {
  const end = e.simTime + minutes * MIN_MS
  while (e.simTime < end) {
    e.advanceTo(Math.min(end, e.simTime + stepMin * MIN_MS))
    e.evaluate()
  }
}

const last = <T>(xs: T[]) => xs[xs.length - 1]!

describe('compareIntervention', () => {
  let fatigue: HealthEngine
  beforeAll(() => {
    fatigue = new HealthEngine({ scenarioId: 'PROGRESSIVE_FATIGUE' })
    run(fatigue, 48 * 60, 60)
  }, 60000)

  it('SLEEP_EXTENSION: HRV recovers with the intervention, not without (fast, deterministic, no state change)', () => {
    const versions = { ...fatigue.versions }
    fatigue.compareIntervention({ astronautId: 'AST-02', kind: 'SLEEP_EXTENSION' })
    // Best of 5 runs, so a GC pause or a busy test machine does not make it flaky.
    let best = Infinity
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now()
      fatigue.compareIntervention({ astronautId: 'AST-02', kind: 'SLEEP_EXTENSION' })
      best = Math.min(best, performance.now() - t0)
    }
    expect(best).toBeLessThan(50)
    const c = fatigue.compareIntervention({ astronautId: 'AST-02', kind: 'SLEEP_EXTENSION' })!
    expect(c.metric).toBe('HRV_RMSSD')
    expect(c.astronautId).toBe('AST-02')
    expect(c.horizonHours).toBe(48)
    expect(c.with.length).toBe(c.without.length)
    expect(c.with[0]!.t).toBe(fatigue.simTime)
    expect(c.with[0]!.v).toBe(c.without[0]!.v)
    for (let i = 1; i < c.with.length; i++) expect(c.with[i]!.t - c.with[i - 1]!.t).toBe(30 * MIN_MS)
    expect(last(c.with).v!).toBeGreaterThan(last(c.without).v! + 5)
    expect(c.band).not.toBeNull()
    expect(c.band!.low).toBeLessThan(c.band!.high)
    expect(last(c.without).v!).toBeLessThan(c.band!.low)
    expect(c.assumptions.some((a) => /hypothetical/i.test(a))).toBe(true)
    expect(c.assumptions.some((a) => /current fatigue pattern continues/.test(a))).toBe(true)
    expect(c.disclaimer).toBe('Simulation for discussion only. Not evidence of clinical efficacy.')
    expect(fatigue.compareIntervention({ astronautId: 'AST-02', kind: 'SLEEP_EXTENSION' })).toEqual(c)
    expect(fatigue.versions).toEqual(versions)
    expect(fatigue.interventions).toHaveLength(0)
  })

  it('respects an explicit metric and horizon', () => {
    const c = fatigue.compareIntervention({ astronautId: 'AST-02', kind: 'REST_PROTOCOL', metric: 'HEART_RATE', horizonHours: 6 })!
    expect(c.metric).toBe('HEART_RATE')
    expect(c.horizonHours).toBe(6)
    expect(c.with[1]!.t - c.with[0]!.t).toBe(15 * MIN_MS)
    expect(last(c.with).v!).toBeLessThan(last(c.without).v!)
  })

  it('returns null when not applicable', () => {
    expect(fatigue.compareIntervention({ astronautId: 'AST-02', kind: 'SENSOR_CHECK' })).toBeNull()
    expect(fatigue.compareIntervention({ astronautId: 'NOPE', kind: 'SLEEP_EXTENSION' })).toBeNull()
    expect(fatigue.compareIntervention({ astronautId: 'AST-02', kind: 'HYDRATION', metric: 'REACTION_TIME' })).toBeNull()
    expect(fatigue.compareIntervention({ astronautId: 'CABIN', kind: 'SLEEP_EXTENSION' })).toBeNull()
  })

  it('NOMINAL: both lines are the same and the assumptions say so', () => {
    const e = new HealthEngine({ scenarioId: 'NOMINAL' })
    const c = e.compareIntervention({ astronautId: 'AST-01', kind: 'HYDRATION' })!
    expect(c.metric).toBe('HYDRATION')
    // hydration boost is the only effect here, so the lines differ
    expect(last(c.with).v!).toBeGreaterThan(last(c.without).v!)
    const s = e.compareIntervention({ astronautId: 'AST-01', kind: 'SLEEP_EXTENSION' })!
    expect(s.with).toEqual(s.without)
    expect(s.assumptions.some((a) => /both lines are the same/.test(a))).toBe(true)
  })

  it('ACUTE_CARDIO: MEDICAL_CONSULT uses a short horizon and lowers heart rate', () => {
    const e = new HealthEngine({ scenarioId: 'ACUTE_CARDIO' })
    run(e, 10, 1)
    const c = e.compareIntervention({ astronautId: 'AST-01', kind: 'MEDICAL_CONSULT' })!
    expect(c.metric).toBe('HEART_RATE')
    expect(c.horizonHours).toBe(2)
    expect(c.with[1]!.t - c.with[0]!.t).toBe(5 * MIN_MS)
    const at30 = c.with.findIndex((p) => p.t >= e.simTime + 30 * MIN_MS)
    expect(c.with[at30]!.v!).toBeLessThan(c.without[at30]!.v! - 20)
  })

  it('CABIN_VENTILATION projects cabin CO2', () => {
    const e = new HealthEngine({ scenarioId: 'ENVIRONMENTAL_CO2' })
    run(e, 3 * 60, 10)
    const c = e.compareIntervention({ astronautId: 'CABIN', kind: 'CABIN_VENTILATION' })!
    expect(c.metric).toBe('CO2')
    expect(c.astronautId).toBe('CABIN')
    expect(c.without[0]!.v!).toBeGreaterThan(5000)
    expect(last(c.with).v!).toBeLessThan(4000)
    expect(last(c.without).v!).toBeGreaterThan(5500)
  })

  it('EXERCISE_ADJUSTMENT: one point per planned session, output recovers with the adjustment', () => {
    const e = new HealthEngine({ scenarioId: 'PERFORMANCE_DECLINE' })
    run(e, 24 * 60, 60)
    const c = e.compareIntervention({ astronautId: 'AST-04', kind: 'EXERCISE_ADJUSTMENT' })!
    expect(c.metric).toBe('EXERCISE_LOAD')
    expect(c.without.length).toBeGreaterThanOrEqual(5)
    expect(c.without.length).toBeLessThanOrEqual(7)
    expect(last(c.with).v!).toBeGreaterThan(last(c.without).v! + 5)
    expect(c.assumptions.some((a) => /One point per planned exercise session/.test(a))).toBe(true)
  }, 60000)
})
