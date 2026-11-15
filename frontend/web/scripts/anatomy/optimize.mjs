/**
 * AHI anatomy atlas: Node stage of the asset pipeline.
 *
 * Reads the raw GLBs and atlas-meta.json written by export_atlas.py, adds the procedural kidneys,
 * then dedups, welds, prunes, quantizes normals, compresses with meshopt and writes the final
 * files plus manifest.json (the AtlasManifest contract in src/features/anatomy/atlas/types.ts).
 *
 * Usage: node scripts/anatomy/optimize.mjs --raw <raw dir> --out <public/anatomy>
 *
 * Design notes
 * - Mesh nodes keep an identity transform. Positions stay float32, snapped to a 1/16384 m grid
 *   (0.06 mm), so the viewer can move or scale a node freely (heartbeat, breathing) without
 *   fighting a dequantization matrix. Normals are stored as normalized int8
 *   (KHR_mesh_quantization) and every buffer view is meshopt compressed
 *   (EXT_meshopt_compression, no Draco, decoder ships with three.js).
 */
import { mkdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions'
import { dedup, prune, quantize, reorder, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const SOURCE = {
  name: 'Z-Anatomy (Human male model), based on BodyParts3D',
  url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy',
  license: 'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)',
  sha256: 'e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736',
  retrievedAt: '2026-11-14',
  attribution: [
    'Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0 (https://www.z-anatomy.com/)',
    'BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan',
    'Authors: Kousaku Okubo (BodyParts3D), Gauthier Kervyn (design, 3D, anatomy), Marcin Zielinski (Blender add-on), Lluis Vinent (Unity development)',
    'Adapted by the AHI project: structures grouped, decimated, re-oriented and compressed for real time rendering. The derived files are distributed under CC BY-SA 4.0.',
  ],
}

const POSITION_GRID = 16384 // positions snap to 1/16384 m

function args() {
  const a = process.argv.slice(2)
  const o = {}
  for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = a[i + 1]
  if (!o.raw || !o.out) throw new Error('Usage: node optimize.mjs --raw <raw dir> --out <output dir>')
  return { raw: resolve(o.raw), out: resolve(o.out) }
}

const r5 = (v) => Math.round(v * 1e5) / 1e5

/** Fits a procedural kidney (own geometry) to the center and size of an atlas bounding box. */
function fitKidney(kidney, box) {
  const scale = [0, 1, 2].map((k) => (box.max[k] - box.min[k]) / (kidney.max[k] - kidney.min[k]))
  const n = kidney.position.length / 3
  const position = new Float32Array(n * 3)
  const normal = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    let len = 0
    for (let k = 0; k < 3; k++) {
      position[i * 3 + k] = box.min[k] + (kidney.position[i * 3 + k] - kidney.min[k]) * scale[k]
      const nk = kidney.normal[i * 3 + k] / scale[k] // inverse transpose of a diagonal scale
      normal[i * 3 + k] = nk
      len += nk * nk
    }
    len = Math.sqrt(len) || 1
    for (let k = 0; k < 3; k++) normal[i * 3 + k] /= len
  }
  return { position, normal, index: new Uint32Array(kidney.index) }
}

function addKidneys(doc, meta, kidneys, structures) {
  const scene = doc.getRoot().listScenes()[0]
  const buffer = doc.getRoot().listBuffers()[0]
  const material = doc.createMaterial('tissue-kidney').setBaseColorFactor([0.55, 0.26, 0.22, 1]).setRoughnessFactor(0.6).setMetallicFactor(0)
  for (const side of ['left', 'right']) {
    const box = meta.kidneyBoxes[side]
    if (!box) throw new Error(`atlas-meta.json has no kidney bounding box for the ${side} side`)
    const geo = fitKidney(kidneys[side], box)
    const id = `kidney-${side}`
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(geo.position).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(geo.normal).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(geo.index).setBuffer(buffer))
      .setMaterial(material)
    scene.addChild(doc.createNode(id).setMesh(doc.createMesh(id).addPrimitive(prim)))
    structures.push({
      id,
      name: side === 'left' ? 'Left kidney' : 'Right kidney',
      system: 'urinary',
      tissue: 'kidney',
      side: side === 'left' ? 'L' : 'R',
      parent: null,
      origin: 'ahi-procedural',
      sourceObjects: [`AHI procedural kidney (${kidneys.generator.replace(/^AHI procedural kidney \(|\)$/g, '')}), fitted to the bounding box of Z-Anatomy "Kidney.${side[0]}"`],
    })
  }
}

/** Snaps float positions to the grid so the meshopt codec sees short mantissas. */
function snapPositions(doc) {
  const seen = new Set()
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const acc = prim.getAttribute('POSITION')
      if (!acc || seen.has(acc)) continue
      seen.add(acc)
      const arr = acc.getArray()
      const out = new Float32Array(arr.length)
      for (let i = 0; i < arr.length; i++) out[i] = Math.round(arr[i] * POSITION_GRID) / POSITION_GRID
      acc.setArray(out)
    }
  }
}

function measure(node) {
  const mesh = node.getMesh()
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  let triangles = 0
  const m = node.getWorldMatrix()
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    const v = [0, 0, 0]
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v)
      const w = [
        m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
        m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
        m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
      ]
      for (let k = 0; k < 3; k++) {
        if (w[k] < min[k]) min[k] = w[k]
        if (w[k] > max[k]) max[k] = w[k]
      }
    }
    const idx = prim.getIndices()
    triangles += (idx ? idx.getCount() : pos.getCount()) / 3
  }
  return { min: min.map(r5), max: max.map(r5), center: min.map((v, k) => r5((v + max[k]) / 2)), triangles }
}

async function main() {
  const { raw, out } = args()
  const meta = JSON.parse(readFileSync(join(raw, 'atlas-meta.json'), 'utf8'))
  const kidneysPath = join(raw, 'kidneys.json')
  const kidneys = existsSync(kidneysPath) ? JSON.parse(readFileSync(kidneysPath, 'utf8')) : null
  mkdirSync(out, { recursive: true })

  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })

  const structures = meta.structures.map((s) => ({ ...s }))
  const measured = new Map()
  const systems = []

  for (const sys of meta.systems) {
    const doc = await io.read(join(raw, sys.file))
    if (sys.id === 'urinary') {
      if (!kidneys) throw new Error('kidneys.json is missing: run build-kidneys.ts first')
      addKidneys(doc, meta, kidneys, structures)
    }
    await doc.transform(dedup(), weld(), prune({ keepAttributes: false, keepLeaves: false }))
    snapPositions(doc)
    await doc.transform(
      reorder({ encoder: MeshoptEncoder, target: 'size' }),
      quantize({ pattern: /^(?!POSITION$).*$/, quantizeNormal: 8 }),
    )
    // int8 normals need KHR_mesh_quantization. quantize() only declares it when POSITION is
    // quantized too, so it is declared here explicitly.
    doc.createExtension(KHRMeshQuantization).setRequired(true)
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })

    let triangles = 0
    let count = 0
    for (const node of doc.getRoot().listNodes()) {
      if (!node.getMesh()) continue
      const name = node.getName()
      if (measured.has(name)) throw new Error(`Duplicate node name ${name}`)
      const m = measure(node)
      measured.set(name, { ...m, system: sys.id })
      triangles += m.triangles
      count++
    }
    const file = join(out, sys.file)
    await io.write(file, doc)
    systems.push({ id: sys.id, label: sys.label, file: sys.file, bytes: statSync(file).size, triangles, structureCount: count })
  }

  const outStructures = []
  for (const s of structures) {
    const m = measured.get(s.id)
    if (!m) throw new Error(`Structure ${s.id} has no mesh node in ${s.system}.glb`)
    if (m.system !== s.system) throw new Error(`Structure ${s.id} is in ${m.system}.glb, expected ${s.system}.glb`)
    const entry = {
      id: s.id, name: s.name, system: s.system, tissue: s.tissue, side: s.side ?? null,
      center: m.center, min: m.min, max: m.max, triangles: m.triangles,
      sourceObjects: s.sourceObjects, origin: s.origin,
    }
    if (s.parent) entry.parent = s.parent
    outStructures.push(entry)
  }
  const ids = new Set(outStructures.map((s) => s.id))
  for (const name of measured.keys()) if (!ids.has(name)) throw new Error(`Mesh node ${name} has no manifest structure`)
  for (const s of outStructures) if (s.parent && !ids.has(s.parent)) throw new Error(`Structure ${s.id} points to a missing parent ${s.parent}`)

  const order = new Map(systems.map((s, i) => [s.id, i]))
  outStructures.sort((a, b) => order.get(a.system) - order.get(b.system) || a.id.localeCompare(b.id))

  const bmin = [Infinity, Infinity, Infinity]
  const bmax = [-Infinity, -Infinity, -Infinity]
  for (const s of outStructures) for (let k = 0; k < 3; k++) { bmin[k] = Math.min(bmin[k], s.min[k]); bmax[k] = Math.max(bmax[k], s.max[k]) }

  const ex = meta.excludedObjects ?? {}
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    bounds: { min: bmin.map(r5), max: bmax.map(r5) },
    source: {
      ...SOURCE,
      excluded: [
        `Ear structures (internal ear, auditory ossicles, tympanic membrane, auditory tube, cochlear and vestibular nerves): the upstream model "Anatomy of the Inner Ear" by University of Dundee School of Medicine is CC BY-NC-SA 4.0 (non commercial). Objects: ${(ex['inner ear'] ?? []).join(', ')}`,
        `Kidney, renal pelvis and intrarenal vessel objects: the upstream model "Kidney" by Lissie Cowley is CC BY-NC 4.0 (non commercial). Replaced by AHI procedural kidneys (origin "ahi-procedural") fitted to the atlas bounding boxes. Objects: ${(ex.kidney ?? []).join(', ')}`,
        `Reproductive structures: not related to any monitored metric; neutral reference body. The atlas stands for every crew member, so the internal and external genital organs, the vessels, nerves and ducts that only serve them and the urethra are not exported, and the external genital region of the body surface (${(meta.neutralSkinObjects ?? []).join(', ')}) is replaced by a smooth neutral surface inside the "skin" structure. Objects: ${(ex.reproductive ?? []).join(', ')}`,
        'Not physical bodies: text labels, label leader lines (.j, .i), group titles (.g), muscle origin and insertion maps (.o*, .e*, collection "2: Muscular insertions"), reference lines and planes, cross section planes, objects that exist only in the "Bonus collection".',
        'Left out for clarity and draw call budget: lymph nodes, tonsils, fasciae, bursae, tendon sheaths, ligaments, joint capsules and membranes, meninges, pleura, peritoneum and omenta, ventricles and other cavities, hair, liver segments, small brainstem nuclei, inner white matter surface of the cerebrum.',
      ],
    },
    systems,
    structures: outStructures,
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n')

  // report
  const pad = (s, n) => String(s).padEnd(n)
  const padL = (s, n) => String(s).padStart(n)
  let bytes = 0
  let tris = 0
  console.log('\n' + pad('system', 16) + padL('structures', 11) + padL('triangles', 11) + padL('bytes', 11) + padL('MB', 7))
  for (const s of systems) {
    bytes += s.bytes
    tris += s.triangles
    console.log(pad(s.id, 16) + padL(s.structureCount, 11) + padL(s.triangles, 11) + padL(s.bytes, 11) + padL((s.bytes / 1048576).toFixed(2), 7))
  }
  console.log(pad('TOTAL', 16) + padL(outStructures.length, 11) + padL(tris, 11) + padL(bytes, 11) + padL((bytes / 1048576).toFixed(2), 7))
  console.log(`bounds min ${manifest.bounds.min.join(', ')} max ${manifest.bounds.max.join(', ')}`)
  console.log(`manifest: ${join(out, 'manifest.json')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
