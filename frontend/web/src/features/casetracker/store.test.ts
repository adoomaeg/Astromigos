import { beforeEach, describe, expect, it } from 'vitest'
import { useCaseTrackerStore } from './store'
import { useAppStore } from '../../state/store'

beforeEach(() => useCaseTrackerStore.setState({ astronautId: null, focusRule: null, reviews: {} }))
describe('case follow-up isolation', () => {
  it('never shares notes when two scenario runs reuse the same alert id', () => {
    const s = useCaseTrackerStore.getState()
    expect(s.recordFollowUp('run-1', 'alert-AL-1', { note: 'First run', at: 100, reviewed: false })).toBe(true)
    expect(s.recordFollowUp('run-2', 'alert-AL-1', { note: 'Second run', at: 200, reviewed: false })).toBe(true)
    const reviews = useCaseTrackerStore.getState().reviews
    expect(reviews['run-1']!['alert-AL-1']![0]!.note).toBe('First run')
    expect(reviews['run-2']!['alert-AL-1']![0]!.note).toBe('Second run')
    expect(s.recordFollowUp('run-1', 'alert-AL-1', { note: '   ', at: 300, reviewed: true })).toBe(false)
  })

  it('starts a new tracker identity on both scenario change and restart', () => {
    const first = useAppStore.getState().simulationRunId
    useAppStore.getState().setScenario('ACUTE_CARDIO')
    const second = useAppStore.getState().simulationRunId
    expect(second).not.toBe(first)
    useAppStore.getState().reset()
    expect(useAppStore.getState().simulationRunId).not.toBe(second)
  })
})
