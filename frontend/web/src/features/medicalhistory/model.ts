import type { Alert, CheckIn, Intervention } from '../../types/domain'

export const RECORD_CATEGORIES = ['Condition', 'Allergy', 'Medication', 'Procedure', 'Note'] as const
export type RecordCategory = typeof RECORD_CATEGORIES[number]
export interface MedicalRecord {
  id: string
  astronautId: string
  category: RecordCategory
  title: string
  details: string
  at: number
  status: 'Active' | 'Resolved' | 'Recorded'
  origin: 'Demo' | 'User entry'
}

/** Fictional workflow records, never sourced from the named astronauts’ personal health. */
export const DEMO_RECORDS: MedicalRecord[] = [
  { id: 'DEMO-01', astronautId: 'AST-01', category: 'Procedure', title: 'Preflight baseline review', details: 'Fictional example: baseline measurements reviewed for this demonstration. No real medical clearance is represented.', at: Date.parse('2026-09-26T09:00:00Z'), status: 'Recorded', origin: 'Demo' },
  { id: 'DEMO-02', astronautId: 'AST-02', category: 'Note', title: 'Sleep and recovery baseline', details: 'Fictional example: a reference sleep and recovery profile was created for the simulation.', at: Date.parse('2026-09-27T10:00:00Z'), status: 'Recorded', origin: 'Demo' },
  { id: 'DEMO-03', astronautId: 'AST-03', category: 'Procedure', title: 'Wearable sensor setup', details: 'Fictional example: smart-shirt and wrist-sensor setup recorded for the simulated pilot profile.', at: Date.parse('2026-09-28T11:00:00Z'), status: 'Recorded', origin: 'Demo' },
  { id: 'DEMO-04', astronautId: 'AST-04', category: 'Note', title: 'Exercise reference assessment', details: 'Fictional example: reference exercise measurements recorded for the simulation.', at: Date.parse('2026-09-29T14:00:00Z'), status: 'Recorded', origin: 'Demo' },
]

export interface HistoryEvent {
  id: string
  at: number
  title: string
  details: string
  category: string
  origin: string
  status: string
}

export function medicalTimeline(astronautId: string, records: readonly MedicalRecord[], alerts: readonly Alert[], interventions: readonly Intervention[], checkIns: readonly CheckIn[]): HistoryEvent[] {
  const events: HistoryEvent[] = records.filter((r) => r.astronautId === astronautId).map((r) => ({ ...r, id: `record-${r.id}` }))
  for (const a of alerts) {
    if (a.astronautId !== astronautId && a.astronautId !== null) continue
    events.push({ id: `alert-${a.id}`, at: a.createdAt, title: a.astronautId === null ? `Cabin: ${a.title}` : a.title, details: a.detail, category: 'Health alert', origin: 'Simulated', status: a.resolvedAt != null ? 'Resolved' : a.acknowledgedAt != null ? 'Acknowledged · unresolved' : 'Open' })
  }
  for (const i of interventions) {
    if (i.astronautId !== astronautId && i.astronautId !== 'CABIN') continue
    events.push({ id: `action-${i.id}`, at: i.loggedAt, title: i.kind.replaceAll('_', ' ').toLowerCase(), details: i.note || `Logged by ${i.actor}. An action log does not confirm that a condition has resolved.`, category: 'Logged action', origin: 'Simulation action', status: 'Recorded' })
  }
  for (const c of checkIns) {
    if (c.astronautId !== astronautId) continue
    const symptoms = c.symptoms.filter((s) => s !== 'none')
    events.push({ id: `checkin-${c.id}`, at: c.at, title: 'Daily health check-in', details: `Mood ${c.mood}/5 · Fatigue ${c.fatigue}/5 · Stress ${c.stress}/5 · Sleep quality ${c.sleepQuality}/5. Symptoms: ${symptoms.length ? symptoms.join(', ') : 'none reported'}.${c.note ? ` ${c.note}` : ''}`, category: 'Check-in', origin: c.data_origin === 'MANUAL' ? 'User entry' : 'Simulated', status: 'Recorded' })
  }
  return events.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
}

/** Defensive local-storage parsing: one malformed entry must not make another crew profile unusable. */
export function parseMedicalRecords(raw: string | null): MedicalRecord[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((r): r is MedicalRecord => !!r && typeof r === 'object' && typeof r.id === 'string' && typeof r.astronautId === 'string' && typeof r.title === 'string' && typeof r.details === 'string' && Number.isFinite(r.at) && RECORD_CATEGORIES.includes(r.category) && ['Active', 'Resolved', 'Recorded'].includes(r.status) && r.origin === 'User entry')
  } catch { return [] }
}
