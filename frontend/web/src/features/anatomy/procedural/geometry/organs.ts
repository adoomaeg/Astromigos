/** Internal organs as signed distance fields plus tube structures (bronchi, optic nerves, ureters, bowel). */
import type { MeshData, Prim } from './sdf.ts'
import { S, U, capsule, custom, displaced, ellipsoid, evalList, group, loft, roundCone, sphere } from './sdf.ts'
import { polygonizeLite } from './simplify.ts'
import { merge, perlin, tube, uvSphere } from './mesh.ts'
import type { V3 } from './vec.ts'
import { add, at, basisFromY, cross, dot, mul, norm, rng, smoothstep, sub } from './vec.ts'

// ---------------------------------------------------------------------------
// Landmarks (male frame; the whole model is scaled for the female variant)
// ---------------------------------------------------------------------------

export const HEART_CENTER: V3 = [0.014, 1.298, 0.04]
export const LUNG_PIVOT: V3 = [0, 1.47, -0.01]
export const EYE_CENTERS: [V3, V3] = [
  [-0.031, 1.645, 0.071],
  [0.031, 1.645, 0.071],
]
export const EYE_R = 0.0115

// ---------------------------------------------------------------------------
// Brain
// ---------------------------------------------------------------------------

function brainPrims(detail: boolean): Prim[] {
  const cer: Prim[] = [
    U(ellipsoid([0, 1.681, 0.022], [0.058, 0.046, 0.054])),
    U(ellipsoid([0, 1.686, -0.03], [0.064, 0.05, 0.062]), 0.03),
    U(ellipsoid([-0.05, 1.648, 0.004], [0.02, 0.022, 0.042]), 0.016),
    U(ellipsoid([0.05, 1.648, 0.004], [0.02, 0.022, 0.042]), 0.016),
    S(custom((x, y) => Math.max(Math.abs(x) - 0.0019, 1.66 - y), [-0.003, 1.65, -0.1], [0.003, 1.75, 0.09]), 0.004),
  ]
  const cerebrum = group(cer)
  const gyri = (x: number, y: number, z: number) => {
    const n = perlin(x * 48, y * 48, z * 48) + 0.45 * perlin(x * 95 + 7.1, y * 95 + 3.3, z * 95 + 1.7)
    return 0.0038 * (1 - smoothstep(0.0, 0.2, Math.abs(n))) - 0.0008
  }
  const cbl = ellipsoid([0, 1.633, -0.057], [0.047, 0.024, 0.03])
  const folia = (_x: number, y: number, z: number) => 0.0012 * Math.sin((y * 0.8 - z * 0.3) * 900)
  return [
    U(detail ? displaced(cerebrum, gyri, 0.004) : cerebrum),
    U(detail ? displaced(cbl, folia, 0.0015) : cbl, 0.005),
    U(roundCone([0, 1.648, -0.022], [0, 1.586, -0.028], 0.013, 0.009), 0.008),
  ]
}

export function buildBrain(): MeshData {
  return polygonizeLite(brainPrims(true), 0.0023, 0.00032, { lipschitz: 4 })
}

// ---------------------------------------------------------------------------
// Eyes (spheres) with optic nerves to the chiasm
// ---------------------------------------------------------------------------

export function buildEyes(): MeshData {
  const parts: MeshData[] = []
  for (const c of EYE_CENTERS) {
    parts.push(uvSphere(c, EYE_R, 28))
    const s = Math.sign(c[0])
    parts.push(tube([at(c, [[0, 0, 1], -0.01]), [s * 0.022, 1.643, 0.045], [s * 0.008, 1.64, 0.026], [0, 1.638, 0.02]], { r: 0.0021, radial: 6, density: 200 }))
  }
  return merge(parts)
}

// ---------------------------------------------------------------------------
// Heart
// ---------------------------------------------------------------------------

function heartPrims(): Prim[] {
  const C = HEART_CENTER
  const a = norm([0.55, -0.62, 0.5])
  const B = basisFromY(a, [0, 0, 1])
  const apex = at(C, [a, 0.062])
  const base = at(C, [a, -0.024])
  const o = (dx: number, dy: number, dz: number): V3 => [C[0] + dx, C[1] + dy, C[2] + dz]
  return [
    U(roundCone(base, apex, 0.042, 0.013)),
    U(ellipsoid(at(C, [a, 0.012]), [0.044, 0.05, 0.037], B), 0.02),
    U(ellipsoid(o(-0.012, -0.004, 0.026), [0.035, 0.044, 0.021], B), 0.015),
    U(sphere(o(-0.038, 0.022, 0.0), 0.026), 0.016),
    U(sphere(o(0.004, 0.03, -0.03), 0.024), 0.016),
    U(ellipsoid(o(0.034, 0.033, 0.012), [0.012, 0.009, 0.016]), 0.01),
    U(ellipsoid(o(-0.03, 0.036, 0.022), [0.012, 0.01, 0.014]), 0.01),
    U(capsule(o(-0.004, 0.02, 0.004), o(-0.006, 0.064, 0.006), 0.013), 0.012),
    U(capsule(o(0.008, 0.018, 0.028), o(0.018, 0.06, 0.012), 0.0115), 0.01),
    U(capsule(o(-0.036, 0.03, 0.0), o(-0.036, 0.088, -0.004), 0.0098), 0.01),
    U(capsule(o(-0.03, -0.01, -0.02), o(-0.03, -0.052, -0.025), 0.0105), 0.01),
    // anterior interventricular groove (subtle)
    S(capsule(o(0.006, 0.016, 0.05), at(apex, [[0, 0, 1], 0.006], [[-1, 0, 0], 0.004]), 0.0032), 0.006),
  ]
}

/** Coronary arteries draped over the heart surface (projected onto the field). */
function coronaries(prims: Prim[]): MeshData {
  const C = HEART_CENTER
  const project = (p: V3): V3 => {
    let q = p
    for (let i = 0; i < 6; i++) {
      const d = evalList(prims, q[0], q[1], q[2])
      const e = 0.0008
      const g = norm([
        evalList(prims, q[0] + e, q[1], q[2]) - evalList(prims, q[0] - e, q[1], q[2]),
        evalList(prims, q[0], q[1] + e, q[2]) - evalList(prims, q[0], q[1] - e, q[2]),
        evalList(prims, q[0], q[1], q[2] + e) - evalList(prims, q[0], q[1], q[2] - e),
      ])
      q = sub(q, mul(g, d - 0.0012))
    }
    return q
  }
  const path = (pts: V3[]) => tube(pts.map((p) => project(add(C, p))), { r: 0.0019, radial: 5, density: 220, cap: 0.002 })
  return merge([
    path([[0.0, 0.03, 0.03], [0.01, 0.01, 0.05], [0.025, -0.02, 0.06], [0.04, -0.045, 0.06], [0.05, -0.06, 0.045]]),
    path([[-0.005, 0.03, 0.025], [-0.03, 0.015, 0.035], [-0.045, -0.01, 0.025], [-0.04, -0.04, 0.0], [-0.015, -0.05, -0.02]]),
    path([[0.01, 0.03, 0.0], [0.035, 0.02, -0.015], [0.05, -0.005, -0.015], [0.06, -0.03, 0.0]]),
  ])
}

export function buildHeart(): MeshData {
  const prims = heartPrims()
  return merge([polygonizeLite(prims, 0.0022, 0.0003), coronaries(prims)])
}

// ---------------------------------------------------------------------------
// Lungs (right lung 3 lobes, left lung 2 lobes with cardiac notch)
// ---------------------------------------------------------------------------

function lungPrims(s: number, detail: boolean): Prim[] {
  const k = (y: number, rx: number, rz: number, cx: number, cz: number) => ({ y, rx, rz, cx: s * cx, cz })
  const keys = [
    k(1.476, 0.016, 0.018, 0.045, -0.016),
    k(1.455, 0.032, 0.037, 0.051, -0.013),
    k(1.405, 0.05, 0.06, 0.061, -0.008),
    k(1.335, 0.061, 0.077, 0.071, -0.004),
    k(1.275, 0.066, 0.086, 0.077, -0.006),
    k(1.22, 0.066, 0.086, 0.081, -0.013),
    k(1.18, 0.058, 0.072, 0.085, -0.03),
  ]
  const L = loft(keys)
  const p: Prim[] = [U(L)]
  p.push(S(sphere([s * 0.07, 1.098, 0.022], 0.132), 0.02))
  p.push(S(custom((x) => Math.abs(x) - 0.024, [-0.024, 1.15, -0.12], [0.024, 1.5, 0.12]), 0.012))
  if (s > 0) p.push(S(ellipsoid([0.026, 1.288, 0.05], [0.058, 0.064, 0.05]), 0.016))
  else p.push(S(ellipsoid([-0.02, 1.3, 0.038], [0.034, 0.05, 0.04]), 0.014))
  if (detail) {
    // oblique fissure: plane from posterior T4 down to anterior 6th rib
    const n = norm([0, 0.59, 0.81])
    const p0: V3 = [0, 1.36, -0.08]
    const gw = 0.0024
    const oblique = (x: number, y: number, z: number) => (x - p0[0]) * n[0] + (y - p0[1]) * n[1] + (z - p0[2]) * n[2]
    p.push(S(custom((x, y, z) => Math.abs(oblique(x, y, z)) - gw, L.min, L.max), 0.004))
    if (s < 0) {
      p.push(S(custom((x, y, z) => Math.max(Math.abs(y - 1.3) - gw, -oblique(x, y, z)), L.min, L.max), 0.004))
    }
  }
  return p
}

export function lungField(s: number): (x: number, y: number, z: number) => number {
  const prims = lungPrims(s, false)
  return (x, y, z) => evalList(prims, x, y, z)
}

export function buildLung(s: number): MeshData {
  return polygonizeLite(lungPrims(s, true), 0.003, 0.0005)
}

/** Bronchial tree grown inside the lung fields (deterministic). */
export function buildBronchi(): MeshData {
  const parts: MeshData[] = []
  const rand = rng(42)
  const carina: V3 = [0, 1.37, 0.004]
  parts.push(tube([[0, 1.535, 0.036], [0, 1.47, 0.026], [0, 1.41, 0.012], carina], { r: 0.0078, radial: 10, density: 120 }))
  const fields = [lungField(-1), lungField(1)]
  const grow = (p: V3, dir: V3, length: number, r: number, gen: number, field: (x: number, y: number, z: number) => number) => {
    if (gen > 5) return
    const kids = gen < 2 ? 2 : rand() < 0.75 ? 2 : 1
    for (let c = 0; c < kids; c++) {
      let best: V3 | null = null
      let bestDir: V3 = dir
      for (let tries = 0; tries < 10; tries++) {
        const rnd = norm([rand() - 0.5, rand() - 0.5, rand() - 0.5])
        const perp = norm(sub(rnd, mul(dir, dot(rnd, dir))))
        const spread = 0.55 + rand() * 0.35
        const d = norm(add(add(dir, mul(perp, spread)), [0, -0.12, 0]))
        const end = at(p, [d, length])
        if (field(end[0], end[1], end[2]) < -0.008) {
          best = end
          bestDir = d
          break
        }
      }
      if (!best) continue
      const mid = add(at(p, [bestDir, length * 0.5]), mul(norm(cross(bestDir, [0, 1, 0.3])), length * 0.06 * (rand() - 0.5)))
      parts.push(tube([p, mid, best], { r: (t: number) => r * (1 - 0.25 * t), radial: gen > 3 ? 4 : 6, density: 140, cap: gen === 5 ? r * 2 : 0 }))
      grow(best, bestDir, length * (0.74 + rand() * 0.08), r * 0.7, gen + 1, field)
    }
  }
  for (const s of [-1, 1]) {
    const end: V3 = s < 0 ? [-0.048, 1.33, -0.004] : [0.058, 1.322, -0.01]
    const mainPath: V3[] = s < 0 ? [carina, [-0.026, 1.35, 0.0], end] : [carina, [0.03, 1.355, -0.002], end]
    parts.push(tube(mainPath, { r: 0.0058, radial: 8, density: 140 }))
    const f = fields[s < 0 ? 0 : 1]!
    grow(end, norm([s * 0.5, 0.15, 0]), 0.045, 0.0042, 1, f)
    grow(end, norm([s * 0.35, -0.8, 0.05]), 0.05, 0.0045, 1, f)
    grow(end, norm([s * 0.4, -0.5, -0.5]), 0.045, 0.004, 2, f)
  }
  return merge(parts)
}

// ---------------------------------------------------------------------------
// Kidneys (T12 to L3, posterior), adrenals and ureters
// ---------------------------------------------------------------------------

export const KIDNEY_CENTERS: [V3, V3] = [
  [-0.058, 1.102, -0.052],
  [0.058, 1.118, -0.052],
]

function kidneyPrims(c: V3, s: number): Prim[] {
  const ax = norm([-s * 0.26, 1, -0.08])
  const m = norm([-s, 0, 0.45])
  const B = basisFromY(ax, cross(m, ax))
  return [
    U(ellipsoid(c, [0.026, 0.054, 0.019], B)),
    S(sphere(at(c, [m, 0.031]), 0.0165), 0.012),
    U(ellipsoid(at(c, [ax, 0.056], [m, 0.006]), [0.017, 0.011, 0.007], B), 0.006),
  ]
}

export function buildKidneys(): MeshData {
  const parts: MeshData[] = []
  KIDNEY_CENTERS.forEach((c, i) => {
    const s = i === 0 ? -1 : 1
    parts.push(polygonizeLite(kidneyPrims(c, s), 0.0022, 0.0003))
    const m = norm([-s, 0, 0.45])
    const hil = at(c, [m, 0.014], [[0, 1, 0], -0.006])
    parts.push(tube([hil, at(hil, [m, 0.01], [[0, 1, 0], -0.02]), [s * 0.042, 1.0, -0.035], [s * 0.05, 0.94, 0.0], [s * 0.022, 0.9, 0.035]], { r: 0.0022, radial: 5, density: 120 }))
  })
  return merge(parts)
}

// ---------------------------------------------------------------------------
// Context organs: liver, stomach, spleen, bowel, bladder (visual realism only)
// ---------------------------------------------------------------------------

export function buildContext(): MeshData {
  const liverCut = (x: number, y: number) => (y - (1.122 + 0.26 * (x + 0.14))) / 1.033
  const liver: Prim[] = [
    U(ellipsoid([-0.045, 1.178, 0.022], [0.098, 0.056, 0.075])),
    U(ellipsoid([0.024, 1.192, 0.045], [0.052, 0.03, 0.045]), 0.03),
    S(custom((x, y) => liverCut(x, y), [-0.16, 1.05, -0.07], [0.09, 1.25, 0.11]), 0.016),
  ]
  const stomach: Prim[] = [
    U(sphere([0.062, 1.205, 0.002], 0.031)),
    U(roundCone([0.066, 1.198, 0.016], [0.06, 1.132, 0.046], 0.032, 0.029), 0.02),
    U(roundCone([0.06, 1.132, 0.046], [0.012, 1.12, 0.056], 0.029, 0.016), 0.02),
    U(capsule([0.012, 1.12, 0.056], [-0.016, 1.126, 0.045], 0.011), 0.01),
  ]
  const spleen: Prim[] = [U(ellipsoid([0.105, 1.19, -0.045], [0.02, 0.045, 0.03], basisFromY([0.3, 1, -0.3])))]
  const bladder: Prim[] = [U(ellipsoid([0, 0.902, 0.042], [0.034, 0.028, 0.03]))]
  const parts: MeshData[] = [polygonizeLite(liver, 0.004, 0.0006), polygonizeLite(stomach, 0.0035, 0.0006), polygonizeLite(spleen, 0.004, 0.0006), polygonizeLite(bladder, 0.004, 0.0006)]
  // large intestine with haustra
  const colon: V3[] = [
    [-0.072, 0.965, 0.035],
    [-0.085, 1.02, 0.03],
    [-0.088, 1.075, 0.025],
    [-0.078, 1.108, 0.04],
    [-0.04, 1.092, 0.07],
    [0.0, 1.078, 0.076],
    [0.042, 1.092, 0.07],
    [0.085, 1.128, 0.012],
    [0.094, 1.07, 0.005],
    [0.088, 0.995, 0.018],
    [0.06, 0.952, 0.032],
    [0.02, 0.935, 0.01],
    [0.0, 0.905, -0.035],
  ]
  parts.push(tube(colon, { r: (t: number) => 0.0165 * (0.88 + 0.12 * Math.abs(Math.sin(t * 90))) * (t > 0.85 ? 0.8 : 1), radial: 10, density: 260, cap: 0.01 }))
  // small intestine: smooth noisy coil inside the abdominal frame
  const pts: V3[] = []
  const N = 70
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const a = t * Math.PI * 9
    const x = 0.052 * Math.sin(a) * (0.6 + 0.4 * Math.cos(t * 7.3))
    const y = 1.055 - t * 0.085 + 0.012 * Math.sin(a * 1.7)
    const z = 0.035 + 0.026 * Math.cos(a * 1.3) + 0.006 * perlin(t * 9, 1.3, 0.2)
    pts.push([x, y, z])
  }
  parts.push(tube(pts, { r: 0.0098, radial: 8, density: 220, cap: 0.008 }))
  return merge(parts)
}

// ---------------------------------------------------------------------------
// Coarse proxies used only for pointer picking (cheap raycasts)
// ---------------------------------------------------------------------------

export function buildPickProxies(): Record<'brain' | 'heart' | 'lungs' | 'kidneys', MeshData> {
  const heart = heartPrims().filter((p) => p.op === 0)
  const kid = KIDNEY_CENTERS.flatMap((c, i) => kidneyPrims(c, i === 0 ? -1 : 1).slice(0, 1))
  return {
    brain: polygonizeLite(brainPrims(false), 0.008, 0.002),
    heart: polygonizeLite(heart, 0.008, 0.002),
    lungs: merge([polygonizeLite(lungPrims(-1, false), 0.012, 0.003), polygonizeLite(lungPrims(1, false), 0.012, 0.003)]),
    kidneys: polygonizeLite(kid.map((p) => ({ ...p, k: 0 })), 0.008, 0.002),
  }
}
