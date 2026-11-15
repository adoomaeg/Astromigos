import { beforeAll, describe, expect, it } from 'vitest'
import type { RiskLevel } from '../types/domain'
import { CREW } from './catalog'
import { CHECKIN } from './config'
import { checkInTime, selfReportSummary, simulateCheckIn } from './checkins'
import { HealthEngine } from './engine'
import { levelRank } from './anomaly'
import { buildProfile } from './sim/profiles'
import { DAY_MS, HOUR_MS, MIN_MS } from './text'

function run(e: HealthEngine, minutes: number, stepMin = 15): void {
  const end = e.simTime + minutes * MIN_MS
  while (e.simTime < end) {
    e.advanceTo(Math.min(end, e.simTime + stepMin * MIN_MS))
    e.evaluate()
  }
}

const day = (t: number) => Math.floor(t / DAY_MS)
const base = { mood: 3, fatigue: 2, stress: 2, sleepQuality: 4, symptoms: [] as string[], note: '' }

describe('simulated daily check-ins', () => {
  let e: HealthEngine
  beforeAll(() => {
    e = new HealthEngine({ scenarioId: 'NOMINAL' })
  }, 60000)

  it('pre-generates one check-in per astronaut per sim morning, newest first', () => {
    const per = new Map<string, Set<number>>()
    for (const c of e.checkIns) {
      expect(c.data_origin).toBe('SIMULATED')
      for (const v of [c.mood, c.fatigue, c.stress, c.sleepQuality]) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(5)
      }
      const minute = (c.at % DAY_MS) / MIN_MS
      expect(Math.abs(minute - CHECKIN.minuteOfDay)).toBeLessThanOrEqual(CHECKIN.jitterMin + 5)
      const s = per.get(c.astronautId) ?? new Set()
      expect(s.has(day(c.at))).toBe(false)
      s.add(day(c.at))
      per.set(c.astronautId, s)
    }
    for (const a of CREW) expect(per.get(a.id)!.size).toBe(CHECKIN.historyDays)
    for (let i = 1; i < e.checkIns.length; i++) expect(e.checkIns[i - 1]!.at).toBeGreaterThanOrEqual(e.checkIns[i]!.at)
  })

  it('feeds MOOD, PERCEIVED_FATIGUE and STRESS like other event metrics (brain region)', () => {
    const h = e.health['AST-01']!
    for (const m of ['MOOD', 'PERCEIVED_FATIGUE', 'STRESS'] as const) {
      expect(h.metrics[m]!.baseline?.status).toBe('READY')
      expect(h.metrics[m]!.current).not.toBeNull()
      expect(h.regions.brain.metrics).toContain(m)
      expect(e.history['AST-01']![m]!.length).toBe(CHECKIN.historyDays)
    }
    expect(h.metrics.MOOD!.data_origin).toBe('SIMULATED')
  })

  it('adds one new check-in per astronaut each morning while running', () => {
    const n0 = e.checkIns.length
    run(e, 24 * 60, 30)
    expect(e.checkIns.length).toBe(n0 + CREW.length)
    for (const a of CREW) {
      const latest = e.checkIns.find((c) => c.astronautId === a.id)!
      expect(latest.at).toBe(checkInTime(e.seed, a.id, day(e.startedAt) + 1))
    }
  })
})

describe('check-ins follow the simulated state', () => {
  it('PROGRESSIVE_FATIGUE: fatigue and stress up, mood and sleep quality down; corroborates R-FAT-01 but stays MODERATE on its own', () => {
    const e = new HealthEngine({ scenarioId: 'PROGRESSIVE_FATIGUE' })
    const before = e.checkIns.filter((c) => c.astronautId === 'AST-02')
    let worstPsy: RiskLevel = 'LOW'
    const end = e.simTime + 72 * 60 * MIN_MS
    while (e.simTime < end) {
      e.advanceTo(e.simTime + 30 * MIN_MS)
      e.evaluate()
      for (const m of ['MOOD', 'PERCEIVED_FATIGUE', 'STRESS'] as const) {
        const st = e.health['AST-02']!.metrics[m]!.status
        if (st !== 'NO_DATA' && levelRank(st) > levelRank(worstPsy)) worstPsy = st
      }
    }
    const after = e.checkIns.filter((c) => c.astronautId === 'AST-02' && c.at > e.startedAt)
    expect(after.length).toBe(3)
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    const last2 = after.slice(0, 2)
    expect(avg(last2.map((c) => c.fatigue))).toBeGreaterThan(avg(before.map((c) => c.fatigue)) + 1.5)
    expect(avg(last2.map((c) => c.mood))).toBeLessThan(avg(before.map((c) => c.mood)))
    expect(avg(last2.map((c) => c.sleepQuality))).toBeLessThan(avg(before.map((c) => c.sleepQuality)) - 1)
    expect(avg(last2.map((c) => c.stress))).toBeGreaterThanOrEqual(avg(before.map((c) => c.stress)))
    expect(worstPsy).toBe('MODERATE')
    const risk = e.health['AST-02']!.risk
    expect(risk.triggered_rules).toContain('R-FAT-01')
    expect(risk.contributing_factors.some((f) => /You also reported high fatigue in your last \d check-ins/.test(f.label))).toBe(true)
    // self report never raises alerts on its own
    expect(e.alerts.some((a) => a.ruleId.startsWith('R-PSY'))).toBe(false)
  }, 60000)

  it('cabin CO2 makes a reported headache more likely (seeded simulation)', () => {
    const P = buildProfile(CREW[0]!, 0, 1)
    const night = { day: 0, bedtime: 0, wake: 0, efficiency: P.sleepEff, durationH: 8 * P.sleepEff }
    let nominal = 0
    let co2 = 0
    for (let d = 0; d < 300; d++) {
      const s = { fatigue: 0, perfLoss: 0, night }
      if (simulateCheckIn(1, 'AST-01', P, d, d * DAY_MS, { ...s, co2: 2600 }).symptoms.includes('headache')) nominal++
      if (simulateCheckIn(1, 'AST-01', P, d, d * DAY_MS, { ...s, co2: 6500 }).symptoms.includes('headache')) co2++
    }
    expect(nominal).toBeLessThan(30)
    expect(co2).toBeGreaterThan(nominal + 100)
  })
})

describe('manual check-ins (submitCheckIn)', () => {
  let e: HealthEngine
  beforeAll(() => {
    e = new HealthEngine({ scenarioId: 'NOMINAL' })
  }, 60000)

  it('replaces the simulated check-in of the same day and is marked MANUAL', () => {
    const today = day(e.simTime)
    const n0 = e.checkIns.length
    const sim = e.checkIns.find((c) => c.astronautId === 'AST-03' && day(c.at) === today)!
    expect(sim.data_origin).toBe('SIMULATED')
    const c = e.submitCheckIn({ ...base, astronautId: 'AST-03', mood: 4, symptoms: [' Headache ', 'headache'] })!
    expect(c.data_origin).toBe('MANUAL')
    expect(c.at).toBe(e.clockNow)
    expect(c.symptoms).toEqual(['headache'])
    expect(e.checkIns.length).toBe(n0)
    expect(e.checkIns.find((x) => x.id === sim.id)).toBeUndefined()
    expect(e.checkIns[0]!.id).toBe(c.id)
    expect(e.audit[0]!.action).toBe('CHECKIN_RECORDED')
    e.evaluate()
    expect(e.health['AST-03']!.metrics.MOOD!.data_origin).toBe('MANUAL')
    expect(e.health['AST-03']!.metrics.MOOD!.current).toBe(4)
    // A reported symptom is a non-diagnostic factor with a small weight.
    const risk = e.health['AST-03']!.risk
    expect(risk.contributing_factors.some((f) => f.label === 'You reported a headache today')).toBe(true)
    expect(risk.risk_level).toBe('LOW')
    // a second manual answer the same day replaces the first one
    e.submitCheckIn({ ...base, astronautId: 'AST-03', mood: 5 })
    expect(e.checkIns.filter((x) => x.astronautId === 'AST-03' && day(x.at) === today)).toHaveLength(1)
    expect(e.submitCheckIn({ ...base, astronautId: 'NOPE' })).toBeNull()
  })

  it('self report alone reaches MODERATE at most and no alert', () => {
    for (let d = 0; d < 3; d++) {
      e.submitCheckIn({ astronautId: 'AST-04', mood: 1, fatigue: 5, stress: 5, sleepQuality: 1, symptoms: ['headache', 'back pain'], note: 'rough day' })
      if (d < 2) run(e, 24 * 60, 60)
      else run(e, 60, 15)
    }
    const h = e.health['AST-04']!
    for (const m of ['MOOD', 'PERCEIVED_FATIGUE', 'STRESS'] as const) expect(h.metrics[m]!.status).toBe('MODERATE')
    expect(h.risk.risk_level).toBe('MODERATE')
    expect(e.alerts.some((a) => a.astronautId === 'AST-04' && a.ruleId.startsWith('R-PSY'))).toBe(false)
    expect(e.recommendations.some((r) => r.astronautId === 'AST-04' && r.ruleId.startsWith('R-PSY') && r.autonomy === 'ONBOARD')).toBe(true)
    expect(h.risk.contributing_factors.some((f) => f.label === 'You reported a headache and back pain today')).toBe(true)
    // the manual days replaced the simulated ones (one check-in per day)
    const ast4 = e.checkIns.filter((c) => c.astronautId === 'AST-04' && c.at > e.startedAt - HOUR_MS)
    expect(ast4).toHaveLength(3)
    expect(ast4.every((c) => c.data_origin === 'MANUAL')).toBe(true)
  }, 60000)

  it('selfReportSummary counts consecutive high fatigue answers in the last 3 days', () => {
    const t = Date.parse('2026-11-20T08:00:00Z')
    const mk = (dDays: number, fatigue: number, symptoms: string[] = []) => ({ id: 'x', astronautId: 'A', at: t - dDays * DAY_MS, mood: 3, fatigue, stress: 2, sleepQuality: 3, symptoms, note: '', data_origin: 'SIMULATED' as const })
    expect(selfReportSummary([mk(0.05, 5, ['headache']), mk(1, 4), mk(2, 2)], t)).toEqual({ highFatigueRun: 2, symptoms: ['headache'] })
    expect(selfReportSummary([mk(1.5, 5), mk(2.5, 5), mk(3.5, 5)], t).highFatigueRun).toBe(2)
    expect(selfReportSummary([mk(1.5, 5)], t).symptoms).toEqual([])
  })
})
