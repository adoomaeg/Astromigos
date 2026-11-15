/** Local UI state of one anatomy viewer instance (hover, layer toggles, camera reset). */
import { create } from 'zustand'
import type { BodyRegionId, Status } from '../../../types/domain'
import type { LayerId } from '../regions'

export interface HoverInfo {
  region: BodyRegionId
  point: [number, number, number]
}

export interface ViewerState {
  hover: HoverInfo | null
  /** null = automatic (muscles appear when selected or not nominal) */
  layers: Record<LayerId, boolean | null>
  resetNonce: number
  setHover: (h: HoverInfo | null) => void
  toggleLayer: (id: LayerId, current: boolean) => void
  resetView: () => void
}

export function createViewerStore() {
  return create<ViewerState>()((set, get) => ({
    hover: null,
    layers: { skin: true, muscles: null, skeleton: true, organs: true, vessels: true },
    resetNonce: 0,
    setHover: (h) => {
      const cur = get().hover
      if (cur === h) return
      if (cur && h && cur.region === h.region) {
        const dx = cur.point[0] - h.point[0]
        const dy = cur.point[1] - h.point[1]
        const dz = cur.point[2] - h.point[2]
        if (dx * dx + dy * dy + dz * dz < 0.00004) return
      }
      set({ hover: h })
    },
    toggleLayer: (id, current) => set((s) => ({ layers: { ...s.layers, [id]: !current } })),
    resetView: () => set((s) => ({ resetNonce: s.resetNonce + 1 })),
  }))
}

export type ViewerStore = ReturnType<typeof createViewerStore>

/** Effective layer visibility, resolving the automatic muscle layer and forcing the selected region visible. */
export function effectiveLayers(
  layers: Record<LayerId, boolean | null>,
  muscleStatus: Status,
  selected: BodyRegionId | null,
): Record<LayerId, boolean> {
  return {
    skin: layers.skin !== false,
    muscles: layers.muscles === null ? muscleStatus !== 'LOW' || selected === 'muscles' : layers.muscles,
    skeleton: layers.skeleton !== false,
    organs: layers.organs !== false,
    vessels: layers.vessels !== false,
  }
}
