/**
 * Anatomical layers of the viewer, derived from the atlas manifest (never from hardcoded ids).
 * A layer is one anatomical system. The nervous system is split in two layers when the atlas
 * holds both the central part (brain, monitored) and peripheral nerves (context, visually busy).
 */
import type { BodyRegionId, Status } from '../../../types/domain'
import type { AnatomySystemId, AtlasManifest, AtlasStructure, Vec3 } from '../atlas/types'
import { REQUIRED_STRUCTURE_IDS } from '../atlas/types'
import { regionOfStructure } from '../atlas/health'
import { REGIONS } from '../regions'
import { TISSUE } from './tissueMaterials'

export interface AtlasLayer {
  id: string
  label: string
  system: AnatomySystemId
  /** Representative tissue color for the toggle swatch. */
  swatch: string
  /** Default visibility. null = automatic (shown when selected or when its region is in alert). */
  defaultOn: boolean | null
  structures: AtlasStructure[]
  triangles: number
  /**
   * Companion layer: it has no toggle of its own and is visible whenever one of these layers is
   * (the eyes follow the skin, so the open eyelids never show empty sockets).
   */
  follows?: string[]
}

const NERVES_LAYER = 'nerves'
const EYES_LAYER = 'eyes'

const ORDER: { system: AnatomySystemId; label: string; swatch: string; defaultOn: boolean | null }[] = [
  { system: 'integumentary', label: 'Skin', swatch: TISSUE.skin.color, defaultOn: true },
  { system: 'muscular', label: 'Muscular', swatch: TISSUE.muscle.color, defaultOn: null },
  { system: 'skeletal', label: 'Skeletal', swatch: TISSUE.bone.color, defaultOn: true },
  { system: 'cardiovascular', label: 'Cardiovascular', swatch: TISSUE.artery.color, defaultOn: true },
  { system: 'respiratory', label: 'Respiratory', swatch: TISSUE.lung.color, defaultOn: true },
  { system: 'nervous', label: 'Nervous', swatch: TISSUE.brain.color, defaultOn: true },
  { system: 'digestive', label: 'Digestive', swatch: TISSUE.gut.color, defaultOn: true },
  { system: 'urinary', label: 'Urinary', swatch: TISSUE.kidney.color, defaultOn: true },
  { system: 'other', label: 'Other', swatch: TISSUE.gland.color, defaultOn: false },
]

const isPeripheralNerve = (s: AtlasStructure) => s.system === 'nervous' && s.tissue === 'nerve' && regionOfStructure(s) === null

export interface LayerModel {
  layers: AtlasLayer[]
  /** Structure id to layer id. */
  layerOf: Map<string, string>
  /** Layers that hold the structures of each body region. */
  regionLayers: Record<BodyRegionId, string[]>
}

export function buildLayers(manifest: AtlasManifest): LayerModel {
  const layers: AtlasLayer[] = []
  const layerOf = new Map<string, string>()
  const present = new Set(manifest.systems.map((f) => f.id))
  const add = (id: string, def: (typeof ORDER)[number], structures: AtlasStructure[], overrides: Partial<AtlasLayer> = {}) => {
    if (!structures.length) return
    layers.push({ id, label: def.label, system: def.system, swatch: def.swatch, defaultOn: def.defaultOn, structures, triangles: structures.reduce((n, s) => n + s.triangles, 0), ...overrides })
    for (const s of structures) layerOf.set(s.id, id)
  }
  for (const def of ORDER) {
    if (!present.has(def.system)) continue
    const all = manifest.structures.filter((s) => s.system === def.system)
    if (def.system === 'nervous') {
      const nerves = all.filter(isPeripheralNerve)
      const central = all.filter((s) => !isPeripheralNerve(s))
      if (nerves.length && central.length) {
        add(def.system, def, central)
        add(NERVES_LAYER, def, nerves, { label: 'Nerves', swatch: TISSUE.nerve.color, defaultOn: false })
        continue
      }
    }
    if (def.system === 'other' && present.has('integumentary')) {
      const eyes = all.filter((s) => s.tissue === 'eye')
      if (eyes.length) {
        add(def.system, def, all.filter((s) => s.tissue !== 'eye'))
        add(EYES_LAYER, def, eyes, { label: 'Eyes', swatch: TISSUE.eye.color, defaultOn: false, follows: ['integumentary', def.system] })
        continue
      }
    }
    add(def.system, def, all)
  }
  const regionLayers = Object.fromEntries(REGIONS.map((r) => [r, [] as string[]])) as Record<BodyRegionId, string[]>
  for (const s of manifest.structures) {
    const region = regionOfStructure(s)
    const layer = layerOf.get(s.id)
    if (region && layer && !regionLayers[region].includes(layer)) regionLayers[region].push(layer)
  }
  return { layers, layerOf, regionLayers }
}

export type LayerChoice = Record<string, boolean | null | undefined>

const ALERT: Record<Status, boolean> = { LOW: false, NO_DATA: false, MODERATE: true, HIGH: true, CRITICAL: true }

/**
 * Effective visibility per layer: the user's choice, else the default. Automatic layers (muscles)
 * appear when their region is in alert. The selected region or structure is always visible.
 */
export function effectiveLayers(
  model: LayerModel,
  choice: LayerChoice,
  ctx: { statuses: Record<BodyRegionId, Status>; selectedRegion: BodyRegionId | null; selectedStructureId: string | null },
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  const forced = new Set<string>()
  const structureLayer = ctx.selectedStructureId ? model.layerOf.get(ctx.selectedStructureId) : undefined
  if (structureLayer) forced.add(structureLayer)
  else if (ctx.selectedRegion) for (const id of model.regionLayers[ctx.selectedRegion]) if (id !== NERVES_LAYER) forced.add(id)
  for (const l of model.layers) {
    const user = choice[l.id]
    let on: boolean
    if (user === true || user === false) on = user
    else if (l.defaultOn !== null) on = l.defaultOn
    else on = REGIONS.some((r) => ALERT[ctx.statuses[r]] && model.regionLayers[r].includes(l.id))
    out[l.id] = on || forced.has(l.id)
  }
  for (const l of model.layers) if (l.follows) out[l.id] = forced.has(l.id) || l.follows.some((id) => out[id])
  return out
}

export interface LayerPreset {
  id: string
  label: string
  title: string
  /** Layer choice by system (the nerves layer follows `nerves`). */
  systems: Partial<Record<AnatomySystemId, boolean | null>>
  nerves: boolean
  skinOpacity: number
}

export const DEFAULT_SKIN_OPACITY = 0.22

export const PRESETS: LayerPreset[] = [
  {
    id: 'default',
    label: 'Default',
    title: 'Translucent skin, skeleton and the monitored organs',
    systems: { integumentary: true, muscular: null, skeletal: true, cardiovascular: true, respiratory: true, nervous: true, digestive: true, urinary: true, other: false },
    nerves: false,
    skinOpacity: DEFAULT_SKIN_OPACITY,
  },
  {
    id: 'organs',
    label: 'Organs',
    title: 'Organs and vessels without the skeleton',
    systems: { integumentary: true, muscular: false, skeletal: false, cardiovascular: true, respiratory: true, nervous: true, digestive: true, urinary: true, other: true },
    nerves: false,
    skinOpacity: 0.14,
  },
  {
    id: 'skeleton',
    label: 'Skeleton',
    title: 'Skeleton inside a faint body outline',
    systems: { integumentary: true, muscular: false, skeletal: true, cardiovascular: false, respiratory: false, nervous: false, digestive: false, urinary: false, other: false },
    nerves: false,
    skinOpacity: 0.12,
  },
  {
    id: 'muscles',
    label: 'Muscles',
    title: 'Muscles over the skeleton',
    systems: { integumentary: false, muscular: true, skeletal: true, cardiovascular: false, respiratory: false, nervous: false, digestive: false, urinary: false, other: false },
    nerves: false,
    skinOpacity: DEFAULT_SKIN_OPACITY,
  },
  {
    id: 'all',
    label: 'All',
    title: 'Every anatomical system',
    systems: { integumentary: true, muscular: true, skeletal: true, cardiovascular: true, respiratory: true, nervous: true, digestive: true, urinary: true, other: true },
    nerves: true,
    skinOpacity: 0.12,
  },
]

export function presetChoice(model: LayerModel, preset: LayerPreset): LayerChoice {
  return Object.fromEntries(model.layers.map((l) => [l.id, l.id === NERVES_LAYER ? preset.nerves : (preset.systems[l.system] ?? l.defaultOn)]))
}

// ---------------------------------------------------------------------------
// Boxes, focus and label anchors (all from manifest bounds, in the atlas frame)
// ---------------------------------------------------------------------------

export interface Box {
  min: Vec3
  max: Vec3
}

export function unionBox(list: AtlasStructure[]): Box | null {
  if (!list.length) return null
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const s of list) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, s.min[i]!)
      max[i] = Math.max(max[i]!, s.max[i]!)
    }
  }
  return { min, max }
}

/** The organs the application monitors directly (required ids), per body region. Skin is whole body. */
export function primaryStructures(manifest: AtlasManifest, region: BodyRegionId): AtlasStructure[] {
  if (region === 'skin') return []
  const ids = new Set<string>(REQUIRED_STRUCTURE_IDS)
  return manifest.structures.filter((s) => ids.has(s.id) && regionOfStructure(s) === region)
}

export interface Focus {
  /** Changes whenever the camera should fly again. */
  key: string
  box: Box
  /** View direction from the target toward the camera. */
  dir: Vec3
  /** Whole body shot: fitted to the viewport instead of the box. */
  full: boolean
  /** Room around the box (multiplier of its radius). Regions get more: their vessels and airways reach beyond the organ. */
  pad?: number
}

const REGION_DIR: Record<BodyRegionId, Vec3> = {
  brain: [0.6, 0.38, 1],
  heart: [0.38, 0.14, 1],
  lungs: [0.25, 0.12, 1],
  kidneys: [0.32, 0.18, -1],
  muscles: [0.5, 0.08, 1],
  bones: [-0.45, 0.08, 1],
  skin: [0.22, 0.05, 1],
}

const height = (b: Box) => b.max[1] - b.min[1]

/** Camera focus for a region: its monitored organs when it has them, else the whole body. */
export function regionFocus(manifest: AtlasManifest, region: BodyRegionId): Focus {
  const box = unionBox(primaryStructures(manifest, region))
  if (!box) return { key: `region:${region}`, box: manifest.bounds, dir: REGION_DIR[region], full: true }
  return { key: `region:${region}`, box, dir: REGION_DIR[region], full: false, pad: 2.1 }
}

/** Camera focus for one structure: seen from its own side of the body (front, back, left or right). */
export function structureFocus(manifest: AtlasManifest, s: AtlasStructure): Focus {
  const body = manifest.bounds
  const box: Box = { min: s.min, max: s.max }
  const full = height(box) > 0.8 * height(body)
  const midZ = (body.min[2] + body.max[2]) / 2
  const depth = Math.max(0.01, body.max[2] - body.min[2])
  const back = (s.center[2] - midZ) / depth < -0.12
  const side = Math.abs(s.center[0]) < 0.02 ? 0.3 : Math.sign(s.center[0]) * 0.42
  return { key: `structure:${s.id}`, box, dir: [side, 0.16, back ? -1 : 1], full }
}

/**
 * Label anchor per region: the center of its monitored organ, or for whole body systems the
 * structure closest to a fixed spot of the body (thigh for muscles, shin for bones, flank for skin).
 */
export function regionAnchors(manifest: AtlasManifest): Record<BodyRegionId, Vec3 | null> {
  const b = manifest.bounds
  const h = height(b)
  const out = Object.fromEntries(REGIONS.map((r) => [r, null])) as Record<BodyRegionId, Vec3 | null>
  const nearest = (region: BodyRegionId, target: Vec3): Vec3 | null => {
    let best: AtlasStructure | null = null
    let bestD = Infinity
    for (const s of manifest.structures) {
      if (regionOfStructure(s) !== region) continue
      const d = (s.center[0] - target[0]) ** 2 + (s.center[1] - target[1]) ** 2 + (s.center[2] - target[2]) ** 2
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    return best ? best.center : null
  }
  for (const r of REGIONS) {
    const prim = primaryStructures(manifest, r)
    if (prim.length) {
      // lungs point to the right lung and kidneys to the left one, so their labels spread to both sides
      const pick = prim.reduce((a, s) => ((r === 'lungs' ? s.center[0] < a.center[0] : s.center[0] > a.center[0]) ? s : a))
      out[r] = pick.center
    }
  }
  out.muscles = nearest('muscles', [0.11, b.min[1] + 0.4 * h, 0.04])
  out.bones = nearest('bones', [-0.09, b.min[1] + 0.25 * h, 0.03])
  if (manifest.structures.some((s) => regionOfStructure(s) === 'skin')) out.skin = [b.min[0] * 0.5, b.min[1] + 0.52 * h, 0.03]
  return out
}
