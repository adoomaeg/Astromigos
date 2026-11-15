import { create } from 'zustand'
import { CREW } from '../../engine/catalog'
import { DEMO_RECORDS, parseMedicalRecords, RECORD_CATEGORIES, type MedicalRecord } from './model'

const KEY = 'astromigos.medical-history.v1'
function load(): MedicalRecord[] {
  try { return parseMedicalRecords(window.localStorage.getItem(KEY)) } catch { return [] }
}
interface MedicalHistoryState {
  astronautId: string | null
  records: MedicalRecord[]
  storageAvailable: boolean
  open: (id: string) => void
  close: () => void
  addRecord: (input: Omit<MedicalRecord, 'id' | 'origin'>) => boolean
}
export const useMedicalHistoryStore = create<MedicalHistoryState>()((set, get) => ({
  astronautId: null,
  records: [...DEMO_RECORDS, ...load()],
  storageAvailable: true,
  open: (astronautId) => { if (CREW.some((c) => c.id === astronautId)) set({ astronautId }) },
  close: () => set({ astronautId: null }),
  addRecord: (input) => {
    if (!CREW.some((c) => c.id === input.astronautId) || !input.title.trim() || !Number.isFinite(input.at) || !RECORD_CATEGORIES.includes(input.category) || !['Active', 'Resolved', 'Recorded'].includes(input.status)) return false
    const record: MedicalRecord = { ...input, title: input.title.trim().slice(0, 120), details: input.details.trim().slice(0, 2000), id: `MH-${crypto.randomUUID()}`, origin: 'User entry' }
    const records = [...get().records, record]
    let storageAvailable = true
    try { window.localStorage.setItem(KEY, JSON.stringify(records.filter((r) => r.origin === 'User entry'))) } catch { storageAvailable = false }
    set({ records, storageAvailable })
    return true
  },
}))
