/**
 * Builds the two kidneys from AHI's own procedural geometry and writes them as plain JSON for
 * optimize.mjs.
 *
 * The Z-Anatomy kidney meshes are not redistributable (upstream CC BY-NC 4.0), so the atlas only
 * contributes the bounding boxes of its kidneys; the geometry written here is AHI code output.
 *
 * It reuses the signed distance field toolkit of the procedural viewer (sdf.ts, simplify.ts,
 * vec.ts) and the same kidney definition as `kidneyPrims` in organs.ts: a tilted ellipsoid with a
 * smooth hilum notch on the medial side. The adrenal cap of the procedural model is left out,
 * because the atlas already has the adrenal glands as separate structures.
 *
 * Usage: tsx scripts/anatomy/build-kidneys.ts <out.json>
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type V3 = [number, number, number]
type Basis = [V3, V3, V3]
interface MeshData {
  position: Float32Array
  normal: Float32Array
  index: Uint32Array
}
interface Prim {
  op: 0 | 1
  k: number
}
interface Shape {
  min: V3
  max: V3
}

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..', '..')
const candidates = ['src/features/anatomy/procedural/geometry', 'src/features/anatomy/geometry']
const geometryDir = candidates.map((p) => resolve(webRoot, p)).find((p) => existsSync(join(p, 'sdf.ts')))
if (!geometryDir) throw new Error(`Procedural geometry toolkit not found (looked for ${candidates.join(', ')})`)

const out = process.argv[2]
if (!out) throw new Error('Usage: tsx scripts/anatomy/build-kidneys.ts <out.json>')

const load = (file: string) => import(pathToFileURL(join(geometryDir, file)).href)
const sdf = (await load('sdf.ts')) as {
  U: (s: Shape, k?: number) => Prim
  S: (s: Shape, k?: number) => Prim
  ellipsoid: (c: V3, r: V3, basis?: Basis) => Shape
  sphere: (c: V3, r: number) => Shape
}
const simplify = (await load('simplify.ts')) as { polygonizeLite: (prims: Prim[], h: number, tol?: number) => MeshData }
const vec = (await load('vec.ts')) as {
  norm: (a: V3) => V3
  cross: (a: V3, b: V3) => V3
  at: (base: V3, ...terms: [V3, number][]) => V3
  basisFromY: (dir: V3, hintZ?: V3) => Basis
}
const organs = (await load('organs.ts')) as { KIDNEY_CENTERS: [V3, V3] }

/** Same definition as kidneyPrims in organs.ts, without the adrenal cap. s = -1 right, +1 left. */
function kidneyPrims(c: V3, s: number): Prim[] {
  const ax = vec.norm([-s * 0.26, 1, -0.08]) // long axis, upper pole tilted toward the spine
  const m = vec.norm([-s, 0, 0.45]) // medial and slightly anterior: where the hilum opens
  const B = vec.basisFromY(ax, vec.cross(m, ax))
  return [sdf.U(sdf.ellipsoid(c, [0.026, 0.054, 0.019], B)), sdf.S(sdf.sphere(vec.at(c, [m, 0.031]), 0.0165), 0.012)]
}

function pack(m: MeshData) {
  const min: V3 = [Infinity, Infinity, Infinity]
  const max: V3 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < m.position.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], m.position[i + k])
      max[k] = Math.max(max[k], m.position[i + k])
    }
  }
  return { position: Array.from(m.position), normal: Array.from(m.normal), index: Array.from(m.index), min, max }
}

const [a, b] = organs.KIDNEY_CENTERS
const leftCenter = a[0] > b[0] ? a : b
const rightCenter = a[0] > b[0] ? b : a
const STEP = 0.0016 // grid step of the polygonizer, meters
const TOLERANCE = 0.00012 // decimation tolerance, meters
const result = {
  generator: `AHI procedural kidney (signed distance field, ${geometryDir.slice(webRoot.length + 1).replace(/\\/g, '/')})`,
  left: pack(simplify.polygonizeLite(kidneyPrims(leftCenter, 1), STEP, TOLERANCE)),
  right: pack(simplify.polygonizeLite(kidneyPrims(rightCenter, -1), STEP, TOLERANCE)),
}
if (!(result.left.min[0] > 0) || !(result.right.max[0] < 0)) throw new Error('Kidney sides are not where they should be')
mkdirSync(dirname(resolve(out)), { recursive: true })
writeFileSync(resolve(out), JSON.stringify(result))
console.log(`[kidneys] left ${result.left.index.length / 3} triangles, right ${result.right.index.length / 3} triangles -> ${out}`)
