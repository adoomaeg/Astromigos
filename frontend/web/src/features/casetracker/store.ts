import { create } from 'zustand'
import type { FollowUp } from './model'

interface CaseTrackerState {
  astronautId: string | null
  focusRule: string | null
  reviews: Record<string, Record<string, FollowUp[]>>
  open: (astronautId: string, ruleId?: string) => void
  close: () => void
  recordFollowUp: (runId: string, caseId: string, followUp: FollowUp) => boolean
}
/** Notes are scoped to a simulation run: reused engine ids must never mix patients or scenarios. */
export const useCaseTrackerStore = create<CaseTrackerState>()((set) => ({
  astronautId: null, focusRule: null, reviews: {},
  open: (astronautId, focusRule) => set({ astronautId, focusRule: focusRule ?? null }),
  close: () => set({ astronautId: null, focusRule: null }),
  recordFollowUp: (runId, caseId, followUp) => {
    if (!followUp.note.trim() || !Number.isFinite(followUp.at)) return false
    set((s) => ({ reviews: { ...s.reviews, [runId]: { ...s.reviews[runId], [caseId]: [...(s.reviews[runId]?.[caseId] ?? []), { ...followUp, note: followUp.note.trim().slice(0, 2000) }] } } }))
    return true
  },
}))
