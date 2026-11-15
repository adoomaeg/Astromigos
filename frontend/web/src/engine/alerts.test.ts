import { describe, expect, it } from 'vitest'
import type { RiskLevel } from '../types/domain'
import { AlertManager } from './alerts'
import { HealthEngine } from './engine'
import type { RuleHit } from './risk'
import { MIN_MS } from './text'

const T0 = Date.parse('2026-11-14T08:00:00Z')
const name = () => 'ORION'

function hit(level: RiskLevel, ruleId = 'R-HR-01'): RuleHit {
  return { subjectId: 'AST-01', ruleId, level, metric: 'HEART_RATE', region: 'heart', method: 'ROBUST_Z', kind: 'PHYSIO', label: 'Heart rate far above your normal', phrase: 'x', title: 'Heart rate far from personal normal' }
}

describe('alert escalation', () => {
  it('CRITICAL unacknowledged: level 1 after 5 min, level 2 after 15 min', () => {
    const am = new AlertManager()
    am.sync([hit('CRITICAL')], T0, name)
    const id = am.alerts[0]!.id
    expect(am.alerts[0]!.escalationLevel).toBe(0)
    expect(am.escalate(T0 + 4 * MIN_MS)).toHaveLength(0)
    const e1 = am.escalate(T0 + 6 * MIN_MS)
    expect(e1).toHaveLength(1)
    expect(e1[0]!.escalationLevel).toBe(1)
    expect(e1[0]!.escalatedAt).toBe(T0 + 5 * MIN_MS)
    expect(am.escalate(T0 + 7 * MIN_MS)).toHaveLength(0)
    const e2 = am.escalate(T0 + 15 * MIN_MS)
    expect(e2[0]!.escalationLevel).toBe(2)
    expect(e2[0]!.escalatedAt).toBe(T0 + 15 * MIN_MS)
    expect(am.escalate(T0 + 60 * MIN_MS)).toHaveLength(0)
    expect(am.alerts.find((a) => a.id === id)!.escalationLevel).toBe(2)
  })

  it('a late evaluation jumps straight to the right level', () => {
    const am = new AlertManager()
    am.sync([hit('CRITICAL')], T0, name)
    const e = am.escalate(T0 + 30 * MIN_MS)
    expect(e[0]!.escalationLevel).toBe(2)
  })

  it('HIGH escalates after 30 and 90 min; MODERATE never', () => {
    const am = new AlertManager()
    am.sync([hit('HIGH'), { ...hit('MODERATE', 'R-HR-02') }], T0, name)
    expect(am.escalate(T0 + 29 * MIN_MS)).toHaveLength(0)
    expect(am.escalate(T0 + 30 * MIN_MS).map((a) => a.escalationLevel)).toEqual([1])
    expect(am.escalate(T0 + 95 * MIN_MS).map((a) => a.escalationLevel)).toEqual([2])
    expect(am.alerts.find((a) => a.severity === 'MODERATE')!.escalationLevel ?? 0).toBe(0)
  })

  it('stops when acknowledged or resolved', () => {
    const am = new AlertManager()
    am.sync([hit('CRITICAL'), hit('CRITICAL', 'R-SPO2-02')], T0, name)
    const [a, b] = am.alerts
    am.acknowledge(a!.id, 'crew', T0 + 2 * MIN_MS)
    // b resolves: rule clear for 10 min
    am.sync([], T0 + 12 * MIN_MS, name)
    am.sync([], T0 + 13 * MIN_MS, name)
    const all = am.alerts
    expect(all.find((x) => x.id === b!.id)!.resolvedAt).not.toBeNull()
    am.escalate(T0 + 60 * MIN_MS)
    expect(am.alerts.find((x) => x.id === a!.id)!.escalationLevel).toBe(0)
    // b escalated to level 1 at +5 (before resolving) and then stopped
    expect(am.alerts.find((x) => x.id === b!.id)!.escalationLevel ?? 0).toBeLessThanOrEqual(1)
  })

  it('engine: escalations are audited and stop after acknowledgement', () => {
    const e = new HealthEngine({ scenarioId: 'ACUTE_CARDIO' })
    const end = e.simTime + 40 * MIN_MS
    let acked = false
    while (e.simTime < end) {
      e.advanceTo(e.simTime + MIN_MS)
      e.evaluate()
      const crit = e.alerts.find((a) => a.severity === 'CRITICAL' && a.acknowledgedAt === null && a.resolvedAt == null)
      if (!acked && crit && (crit.escalationLevel ?? 0) >= 1) {
        expect(e.audit.some((x) => x.action === 'ALERT_ESCALATED' && x.detail.includes(crit.id))).toBe(true)
        e.acknowledgeAlert(crit.id, 'crew medical officer')
        acked = true
        const lvl = crit.escalationLevel
        e.advanceTo(e.simTime + 30 * MIN_MS)
        e.evaluate()
        expect(e.alerts.find((a) => a.id === crit.id)!.escalationLevel).toBe(lvl)
      }
    }
    expect(acked).toBe(true)
  })
})
