/**
 * Loads the procedural anatomy once per body variant. Geometry is built in parallel Web Workers
 * (main thread stays responsive) and cached for the session as three.js BufferGeometry.
 */
import { BufferAttribute, BufferGeometry } from 'three'
import type { AnatomyParts, PartId } from './geometry/build.ts'
import { BUILD_GROUPS, COMPOSITES, buildParts } from './geometry/build.ts'
import { merge } from './geometry/mesh.ts'
import type { Sex } from './geometry/rig.ts'
import type { MeshData } from './geometry/sdf.ts'

type CompositeId = keyof typeof COMPOSITES
type ComposedPart = (typeof COMPOSITES)[CompositeId][number]
/** Render geometries: built parts plus composites (skin, skinLo, skeleton) merged from pieces. */
export type AnatomyGeometries = Record<Exclude<PartId, ComposedPart> | CompositeId, BufferGeometry>

const cache = new Map<Sex, Promise<AnatomyGeometries>>()

function toGeometry(m: MeshData): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(m.position, 3))
  g.setAttribute('normal', new BufferAttribute(m.normal, 3))
  if (m.dist) g.setAttribute('aDist', new BufferAttribute(m.dist, 1))
  g.setIndex(new BufferAttribute(m.index, 1))
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}

function buildInWorker(sex: Sex, parts: PartId[]): Promise<Partial<AnatomyParts>> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./anatomy.worker.ts', import.meta.url), { type: 'module' })
    } catch (err) {
      reject(err)
      return
    }
    worker.onmessage = (e: MessageEvent<Partial<AnatomyParts>>) => {
      resolve(e.data)
      worker.terminate()
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(e)
    }
    worker.postMessage({ sex, parts })
  })
}

/** Main thread fallback (yields between groups so the page can paint). */
async function buildOnMainThread(sex: Sex, parts: PartId[]): Promise<Partial<AnatomyParts>> {
  await new Promise((r) => setTimeout(r, 0))
  return buildParts(sex, parts)
}

/**
 * Persistent cache (IndexedDB) so repeat visits skip the build entirely. Production only, so
 * geometry edits during development are never masked by stale data. Bump on geometry changes.
 */
const GEOMETRY_VERSION = 'ahi-anatomy-v2'
const DB_NAME = 'ahi-anatomy'
const STORE = 'meshes'

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function readCache(sex: Sex): Promise<AnatomyParts | null> {
  if (import.meta.env.DEV) return null
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(sex)
      req.onsuccess = () => {
        const v = req.result as { version: string; parts: AnatomyParts } | undefined
        resolve(v && v.version === GEOMETRY_VERSION ? v.parts : null)
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function writeCache(sex: Sex, parts: AnatomyParts) {
  if (import.meta.env.DEV) return
  setTimeout(async () => {
    const db = await openDb()
    if (!db) return
    try {
      db.transaction(STORE, 'readwrite').objectStore(STORE).put({ version: GEOMETRY_VERSION, parts }, sex)
    } catch {
      // storage full or unavailable: the build simply runs again next time
    }
  }, 1500)
}

async function buildAll(sex: Sex): Promise<AnatomyParts> {
  const groups = await Promise.all(BUILD_GROUPS.map((g) => buildInWorker(sex, g).catch(() => buildOnMainThread(sex, g))))
  return Object.assign({}, ...groups) as AnatomyParts
}

export function loadAnatomy(sex: Sex): Promise<AnatomyGeometries> {
  const hit = cache.get(sex)
  if (hit) return hit
  const p = (async () => {
    let parts = await readCache(sex)
    if (!parts) {
      parts = await buildAll(sex)
      writeCache(sex, parts)
    }
    const out = {} as Record<string, BufferGeometry>
    const composed = new Set<string>(Object.values(COMPOSITES).flat())
    for (const [id, mesh] of Object.entries(parts) as [PartId, MeshData][]) if (!composed.has(id)) out[id] = toGeometry(mesh)
    for (const [id, pieces] of Object.entries(COMPOSITES)) out[id] = toGeometry(merge(pieces.map((p) => parts![p])))
    return out as AnatomyGeometries
  })()
  cache.set(sex, p)
  p.catch(() => cache.delete(sex))
  return p
}

/** Starts building a variant in the background (e.g. the other crew sex) so switching is instant. */
export function prefetchAnatomy(sex: Sex) {
  void loadAnatomy(sex).catch(() => undefined)
}
