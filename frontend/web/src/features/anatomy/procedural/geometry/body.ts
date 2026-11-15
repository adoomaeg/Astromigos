/** Skin (outer body) and superficial muscle layer as signed distance fields. */
import type { LoftKey, MeshData, Prim, Shape } from './sdf.ts'
import { S, U, capsule, custom, ellipsoid, group, loft, polygonize, roundCone, smax, sphere } from './sdf.ts'
import type { Cut } from './mesh.ts'
import { clipByCuts, merge } from './mesh.ts'
import { decimate } from './simplify.ts'
import type { ArmRig, LegRig, Rig } from './rig.ts'
import type { V3 } from './vec.ts'
import { at, basisFromY, basisFromZY, lerp3, norm, smoothstep, sub } from './vec.ts'

const TORSO: LoftKey[] = [
  { y: 0.78, rx: 0.1, rz: 0.08, cx: 0, cz: -0.005 },
  { y: 0.82, rx: 0.15, rz: 0.1, cx: 0, cz: -0.008 },
  { y: 0.87, rx: 0.17, rz: 0.11, cx: 0, cz: -0.012 },
  { y: 0.92, rx: 0.172, rz: 0.108, cx: 0, cz: -0.01 },
  { y: 0.98, rx: 0.16, rz: 0.1, cx: 0, cz: -0.002 },
  { y: 1.05, rx: 0.148, rz: 0.098, cx: 0, cz: 0.004 },
  { y: 1.1, rx: 0.145, rz: 0.098, cx: 0, cz: 0.006 },
  { y: 1.16, rx: 0.15, rz: 0.104, cx: 0, cz: 0.006 },
  { y: 1.22, rx: 0.158, rz: 0.112, cx: 0, cz: 0.004 },
  { y: 1.29, rx: 0.165, rz: 0.118, cx: 0, cz: 0 },
  { y: 1.35, rx: 0.17, rz: 0.115, cx: 0, cz: -0.006 },
  { y: 1.4, rx: 0.163, rz: 0.1, cx: 0, cz: -0.012 },
  { y: 1.44, rx: 0.128, rz: 0.076, cx: 0, cz: -0.018 },
  { y: 1.48, rx: 0.062, rz: 0.056, cx: 0, cz: -0.02 },
]

function zone(rig: Rig, y: number): number {
  const hipW = rig.wHip
  const waistW = rig.wWaist
  const chestW = rig.wChest
  const shW = rig.wShoulder
  if (y < 0.95) return hipW
  if (y < 1.03) return hipW + (waistW - hipW) * smoothstep(0.95, 1.03, y)
  if (y < 1.15) return waistW
  if (y < 1.26) return waistW + (chestW - waistW) * smoothstep(1.15, 1.26, y)
  if (y < 1.38) return chestW
  if (y < 1.45) return chestW + (shW - chestW) * smoothstep(1.38, 1.45, y)
  return shW
}

export function torsoLoft(rig: Rig, inset = 0) {
  const female = rig.sex === 'F'
  return loft(
    TORSO.map((k) => {
      const w = zone(rig, k.y)
      const dz = female ? (k.y < 0.95 ? 1.03 : 0.95) : 1
      return { ...k, rx: k.rx * w - inset, rz: k.rz * dz - inset }
    }),
  )
}

const along = (a: V3, b: V3, rPerp: number, rAlong: number, rDepth: number, offset: V3 = [0, 0, 0], t = 0.5): Shape =>
  ellipsoid(at(lerp3(a, b, t), [offset, 1]), [rPerp, rAlong, rDepth], basisFromY(sub(b, a)))

// ---------------------------------------------------------------------------
// Skin
// ---------------------------------------------------------------------------

function headPrims(female: boolean): Prim[] {
  const p: Prim[] = []
  const f = female ? 0.96 : 1
  p.push(U(ellipsoid([0, 1.658, -0.012], [0.074 * f, 0.093, 0.097 * f])))
  p.push(U(ellipsoid([0, 1.625, 0.025], [0.066 * f, 0.075, 0.068]), 0.03))
  p.push(U(roundCone([0, 1.6, 0.02], [0, 1.538, 0.06], 0.055 * f, 0.02), 0.03))
  for (const s of [-1, 1]) {
    p.push(U(capsule([s * 0.05 * f, 1.605, -0.005], [s * 0.04 * f, 1.555, 0.025], 0.018), 0.03))
    p.push(U(capsule([s * 0.04 * f, 1.555, 0.025], [0, 1.536, 0.062], 0.016), 0.025))
    p.push(U(ellipsoid([s * 0.047 * f, 1.618, 0.06], [0.024, 0.02, 0.024]), 0.02))
    p.push(U(ellipsoid([s * 0.075 * f, 1.64, -0.008], [0.008, 0.027, 0.017]), 0.008))
  }
  p.push(U(capsule([-0.044 * f, 1.664, 0.077], [0.044 * f, 1.664, 0.077], 0.012), 0.016))
  p.push(U(roundCone([0, 1.648, 0.085], [0, 1.614, 0.101], 0.008, 0.0105), 0.012))
  p.push(U(ellipsoid([0, 1.611, 0.093], [0.016, 0.008, 0.01]), 0.008))
  p.push(U(ellipsoid([0, 1.574, 0.084], [0.022, 0.011, 0.012]), 0.008))
  for (const s of [-1, 1]) p.push(S(sphere([s * 0.031, 1.645, 0.096], 0.0145), 0.012))
  // neck
  p.push(U(roundCone([0, 1.46, -0.02], [0, 1.585, -0.01], female ? 0.054 : 0.06, female ? 0.045 : 0.05), 0.035))
  if (!female) p.push(U(ellipsoid([0, 1.52, 0.044], [0.011, 0.014, 0.01]), 0.015))
  for (const s of [-1, 1]) p.push(U(capsule([s * 0.058, 1.625, -0.015], [s * 0.017, 1.452, 0.045], 0.012), 0.02))
  return p
}

function armSkin(a: ArmRig, female: boolean): Prim[] {
  const p: Prim[] = []
  const m = female ? 0.88 : 1
  const { S: Sh, E, W, u, d, w, n, s } = a
  p.push(U(ellipsoid(at(Sh, [u, 0.05], [[s, 0, 0], 0.012]), [0.05 * m, 0.085, 0.052 * m], basisFromY(u)), 0.035))
  p.push(U(roundCone(Sh, E, 0.045 * m, 0.034 * m), 0.03))
  p.push(U(along(Sh, E, 0.031 * m, 0.085, 0.031 * m, [0, 0, 0.016], 0.55), 0.03))
  p.push(U(along(Sh, E, 0.033 * m, 0.095, 0.032 * m, [0, 0, -0.017], 0.45), 0.03))
  p.push(U(sphere(E, 0.034 * m), 0.025))
  p.push(U(roundCone(E, W, 0.037 * m, 0.023 * m), 0.025))
  p.push(U(along(E, W, 0.038 * m, 0.075, 0.032 * m, [0, 0, 0.004], 0.28), 0.03))
  p.push(U(ellipsoid(W, [0.016 * m, 0.02, 0.025 * m], [n, d, w]), 0.015))
  // hand
  p.push(U(ellipsoid(at(W, [d, 0.05]), [0.016 * m, 0.05 * m, 0.042 * m], [n, d, w]), 0.012))
  p.push(U(ellipsoid(at(W, [d, 0.035], [w, 0.024], [n, 0.008]), [0.013, 0.026, 0.015], [n, d, w]), 0.01))
  for (const fg of [...a.fingers, a.thumb]) {
    for (let k = 0; k < 3; k++) {
      const a0 = k === 0 ? at(fg.pts[0]!, [d, -0.014]) : fg.pts[k]!
      const b0 = fg.pts[k + 1]!
      const shorten = k === 2 ? norm(sub(b0, a0)) : null
      const b1 = shorten ? at(b0, [shorten, -fg.r[2]! * 0.8]) : b0
      p.push(U(capsule(a0, b1, fg.r[k]!), 0.004))
    }
  }
  return p
}

function legSkin(l: LegRig, female: boolean): Prim[] {
  const p: Prim[] = []
  const { H, K, A, s } = l
  const m = female ? 0.97 : 1
  const thighTop = at(H, [[s, 0, 0], 0.012], [[0, 0, 1], -0.005])
  p.push(U(roundCone(thighTop, at(K, [[0, 1, 0], 0.02]), 0.088 * m, 0.051 * m), 0.05))
  p.push(U(along(H, K, 0.05 * m, 0.14, 0.04 * m, [s * 0.004, 0, 0.03], 0.6), 0.04))
  p.push(U(along(H, K, 0.045 * m, 0.12, 0.05 * m, [-s * 0.03, 0, -0.005], 0.3), 0.04))
  p.push(U(sphere(K, 0.048 * m), 0.03))
  p.push(U(ellipsoid(at(K, [[0, 1, 0], 0.01], [[0, 0, 1], 0.038]), [0.025, 0.03, 0.015]), 0.02))
  p.push(U(roundCone(K, A, 0.046 * m, 0.029 * m), 0.03))
  p.push(U(along(K, A, 0.05 * m, 0.1, 0.044 * m, [0, 0, -0.03], 0.28), 0.04))
  for (const o of [-1, 1]) p.push(U(sphere(at(A, [[s * o, 0, 0], 0.021]), 0.015), 0.015))
  // foot: heel, arch body, toes, cut flat at the floor
  const fx = s * (female ? 0.115 : 0.12)
  const footParts: Prim[] = [
    U(sphere([s * 0.11 * (female ? 0.96 : 1), 0.034, -0.038], 0.033)),
    U(ellipsoid([fx, 0.03, 0.045], [0.043, 0.033, 0.105]), 0.02),
    U(ellipsoid([fx + s * 0.006, 0.018, 0.14], [0.044, 0.017, 0.04]), 0.02),
    U(capsule(A, [fx, 0.045, 0.075], 0.03), 0.025),
  ]
  const foot = group(footParts)
  p.push(U(custom((x, y, z) => smax(foot.f(x, y, z), -y, 0.006), foot.min, foot.max), 0.02))
  return p
}

export function skinPrims(rig: Rig): Prim[] {
  const female = rig.sex === 'F'
  const p: Prim[] = []
  const torso = torsoLoft(rig)
  p.push(U(torso))
  p.push(...headPrims(female))
  for (const s of [-1, 1]) {
    // trapezius slope, clavicle line, pectorals / breasts, glutes
    p.push(U(capsule([s * 0.035, 1.5, -0.03], [s * (rig.shX - 0.025), 1.44, -0.02], 0.03), 0.04))
    p.push(U(capsule([s * 0.02, 1.437, 0.068], [s * (rig.shX - 0.03), 1.448, 0.018], 0.011), 0.02))
    p.push(U(ellipsoid([s * 0.07, 1.318, 0.082], [0.07 * rig.wChest, 0.05, 0.03], basisFromZY([s * 0.25, 0, 1], [0, 1, 0])), 0.04))
    if (female) p.push(U(ellipsoid([s * 0.082, 1.258, 0.095], [0.057, 0.054, 0.048], basisFromZY([s * 0.35, -0.15, 1], [0, 1, 0])), 0.035))
    p.push(U(ellipsoid([s * 0.07 * rig.wHip, 0.875, -0.072], [0.075 * rig.wHip, 0.085, 0.06]), 0.04))
  }
  p.push(S(sphere([0, 1.05, 0.104], 0.006), 0.004))
  p.push(S(capsule([0, 1.15, -0.105], [0, 1.4, -0.123], 0.008), 0.02))
  for (const a of rig.arms) p.push(...armSkin(a, female))
  for (const l of rig.legs) p.push(...legSkin(l, female))
  return p
}

/** Wrist cut: the hand side is polygonized on a finer grid and joined exactly on this plane. */
function handCut(a: ArmRig): Cut {
  return { p: at(a.W, [a.f, -0.022]), n: a.f, r: 0.085 }
}

function handBox(a: ArmRig): { min: V3; max: V3 } {
  const pts: V3[] = [at(a.W, [a.f, -0.05]), ...a.fingers.flatMap((f) => f.pts), ...a.thumb.pts]
  for (const sw of [-1, 1]) for (const sn of [-1, 1]) pts.push(at(a.W, [a.w, sw * 0.05], [a.n, sn * 0.035]))
  const min: V3 = [Infinity, Infinity, Infinity]
  const max: V3 = [-Infinity, -Infinity, -Infinity]
  for (const p of pts)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, p[k]! - 0.02)
      max[k] = Math.max(max[k]!, p[k]! + 0.02)
    }
  return { min, max }
}

/** Horizontal split of the body skin so the two halves build in parallel workers. */
const WAIST_CUT: Cut = { p: [0, 0.98, 0], n: [0, 1, 0], r: 10 }

export interface SkinPiece {
  hi: MeshData
  lo: MeshData
}

/** Lighter variant for small viewports (seam vertices are open boundaries, so they stay put). */
const lite = (m: MeshData) => decimate(m, { tol: 0.0012, minRatio: 0.2 })

/**
 * Body skin (hands excluded) on a 5.5 mm grid, decimated with quadric error and clipped exactly
 * at the waist plane: `upper` keeps everything above it, the lower half everything below.
 */
export function buildSkinHalf(rig: Rig, upper: boolean): SkinPiece {
  const prims = skinPrims(rig)
  const y = WAIST_CUT.p[1]
  const box = upper ? { min: [-1, y - 0.03, -1] as V3, max: [1, 3, 1] as V3 } : { min: [-1, -1, -1] as V3, max: [1, y + 0.03, 1] as V3 }
  let m = clipByCuts(decimate(polygonize(prims, 0.0055, { lipschitz: 1.3, box }), { tol: 0.00045 }), [WAIST_CUT], upper)
  if (!upper) m = clipByCuts(m, rig.arms.map(handCut), false)
  return { hi: m, lo: lite(m) }
}

/** Both hands on a 2.8 mm grid so the fingers separate, joined to the body at the wrist planes. */
export function buildHands(rig: Rig): SkinPiece {
  const prims = skinPrims(rig)
  const hi = merge(
    rig.arms.map((a) => {
      const m = decimate(polygonize(prims, 0.0028, { lipschitz: 1.3, box: handBox(a) }), { tol: 0.00025, minRatio: 0.15 })
      return clipByCuts(m, [handCut(a)], true)
    }),
  )
  return { hi, lo: decimate(hi, { tol: 0.0008, minRatio: 0.25 }) }
}

// ---------------------------------------------------------------------------
// Muscles (superficial groups, small blend radius so separations read as grooves)
// ---------------------------------------------------------------------------

export function musclePrims(rig: Rig): Prim[] {
  const female = rig.sex === 'F'
  const k = 0.005
  const p: Prim[] = []
  const t = torsoLoft(rig, 0.012)
  const front = (y: number) => {
    const s = t.at(y)
    return s.cz + s.rz
  }
  const back = (y: number) => {
    const s = t.at(y)
    return s.cz - s.rz
  }
  // a thin core so the layer reads as a body, not floating blobs
  p.push(U(torsoLoft(rig, 0.026)))
  for (const s of [-1, 1]) {
    p.push(U(ellipsoid([s * 0.072, 1.325, front(1.325) - 0.02], [0.072 * rig.wChest, 0.052, 0.024], basisFromZY([s * 0.3, 0, 1], [s * 0.25, 1, 0])), k))
    const rows = [1.235, 1.185, 1.135]
    for (const y of rows) p.push(U(ellipsoid([s * 0.03, y, front(y) - 0.006], [0.026, 0.023, 0.012]), k))
    p.push(U(ellipsoid([s * 0.03, 1.06, front(1.06) - 0.006], [0.025, 0.05, 0.012]), k))
    p.push(U(ellipsoid([s * 0.118 * rig.wWaist, 1.12, 0.03], [0.038, 0.085, 0.055], basisFromZY([s * 0.8, 0, 0.6], [-s * 0.15, 1, 0])), k))
    p.push(U(ellipsoid([s * 0.11, 1.245, back(1.245) + 0.022], [0.05, 0.115, 0.028], basisFromZY([s * 0.6, 0, -0.8], [-s * 0.3, 1, 0])), k))
    p.push(U(capsule([s * 0.025, 1.0, back(1.0) + 0.02], [s * 0.025, 1.36, back(1.36) + 0.02], 0.018), k))
    p.push(U(capsule([s * 0.03, 1.52, -0.04], [s * (rig.shX - 0.03), 1.44, -0.03], 0.021), k))
    p.push(U(ellipsoid([s * 0.072 * rig.wHip, 0.88, -0.07], [0.072 * rig.wHip, 0.08, 0.052]), k))
    p.push(U(capsule([s * 0.056, 1.625, -0.012], [s * 0.017, 1.455, 0.04], 0.011), k))
    // serratus anterior digitations
    for (let i = 0; i < 4; i++) p.push(U(ellipsoid([s * (0.138 - i * 0.004) * rig.wChest, 1.29 - i * 0.032, 0.045], [0.012, 0.012, 0.03], basisFromZY([s, 0, 0.4], [0, 1, 0.2])), k))
  }
  p.push(U(ellipsoid([0, 1.39, back(1.39) + 0.012], [0.11 * rig.wShoulder, 0.075, 0.022]), k))
  p.push(U(roundCone([0, 1.46, -0.02], [0, 1.58, -0.012], female ? 0.046 : 0.052, 0.042), k))

  for (const a of rig.arms) {
    const { S: Sh, E, W, u, s } = a
    const m = female ? 0.88 : 1
    p.push(U(ellipsoid(at(Sh, [u, 0.052], [[s, 0, 0], 0.01]), [0.046 * m, 0.08, 0.048 * m], basisFromY(u)), k))
    p.push(U(along(Sh, E, 0.027 * m, 0.085, 0.027 * m, [0, 0, 0.015], 0.56), k))
    p.push(U(along(Sh, E, 0.029 * m, 0.1, 0.028 * m, [0, 0, -0.016], 0.5), k))
    p.push(U(along(Sh, E, 0.02 * m, 0.13, 0.02 * m, [0, 0, 0], 0.5), k))
    p.push(U(along(E, W, 0.029 * m, 0.085, 0.024 * m, [0, 0, 0.01], 0.32), k))
    p.push(U(along(E, W, 0.025 * m, 0.09, 0.021 * m, [0, 0, -0.011], 0.36), k))
    p.push(U(roundCone(E, W, 0.018 * m, 0.014 * m), k))
    p.push(U(ellipsoid(at(W, [a.d, 0.048]), [0.012 * m, 0.04, 0.034 * m], [a.n, a.d, a.w]), k))
  }
  for (const l of rig.legs) {
    const { H, K, A, s } = l
    const X: V3 = [s, 0, 0]
    const Z: V3 = [0, 0, 1]
    p.push(U(along(H, K, 0.034, 0.17, 0.03, at([0, 0, 0], [Z, 0.034]), 0.5), k))
    p.push(U(along(H, K, 0.034, 0.165, 0.04, at([0, 0, 0], [X, 0.036]), 0.55), k))
    p.push(U(along(H, K, 0.03, 0.08, 0.03, at([0, 0, 0], [X, -0.026], [Z, 0.014]), 0.8), k))
    p.push(U(along(H, K, 0.034, 0.12, 0.044, at([0, 0, 0], [X, -0.038]), 0.3), k))
    p.push(U(along(H, K, 0.038, 0.16, 0.034, at([0, 0, 0], [Z, -0.04]), 0.5), k))
    p.push(U(capsule([s * 0.12 * rig.wHip, 1.0, 0.05], [s * 0.074, 0.52, -0.012], 0.008), k))
    p.push(U(roundCone(at(H, [Z, 0.0]), K, 0.05, 0.03), k))
    p.push(U(along(K, A, 0.025, 0.1, 0.03, at([0, 0, 0], [Z, -0.03], [X, -0.016]), 0.3), k))
    p.push(U(along(K, A, 0.024, 0.095, 0.028, at([0, 0, 0], [Z, -0.03], [X, 0.016]), 0.29), k))
    p.push(U(along(K, A, 0.034, 0.12, 0.026, at([0, 0, 0], [Z, -0.022]), 0.5), k))
    p.push(U(along(K, A, 0.016, 0.13, 0.018, at([0, 0, 0], [Z, 0.02], [X, 0.012]), 0.42), k))
    p.push(U(capsule(at(lerp3(K, A, 0.75), [Z, -0.028]), at(A, [Z, -0.034]), 0.007), k))
    p.push(U(roundCone(K, A, 0.026, 0.02), k))
  }
  return p
}
