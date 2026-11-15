import { describe, expect, it } from 'vitest'
import type { Alert, CheckIn, Intervention } from '../../types/domain'
import { DEMO_RECORDS, medicalTimeline, parseMedicalRecords, type MedicalRecord } from './model'

const manual: MedicalRecord = { id: 'manual', astronautId: 'AST-01', category: 'Note', title: 'Demo follow-up', details: 'Fictional example', at: 100, status: 'Recorded', origin: 'User entry' }
const alert: Alert = { id: 'AL-1', astronautId: 'AST-01', severity: 'HIGH', title: 'Review requested', detail: 'Simulated event', region: 'heart', metric: 'HEART_RATE', ruleId: 'R-HR-01', createdAt: 200, acknowledgedAt: 250, acknowledgedBy: 'crew', resolvedAt: null }
const intervention: Intervention = { id: 'IN-1', astronautId: 'AST-01', kind: 'REST_PROTOCOL', recommendationId: null, loggedAt: 300, actor: 'crew', note: '' }
const checkIn: CheckIn = { id: 'CI-1', astronautId: 'AST-01', at: 400, mood: 4, fatigue: 2, stress: 2, sleepQuality: 4, symptoms: ['headache'], note: 'Example note', data_origin: 'MANUAL' }

describe('individual medical history', () => {
  it('keeps personal entries, alerts, actions and check-ins scoped to the chosen astronaut', () => {
    const records = [manual, { ...manual, id: 'other', astronautId: 'AST-02' }]
    const otherAlert = { ...alert, id: 'AL-2', astronautId: 'AST-02' }
    const timeline = medicalTimeline('AST-01', records, [alert, otherAlert], [intervention, { ...intervention, id: 'IN-2', astronautId: 'AST-02' }], [checkIn, { ...checkIn, id: 'CI-2', astronautId: 'AST-02' }])
    expect(timeline.map((e) => e.id)).toEqual(['checkin-CI-1', 'action-IN-1', 'alert-AL-1', 'record-manual'])
    expect(medicalTimeline('AST-03', records, [alert], [intervention], [checkIn])).toEqual([])
  })

  it('includes shared cabin events without copying another astronaut’s personal records', () => {
    const cabinAlert = { ...alert, astronautId: null }
    const cabinAction = { ...intervention, astronautId: 'CABIN' }
    expect(medicalTimeline('AST-02', [manual], [cabinAlert], [cabinAction], [checkIn]).map((e) => e.id)).toEqual(['action-IN-1', 'alert-AL-1'])
  })

  it('retains unresolved status after acknowledgement or a logged action', () => {
    const timeline = medicalTimeline('AST-01', [], [alert], [intervention], [])
    expect(timeline.find((e) => e.category === 'Health alert')!.status).toBe('Acknowledged · unresolved')
    expect(timeline.find((e) => e.category === 'Logged action')!.details).toContain('does not confirm')
    expect(medicalTimeline('AST-01', [], [{ ...alert, resolvedAt: 500 }], [], [])[0]!.status).toBe('Resolved')
  })

  it('labels manual check-ins and synthetic data separately and preserves all symptoms and notes', () => {
    const timeline = medicalTimeline('AST-01', [], [], [], [checkIn, { ...checkIn, id: 'sim', data_origin: 'SIMULATED' }])
    expect(timeline.map((e) => e.origin).sort()).toEqual(['Simulated', 'User entry'])
    expect(timeline[0]!.details).toContain('headache')
    expect(timeline[0]!.details).toContain('Example note')
  })

  it('provides a separate clearly fictional initial record for every astronaut', () => {
    for (const id of ['AST-01', 'AST-02', 'AST-03', 'AST-04']) {
      const records = medicalTimeline(id, DEMO_RECORDS, [], [], [])
      expect(records).toHaveLength(1)
      expect(records[0]!.origin).toBe('Demo')
      expect(records[0]!.details).toContain('Fictional example')
    }
  })

  it('recovers valid entries from storage while rejecting corrupt and invalid records', () => {
    expect(parseMedicalRecords(null)).toEqual([])
    expect(parseMedicalRecords('broken')).toEqual([])
    expect(parseMedicalRecords('{}')).toEqual([])
    expect(parseMedicalRecords(JSON.stringify([manual, null, { ...manual, at: 'yesterday' }, { ...manual, category: 'unknown' }, { ...manual, origin: 'Demo' }]))).toEqual([manual])
  })
})
