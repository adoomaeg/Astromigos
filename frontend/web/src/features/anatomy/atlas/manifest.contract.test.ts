/**
 * Contract test for the real atlas (public/anatomy/manifest.json plus one GLB per system),
 * written by the asset pipeline. It runs only when the manifest exists, so a checkout without
 * the generated assets still passes (the viewer then falls back to the procedural body).
 *
 * GLB files are read with Node and parsed by hand (12 byte header, then the JSON chunk): no
 * three.js, no decoder. Only the scene graph is checked, never the compressed geometry.
 */
import { describe, expect, it } from 'vitest'
import { METRIC_CATALOG } from '../../../engine/catalog'
import type { BodyRegionId } from '../../../types/domain'
import { isBrainStructure, primaryStructureOfRegion, regionOfStructure, relatedMetrics, structuresOfRegion } from './health'
import type { AnatomySystemId, AtlasManifest, TissueClass, Vec3 } from './types'
import { REQUIRED_STRUCTURE_IDS } from './types'

/** The slice of node:fs this test needs. The app tsconfig has no Node types, hence the local shape. */
interface NodeFs {
  existsSync(path: URL): boolean
  readFileSync(path: URL): Uint8Array
  statSync(path: URL): { size: number }
}

// Built at run time so the browser type check never has to resolve a Node module.
const NODE_FS = ['node', 'fs'].join(':')
const fs = (await import(/* @vite-ignore */ NODE_FS)) as NodeFs

// VITE_AHI_ATLAS_DIR (a file URL ending with a slash) points the test at another atlas folder,
// e.g. a pipeline output that is not copied to public/ yet. Default: the folder the app serves.
const override = import.meta.env.VITE_AHI_ATLAS_DIR as string | undefined
const ATLAS_DIR = override ? new URL(override) : new URL('../../../../public/anatomy/', import.meta.url)
const MANIFEST_URL = new URL('manifest.json', ATLAS_DIR)
const hasAtlas = fs.existsSync(MANIFEST_URL)
const manifest: AtlasManifest | null = hasAtlas ? (JSON.parse(new TextDecoder().decode(fs.readFileSync(MANIFEST_URL))) as AtlasManifest) : null

const SYSTEMS: AnatomySystemId[] = ['integumentary', 'skeletal', 'muscular', 'cardiovascular', 'respiratory', 'nervous', 'digestive', 'urinary', 'other']
const TISSUES: TissueClass[] = ['skin', 'bone', 'cartilage', 'tooth', 'muscle', 'tendon', 'heart', 'artery', 'vein', 'lung', 'airway', 'brain', 'nerve', 'liver', 'kidney', 'gut', 'gland', 'eye', 'organ']
const REGIONS: BodyRegionId[] = ['brain', 'heart', 'lungs', 'kidneys', 'muscles', 'bones', 'skin']
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** Em dash and en dash, built from char codes so this file itself stays free of them. */
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']')

function isVec3(v: unknown): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
}

interface GltfJson {
  asset?: { version?: string }
  nodes?: { name?: string; mesh?: number }[]
  meshes?: unknown[]
  extensionsUsed?: string[]
  extensionsRequired?: string[]
}

/** Reads the JSON chunk of a binary glTF 2.0 file. */
function readGlbJson(bytes: Uint8Array): GltfJson {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB file (bad magic)')
  if (view.getUint32(4, true) !== 2) throw new Error(`unsupported GLB version ${view.getUint32(4, true)}`)
  if (view.getUint32(8, true) !== bytes.byteLength) throw new Error('GLB length header does not match the file size')
  const chunkLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== 0x4e4f534a) throw new Error('first GLB chunk is not JSON')
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + chunkLength))) as GltfJson
}

describe('GLB JSON chunk reader', () => {
  it('parses a minimal GLB and rejects other files', () => {
    const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, nodes: [{ name: 'heart', mesh: 0 }] }))
    const padded = Math.ceil(json.length / 4) * 4
    const bytes = new Uint8Array(20 + padded).fill(0x20)
    const view = new DataView(bytes.buffer)
    view.setUint32(0, 0x46546c67, true)
    view.setUint32(4, 2, true)
    view.setUint32(8, bytes.byteLength, true)
    view.setUint32(12, padded, true)
    view.setUint32(16, 0x4e4f534a, true)
    bytes.set(json, 20)
    expect(readGlbJson(bytes).nodes).toEqual([{ name: 'heart', mesh: 0 }])
    expect(() => readGlbJson(new Uint8Array(32))).toThrow(/bad magic/)
  })
})

describe.skipIf(!hasAtlas)('atlas manifest contract (public/anatomy)', () => {
  const m = manifest!

  it('has a valid top level shape, source and license facts', () => {
    expect(typeof m.version).toBe('number')
    expect(Number.isNaN(Date.parse(m.generatedAt))).toBe(false)
    expect(isVec3(m.bounds.min) && isVec3(m.bounds.max)).toBe(true)
    // Atlas frame: meters, Y up, feet on y = 0, centered on x and z, adult height.
    expect(Math.abs(m.bounds.min[1])).toBeLessThan(0.03)
    expect(m.bounds.max[1]).toBeGreaterThan(1.5)
    expect(m.bounds.max[1]).toBeLessThan(2.1)
    expect(Math.abs(m.bounds.min[0] + m.bounds.max[0])).toBeLessThan(0.1)
    expect(m.source.name.length).toBeGreaterThan(0)
    expect(m.source.url).toMatch(/^https:\/\//)
    expect(m.source.license).toMatch(/CC[ -]BY[ -]SA|Attribution-ShareAlike/i)
    expect(m.source.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(m.source.attribution.join(' ')).toMatch(/Z-Anatomy/)
    expect(m.source.attribution.join(' ')).toMatch(/BodyParts3D/)
    // The two non commercial upstream items are documented as left out.
    expect(m.source.excluded.length).toBeGreaterThan(0)
    expect(m.systems.length).toBeGreaterThan(0)
    expect(m.structures.length).toBeGreaterThan(0)
  })

  it('has valid structures with unique ids', () => {
    const ids = new Set<string>()
    for (const s of m.structures) {
      expect(s.id, s.id).toMatch(KEBAB)
      expect(ids.has(s.id), `duplicate id ${s.id}`).toBe(false)
      ids.add(s.id)
      expect(typeof s.name === 'string' && s.name.trim().length > 0, s.id).toBe(true)
      expect(DASHES.test(s.name), `${s.id} name has an em dash or en dash`).toBe(false)
      expect(SYSTEMS, s.id).toContain(s.system)
      expect(TISSUES, s.id).toContain(s.tissue)
      expect([null, 'L', 'R'], s.id).toContain(s.side)
      expect(['z-anatomy', 'ahi-procedural'], s.id).toContain(s.origin)
      expect(isVec3(s.center) && isVec3(s.min) && isVec3(s.max), s.id).toBe(true)
      for (let i = 0; i < 3; i++) {
        expect(s.min[i]!, `${s.id} min/max axis ${i}`).toBeLessThanOrEqual(s.max[i]!)
        expect(s.center[i]!, `${s.id} center axis ${i}`).toBeGreaterThanOrEqual(s.min[i]! - 1e-6)
        expect(s.center[i]!, `${s.id} center axis ${i}`).toBeLessThanOrEqual(s.max[i]! + 1e-6)
      }
      expect(Number.isInteger(s.triangles) && s.triangles > 0, `${s.id} triangles`).toBe(true)
      expect(Array.isArray(s.sourceObjects), s.id).toBe(true)
    }
    for (const s of m.structures) {
      if (s.parent != null) {
        expect(ids.has(s.parent), `${s.id} parent ${s.parent}`).toBe(true)
        expect(s.parent, s.id).not.toBe(s.id)
      }
    }
  })

  it('contains the structure ids the application relies on, mapped to their regions', () => {
    const byId = new Map(m.structures.map((s) => [s.id, s]))
    const want: Record<(typeof REQUIRED_STRUCTURE_IDS)[number], BodyRegionId> = {
      skin: 'skin',
      heart: 'heart',
      'lung-left': 'lungs',
      'lung-right': 'lungs',
      brain: 'brain',
      'kidney-left': 'kidneys',
      'kidney-right': 'kidneys',
    }
    for (const id of REQUIRED_STRUCTURE_IDS) {
      const s = byId.get(id)
      expect(s, `required structure ${id}`).toBeDefined()
      expect(regionOfStructure(s!), id).toBe(want[id])
    }
    // Kidneys come from AHI code: the upstream kidney model is not redistributable.
    for (const id of ['kidney-left', 'kidney-right']) {
      expect(byId.get(id)!.origin, id).toBe('ahi-procedural')
      expect(byId.get(id)!.system, id).toBe('urinary')
      expect(byId.get(id)!.tissue, id).toBe('kidney')
    }
    expect(byId.get('kidney-left')!.side).toBe('L')
    expect(byId.get('kidney-right')!.side).toBe('R')
  })

  it('gives paired structures the side their id names', () => {
    const wrong: string[] = []
    for (const s of m.structures) {
      const named = /(^|-)left(-|$)/.test(s.id) ? 'L' : /(^|-)right(-|$)/.test(s.id) ? 'R' : null
      if (named === null) continue
      if (s.side === named) continue
      wrong.push(`${s.id} (side ${String(s.side)}, id says ${named})`)
    }
    expect(wrong).toEqual([])
    // A side is only ever L or R, and x follows it: the atlas faces +Z, so the body's left is on +X.
    for (const s of m.structures) {
      if (s.side === 'L') expect(s.center[0], `${s.id} is on the left, x should be positive`).toBeGreaterThan(-0.02)
      if (s.side === 'R') expect(s.center[0], `${s.id} is on the right, x should be negative`).toBeLessThan(0.02)
    }
  })

  it('maps the real structures by the health rules', () => {
    for (const s of m.structures) {
      const region = regionOfStructure(s)
      for (const code of relatedMetrics(s)) expect(METRIC_CATALOG[code].region, `${s.id} ${code}`).toBe(region)
      if (s.system === 'digestive' || s.system === 'other') expect(region, s.id).toBeNull()
      if (s.system === 'urinary') expect(region, s.id).toBe(s.tissue === 'kidney' ? 'kidneys' : null)
      if (s.system === 'nervous') {
        expect(region, s.id).toBe(isBrainStructure(s) ? 'brain' : null)
        // The spinal cord and nerves are context only, whatever material class they carry.
        if (/(^|-)(spinal|nerve|nerves|plexus|ganglion|ganglia)(-|$)/.test(s.id)) expect(region, s.id).toBeNull()
      }
      if (region === 'brain') expect(s.system, s.id).toBe('nervous')
      if (region === 'kidneys') expect(s.tissue, s.id).toBe('kidney')
    }
    // Every monitored region can be reached from the atlas, and the single organ regions have a primary structure.
    for (const r of REGIONS) expect(structuresOfRegion(m, r).length, r).toBeGreaterThan(0)
    expect(primaryStructureOfRegion(m, 'heart')?.id).toBe('heart')
    expect(primaryStructureOfRegion(m, 'brain')?.id).toBe('brain')
    expect(primaryStructureOfRegion(m, 'skin')?.id).toBe('skin')
    expect(primaryStructureOfRegion(m, 'lungs')).not.toBeNull()
    expect(primaryStructureOfRegion(m, 'kidneys')).not.toBeNull()
  })

  it('has one file entry per system in use, with consistent counts', () => {
    const systemIds = m.systems.map((f) => f.id)
    expect(new Set(systemIds).size, 'duplicate system entries').toBe(systemIds.length)
    expect(new Set(m.systems.map((f) => f.file)).size, 'duplicate file names').toBe(m.systems.length)
    for (const f of m.systems) {
      expect(SYSTEMS, f.file).toContain(f.id)
      expect(f.label.trim().length, f.id).toBeGreaterThan(0)
      expect(f.file, f.id).toMatch(/^[a-z0-9._-]+\.glb$/)
      const list = m.structures.filter((s) => s.system === f.id)
      expect(f.structureCount, `${f.id} structureCount`).toBe(list.length)
      expect(f.structureCount, `${f.id} is empty`).toBeGreaterThan(0)
      expect(
        f.triangles,
        `${f.id} triangles`,
      ).toBe(list.reduce((n, s) => n + s.triangles, 0))
      expect(Number.isInteger(f.bytes) && f.bytes > 0, `${f.id} bytes`).toBe(true)
    }
    for (const s of m.structures) expect(systemIds, `${s.id} has no file entry for system ${s.system}`).toContain(s.system)
  })

  it('ships every GLB, with one mesh node named after each structure id', () => {
    for (const f of m.systems) {
      const url = new URL(f.file, ATLAS_DIR)
      expect(fs.existsSync(url), `${f.file} is missing`).toBe(true)
      expect(fs.statSync(url).size, `${f.file} size on disk`).toBe(f.bytes)
      const gltf = readGlbJson(fs.readFileSync(url))
      expect(gltf.asset?.version, f.file).toBe('2.0')
      // The app works offline: meshopt only (decoder ships with three), never Draco (CDN decoder).
      const extensions = [...(gltf.extensionsUsed ?? []), ...(gltf.extensionsRequired ?? [])]
      expect(extensions, f.file).not.toContain('KHR_draco_mesh_compression')
      const meshNodes = new Map<string, number>()
      for (const n of gltf.nodes ?? []) {
        if (n.name != null && n.mesh != null) meshNodes.set(n.name, (meshNodes.get(n.name) ?? 0) + 1)
      }
      const missing: string[] = []
      const repeated: string[] = []
      for (const s of m.structures) {
        if (s.system !== f.id) continue
        const count = meshNodes.get(s.id) ?? 0
        if (count === 0) missing.push(s.id)
        else if (count > 1) repeated.push(s.id)
      }
      expect(missing, `${f.file}: structures without a mesh node`).toEqual([])
      expect(repeated, `${f.file}: structures with more than one mesh node`).toEqual([])
    }
  })
})
