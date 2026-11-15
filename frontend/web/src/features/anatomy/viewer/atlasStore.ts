/** Local UI state of one atlas viewer instance (hover, layers, skin opacity, camera requests). */
import { create } from 'zustand'
import type { LayerChoice } from './layers'
import { DEFAULT_SKIN_OPACITY } from './layers'

export interface AtlasHover {
  /** Structure id under the pointer. */
  id: string
  point: [number, number, number]
}

export type ViewPreset = 'front' | 'back' | 'left' | 'right'

export interface AtlasViewState {
  hover: AtlasHover | null
  /** User choice per layer id. Missing or null = default (see layers.ts). */
  layers: LayerChoice
  skinOpacity: number
  /** Last requested preset view (nonce changes on every request). */
  view: { preset: ViewPreset; nonce: number } | null
  resetNonce: number
  setHover: (h: AtlasHover | null) => void
  setLayer: (id: string, on: boolean) => void
  setLayers: (choice: LayerChoice, skinOpacity?: number) => void
  setSkinOpacity: (v: number) => void
  setView: (preset: ViewPreset) => void
  resetView: () => void
}

export function createAtlasStore() {
  return create<AtlasViewState>()((set, get) => ({
    hover: null,
    layers: {},
    skinOpacity: DEFAULT_SKIN_OPACITY,
    view: null,
    resetNonce: 0,
    setHover: (h) => {
      const cur = get().hover
      if (cur === h) return
      if (cur && h && cur.id === h.id) {
        const dx = cur.point[0] - h.point[0]
        const dy = cur.point[1] - h.point[1]
        const dz = cur.point[2] - h.point[2]
        if (dx * dx + dy * dy + dz * dz < 0.00004) return
      }
      set({ hover: h })
    },
    setLayer: (id, on) => set((s) => ({ layers: { ...s.layers, [id]: on } })),
    setLayers: (choice, skinOpacity) => set((s) => ({ layers: choice, skinOpacity: skinOpacity ?? s.skinOpacity })),
    setSkinOpacity: (v) => set({ skinOpacity: Math.min(1, Math.max(0, v)) }),
    setView: (preset) => set((s) => ({ view: { preset, nonce: (s.view?.nonce ?? 0) + 1 } })),
    resetView: () => set((s) => ({ resetNonce: s.resetNonce + 1, view: null })),
  }))
}

export type AtlasStore = ReturnType<typeof createAtlasStore>

/** Dev and lab switches shared by every viewer instance. */
export interface QualityOverrides {
  shadows?: boolean
  msaa?: number
  bloom?: boolean
  dpr?: number
}
export const useAnatomyDebug = create<{
  forceFallback: boolean
  /** Lab only: force render quality settings to measure their cost. */
  overrides: QualityOverrides
  setForceFallback: (v: boolean) => void
  setOverrides: (o: QualityOverrides) => void
}>((set) => ({
  forceFallback: false,
  overrides: {},
  setForceFallback: (forceFallback) => set({ forceFallback }),
  setOverrides: (overrides) => set({ overrides }),
}))

/** Renderer statistics published once per second for the lab page. */
export interface ViewerStats {
  fps: number
  calls: number
  triangles: number
  /** Last hover pick duration (ms). */
  pickMs: number
  structures: number
}
export const viewerStats: ViewerStats = { fps: 0, calls: 0, triangles: 0, pickMs: 0, structures: 0 }
