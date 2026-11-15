import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './store'
import { clearSelection, focusTarget } from '../features/shared/hooks'

/**
 * Selection contract between the 3D atlas, the body system chips and the right panel:
 * structure, region and metric always change together, in one store update.
 */
describe('selection: structure, region and metric', () => {
  const get = () => useAppStore.getState()

  beforeEach(() => {
    get().pause()
    get().selectAstronaut('AST-01')
  })

  it('starts with nothing selected', () => {
    expect(get().selectedStructureId).toBeNull()
    expect(get().selectedRegion).toBeNull()
    expect(get().selectedMetric).toBeNull()
  })

  it('selectStructure sets the structure and its region atomically and clears the metric', () => {
    get().selectRegion('lungs')
    get().selectMetric('SPO2')
    const updates: Array<{ structure: string | null; region: string | null; metric: string | null }> = []
    const stop = useAppStore.subscribe((s) => updates.push({ structure: s.selectedStructureId, region: s.selectedRegion, metric: s.selectedMetric }))
    get().selectStructure('heart', 'heart')
    stop()
    // One update: no intermediate state where the structure and the region disagree.
    expect(updates).toEqual([{ structure: 'heart', region: 'heart', metric: null }])
  })

  it('selectStructure without a region (context only) clears the region', () => {
    get().selectRegion('heart')
    get().selectStructure('liver')
    expect(get().selectedStructureId).toBe('liver')
    expect(get().selectedRegion).toBeNull()
    get().selectStructure('stomach', null)
    expect(get().selectedStructureId).toBe('stomach')
    expect(get().selectedRegion).toBeNull()
  })

  it('selectStructure(null) clears structure, region and metric, even when a region is passed', () => {
    get().selectStructure('aorta', 'heart')
    get().selectMetric('HEART_RATE')
    get().selectStructure(null, 'heart')
    expect(get().selectedStructureId).toBeNull()
    expect(get().selectedRegion).toBeNull()
    expect(get().selectedMetric).toBeNull()
  })

  it('selectRegion clears the structure (a chip always means the whole region)', () => {
    get().selectStructure('aorta', 'heart')
    get().selectRegion('heart')
    expect(get().selectedStructureId).toBeNull()
    expect(get().selectedRegion).toBe('heart')
    get().selectStructure('liver')
    get().selectRegion('lungs')
    expect(get().selectedStructureId).toBeNull()
    expect(get().selectedRegion).toBe('lungs')
    get().selectStructure('brain', 'brain')
    get().selectRegion(null)
    expect(get().selectedStructureId).toBeNull()
    expect(get().selectedRegion).toBeNull()
  })

  it('selectAstronaut clears structure, region and metric', () => {
    get().selectStructure('kidney-left', 'kidneys')
    get().selectMetric('HYDRATION')
    get().selectAstronaut('AST-02')
    expect(get().selectedAstronautId).toBe('AST-02')
    expect(get().selectedStructureId).toBeNull()
    expect(get().selectedRegion).toBeNull()
    expect(get().selectedMetric).toBeNull()
  })

  it('selectMetric keeps the structure and the region', () => {
    get().selectStructure('heart', 'heart')
    get().selectMetric('HRV_RMSSD')
    expect(get().selectedStructureId).toBe('heart')
    expect(get().selectedRegion).toBe('heart')
    expect(get().selectedMetric).toBe('HRV_RMSSD')
  })

  it('a clock tick never touches the selection', () => {
    get().selectStructure('heart', 'heart')
    get().play()
    get().tick(100)
    get().pause()
    expect(get().selectedStructureId).toBe('heart')
    expect(get().selectedRegion).toBe('heart')
  })
})

describe('focusTarget and clearSelection with a selected structure', () => {
  const get = () => useAppStore.getState()

  beforeEach(() => {
    get().pause()
    get().selectAstronaut('AST-01')
  })

  it('selects the region and clears a structure of another region (alert View buttons)', () => {
    get().selectStructure('liver')
    focusTarget({ astronautId: 'AST-01', region: 'heart', metric: 'HEART_RATE' })
    expect(get().selectedStructureId).toBeNull()
    expect(get().selectedRegion).toBe('heart')
    expect(get().selectedMetric).toBe('HEART_RATE')

    get().selectStructure('lung-left', 'lungs')
    focusTarget({ metric: 'HYDRATION' })
    expect(get().selectedStructureId).toBeNull()
    expect(get().selectedRegion).toBe('kidneys')
    expect(get().selectedMetric).toBe('HYDRATION')
  })

  it('keeps a structure of the same region and only opens the metric', () => {
    get().selectStructure('aorta', 'heart')
    focusTarget({ astronautId: 'AST-01', metric: 'SYSTOLIC_BP' })
    expect(get().selectedStructureId).toBe('aorta')
    expect(get().selectedRegion).toBe('heart')
    expect(get().selectedMetric).toBe('SYSTOLIC_BP')
  })

  it('changes astronaut first, which clears the structure', () => {
    get().selectStructure('aorta', 'heart')
    focusTarget({ astronautId: 'AST-03', region: 'heart' })
    expect(get().selectedAstronautId).toBe('AST-03')
    expect(get().selectedStructureId).toBeNull()
    expect(get().selectedRegion).toBe('heart')
  })

  it('ignores cabin targets and leaves the selection alone', () => {
    get().selectStructure('aorta', 'heart')
    focusTarget({ region: 'environment', metric: 'CO2' })
    expect(get().selectedStructureId).toBe('aorta')
    expect(get().selectedRegion).toBe('heart')
  })

  it('clearSelection goes back to the overview', () => {
    get().selectStructure('aorta', 'heart')
    get().selectMetric('HEART_RATE')
    clearSelection()
    expect(get().selectedStructureId).toBeNull()
    expect(get().selectedRegion).toBeNull()
    expect(get().selectedMetric).toBeNull()
  })
})
