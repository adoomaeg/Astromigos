import { create } from 'zustand'

/**
 * UI-only state that does not belong to the domain AppState contract.
 * View mode, presentation mode and the alert sound preference persist in localStorage
 * (every access wrapped in try/catch: private windows and blocked storage must not break the app).
 */

export type ViewMode = 'ground' | 'crew'

const KEY = 'ahi.ui.v2'

interface Persisted {
  viewMode: ViewMode
  presentation: boolean
  soundOn: boolean
}

const DEFAULTS: Persisted = { viewMode: 'ground', presentation: false, soundOn: false }

function load(): Persisted {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const p = JSON.parse(raw) as Partial<Persisted>
    return {
      viewMode: p.viewMode === 'crew' ? 'crew' : 'ground',
      presentation: p.presentation === true,
      soundOn: p.soundOn === true,
    }
  } catch {
    return DEFAULTS
  }
}

function save(p: Persisted) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // storage unavailable: preferences simply do not persist
  }
}

export interface TourState {
  active: boolean
  step: number
  autoplay: boolean
}

interface UiState extends Persisted {
  alertsOpen: boolean
  setAlertsOpen: (open: boolean) => void
  /** Critical alert ids the user hid from the banner without acknowledging. */
  bannerHidden: string[]
  hideBanner: (id: string) => void

  setViewMode: (mode: ViewMode) => void
  toggleViewMode: () => void
  setPresentation: (on: boolean) => void
  togglePresentation: () => void
  setSoundOn: (on: boolean) => void

  shortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void

  tour: TourState
  /** View mode before the tour started, restored on exit. */
  tourReturnView: ViewMode | null
  startTour: () => void
  setTourStep: (step: number) => void
  setTourAutoplay: (on: boolean) => void
  endTour: () => void
}

const initial = typeof window !== 'undefined' ? load() : DEFAULTS

export const useUiStore = create<UiState>()((set, get) => {
  const persist = () => {
    const s = get()
    save({ viewMode: s.viewMode, presentation: s.presentation, soundOn: s.soundOn })
  }
  return {
    ...initial,
    alertsOpen: false,
    setAlertsOpen: (alertsOpen) => set({ alertsOpen }),
    bannerHidden: [],
    hideBanner: (id) => set((s) => ({ bannerHidden: [...s.bannerHidden, id] })),

    setViewMode: (viewMode) => {
      set({ viewMode })
      persist()
    },
    toggleViewMode: () => get().setViewMode(get().viewMode === 'ground' ? 'crew' : 'ground'),
    setPresentation: (presentation) => {
      set({ presentation })
      persist()
    },
    togglePresentation: () => get().setPresentation(!get().presentation),
    setSoundOn: (soundOn) => {
      set({ soundOn })
      persist()
    },

    shortcutsOpen: false,
    setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

    tour: { active: false, step: 0, autoplay: false },
    tourReturnView: null,
    startTour: () => set((s) => ({ tour: { active: true, step: 0, autoplay: false }, tourReturnView: s.viewMode, alertsOpen: false, shortcutsOpen: false })),
    setTourStep: (step) => set((s) => ({ tour: { ...s.tour, step } })),
    setTourAutoplay: (autoplay) => set((s) => ({ tour: { ...s.tour, autoplay } })),
    endTour: () => {
      const back = get().tourReturnView
      set({ tour: { active: false, step: 0, autoplay: false }, tourReturnView: null })
      if (back) get().setViewMode(back)
    },
  }
})
