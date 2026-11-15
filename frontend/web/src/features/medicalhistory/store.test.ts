import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MedicalRecord } from './model'

let storage: Map<string, string>
beforeEach(() => {
  vi.resetModules()
  storage = new Map()
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } })
})
afterEach(() => vi.unstubAllGlobals())
const input: Omit<MedicalRecord, 'id' | 'origin'> = { astronautId: 'AST-01', category: 'Allergy', title: ' Fictional demo entry ', details: 'Sample only', at: 100, status: 'Active' }

describe('medical-history storage', () => {
  it('saves only user entries and restores them to the same astronaut after reload', async () => {
    const { useMedicalHistoryStore } = await import('./store')
    expect(useMedicalHistoryStore.getState().addRecord(input)).toBe(true)
    const saved = useMedicalHistoryStore.getState().records.find((r) => r.origin === 'User entry')!
    expect(saved.title).toBe('Fictional demo entry')
    const persisted = JSON.parse([...storage.values()][0]!)
    expect(persisted).toHaveLength(1)
    expect(persisted[0].astronautId).toBe('AST-01')
    vi.resetModules()
    const reloaded = await import('./store')
    expect(reloaded.useMedicalHistoryStore.getState().records.filter((r) => r.origin === 'User entry')).toEqual([saved])
  })

  it('switches individual histories independently without discarding records when closed', async () => {
    const { useMedicalHistoryStore } = await import('./store')
    const s = useMedicalHistoryStore.getState()
    s.addRecord(input)
    s.open('AST-01')
    expect(useMedicalHistoryStore.getState().astronautId).toBe('AST-01')
    s.open('AST-02')
    expect(useMedicalHistoryStore.getState().astronautId).toBe('AST-02')
    s.close()
    expect(useMedicalHistoryStore.getState().astronautId).toBeNull()
    expect(useMedicalHistoryStore.getState().records.filter((r) => r.origin === 'User entry')).toHaveLength(1)
  })

  it('rejects invalid input and keeps unsaved session records usable if browser storage is blocked', async () => {
    const { useMedicalHistoryStore } = await import('./store')
    const s = useMedicalHistoryStore.getState()
    expect(s.addRecord({ ...input, astronautId: 'unknown' })).toBe(false)
    expect(s.addRecord({ ...input, title: '  ' })).toBe(false)
    expect(s.addRecord({ ...input, at: NaN })).toBe(false)
    vi.stubGlobal('window', { localStorage: { setItem: () => { throw new Error('Storage blocked') } } })
    expect(s.addRecord(input)).toBe(true)
    expect(useMedicalHistoryStore.getState().storageAvailable).toBe(false)
    expect(useMedicalHistoryStore.getState().records.some((r) => r.origin === 'User entry')).toBe(true)
  })
})
