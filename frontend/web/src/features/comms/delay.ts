import { create } from 'zustand'
import type { CommMessage, CommProfile, CommProfileId } from '../../types/domain'

export const PROFILE_SHORT: Record<CommProfileId, string> = {
  ISS: 'ISS',
  MOON: 'Moon',
  MARS_NEAR: 'Mars near',
  MARS_FAR: 'Mars far',
}

/** One way light time as a short label: "0.5 s", "1.3 s", "4 min", "22 min". */
export function formatDelay(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '--'
  if (sec < 10) return `${sec.toFixed(1)} s`
  if (sec < 90) return `${Math.round(sec)} s`
  const min = sec / 60
  return min < 10 ? `${Math.round(min * 10) / 10} min` : `${Math.round(min)} min`
}

/** Remaining duration as "12 min 30 s", "3 min", "45 s". */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h} h ${m % 60} min`
  }
  return r && m < 10 ? `${m} min ${r} s` : `${m} min`
}

/** Plain explanation of what the delay means for decisions. */
export function delayMeaning(p: CommProfile): string {
  const rt = p.oneWayDelaySec * 2
  if (rt < 5) return `A question to Earth and its answer take about ${formatDelay(Math.max(1, rt))}. Mission Control can support decisions in near real time.`
  return `A question to Earth and its answer take at least ${formatDelay(rt)}. On-board steps come first; use the ground for review, not for urgent decisions.`
}

export function isInTransit(m: CommMessage, simNow: number): boolean {
  return m.status === 'IN_TRANSIT' && simNow < m.arrivesAt
}

export const COMM_KIND_LABEL: Record<CommMessage['kind'], string> = {
  HEALTH_PACKET: 'Health packet',
  CONSULT_REQUEST: 'Consult request',
  GROUND_REPLY: 'Ground reply',
  HANDOVER_REPORT: 'Handover report',
}

/** UI-only state so other features (timeline markers) can open the comms drawer. */
export const useCommsUi = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
