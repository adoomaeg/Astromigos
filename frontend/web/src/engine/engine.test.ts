import { describe, expect, it } from 'vitest'
import type { RiskLevel } from '../types/domain'
import { HealthEngine } from './engine'
import { levelRank } from './anomaly'
import { MIN_MS } from './text'

/** Advance in fixed steps, evaluating after each (like the store does). */
function run(e: HealthEngine, minutes: number, stepMin = 5, onEval?: (e: HealthEngine) => void): void {
  const end = e.simTime + minutes * MIN_MS
  while (e.simTime < end) {
    e.advanceTo(Math.min(end, e.simTime + stepMin * MIN_MS))
    e.evaluate()
    onEval?.(e)
  }
}

const rank = (l: RiskLevel) => levelRank(l)

describe('startup', () => {
  it('pre-generates history so personal baselines are READY immediately', () => {
    const e = new HealthEngine({ scenarioId: 'NOMINAL' })
    const h = e.health['AST-01']!
    expect(h.metrics.HEART_RATE!.baseline?.status).toBe('READY')
    expect(h.metrics.SLEEP_DURATION!.baseline?.status).toBe('READY')
    expect(h.metrics.EXERCISE_LOAD!.baseline?.status).toBe('READY')
    expect(e.environment.metrics.CO2!.current).not.toBeNull()
    const hr = e.history['AST-01']!.HEART_RATE!
    // 5 days at 5 min + last 2 h at 1 min, bounded
    expect(hr.length).toBeGreaterThan(1400)
    expect(hr.length).toBeLessThan(1700)
    expect(hr[hr.length - 1]!.t).toBe(e.simTime)
    for (let i = 1; i < hr.length; i++) expect(hr[i]!.t).toBeGreaterThan(hr[i - 1]!.t)
    expect(e.history.CABIN!.CO2!.length).toBeGreaterThan(1400)
    expect(e.devices.every((d) => d.data_origin === 'SIMULATED')).toBe(true)
    expect(Object.values(e.health).every((x) => x.risk.risk_level === 'LOW')).toBe(true)
  })

  it('is reproducible with the same seed', () => {
    const a = new HealthEngine({ scenarioId: 'NOMINAL' })
    const b = new HealthEngine({ scenarioId: 'NOMINAL' })
    expect(a.history['AST-02']!.HRV_RMSSD!.slice(-50)).toEqual(b.history['AST-02']!.HRV_RMSSD!.slice(-50))
    const c = new HealthEngine({ scenarioId: 'NOMINAL', seed: 7 })
    expect(c.history['AST-02']!.HRV_RMSSD!.slice(-50)).not.toEqual(a.history['AST-02']!.HRV_RMSSD!.slice(-50))
  })

  it('history stays bounded while running', () => {
    const e = new HealthEngine({ scenarioId: 'NOMINAL' })
    run(e, 24 * 60, 30)
    const n = e.history['AST-01']!.HEART_RATE!.length
    expect(n).toBeLessThan(1700)
    expect(e.history['AST-01']!.SLEEP_DURATION!.length).toBeLessThanOrEqual(40)
  })
})

describe('scenarios', () => {
  it('NOMINAL: two simulated days with workouts and sleep never reach HIGH', () => {
    const e = new HealthEngine({ scenarioId: 'NOMINAL' })
    let worst: RiskLevel = 'LOW'
    run(e, 48 * 60, 15, (x) => {
      for (const h of Object.values(x.health)) if (rank(h.risk.risk_level) > rank(worst)) worst = h.risk.risk_level
    })
    expect(rank(worst)).toBeLessThan(rank('HIGH'))
    expect(e.alerts.filter((a) => rank(a.severity) >= rank('HIGH'))).toHaveLength(0)
  })

  it('ACUTE_CARDIO reaches CRITICAL within about 15 sim minutes with a single grouped alert', () => {
    const e = new HealthEngine({ scenarioId: 'ACUTE_CARDIO' })
    let criticalAt: number | null = null
    run(e, 30, 1, (x) => {
      if (criticalAt === null && x.health['AST-01']!.risk.risk_level === 'CRITICAL') criticalAt = (x.simTime - x.startedAt) / MIN_MS
    })
    expect(criticalAt).not.toBeNull()
    expect(criticalAt!).toBeLessThanOrEqual(15)
    const h = e.health['AST-01']!
    expect(h.metrics.HEART_RATE!.current!).toBeGreaterThan(135)
    expect(h.metrics.SPO2!.current!).toBeLessThan(91)
    expect(h.risk.triggered_rules).toContain('R-CARD-01')
    expect(h.regions.heart.status).toBe('CRITICAL')
    expect(h.risk.headline).toMatch(/medical review is requested now/)
    const crit = e.alerts.filter((a) => a.astronautId === 'AST-01' && a.severity === 'CRITICAL')
    expect(crit.length).toBeGreaterThanOrEqual(1)
    expect(e.recommendations.some((r) => r.ruleId === 'R-CARD-01' && r.requiresHumanReview)).toBe(true)
    // other crew unaffected
    expect(e.health['AST-02']!.risk.risk_level).toBe('LOW')
  })

  it('ACUTE_CARDIO eases after a logged MEDICAL_CONSULT (hypothetical simulation effect)', () => {
    const e = new HealthEngine({ scenarioId: 'ACUTE_CARDIO' })
    run(e, 20, 1)
    e.logIntervention({ astronautId: 'AST-01', kind: 'MEDICAL_CONSULT' })
    expect(e.audit[0]!.detail).toMatch(/SIMULATION/)
    run(e, 90, 5)
    expect(e.health['AST-01']!.metrics.HEART_RATE!.current!).toBeLessThan(100)
    expect(rank(e.health['AST-01']!.risk.risk_level)).toBeLessThan(rank('CRITICAL'))
  })

  it('SENSOR_FAILURE: Bio-Monitor goes stale then offline and its metrics are NO_DATA, never LOW', () => {
    const e = new HealthEngine({ scenarioId: 'SENSOR_FAILURE' })
    run(e, 15, 1)
    expect(e.devices.find((d) => d.id === 'DEV-BIO-AST-03')!.state).toBe('DEGRADED')
    run(e, 10, 1)
    const dev = e.devices.find((d) => d.id === 'DEV-BIO-AST-03')!
    expect(dev.state).toBe('DATA_STALE')
    const h = e.health['AST-03']!
    for (const m of ['HEART_RATE', 'HRV_RMSSD', 'SPO2', 'RESPIRATORY_RATE', 'SKIN_TEMPERATURE'] as const) {
      expect(h.metrics[m]!.status).toBe('NO_DATA')
      expect(h.metrics[m]!.current).toBeNull()
    }
    expect(h.regions.heart.status).toBe('NO_DATA')
    expect(h.regions.lungs.status).toBe('NO_DATA')
    expect(h.risk.triggered_rules).toContain('R-DQ-01')
    expect(h.risk.confidence).toBeLessThan(0.6)
    expect(e.alerts.some((a) => a.ruleId === 'R-DQ-01' && a.astronautId === 'AST-03')).toBe(true)
    // gaps are explicit nulls in history (no interpolation)
    const hr = e.history['AST-03']!.HEART_RATE!
    expect(hr[hr.length - 1]!.v).toBeNull()
    run(e, 30, 5)
    expect(e.devices.find((d) => d.id === 'DEV-BIO-AST-03')!.state).toBe('OFFLINE')
    // SENSOR_CHECK restores the device
    e.logIntervention({ astronautId: 'AST-03', kind: 'SENSOR_CHECK' })
    run(e, 10, 1)
    expect(e.devices.find((d) => d.id === 'DEV-BIO-AST-03')!.state).toBe('ONLINE')
    expect(e.health['AST-03']!.metrics.HEART_RATE!.status).not.toBe('NO_DATA')
  })

  it('PROGRESSIVE_FATIGUE escalates over simulated days (sleep, HRV, resting HR together)', () => {
    const e = new HealthEngine({ scenarioId: 'PROGRESSIVE_FATIGUE' })
    const at: Record<number, { level: RiskLevel; score: number }> = {}
    run(e, 12 * 60, 15)
    at[12] = { level: e.health['AST-02']!.risk.risk_level, score: e.health['AST-02']!.risk.risk_score }
    run(e, 60 * 60, 15)
    const h = e.health['AST-02']!
    at[72] = { level: h.risk.risk_level, score: h.risk.risk_score }
    expect(rank(at[12]!.level)).toBeLessThanOrEqual(rank('MODERATE'))
    expect(at[72]!.level).toBe('HIGH')
    expect(at[72]!.score).toBeGreaterThan(at[12]!.score)
    expect(h.risk.triggered_rules).toContain('R-FAT-01')
    expect(h.metrics.SLEEP_DURATION!.status).not.toBe('LOW')
    expect(h.risk.contributing_factors.some((f) => /HRV \d+% below your normal for \d+ (hours|days)/.test(f.label))).toBe(true)
    expect(e.recommendations.some((r) => r.astronautId === 'AST-02' && r.ruleId === 'R-FAT-01' && r.audience === 'FLIGHT_SURGEON')).toBe(true)
    // the rest of the crew stays below HIGH
    expect(rank(e.health['AST-01']!.risk.risk_level)).toBeLessThan(rank('HIGH'))
  }, 30000)

  it('ENVIRONMENTAL_CO2 raises CO2 for everyone, and CABIN_VENTILATION brings it down', () => {
    const e = new HealthEngine({ scenarioId: 'ENVIRONMENTAL_CO2' })
    run(e, 4 * 60, 10)
    const co2 = e.environment.metrics.CO2!
    expect(co2.current!).toBeGreaterThan(5300)
    expect(co2.status).toBe('HIGH')
    expect(e.alerts.some((a) => a.astronautId === null && a.ruleId === 'R-ENV-CO2-01')).toBe(true)
    for (const h of Object.values(e.health)) expect(rank(h.risk.risk_level)).toBeGreaterThanOrEqual(rank('MODERATE'))
    e.logIntervention({ astronautId: 'AST-01', kind: 'CABIN_VENTILATION' })
    run(e, 3 * 60, 10)
    expect(e.environment.metrics.CO2!.current!).toBeLessThan(4000)
    expect(e.environment.status).toBe('LOW')
  })

  it('PERFORMANCE_DECLINE lowers exercise output session after session', () => {
    const e = new HealthEngine({ scenarioId: 'PERFORMANCE_DECLINE' })
    run(e, 4 * 24 * 60, 30)
    const ex = e.health['AST-04']!.metrics.EXERCISE_LOAD!
    expect(ex.status).toBe('HIGH')
    expect(ex.current!).toBeLessThan(85)
    expect(ex.explanation).toMatch(/below your normal for \d sessions/)
  }, 30000)

  it('acknowledging an alert writes an audit event', () => {
    const e = new HealthEngine({ scenarioId: 'ACUTE_CARDIO' })
    run(e, 15, 1)
    const al = e.alerts[0]!
    expect(e.acknowledgeAlert(al.id, 'flight surgeon')).toBe(true)
    expect(e.alerts.find((a) => a.id === al.id)!.acknowledgedBy).toBe('flight surgeon')
    expect(e.audit[0]!.action).toBe('ALERT_ACK')
  })
})
