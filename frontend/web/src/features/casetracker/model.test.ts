import { describe, expect, it } from 'vitest'
import { HealthEngine } from '../../engine/engine'
import type { Alert, Recommendation } from '../../types/domain'
import { issueCases, type CaseSnapshot } from './model'

function fixture() {
  const e = new HealthEngine({ scenarioId: 'NOMINAL' })
  const at = e.simTime
  const alert: Alert = { id: 'AL-TEST', astronautId: 'AST-01', severity: 'HIGH', title: 'Heart rate change', detail: 'Simulated change', region: 'heart', metric: 'HEART_RATE', ruleId: 'R-HR-01', createdAt: at, acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null }
  const rec: Recommendation = { id: 'REC-TEST', astronautId: 'AST-01', ruleId: 'R-HR-01', title: 'Request review', rationale: 'Simulated change', priority: 'HIGH', audience: 'FLIGHT_SURGEON', region: null, requiresHumanReview: true, createdAt: at, status: 'PENDING', active: true, interventionKind: 'REST_PROTOCOL' }
  const snapshot: CaseSnapshot = { alerts: [alert], recommendations: [rec], interventions: [], health: e.health, environment: e.environment, history: e.history }
  return { at, alert, rec, snapshot }
}

describe('problem-to-follow-up cases', () => {
  it('links a recommendation and its logged action to the triggering alert without duplicating cases', () => {
    const { at, snapshot } = fixture()
    snapshot.interventions = [{ id: 'IN-1', astronautId: 'AST-01', kind: 'REST_PROTOCOL', recommendationId: 'REC-TEST', loggedAt: at + 1000, actor: 'crew', note: '' }]
    const cases = issueCases('AST-01', snapshot)
    expect(cases).toHaveLength(1)
    expect(cases[0]!.recommendations.map((r) => r.id)).toEqual(['REC-TEST'])
    expect(cases[0]!.interventions).toHaveLength(1)
    expect(cases[0]!.status).toBe('Open')
  })

  it('does not resolve an acknowledged alert, completed action, or dismissed recommendation', () => {
    const { at, snapshot, alert, rec } = fixture()
    for (const status of ['DONE', 'DISMISSED'] as const) {
      snapshot.alerts = [{ ...alert, acknowledgedAt: at + 1000 }]
      snapshot.recommendations = [{ ...rec, status }]
      expect(issueCases('AST-01', snapshot)[0]!.status).toBe('Open')
    }
    // Even with a cleared alert, a still-active recommendation is not resolved by clicking Done.
    snapshot.alerts = [{ ...alert, resolvedAt: at + 1000 }]
    expect(issueCases('AST-01', snapshot)[0]!.status).toBe('Open')
  })

  it('requires cleared readings and a written review after clearance to resolve a case', () => {
    const { at, snapshot, alert, rec } = fixture()
    snapshot.alerts = [{ ...alert, resolvedAt: at + 1000 }]
    snapshot.recommendations = [{ ...rec, status: 'DONE', active: false }]
    expect(issueCases('AST-01', snapshot)[0]!.status).toBe('Awaiting follow-up')
    expect(issueCases('AST-01', snapshot, { 'alert-AL-TEST': [{ note: 'Signals reviewed', at: at + 2000, reviewed: false }] })[0]!.status).toBe('Awaiting follow-up')
    expect(issueCases('AST-01', snapshot, { 'alert-AL-TEST': [{ note: 'Signals reviewed', at: at + 2000, reviewed: true }] })[0]!.status).toBe('Resolved')
    expect(issueCases('AST-01', snapshot, { 'alert-AL-TEST': [{ note: '   ', at: at + 2000, reviewed: true }] })[0]!.status).toBe('Awaiting follow-up')
  })

  it('keeps missing readings open and does not reuse an old review after recurrence', () => {
    const { at, snapshot, alert, rec } = fixture()
    snapshot.alerts = [{ ...alert, resolvedAt: at + 2000 }]
    snapshot.recommendations = [{ ...rec, active: false }]
    const review = { 'alert-AL-TEST': [{ note: 'Earlier review', at: at + 1000, reviewed: true }] }
    expect(issueCases('AST-01', snapshot, review)[0]!.status).toBe('Awaiting follow-up')
    snapshot.health['AST-01']!.metrics.HEART_RATE!.current = null
    expect(issueCases('AST-01', snapshot, review)[0]!.status).toBe('Open')
  })

  it('keeps cases separate by astronaut and includes shared cabin issues', () => {
    const { snapshot, alert, rec } = fixture()
    snapshot.alerts.push({ ...alert, id: 'CABIN-1', astronautId: null, ruleId: 'R-ENV-CO2-01', metric: 'CO2', region: 'environment' })
    expect(issueCases('AST-02', snapshot).map((c) => c.subjectId)).toEqual(['CABIN'])
    expect(issueCases('AST-01', snapshot)).toHaveLength(2)
    snapshot.alerts = []
    snapshot.recommendations = [rec]
    expect(issueCases('AST-01', snapshot)[0]!.id).toBe('recommendation-REC-TEST')
    expect(issueCases('AST-02', snapshot)).toEqual([])
  })

  it('keeps repeated episodes and their linked actions separate', () => {
    const { at, snapshot, alert, rec } = fixture()
    snapshot.alerts = [{ ...alert, resolvedAt: at + 1000 }, { ...alert, id: 'AL-SECOND', createdAt: at + 60 * 60_000 }]
    snapshot.recommendations = [{ ...rec, active: false }, { ...rec, id: 'REC-SECOND', createdAt: at + 60 * 60_000 }]
    snapshot.interventions = [{ id: 'IN-SECOND', astronautId: 'AST-01', kind: 'REST_PROTOCOL', recommendationId: 'REC-SECOND', loggedAt: at + 61 * 60_000, actor: 'crew', note: '' }]
    const cases = issueCases('AST-01', snapshot)
    expect(cases).toHaveLength(2)
    expect(cases.find((c) => c.id === 'alert-AL-TEST')!.interventions).toHaveLength(0)
    expect(cases.find((c) => c.id === 'alert-AL-SECOND')!.recommendations[0]!.id).toBe('REC-SECOND')
    expect(cases.find((c) => c.id === 'alert-AL-SECOND')!.interventions).toHaveLength(1)
  })

  it('shows proximity to the personal range without presenting an action as a cure', () => {
    const { at, snapshot } = fixture()
    const metric = snapshot.health['AST-01']!.metrics.HEART_RATE!
    snapshot.history['AST-01']!.HEART_RATE = [{ t: at - 60_000, v: 200 }]
    metric.current = 150
    metric.status = 'HIGH'
    const issue = issueCases('AST-01', snapshot)[0]!
    expect(issue.measurements[0]!.detected).toBe(200)
    expect(issue.measurements[0]!.current).toBe(150)
    expect(issue.measurements[0]!.trend).toBe('Closer to personal range')
    expect(issue.status).toBe('Open')
    snapshot.history['AST-01']!.HEART_RATE = [{ t: at - 16 * 60_000, v: 200 }]
    expect(issueCases('AST-01', snapshot)[0]!.measurements[0]!.detected).toBeNull()
  })
})
