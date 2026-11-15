import { describe, expect, it } from 'vitest'
import { useAppStore } from './store'

describe('store v2 slices and actions', () => {
  it('publishes v2 slices, keeps references stable and wires the actions', () => {
    const s0 = useAppStore.getState()
    expect(s0.commProfileId).toBe('ISS')
    expect(s0.missionPlan.note).toMatch(/not official limits/)
    expect(s0.checkIns.length).toBeGreaterThan(0)
    expect(s0.statusTimeline.length).toBeGreaterThan(90)
    expect(s0.missionDays['AST-01']!.length).toBe(44)

    // a tick without new data keeps the v2 references
    s0.pause()
    s0.tick(100)
    const s1 = useAppStore.getState()
    expect(s1.statusTimeline).toBe(s0.statusTimeline)
    expect(s1.missionDays).toBe(s0.missionDays)
    expect(s1.comms).toBe(s0.comms)

    s1.setCommProfile('MARS_FAR')
    const s2 = useAppStore.getState()
    expect(s2.commProfileId).toBe('MARS_FAR')
    expect(s2.mission.commDelaySec).toBe(1320)
    expect(s2.mission).not.toBe(s1.mission)

    const id = s2.sendToGround({ astronautId: 'AST-01', kind: 'CONSULT_REQUEST', title: 'Consult', body: 'Please review.' })
    const s3 = useAppStore.getState()
    expect(s3.comms[0]!.id).toBe(id)
    expect(s3.comms[0]!.status).toBe('IN_TRANSIT')

    s3.submitCheckIn({ astronautId: 'AST-02', mood: 4, fatigue: 2, stress: 2, sleepQuality: 4, symptoms: [], note: '' })
    const s4 = useAppStore.getState()
    expect(s4.checkIns[0]!.data_origin).toBe('MANUAL')
    expect(s4.checkIns).not.toBe(s3.checkIns)

    expect(s4.compareIntervention({ astronautId: 'AST-02', kind: 'SENSOR_CHECK' })).toBeNull()
    expect(s4.compareIntervention({ astronautId: 'AST-02', kind: 'SLEEP_EXTENSION' })!.metric).toBe('HRV_RMSSD')

    // the comm profile survives a scenario change
    s4.setScenario('ACUTE_CARDIO')
    const s5 = useAppStore.getState()
    expect(s5.commProfileId).toBe('MARS_FAR')
    expect(s5.mission.commDelaySec).toBe(1320)
    expect(s5.comms).toHaveLength(0)
  }, 60000)
})
