/**
 * Validates the published anatomy atlas (public/anatomy) against the AtlasManifest contract.
 * It parses the GLB containers directly (JSON chunk only, no decoder), so it is independent
 * from the tools that wrote them.
 *
 * Usage: node scripts/anatomy/validate.mjs [dir]   (default: public/anatomy)
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(process.argv[2] ?? join(here, '..', '..', 'public', 'anatomy'))

const REQUIRED = ['skin', 'heart', 'lung-left', 'lung-right', 'brain', 'kidney-left', 'kidney-right']
const SYSTEMS = ['integumentary', 'skeletal', 'muscular', 'cardiovascular', 'respiratory', 'nervous', 'digestive', 'urinary', 'other']
const TISSUES = ['skin', 'bone', 'cartilage', 'tooth', 'muscle', 'tendon', 'heart', 'artery', 'vein', 'lung', 'airway', 'brain', 'nerve', 'liver', 'kidney', 'gut', 'gland', 'eye', 'organ']
const TOTAL_BYTES_CEILING = 16 * 1048576
const FILE_BYTES_SOFT = 4 * 1048576

const errors = []
const warnings = []
const fail = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

function readGlbJson(path) {
  const buf = readFileSync(path)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB file')
  if (buf.readUInt32LE(4) !== 2) throw new Error('not glTF 2.0')
  const len = buf.readUInt32LE(12)
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('first chunk is not JSON')
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'))
}

const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))

const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
if (manifest.version !== 1) fail(`manifest.version is ${manifest.version}, expected 1`)
if (Number.isNaN(Date.parse(manifest.generatedAt))) fail('manifest.generatedAt is not a date')
if (!isVec3(manifest.bounds?.min) || !isVec3(manifest.bounds?.max)) fail('manifest.bounds is malformed')
for (const k of ['name', 'url', 'license', 'sha256', 'retrievedAt']) if (typeof manifest.source?.[k] !== 'string') fail(`manifest.source.${k} is missing`)
if (!Array.isArray(manifest.source?.attribution) || !manifest.source.attribution.length) fail('manifest.source.attribution is empty')
if (!Array.isArray(manifest.source?.excluded) || !manifest.source.excluded.length) fail('manifest.source.excluded is empty')
else if (!manifest.source.excluded.some((e) => e.includes('not related to any monitored metric; neutral reference body'))) fail('manifest.source.excluded does not record the reproductive structures')
if (new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']').test(JSON.stringify(manifest))) fail('manifest contains an en dash or em dash')

// frame: feet on y = 0, centered on x and z, about 1.8 m tall
const b = manifest.bounds
if (Math.abs(b.min[1]) > 0.01) fail(`feet are not on y = 0 (min y ${b.min[1]})`)
if (b.max[1] < 1.6 || b.max[1] > 2.0) fail(`unexpected body height ${b.max[1]}`)
if (Math.abs(b.min[0] + b.max[0]) > 0.03) fail(`body is not centered on x (${b.min[0]} .. ${b.max[0]})`)
if (Math.abs(b.min[2] + b.max[2]) > 0.03) fail(`body is not centered on z (${b.min[2]} .. ${b.max[2]})`)

const ids = new Set()
const byId = new Map()
for (const s of manifest.structures) {
  if (ids.has(s.id)) fail(`duplicate structure id ${s.id}`)
  ids.add(s.id)
  byId.set(s.id, s)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) fail(`structure id ${s.id} is not kebab-case`)
  if (typeof s.name !== 'string' || !s.name) fail(`structure ${s.id} has no name`)
  if (!SYSTEMS.includes(s.system)) fail(`structure ${s.id} has unknown system ${s.system}`)
  if (!TISSUES.includes(s.tissue)) fail(`structure ${s.id} has unknown tissue ${s.tissue}`)
  if (![null, 'L', 'R'].includes(s.side)) fail(`structure ${s.id} has invalid side ${s.side}`)
  if (!isVec3(s.center) || !isVec3(s.min) || !isVec3(s.max)) fail(`structure ${s.id} has malformed bounds`)
  if (!(s.triangles > 0)) fail(`structure ${s.id} has no triangles`)
  if (!Array.isArray(s.sourceObjects) || !s.sourceObjects.length) fail(`structure ${s.id} has no sourceObjects`)
  if (!['z-anatomy', 'ahi-procedural'].includes(s.origin)) fail(`structure ${s.id} has invalid origin ${s.origin}`)
  if (s.side === 'L' && !(s.center[0] > 0)) fail(`left structure ${s.id} is not at x > 0 (center x ${s.center[0]})`)
  if (s.side === 'R' && !(s.center[0] < 0)) fail(`right structure ${s.id} is not at x < 0 (center x ${s.center[0]})`)
  if (/(^|-)left(-|$)/.test(s.id) && s.side !== 'L') fail(`structure ${s.id} is named left but has side ${s.side}`)
  if (/(^|-)right(-|$)/.test(s.id) && s.side !== 'R') fail(`structure ${s.id} is named right but has side ${s.side}`)
  if (s.side === 'L' && !/(^|-)left(-|$)/.test(s.id)) warn(`left structure id ${s.id} does not contain "left"`)
  if (s.side === 'R' && !/(^|-)right(-|$)/.test(s.id)) warn(`right structure id ${s.id} does not contain "right"`)
}
for (const s of manifest.structures) if (s.parent !== undefined && !ids.has(s.parent)) fail(`structure ${s.id} has a missing parent ${s.parent}`)
for (const id of REQUIRED) if (!ids.has(id)) fail(`required structure ${id} is missing`)
for (const id of ['kidney-left', 'kidney-right']) {
  const s = byId.get(id)
  if (s && (s.origin !== 'ahi-procedural' || s.tissue !== 'kidney' || s.system !== 'urinary')) fail(`${id} must be procedural, tissue kidney, system urinary`)
}
for (const s of manifest.structures) {
  if (s.origin === 'z-anatomy' && s.sourceObjects.some((n) => /^(Kidney|Renal pelvis|Cochlea|Vestibule|Incus|Malleus|Stapes)\b/.test(n))) fail(`structure ${s.id} contains an excluded source object`)
  // neutral reference body: no reproductive structure is exported
  if (s.origin === 'z-anatomy' && s.sourceObjects.some((n) => /penis|testi|scrot|prostat|epididym|deferens|seminal|ejaculat|urethra/i.test(n))) fail(`structure ${s.id} contains a reproductive source object`)
  if (/reproductive|genital/.test(s.id)) fail(`structure ${s.id} must not be exported (neutral reference body)`)
}
// the heart sits slightly on the body's left (+x)
const heart = byId.get('heart')
if (heart && !(heart.center[0] > 0)) fail(`heart center x ${heart.center[0]} should be on the left (+x)`)

let totalBytes = 0
let totalTris = 0
const seenSystems = new Set()
for (const sys of manifest.systems) {
  if (seenSystems.has(sys.id)) fail(`duplicate system ${sys.id}`)
  seenSystems.add(sys.id)
  if (!SYSTEMS.includes(sys.id)) fail(`unknown system ${sys.id}`)
  const path = join(dir, sys.file)
  let json
  try {
    json = readGlbJson(path)
  } catch (e) {
    fail(`${sys.file}: ${e.message}`)
    continue
  }
  const bytes = statSync(path).size
  totalBytes += bytes
  totalTris += sys.triangles
  if (bytes !== sys.bytes) fail(`${sys.file}: manifest bytes ${sys.bytes} differ from file size ${bytes}`)
  if (bytes > FILE_BYTES_SOFT) warn(`${sys.file} is ${(bytes / 1048576).toFixed(2)} MB (soft limit 4 MB)`)
  const used = json.extensionsUsed ?? []
  const required = json.extensionsRequired ?? []
  if (!required.includes('EXT_meshopt_compression')) fail(`${sys.file}: EXT_meshopt_compression is not required`)
  if (!used.includes('KHR_mesh_quantization')) fail(`${sys.file}: KHR_mesh_quantization is not used`)
  if (used.includes('KHR_draco_mesh_compression')) fail(`${sys.file}: Draco is not allowed`)
  if (json.cameras?.length) fail(`${sys.file}: contains cameras`)
  if (json.animations?.length) fail(`${sys.file}: contains animations`)
  if (json.skins?.length) fail(`${sys.file}: contains skins`)
  if (json.images?.length || json.textures?.length) fail(`${sys.file}: contains textures`)
  if (json.extensions?.KHR_lights_punctual) fail(`${sys.file}: contains lights`)

  const expected = manifest.structures.filter((s) => s.system === sys.id)
  const meshNodes = new Map()
  for (const node of json.nodes ?? []) {
    if (node.mesh === undefined) continue
    if (meshNodes.has(node.name)) fail(`${sys.file}: duplicate mesh node ${node.name}`)
    meshNodes.set(node.name, node)
    if (node.matrix || node.rotation || node.scale || node.translation) fail(`${sys.file}: node ${node.name} has a transform (must be identity)`)
    if (node.children?.length) fail(`${sys.file}: node ${node.name} has children`)
  }
  let fileTris = 0
  for (const s of expected) {
    const node = meshNodes.get(s.id)
    if (!node) {
      fail(`${sys.file}: no mesh node named ${s.id}`)
      continue
    }
    const mesh = json.meshes[node.mesh]
    let tris = 0
    for (const prim of mesh.primitives) {
      if (prim.mode !== undefined && prim.mode !== 4) fail(`${sys.file}: ${s.id} is not a triangle mesh`)
      if (prim.attributes.POSITION === undefined || prim.attributes.NORMAL === undefined) fail(`${sys.file}: ${s.id} lacks POSITION or NORMAL`)
      if (prim.attributes.TANGENT !== undefined) fail(`${sys.file}: ${s.id} has tangents`)
      const pos = json.accessors[prim.attributes.POSITION]
      const idx = prim.indices !== undefined ? json.accessors[prim.indices] : null
      tris += (idx ? idx.count : pos.count) / 3
      // accessor bounds must agree with the manifest bounds
      for (let k = 0; k < 3; k++) {
        if (pos.min[k] < s.min[k] - 1e-3 || pos.max[k] > s.max[k] + 1e-3) fail(`${sys.file}: ${s.id} accessor bounds exceed the manifest bounds`)
      }
    }
    if (mesh.primitives.length !== 1) warn(`${sys.file}: ${s.id} has ${mesh.primitives.length} primitives (one draw call each)`)
    if (tris !== s.triangles) fail(`${sys.file}: ${s.id} has ${tris} triangles, manifest says ${s.triangles}`)
    fileTris += tris
  }
  for (const name of meshNodes.keys()) if (!expected.some((s) => s.id === name)) fail(`${sys.file}: mesh node ${name} is not in the manifest`)
  if (meshNodes.size !== sys.structureCount) fail(`${sys.file}: structureCount ${sys.structureCount} differs from ${meshNodes.size} mesh nodes`)
  if (fileTris !== sys.triangles) fail(`${sys.file}: triangles ${sys.triangles} differ from the sum of structures ${fileTris}`)
}
for (const s of manifest.structures) if (!seenSystems.has(s.system)) fail(`structure ${s.id} belongs to system ${s.system} which has no file`)
if (totalBytes > TOTAL_BYTES_CEILING) fail(`total size ${(totalBytes / 1048576).toFixed(2)} MB exceeds the 16 MB ceiling`)

const count = manifest.structures.length
console.log(`[validate] ${dir}`)
console.log(`[validate] ${manifest.systems.length} files, ${count} structures, ${totalTris} triangles, ${(totalBytes / 1048576).toFixed(2)} MB`)
for (const w of warnings) console.log('[validate] WARN ' + w)
if (errors.length) {
  for (const e of errors) console.error('[validate] FAIL ' + e)
  console.error(`[validate] ${errors.length} error(s)`)
  process.exit(1)
}
console.log('[validate] OK')
