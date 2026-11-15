/**
 * Loads the atlas GLB files (one per anatomical system, meshopt compressed) on demand.
 *
 * Geometry is cached for the whole session, so switching astronaut or remounting the viewer
 * never downloads or parses a file twice. The cache holds plain BufferGeometry (no meshes), so
 * every viewer instance builds its own scene objects on top of it. Only files under the app's
 * own /anatomy/ folder are requested: no CDN decoder, no remote assets.
 */
import { create } from 'zustand'
import { Matrix4 } from 'three'
import type { BufferGeometry, Material, Mesh, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { AnatomySystemId, AtlasManifest, AtlasSystemFile } from '../atlas/types'
import { systemFileUrl } from '../atlas/manifest'

/** One drawable piece of a structure: geometry in GLB node space plus its node to atlas matrix. */
export interface StructurePart {
  geometry: BufferGeometry
  matrix: Matrix4
}

export interface SystemAsset {
  system: AnatomySystemId
  /** Structure id to its parts (usually one). */
  parts: Map<string, StructurePart[]>
  triangles: number
  bytes: number
  /** Download plus parse time (ms). */
  ms: number
}

export interface FileProgress {
  loaded: number
  total: number
  status: 'loading' | 'ready' | 'error'
}

/** Download progress per system file (shared by every viewer instance). */
export const useAtlasProgress = create<{ files: Partial<Record<AnatomySystemId, FileProgress>> }>(() => ({ files: {} }))

function setProgress(system: AnatomySystemId, p: FileProgress) {
  useAtlasProgress.setState((s) => ({ files: { ...s.files, [system]: p } }))
}

/** Size and time of every system loaded in this session (lab readout). */
export const loadStats: { system: AnatomySystemId; bytes: number; ms: number; triangles: number }[] = []

const cache = new Map<string, Promise<SystemAsset>>()

async function fetchBytes(url: string, onProgress: (loaded: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Atlas file request failed (${res.status}): ${url}`)
  if (!res.body) {
    const buf = await res.arrayBuffer()
    onProgress(buf.byteLength)
    return buf
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  let last = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    const now = performance.now()
    if (now - last > 80) {
      last = now
      onProgress(loaded)
    }
  }
  const out = new Uint8Array(loaded)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  onProgress(loaded)
  return out.buffer
}

/** GLB magic "glTF": a dev server answers unknown paths with index.html, which must not be parsed. */
function isGlb(buf: ArrayBuffer): boolean {
  return buf.byteLength > 12 && new DataView(buf).getUint32(0, true) === 0x46546c67
}

/** Structure id of a mesh: its own node name or the name of the closest named ancestor. */
function structureIdOf(o: Object3D, ids: Set<string>): string | null {
  for (let p: Object3D | null = o; p; p = p.parent) {
    const original = p.userData.name as string | undefined
    if (original && ids.has(original)) return original
    if (ids.has(p.name)) return p.name
  }
  return null
}

async function parseSystem(manifest: AtlasManifest, file: AtlasSystemFile): Promise<SystemAsset> {
  const t0 = performance.now()
  const url = systemFileUrl(file)
  const total = Math.max(1, file.bytes)
  setProgress(file.id, { loaded: 0, total, status: 'loading' })
  const buf = await fetchBytes(url, (loaded) => setProgress(file.id, { loaded: Math.min(loaded, total), total, status: 'loading' }))
  if (!isGlb(buf)) throw new Error(`Atlas file is not a GLB: ${url}`)
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.parseAsync(buf, '')
  const ids = new Set(manifest.structures.filter((s) => s.system === file.id).map((s) => s.id))
  const parts = new Map<string, StructurePart[]>()
  const materials = new Set<Material>()
  let triangles = 0
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m)
    const id = structureIdOf(mesh, ids)
    if (!id) return
    const g = mesh.geometry
    // the viewer shades by tissue class: only position and normal are kept on the GPU
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    if (!g.attributes.normal) g.computeVertexNormals()
    g.computeBoundingBox()
    g.computeBoundingSphere()
    triangles += (g.index ? g.index.count : g.attributes.position!.count) / 3
    const list = parts.get(id) ?? []
    list.push({ geometry: g, matrix: new Matrix4().copy(mesh.matrixWorld) })
    parts.set(id, list)
  })
  for (const m of materials) m.dispose()
  if (import.meta.env.DEV) {
    const missing = [...ids].filter((id) => !parts.has(id))
    if (missing.length) console.warn(`[anatomy] ${file.file}: ${missing.length} manifest structures have no mesh node`, missing.slice(0, 12))
  }
  if (parts.size === 0) throw new Error(`Atlas file has no known structure: ${url}`)
  setProgress(file.id, { loaded: total, total, status: 'ready' })
  const asset: SystemAsset = { system: file.id, parts, triangles: Math.round(triangles), bytes: buf.byteLength, ms: performance.now() - t0 }
  loadStats.push({ system: asset.system, bytes: asset.bytes, ms: asset.ms, triangles: asset.triangles })
  return asset
}

/** Loads one system file (cached). Rejects when the file is missing or invalid. */
export function loadSystem(manifest: AtlasManifest, file: AtlasSystemFile): Promise<SystemAsset> {
  const url = systemFileUrl(file)
  const hit = cache.get(url)
  if (hit) return hit
  const p = parseSystem(manifest, file)
  cache.set(url, p)
  p.catch(() => {
    if (cache.get(url) === p) cache.delete(url)
    setProgress(file.id, { loaded: 0, total: Math.max(1, file.bytes), status: 'error' })
  })
  return p
}

/** Frees every cached geometry (GPU buffers are released by the renderers that used them). */
export function disposeAtlasCache() {
  for (const p of cache.values()) void p.then((a) => a.parts.forEach((list) => list.forEach((part) => part.geometry.dispose()))).catch(() => undefined)
  cache.clear()
  useAtlasProgress.setState({ files: {} })
}
