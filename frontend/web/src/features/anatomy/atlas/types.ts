/**
 * Anatomical atlas contract: the shape of `public/anatomy/manifest.json`, written by the asset
 * pipeline (frontend/web/scripts/anatomy) and read by the viewer and the health mapping.
 *
 * The atlas holds anatomy facts only (what a structure is, where its mesh lives). Health
 * semantics (which body region and metrics relate to a structure) live in `health.ts`, so the
 * asset pipeline never encodes monitoring rules.
 *
 * Coordinate frame of every GLB: meters, Y up, body facing +Z, feet on y = 0, centered on x = 0
 * and z = 0 (the same frame the procedural viewer used).
 */

/** Anatomical systems, also the unit of lazy loading (one GLB file per system). */
export type AnatomySystemId =
  | 'integumentary' // body surface (skin)
  | 'skeletal'
  | 'muscular'
  | 'cardiovascular'
  | 'respiratory'
  | 'nervous'
  | 'digestive'
  | 'urinary'
  | 'other' // endocrine, lymphoid, sense organs and anything not listed above

/** Tissue class: drives the viewer material (color, roughness, translucency). */
export type TissueClass =
  | 'skin'
  | 'bone'
  | 'cartilage'
  | 'tooth'
  | 'muscle'
  | 'tendon'
  | 'heart'
  | 'artery'
  | 'vein'
  | 'lung'
  | 'airway'
  | 'brain'
  | 'nerve'
  | 'liver'
  | 'kidney'
  | 'gut'
  | 'gland'
  | 'eye'
  | 'organ' // generic soft tissue

export type Vec3 = [number, number, number]

export interface AtlasStructure {
  /** Stable kebab-case id, unique in the atlas. It is also the GLB node name. e.g. "femur-left". */
  id: string
  /** English anatomical name for display, e.g. "Left femur". */
  name: string
  system: AnatomySystemId
  tissue: TissueClass
  /** 'L' | 'R' for paired structures, null for midline or merged structures. */
  side: 'L' | 'R' | null
  /** Bounding box center and extents in the atlas frame (meters). */
  center: Vec3
  min: Vec3
  max: Vec3
  triangles: number
  /** Names of the source objects merged into this structure (provenance and debugging). */
  sourceObjects: string[]
  /**
   * Where the geometry comes from. 'z-anatomy' for the atlas, 'ahi-procedural' for the few
   * structures rebuilt by AHI code because the upstream model is not redistributable (non
   * commercial upstream license).
   */
  origin: 'z-anatomy' | 'ahi-procedural'
  /** Optional: id of a larger structure this one belongs to (e.g. lobes of a lung). */
  parent?: string
}

export interface AtlasSystemFile {
  id: AnatomySystemId
  /** Display label, e.g. "Skeletal system". */
  label: string
  /** File name relative to the manifest, e.g. "skeletal.glb". */
  file: string
  bytes: number
  triangles: number
  /** Number of structures (GLB mesh nodes) in the file. */
  structureCount: number
}

export interface AtlasManifest {
  /** Bumped when ids or files change in an incompatible way. */
  version: number
  generatedAt: string
  /** Total body extent in the atlas frame (meters). */
  bounds: { min: Vec3; max: Vec3 }
  source: {
    name: string
    url: string
    license: string
    /** SHA-256 of the downloaded source archive. */
    sha256: string
    retrievedAt: string
    attribution: string[]
    /** Upstream content deliberately left out (with the reason). */
    excluded: string[]
  }
  systems: AtlasSystemFile[]
  structures: AtlasStructure[]
}

/**
 * Structure ids the application code relies on. The asset pipeline must always produce them
 * (a test checks the manifest). Everything else is discovered from the manifest at runtime.
 */
export const REQUIRED_STRUCTURE_IDS = [
  'skin',
  'heart',
  'lung-left',
  'lung-right',
  'brain',
  'kidney-left',
  'kidney-right',
] as const
