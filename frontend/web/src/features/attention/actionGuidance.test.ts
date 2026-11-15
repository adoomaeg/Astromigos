import { describe, expect, it } from 'vitest'
import { HealthEngine } from '../../engine/engine'
import { REC_CATALOG } from '../../engine/recommendations'
import type { Alert, Recommendation } from '../../types/domain'
import { guidanceSteps, needsMedicalAttention } from './actionGuidance'

function recommendation(ruleId: string): Recommendation {
  const tpl = REC_CATALOG.byRule[ruleId]!
  return { id: 'REC-TEST', astronautId: 'AST-01', ruleId, title: tpl.title, rationale: tpl.why, priority: 'MODERATE', audience: tpl.audience, region: tpl.region, requiresHumanReview: false, createdAt: 0, status: 'PENDING', interventionKind: tpl.interventionKind }
}

function acuteEngine() {
  const e = new HealthEngine({ scenarioId: 'ACUTE_CARDIO' })
  for (let i = 0; i < 20; i++) { e.advanceTo(e.simTime + 60_000); e.evaluate() }
  return e
}

describe('medical escalation', () => {
  it('shows for the affected astronaut during an acute event, not an unaffected crewmate', () => {
    const e = acuteEngine()
    expect(needsMedicalAttention('AST-01', e.health['AST-01'], e.alerts)).toBe(true)
    expect(needsMedicalAttention('AST-02', e.health['AST-02'], e.alerts)).toBe(false)
  })

  it('persists after acknowledgement, dismissal and logging a consultation while the condition remains critical', () => {
    const e = acuteEngine()
    for (const a of e.alerts) e.acknowledgeAlert(a.id)
    for (const r of e.recommendations) e.dismissRecommendation(r.id)
    e.logIntervention({ astronautId: 'AST-01', kind: 'MEDICAL_CONSULT' })
    expect(needsMedicalAttention('AST-01', e.health['AST-01'], e.alerts)).toBe(true)
  })

  it('does not escalate nominal data, missing data alone, or resolved historical alerts', () => {
    const e = new HealthEngine({ scenarioId: 'NOMINAL' })
    expect(needsMedicalAttention('AST-01', e.health['AST-01'], e.alerts)).toBe(false)
    expect(needsMedicalAttention('AST-01', undefined, [])).toBe(false)
    const alerts = [{ astronautId: 'AST-01', severity: 'CRITICAL', resolvedAt: 1 }] as Alert[]
    expect(needsMedicalAttention('AST-01', e.health['AST-01'], alerts)).toBe(false)
  })

  it('retains an acknowledged unresolved critical alert even if overall risk drops', () => {
    const e = new HealthEngine({ scenarioId: 'NOMINAL' })
    const alerts = [{ astronautId: 'AST-01', severity: 'CRITICAL', resolvedAt: null, acknowledgedAt: 1 }] as Alert[]
    expect(needsMedicalAttention('AST-01', e.health['AST-01'], alerts)).toBe(true)
  })

  it('escalates a critical individual measurement even if the aggregate level is low', () => {
    const e = new HealthEngine({ scenarioId: 'NOMINAL' })
    const h = e.health['AST-01']!
    h.metrics.SPO2 = { ...h.metrics.SPO2!, status: 'CRITICAL' }
    expect(needsMedicalAttention('AST-01', h, [])).toBe(true)
  })

  it('includes critical cabin conditions for all affected crew', () => {
    expect(needsMedicalAttention('AST-02', undefined, [], 'CRITICAL')).toBe(true)
    const alerts = [{ astronautId: null, severity: 'CRITICAL', resolvedAt: null }] as Alert[]
    expect(needsMedicalAttention('AST-02', undefined, alerts)).toBe(true)
  })
})

describe('recommended next steps', () => {
  it('provides a complete sequence for every existing rule, including those without an intervention', () => {
    for (const rule of Object.keys(REC_CATALOG.byRule)) {
      const steps = guidanceSteps(recommendation(rule))
      expect(steps.length, rule).toBeGreaterThanOrEqual(3)
      expect(steps.every((s) => s.trim().length > 0), rule).toBe(true)
    }
  })

  it('distinguishes a CO₂ scrubber issue from temperature and humidity control', () => {
    expect(guidanceSteps(recommendation('R-ENV-CO2-01')).join(' ')).toContain('scrubber')
    expect(guidanceSteps(recommendation('R-ENV-TEMP-01')).join(' ')).toContain('thermal control')
    expect(guidanceSteps(recommendation('R-ENV-RH-01')).join(' ')).toContain('humidity control')
  })

  it('directs acute cardiac guidance to medical support and keeps deep-space onboard steps first', () => {
    expect(guidanceSteps(recommendation('R-CARD-01'))[0]).toContain('flight surgeon')
    const rec = { ...recommendation('R-CARD-01'), title: 'Crew medical officer: start the onboard assessment protocol now', interventionKind: 'REST_PROTOCOL' as const }
    const steps = guidanceSteps(rec)
    expect(steps[0]).toContain('crew medical officer now')
    expect(steps[1]).toContain('onboard assessment')
  })
})
