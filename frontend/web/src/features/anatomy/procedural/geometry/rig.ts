/**
 * Anatomical rig: shared landmarks (joints, spine, hand polylines) used by skin, muscles,
 * skeleton, organs and vessels so every layer lines up.
 *
 * Units are meters. Origin between the feet on the floor, +Y up, +Z anterior (the body faces +Z).
 * The person's LEFT side is +X. Proportions follow adult anthropometric ratios for a
 * 1.75 m male (head ~1/7.6 of height, shoulder 0.818 H, hip joint 0.52 H, knee 0.29 H).
 * Female variant: same skeleton height scaled at render time (0.94), with narrower shoulders,
 * narrower waist and wider pelvis.
 */
import type { V3 } from './vec.ts'
import { add, at, cross, len, lerp3, mul, norm, sub } from './vec.ts'
import { sampleSpline } from './mesh.ts'

export type Sex = 'M' | 'F'

export interface Finger {
  /** joint points: base (knuckle), mid, distal, tip */
  pts: V3[]
  r: number[]
}

export interface ArmRig {
  s: 1 | -1
  S: V3 // shoulder (humeral head)
  E: V3 // elbow
  W: V3 // wrist
  u: V3 // upper arm direction
  f: V3 // forearm direction
  d: V3 // hand direction (toward fingertips)
  w: V3 // hand width axis (toward thumb)
  n: V3 // palm normal (toward the body)
  lat: V3 // lateral axis at the elbow
  fingers: Finger[]
  thumb: Finger
}

export interface LegRig {
  s: 1 | -1
  H: V3 // hip joint
  K: V3 // knee
  A: V3 // ankle
}

export interface Rig {
  sex: Sex
  shX: number
  hipX: number
  /** width factors applied to the torso loft by zone */
  wShoulder: number
  wChest: number
  wWaist: number
  wHip: number
  arms: [ArmRig, ArmRig]
  legs: [LegRig, LegRig]
  /** 24 vertebra centers C1..L5 (top to bottom) and their up tangents */
  vertebrae: { p: V3; t: V3; scale: number; spacing: number }[]
  /** dense spine centerline from skull base to sacrum */
  spineLine: V3[]
}

const rad = (d: number) => (d * Math.PI) / 180

function makeArm(s: 1 | -1, shX: number, female: boolean): ArmRig {
  const S: V3 = [s * shX, 1.415, -0.012]
  const a1 = rad(female ? 12 : 13)
  const a2 = rad(female ? 15 : 16)
  const u = norm([s * Math.sin(a1), -Math.cos(a1), -0.035])
  const E = at(S, [u, female ? 0.285 : 0.295])
  const f = norm([s * Math.sin(a2), -Math.cos(a2), 0.11])
  const W = at(E, [f, female ? 0.245 : 0.255])
  const d = norm(add(f, [0, 0, -0.03]))
  const zf: V3 = [0, 0, 1]
  const w = norm(sub(zf, mul(d, d[2])))
  const n = mul(norm(cross(d, w)), s)
  const lat = mul(norm([-u[1], u[0], 0]), s)
  const hs = female ? 0.93 : 1

  // Relaxed hand: knuckles slightly apart and fingers fanning out so each one reads on its own.
  const offs = [0.026, 0.0088, -0.0088, -0.025]
  const lens = [0.072, 0.08, 0.075, 0.06]
  const radii = [0.0082, 0.0084, 0.008, 0.007]
  const fan = [0.13, 0.04, -0.05, -0.15]
  const fingers: Finger[] = offs.map((off, i) => {
    const base = at(W, [d, (i === 0 || i === 3 ? 0.084 : 0.088) * hs], [w, off * hs])
    let dir = norm(at(d, [w, fan[i]!]))
    const L = lens[i]! * hs
    const segs = [0.45, 0.3, 0.25]
    const pts: V3[] = [base]
    let p = base
    for (let k = 0; k < 3; k++) {
      dir = norm(at(dir, [n, Math.tan(0.16 + k * 0.06)]))
      p = at(p, [dir, L * segs[k]!])
      pts.push(p)
    }
    const r0 = radii[i]! * hs
    return { pts, r: [r0, r0 * 0.92, r0 * 0.84] }
  })
  const tb = at(W, [d, 0.02 * hs], [w, 0.024 * hs], [n, 0.006])
  let tdir = norm(at(d, [w, 0.5], [n, 0.32]))
  const tpts: V3[] = [tb]
  let tp = tb
  const tl = [0.044, 0.03, 0.026]
  for (let k = 0; k < 3; k++) {
    tp = at(tp, [tdir, tl[k]! * hs])
    tpts.push(tp)
    tdir = norm(at(tdir, [d, 0.25], [n, 0.12]))
  }
  const thumb: Finger = { pts: tpts, r: [0.0115 * hs, 0.0098 * hs, 0.0088 * hs] }
  return { s, S, E, W, u, f, d, w, n, lat, fingers, thumb }
}

function makeLeg(s: 1 | -1, hipX: number, female: boolean): LegRig {
  return {
    s,
    H: [s * hipX, 0.915, 0.0],
    K: [s * (female ? 0.094 : 0.098), 0.505, 0.008],
    A: [s * (female ? 0.106 : 0.112), 0.085, -0.012],
  }
}

export function makeRig(sex: Sex): Rig {
  const female = sex === 'F'
  const shX = female ? 0.168 : 0.185
  const hipX = female ? 0.095 : 0.088
  const arms: [ArmRig, ArmRig] = [makeArm(-1, shX, female), makeArm(1, shX, female)]
  const legs: [LegRig, LegRig] = [makeLeg(-1, hipX, female), makeLeg(1, hipX, female)]

  // Spine centerline (vertebral body centers): cervical lordosis, thoracic kyphosis, lumbar lordosis.
  const ctrl: V3[] = [
    [0, 1.592, -0.018],
    [0, 1.535, -0.028],
    [0, 1.47, -0.043],
    [0, 1.4, -0.06],
    [0, 1.33, -0.071],
    [0, 1.255, -0.068],
    [0, 1.18, -0.053],
    [0, 1.11, -0.032],
    [0, 1.05, -0.024],
    [0, 1.015, -0.034],
  ]
  const spineLine = sampleSpline(ctrl, 240)
  const cum = [0]
  for (let i = 1; i < spineLine.length; i++) cum.push(cum[i - 1]! + len(sub(spineLine[i]!, spineLine[i - 1]!)))
  const total = cum[cum.length - 1]!
  // relative heights: cervical 1.0, thoracic 1.45, lumbar 1.9
  const weights: number[] = []
  for (let i = 0; i < 24; i++) weights.push(i < 7 ? 1 : i < 19 ? 1.42 + (i - 7) * 0.02 : 1.85 + (i - 19) * 0.04)
  const wsum = weights.reduce((a, b) => a + b, 0)
  const vertebrae: Rig['vertebrae'] = []
  let acc = 0
  for (let i = 0; i < 24; i++) {
    const center = acc + weights[i]! * 0.5
    acc += weights[i]!
    const target = (center / wsum) * total
    let k = 1
    while (k < cum.length - 1 && cum[k]! < target) k++
    const t0 = (target - cum[k - 1]!) / (cum[k]! - cum[k - 1]! || 1)
    const p = lerp3(spineLine[k - 1]!, spineLine[k]!, t0)
    const t = norm(sub(spineLine[k - 1]!, spineLine[Math.min(cum.length - 1, k + 1)]!))
    const scale = i < 7 ? 0.6 + i * 0.02 : i < 19 ? 0.76 + (i - 7) * 0.022 : 1.05 + (i - 19) * 0.05
    vertebrae.push({ p, t, scale, spacing: (weights[i]! / wsum) * total })
  }
  return {
    sex,
    shX,
    hipX,
    wShoulder: female ? 0.9 : 1,
    wChest: female ? 0.93 : 1,
    wWaist: female ? 0.86 : 1,
    wHip: female ? 1.07 : 1,
    arms,
    legs,
    vertebrae,
    spineLine,
  }
}

/** Thoracic vertebra i (1..12) center. */
export const thoracic = (rig: Rig, i: number) => rig.vertebrae[6 + i]!
/** Lumbar vertebra i (1..5) center. */
export const lumbar = (rig: Rig, i: number) => rig.vertebrae[18 + i]!

