import type { RiskLevel, Status } from '../types/domain'

/**
 * Status semantics shared by UI and 3D viewer.
 * Color is never the only cue: always pair it with label and icon/shape.
 */
export const STATUS_META: Record<Status, { label: string; crewLabel: string; color: string; glow: string; rank: number }> = {
  LOW: { label: 'Nominal', crewLabel: 'All good', color: '#34d399', glow: 'rgba(52,211,153,0.35)', rank: 0 },
  MODERATE: { label: 'Watch', crewLabel: 'Keep an eye', color: '#fbbf24', glow: 'rgba(251,191,36,0.35)', rank: 1 },
  HIGH: { label: 'Warning', crewLabel: 'Act soon', color: '#fb923c', glow: 'rgba(251,146,60,0.40)', rank: 2 },
  CRITICAL: { label: 'Critical', crewLabel: 'Act now', color: '#f43f5e', glow: 'rgba(244,63,94,0.45)', rank: 3 },
  NO_DATA: { label: 'No data', crewLabel: 'Signal lost', color: '#94a3b8', glow: 'rgba(148,163,184,0.30)', rank: -1 },
}

export function worstStatus(list: Status[]): Status {
  let worst: Status = 'LOW'
  let hasData = false
  for (const s of list) {
    if (s === 'NO_DATA') continue
    hasData = true
    if (STATUS_META[s].rank > STATUS_META[worst].rank) worst = s
  }
  if (!hasData && list.length > 0) return 'NO_DATA'
  return worst
}

export const RISK_ORDER: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL']
