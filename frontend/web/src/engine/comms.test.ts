import { beforeAll, describe, expect, it } from 'vitest'
import type { CommMessage } from '../types/domain'
import { COMM_PROFILES } from './catalog'
import { COMMS } from './config'
import { CommManager, groundReplyText, reviewMs } from './comms'
import { HealthEngine } from './engine'
import { MIN_MS } from './text'

const MARS_FAR = COMM_PROFILES.find((p) => p.id === 'MARS_FAR')!
const ISS = COMM_PROFILES.find((p) => p.id === 'ISS')!
const T0 = Date.parse('2026-11-14T08:00:00Z')
const ctx = () => ({ callsign: 'ORION', level: 'HIGH' as const, topic: 'Heart rate far from personal normal' })

function run(e: HealthEngine, minutes: number, stepMin = 1): void {
  const end = e.simTime + minutes * MIN_MS
  while (e.simTime < end) {
    e.advanceTo(Math.min(end, e.simTime + stepMin * MIN_MS))
    e.evaluate()
  }
}

describe('CommManager (unit)', () => {
  it('delivers a downlink after the one way delay, then a simulated ground reply after review + delay', () => {
    const cm = new CommManager(1)
    const m = cm.send({ astronautId: 'AST-01', kind: 'CONSULT_REQUEST', title: 'Consult', body: 'Please review' }, T0, MARS_FAR, 'MANUAL')
    expect(m.arrivesAt - m.sentAt).toBe(22 * 60 * 1000)
    expect(m.status).toBe('IN_TRANSIT')
    expect(cm.process(T0 + 21 * MIN_MS, MARS_FAR, ctx)).toHaveLength(0)
    expect(cm.messages[0]!.status).toBe('IN_TRANSIT')

    const ev = cm.process(T0 + 22 * MIN_MS, MARS_FAR, ctx)
    expect(ev.map((e) => e.kind)).toEqual(['DELIVERED'])
    expect(cm.messages[0]!.status).toBe('DELIVERED')

    const review = reviewMs(1, m.id)
    expect(review).toBeGreaterThanOrEqual(COMMS.reviewMinMin * MIN_MS)
    expect(review).toBeLessThanOrEqual(COMMS.reviewMaxMin * MIN_MS)
    cm.process(m.arrivesAt + review, MARS_FAR, ctx)
    const reply = cm.messages[0]!
    expect(reply.kind).toBe('GROUND_REPLY')
    expect(reply.direction).toBe('UPLINK')
    expect(reply.status).toBe('IN_TRANSIT')
    expect(reply.sentAt).toBe(m.arrivesAt + review)
    expect(reply.arrivesAt).toBe(reply.sentAt + 22 * 60 * 1000)
    expect(reply.data_origin).toBe('SIMULATED')
    expect(reply.relatedRecommendationId).toBeNull()
    cm.process(reply.arrivesAt, MARS_FAR, ctx)
    expect(cm.messages[0]!.status).toBe('DELIVERED')
    // newest first
    for (let i = 1; i < cm.messages.length; i++) expect(cm.messages[i - 1]!.sentAt).toBeGreaterThanOrEqual(cm.messages[i]!.sentAt)
  })

  it('timing does not depend on how often it is processed', () => {
    const a = new CommManager(3)
    const b = new CommManager(3)
    for (const cm of [a, b]) cm.send({ astronautId: 'AST-02', kind: 'HEALTH_PACKET', title: 'Packet', body: '...' }, T0, MARS_FAR, 'SIMULATED')
    for (let t = T0; t <= T0 + 120 * MIN_MS; t += MIN_MS) a.process(t, MARS_FAR, ctx)
    b.process(T0 + 120 * MIN_MS, MARS_FAR, ctx)
    const strip = (ms: CommMessage[]) => ms.map((m) => [m.kind, m.status, m.sentAt, m.arrivesAt])
    expect(strip(b.messages)).toEqual(strip(a.messages))
    expect(b.messages).toHaveLength(2)
  })

  it('handover reports do not get a reply; replies are plain and non-prescriptive', () => {
    const cm = new CommManager(1)
    cm.send({ astronautId: null, kind: 'HANDOVER_REPORT', title: 'Shift handover', body: '...' }, T0, ISS, 'MANUAL')
    cm.process(T0 + 60 * MIN_MS, ISS, ctx)
    expect(cm.messages).toHaveLength(1)
    const req = { kind: 'HEALTH_PACKET' } as CommMessage
    for (const level of ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const) {
      const r = groundReplyText(req, { callsign: 'LYRA', level, topic: null }, T0)
      expect(r.body).toMatch(/re-check/)
      expect(r.body).toMatch(/simulated/i)
      expect(r.body).not.toMatch(/\b(mg|tablet|medication|drug|prescri)/i)
      expect(r.body).not.toMatch(new RegExp('[\\u2013\\u2014]'))
    }
  })
})

describe('Earth link in the engine', () => {
  let e: HealthEngine
  beforeAll(() => {
    e = new HealthEngine({ scenarioId: 'ACUTE_CARDIO', commProfileId: 'MARS_FAR' })
    run(e, 20, 1)
  }, 60000)

  it('applies the comm profile to the mission', () => {
    expect(e.commProfileId).toBe('MARS_FAR')
    expect(e.mission.commDelaySec).toBe(22 * 60)
  })

  it('downlinks one automatic health packet per HIGH or CRITICAL alert', () => {
    const packets = e.comms.filter((m) => m.kind === 'HEALTH_PACKET')
    const highAlerts = e.alerts.filter((a) => a.severity === 'HIGH' || a.severity === 'CRITICAL')
    expect(highAlerts.length).toBeGreaterThan(0)
    expect(packets.length).toBe(highAlerts.length)
    expect(new Set(packets.map((p) => p.relatedAlertId)).size).toBe(packets.length)
    for (const p of packets) {
      expect(p.direction).toBe('DOWNLINK')
      expect(p.data_origin).toBe('SIMULATED')
      expect(p.arrivesAt - p.sentAt).toBe(22 * 60 * 1000)
      expect(p.body).toMatch(/SIMULATED/)
    }
    expect(e.audit.some((a) => a.action === 'COMM_SENT')).toBe(true)
  })

  it('under Mars, a CRITICAL ground review item gets one onboard first step that states the earliest Earth reply', () => {
    const ground = e.recommendations.filter((r) => r.astronautId === 'AST-01' && r.autonomy === 'GROUND_REVIEW' && (r.priority === 'CRITICAL' || r.priority === 'HIGH'))
    expect(ground.length).toBeGreaterThan(0)
    const onboard = e.recommendations.filter((r) => r.astronautId === 'AST-01' && r.title.startsWith('Crew medical officer: start the onboard assessment protocol now'))
    expect(onboard).toHaveLength(1)
    expect(onboard[0]!.autonomy).toBe('ONBOARD')
    expect(onboard[0]!.rationale).toMatch(/earliest flight surgeon reply is about 48 min/)
    expect(e.recommendations.every((r) => r.autonomy === 'ONBOARD' || r.autonomy === 'GROUND_REVIEW')).toBe(true)
  })

  it('delivers packets, then simulated ground replies, all logged in the audit trail', () => {
    run(e, 70, 5)
    const replies = e.comms.filter((m) => m.kind === 'GROUND_REPLY')
    expect(replies.length).toBeGreaterThan(0)
    expect(replies.some((r) => r.status === 'DELIVERED')).toBe(true)
    for (const r of replies) {
      const req = e.comms.find((m) => m.direction === 'DOWNLINK' && m.relatedAlertId === r.relatedAlertId)!
      expect(r.sentAt - req.arrivesAt).toBeGreaterThanOrEqual(COMMS.reviewMinMin * MIN_MS)
      expect(r.sentAt - req.arrivesAt).toBeLessThanOrEqual(COMMS.reviewMaxMin * MIN_MS)
    }
    expect(e.audit.some((a) => a.action === 'COMM_RECEIVED' && /Ground reply received/.test(a.detail))).toBe(true)
  })
})

describe('profile switch and manual messages', () => {
  it('setCommProfile updates the mission reference, sendToGround returns an id and gets a reply', () => {
    const e = new HealthEngine({ scenarioId: 'NOMINAL' })
    const mission = e.mission
    expect(e.setCommProfile('ISS')).toBe(false)
    expect(e.setCommProfile('MOON')).toBe(true)
    expect(e.mission).not.toBe(mission)
    expect(e.mission.commDelaySec).toBe(1.3)
    expect(e.audit[0]!.action).toBe('COMM_PROFILE_CHANGED')

    const v = e.versions.comms
    const id = e.sendToGround({ astronautId: 'AST-02', kind: 'CONSULT_REQUEST', title: 'Consult: sleep', body: 'Please review the sleep trend.', recommendationId: 'REC-1' })
    expect(id).toMatch(/^COM-/)
    expect(e.versions.comms).toBeGreaterThan(v)
    const m = e.comms.find((x) => x.id === id)!
    expect(m.data_origin).toBe('MANUAL')
    expect(m.status).toBe('IN_TRANSIT')
    expect(m.relatedRecommendationId).toBe('REC-1')
    run(e, 1, 1)
    expect(e.comms.find((x) => x.id === id)!.status).toBe('DELIVERED')
    run(e, 10, 1)
    const reply = e.comms.find((x) => x.kind === 'GROUND_REPLY')!
    expect(reply.status).toBe('DELIVERED')
    expect(reply.relatedRecommendationId).toBe('REC-1')
    // a slice without changes keeps its reference
    const before = e.comms
    e.evaluate()
    expect(e.comms).toBe(before)
  })

  it('no onboard first step under the ISS profile', () => {
    const e = new HealthEngine({ scenarioId: 'ACUTE_CARDIO' })
    run(e, 16, 1)
    expect(e.recommendations.some((r) => r.title.startsWith('Crew medical officer'))).toBe(false)
    expect(e.recommendations.some((r) => r.autonomy === 'GROUND_REVIEW')).toBe(true)
  })
})
