/** Procedural skeleton: skull, spine (24 vertebrae), ribcage, shoulder girdle, pelvis and limb bones. */
import type { MeshData, Prim, Shape } from './sdf.ts'
import { S, U, capsule, custom, ellipsoid, roundCone, roundedCylinder, shell, sphere, torus } from './sdf.ts'
import { polygonizeLite } from './simplify.ts'
import { merge, transform, tube } from './mesh.ts'
import type { ArmRig, LegRig, Rig } from './rig.ts'
import { thoracic } from './rig.ts'
import type { Basis, V3 } from './vec.ts'
import { at, basisFromY, basisFromZY, cross, lerp3, norm, sub } from './vec.ts'

const X: V3 = [1, 0, 0]
const Y: V3 = [0, 1, 0]
const Z: V3 = [0, 0, 1]
const ID: Basis = [X, Y, Z]
/** Decimation tolerance for bone meshes (meters). */
const BONE_TOL = 0.0004

function skull(female: boolean): MeshData {
  const f = female ? 0.96 : 1
  const p: Prim[] = []
  const cranium = ellipsoid([0, 1.663, -0.012], [0.07 * f, 0.084, 0.092 * f])
  p.push(U(shell(cranium, 0.0055)))
  p.push(U(ellipsoid([0, 1.607, 0.045], [0.037 * f, 0.03, 0.034]), 0.012))
  p.push(U(capsule([-0.045 * f, 1.664, 0.074], [0.045 * f, 1.664, 0.074], 0.0075), 0.01))
  for (const s of [-1, 1]) {
    p.push(U(capsule([s * 0.034 * f, 1.626, 0.066], [s * 0.061 * f, 1.628, 0.03], 0.0065), 0.008))
    p.push(U(capsule([s * 0.061 * f, 1.628, 0.03], [s * 0.066 * f, 1.632, -0.006], 0.0045), 0.006))
    // mandible: condyle, ramus, body
    p.push(U(capsule([s * 0.057 * f, 1.628, -0.006], [s * 0.05 * f, 1.566, 0.0], 0.0065), 0.006))
    p.push(U(capsule([s * 0.05 * f, 1.566, 0.0], [s * 0.034 * f, 1.551, 0.045], 0.0072), 0.008))
    p.push(U(capsule([s * 0.034 * f, 1.551, 0.045], [0, 1.546, 0.066], 0.0078), 0.008))
    p.push(U(capsule([s * 0.05 * f, 1.59, 0.008], [s * 0.047 * f, 1.607, 0.022], 0.004), 0.005))
    // teeth rows
    p.push(U(capsule([s * 0.027 * f, 1.584, 0.03], [s * 0.016, 1.583, 0.058], 0.0055), 0.004))
    p.push(U(capsule([s * 0.016, 1.583, 0.058], [0, 1.583, 0.066], 0.0055), 0.004))
    p.push(U(capsule([s * 0.025 * f, 1.567, 0.032], [s * 0.014, 1.568, 0.056], 0.0048), 0.004))
    p.push(U(capsule([s * 0.014, 1.568, 0.056], [0, 1.568, 0.062], 0.0048), 0.004))
    p.push(S(sphere([s * 0.031, 1.645, 0.081], 0.0185), 0.007))
  }
  p.push(U(ellipsoid([0, 1.548, 0.066], [0.014, 0.011, 0.007]), 0.006))
  p.push(S(ellipsoid([0, 1.619, 0.086], [0.0095, 0.015, 0.02]), 0.004))
  return polygonizeLite(p, 0.0034, BONE_TOL)
}

function vertebraTemplate(): MeshData {
  const p: Prim[] = []
  p.push(U(roundedCylinder([0, 0, 0], 0.0155, 0.0085, 0.003, ID)))
  p.push(U(torus([0, 0, -0.024], 0.0105, 0.0034, ID), 0.004))
  p.push(U(capsule([0, 0, -0.034], [0, -0.009, -0.051], 0.0034), 0.004))
  for (const s of [-1, 1]) {
    p.push(U(capsule([s * 0.009, 0.0015, -0.025], [s * 0.026, 0.003, -0.031], 0.0033), 0.004))
    p.push(U(sphere([s * 0.009, 0.0065, -0.028], 0.0032), 0.003))
    p.push(U(sphere([s * 0.009, -0.0065, -0.029], 0.0032), 0.003))
  }
  return polygonizeLite(p, 0.0025, 0.0004)
}

function spine(rig: Rig): MeshData {
  const tpl = vertebraTemplate()
  const parts: MeshData[] = []
  for (const v of rig.vertebrae) {
    const sy = Math.min(1.25, (v.spacing * 0.78) / 0.017)
    const basis = basisFromY(v.t, Z)
    parts.push(transform(tpl, [v.scale, sy * Math.min(1, v.scale + 0.15), v.scale], basis, v.p))
  }
  return merge(parts)
}

/** Sternum line z as a function of y. */
const sternumZ = (y: number) => 0.072 + ((1.425 - y) / 0.155) * 0.028

function ribs(rig: Rig): MeshData {
  const W = [0.058, 0.086, 0.106, 0.12, 0.13, 0.137, 0.142, 0.144, 0.141, 0.134, 0.122, 0.108]
  const D = [0.03, 0.05, 0.068, 0.082, 0.092, 0.1, 0.106, 0.11, 0.11, 0.105, 0.08, 0.06]
  const attach = [1.408, 1.385, 1.36, 1.338, 1.316, 1.296, 1.279]
  const parts: MeshData[] = []
  const wc = rig.wChest
  for (let i = 1; i <= 12; i++) {
    const v = thoracic(rig, i)
    const yh = v.p[1] + 0.004
    const zh = v.p[2]
    const a = W[i - 1]! * wc
    const zBack = zh - 0.03
    const zFront = i <= 7 ? sternumZ(attach[i - 1]!) - 0.004 : 0.088
    const cz = (zBack + zFront) * 0.5
    const b = (zFront - zBack) * 0.5
    const xEnd = i <= 7 ? 0.05 + i * 0.002 : i <= 10 ? 0.075 + (i - 8) * 0.012 : 0
    const thetaEnd = i === 11 ? Math.PI * 0.62 : i === 12 ? Math.PI * 0.5 : Math.PI - Math.asin(Math.min(0.99, Math.pow(xEnd / a, 1.1)))
    for (const s of [-1, 1]) {
      const pts: V3[] = [[s * 0.017, yh + 0.002, zh - 0.004]]
      const th0 = 0.32
      const steps = 10
      for (let k = 0; k <= steps; k++) {
        const th = th0 + ((thetaEnd - th0) * k) / steps
        const sn = Math.sin(th)
        const cs = Math.cos(th)
        const nb = cs > 0 ? 2.8 : 2.2
        const x = a * Math.pow(Math.abs(sn), 2 / nb)
        const z = cz - b * Math.sign(cs) * Math.pow(Math.abs(cs), 2 / nb)
        const u = k / steps
        const y = yh - D[i - 1]! * Math.pow(u, 1.25)
        pts.push([s * x, y, z])
      }
      const bony = tube(pts, { r: i <= 2 ? 0.0058 : 0.0052, radial: 7, density: 90, cap: 0.004 })
      parts.push(bony)
      // costal cartilage
      const last = pts[pts.length - 1]!
      if (i <= 7) {
        const ay = attach[i - 1]!
        const c: V3[] = [last, [s * (0.017 + (Math.abs(last[0]) - 0.017) * 0.45), (last[1] + ay) * 0.5 - 0.004 * (i - 3), sternumZ(ay) - 0.002], [s * 0.016, ay, sternumZ(ay)]]
        parts.push(tube(c, { r: 0.0045, radial: 6, density: 120, cap: 0.003 }))
      } else if (i <= 10) {
        const ty = attach[6]! - 0.028 - (i - 8) * 0.014
        const c: V3[] = [last, [s * (0.05 + (i - 8) * 0.012), ty - 0.012, 0.09], [s * (0.03 + (i - 8) * 0.01), ty + 0.006, 0.096]]
        parts.push(tube(c, { r: 0.0042, radial: 6, density: 120, cap: 0.003 }))
      }
    }
  }
  return merge(parts)
}

function sternum(): MeshData {
  const top: V3 = [0, 1.425, sternumZ(1.425)]
  const bot: V3 = [0, 1.27, sternumZ(1.27)]
  const axis = sub(top, bot)
  const B = basisFromZY([0, 0.18, 1], axis)
  const p: Prim[] = [
    U(ellipsoid([0, 1.405, sternumZ(1.405) - 0.002], [0.026, 0.022, 0.0065], B)),
    U(ellipsoid(lerp3(top, bot, 0.5), [0.016, 0.068, 0.0062], B), 0.012),
    U(ellipsoid([0, 1.258, sternumZ(1.258) - 0.002], [0.007, 0.016, 0.0035], B), 0.006),
  ]
  return polygonizeLite(p, 0.0024, 0.0004)
}

function shoulderGirdle(rig: Rig): MeshData {
  const parts: MeshData[] = []
  const sh = rig.shX
  for (const s of [-1, 1]) {
    parts.push(
      tube(
        [
          [s * 0.02, 1.432, 0.07],
          [s * 0.06, 1.442, 0.068],
          [s * 0.105, 1.448, 0.046],
          [s * (sh - 0.035), 1.452, 0.008],
          [s * (sh - 0.008), 1.446, -0.016],
        ],
        { r: 0.0062, radial: 8, density: 120, cap: 0.004 },
      ),
    )
    const nrm = norm([s * 0.42, 0, -1])
    const B = basisFromZY(nrm, [0, 1, 0.12])
    const p: Prim[] = [
      U(ellipsoid([s * 0.1 * rig.wChest, 1.36, -0.088], [0.05, 0.042, 0.005], B)),
      U(ellipsoid([s * 0.083 * rig.wChest, 1.305, -0.093], [0.026, 0.052, 0.005], B), 0.018),
      U(capsule([s * 0.06, 1.388, -0.1], [s * (sh - 0.008), 1.445, -0.03], 0.0055), 0.008),
      U(sphere([s * (sh - 0.022), 1.414, -0.022], 0.012), 0.012),
      U(capsule([s * (sh - 0.035), 1.43, -0.02], [s * (sh - 0.045), 1.43, 0.02], 0.0045), 0.006),
    ]
    parts.push(polygonizeLite(p, 0.003, BONE_TOL))
  }
  return merge(parts)
}

function pelvis(rig: Rig): MeshData {
  const pw = rig.hipX / 0.088
  const p: Prim[] = []
  const cup = (H: V3, s: number): Shape => {
    const outer = sphere(at(H, [X, -s * 0.004]), 0.031)
    const inner = sphere(H, 0.0235)
    return custom((x, y, z) => Math.max(outer.f(x, y, z), -inner.f(x, y, z)), outer.min, outer.max)
  }
  for (const s of [-1, 1]) {
    const H: V3 = [s * rig.hipX, 0.915, 0]
    p.push(U(cup(H, s), 0.004))
    const hDir = norm([s * 0.075 * pw, 0, 0.105])
    const up = norm([s * 0.32, 1, 0])
    const B = basisFromZY(cross(hDir, up), up)
    p.push(U(ellipsoid([s * 0.088 * pw, 0.998, -0.012], [0.072, 0.058, 0.0075], B), 0.012))
    p.push(U(capsule([s * 0.05 * pw, 1.032, -0.058], [s * 0.112 * pw, 1.058, -0.022], 0.0065), 0.01))
    p.push(U(capsule([s * 0.112 * pw, 1.058, -0.022], [s * 0.124 * pw, 1.035, 0.036], 0.0062), 0.01))
    p.push(U(capsule([s * 0.085 * pw, 0.968, -0.008], [s * 0.078 * pw, 0.93, 0.0], 0.017), 0.015))
    p.push(U(capsule([s * 0.073 * pw, 0.926, 0.024], [s * 0.012, 0.886, 0.05], 0.0085), 0.008))
    p.push(U(ellipsoid([s * 0.008, 0.875, 0.05], [0.006, 0.016, 0.009]), 0.006))
    p.push(U(capsule([s * 0.012, 0.865, 0.045], [s * 0.055 * pw, 0.858, -0.01], 0.0072), 0.006))
    p.push(U(capsule([s * 0.072 * pw, 0.905, -0.012], [s * 0.055 * pw, 0.858, -0.012], 0.0115), 0.008))
    p.push(U(capsule([s * 0.034, 0.99, -0.062], [s * 0.062 * pw, 1.0, -0.052], 0.012), 0.01))
    p.push(U(capsule([s * 0.036, 0.99, -0.045], [s * 0.066 * pw, 0.962, 0.0], 0.0052), 0.006))
    p.push(U(capsule([s * 0.066 * pw, 0.962, 0.0], [s * 0.058 * pw, 0.93, 0.03], 0.0052), 0.006))
  }
  const sacB = basisFromY([0, 0.09, 0.04], Z)
  p.push(U(ellipsoid([0, 0.982, -0.062], [0.047 * pw, 0.03, 0.015], sacB), 0.012))
  p.push(U(ellipsoid([0, 0.935, -0.077], [0.03 * pw, 0.034, 0.011], sacB), 0.018))
  p.push(U(capsule([0, 0.905, -0.087], [0, 0.882, -0.08], 0.0055), 0.006))
  return polygonizeLite(p, 0.0036, BONE_TOL)
}

function armBones(a: ArmRig): MeshData {
  const { S: Sh, E, W, u, f, d, w, n, lat } = a
  const p: Prim[] = []
  p.push(U(sphere(Sh, 0.021)))
  p.push(U(sphere(at(Sh, [lat, 0.013], [Y, 0.004], [Z, 0.006]), 0.011), 0.008))
  p.push(U(roundCone(at(Sh, [u, 0.022]), at(E, [u, -0.022]), 0.0115, 0.0105), 0.01))
  p.push(U(ellipsoid(at(E, [u, -0.011]), [0.027, 0.011, 0.013], basisFromZY(Z, u)), 0.01))
  // ulna and radius
  p.push(U(sphere(at(E, [Z, -0.014], [u, 0.004]), 0.011)))
  p.push(U(capsule(at(E, [Z, -0.008], [u, 0.006]), at(W, [Z, -0.009], [f, -0.008]), 0.0056), 0.008))
  p.push(U(sphere(at(W, [Z, -0.01], [f, -0.008]), 0.0075), 0.006))
  p.push(U(sphere(at(E, [u, 0.013], [Z, 0.004], [lat, 0.012]), 0.0092)))
  p.push(U(capsule(at(E, [u, 0.013], [Z, 0.004], [lat, 0.012]), at(W, [Z, 0.009], [f, -0.01]), 0.0058), 0.008))
  p.push(U(ellipsoid(at(W, [Z, 0.008], [f, -0.008]), [0.012, 0.008, 0.012], basisFromY(f)), 0.008))
  const arm = polygonizeLite(p, 0.0032, BONE_TOL)

  const hp: Prim[] = []
  hp.push(U(ellipsoid(at(W, [d, 0.013]), [0.009, 0.013, 0.021], [n, d, w])))
  const offs = [0.024, 0.008, -0.008, -0.023]
  a.fingers.forEach((fg, i) => {
    const base = fg.pts[0]!
    const mStart = at(W, [d, 0.026], [w, offs[i]! * 0.55])
    const mEnd = at(base, [d, -0.006])
    hp.push(U(capsule(mStart, mEnd, 0.0041), 0.003))
    hp.push(U(sphere(mEnd, 0.0049), 0.003))
    for (let k = 0; k < 3; k++) {
      const a0 = fg.pts[k]!
      const b0 = fg.pts[k + 1]!
      const dir = norm(sub(b0, a0))
      hp.push(U(capsule(at(a0, [dir, 0.003]), at(b0, [dir, k === 2 ? -0.004 : -0.003]), 0.0036 - k * 0.0004), 0.002))
    }
  })
  const t = a.thumb
  hp.push(U(capsule(at(W, [d, 0.012], [w, 0.016]), at(t.pts[1]!, [norm(sub(t.pts[1]!, t.pts[0]!)), -0.003]), 0.0046), 0.003))
  for (let k = 1; k < 3; k++) {
    const dir = norm(sub(t.pts[k + 1]!, t.pts[k]!))
    hp.push(U(capsule(at(t.pts[k]!, [dir, 0.003]), at(t.pts[k + 1]!, [dir, -0.004]), 0.0042 - k * 0.0004), 0.002))
  }
  const hand = polygonizeLite(hp, 0.0021, 0.0003)
  return merge([arm, hand])
}

function legBones(l: LegRig, rig: Rig): MeshData {
  const { H, K, A, s } = l
  const sx: V3 = [s, 0, 0]
  const p: Prim[] = []
  const hx = rig.hipX
  p.push(U(sphere(H, 0.0225)))
  p.push(U(capsule(H, [s * (hx + 0.04), H[1] - 0.014, -0.005], 0.0135), 0.008))
  p.push(U(sphere([s * (hx + 0.05), 0.917, -0.01], 0.018), 0.012))
  p.push(U(sphere([s * (hx + 0.026), 0.874, -0.016], 0.009), 0.01))
  p.push(U(roundCone([s * (hx + 0.043), 0.89, -0.004], at(K, [Y, 0.05]), 0.0135, 0.0125), 0.012))
  for (const o of [-1, 1]) p.push(U(sphere(at(K, [sx, o * 0.019], [Y, 0.018], [Z, -0.006]), 0.019), 0.012))
  const femur = polygonizeLite(p, 0.0036, BONE_TOL)

  const q: Prim[] = []
  q.push(U(ellipsoid(at(K, [Y, -0.016], [Z, -0.002]), [0.037, 0.012, 0.028])))
  q.push(U(roundCone(at(K, [Y, -0.03], [Z, 0.002]), at(A, [sx, -0.005], [Y, 0.025], [Z, 0.004]), 0.019, 0.012), 0.012))
  q.push(U(sphere(at(K, [Y, -0.046], [Z, 0.02]), 0.009), 0.01))
  q.push(U(ellipsoid(at(A, [sx, -0.004], [Y, 0.012]), [0.02, 0.012, 0.017]), 0.01))
  q.push(U(sphere(at(A, [sx, -0.019]), 0.0088), 0.008))
  q.push(U(capsule(at(K, [sx, 0.035], [Y, -0.035], [Z, -0.012]), at(A, [sx, 0.021], [Y, 0.01], [Z, -0.01]), 0.0055)))
  q.push(U(sphere(at(K, [sx, 0.035], [Y, -0.035], [Z, -0.012]), 0.0088), 0.006))
  q.push(U(sphere(at(A, [sx, 0.022], [Y, -0.004], [Z, -0.008]), 0.0088), 0.006))
  const shin = polygonizeLite(q, 0.0036, BONE_TOL)
  const patella = polygonizeLite([U(ellipsoid(at(K, [Y, 0.026], [Z, 0.041]), [0.02, 0.023, 0.009]))], 0.0024, 0.0004)

  // foot
  const fp: Prim[] = []
  const fs = rig.sex === 'F' ? 0.96 : 1
  fp.push(U(ellipsoid(at(A, [Y, -0.03], [Z, 0.006]), [0.016, 0.012, 0.022])))
  fp.push(U(ellipsoid([s * 0.11 * fs, 0.033, -0.037], [0.016, 0.019, 0.03], basisFromY([0, 1, -0.5], Z)), 0.008))
  fp.push(U(ellipsoid([s * 0.117 * fs, 0.036, 0.028], [0.026, 0.012, 0.017]), 0.008))
  const mr = [0.0064, 0.0047, 0.0044, 0.0042, 0.0045]
  for (let i = 0; i < 5; i++) {
    const bx = s * (0.1 + 0.0105 * i) * fs
    const hxp = s * (0.098 + 0.0135 * i) * fs
    const base: V3 = [bx, 0.036 - 0.002 * i, 0.046]
    const head: V3 = [hxp, 0.015, 0.112 - 0.006 * i]
    fp.push(U(capsule(base, head, mr[i]!), 0.003))
    fp.push(U(sphere(head, mr[i]! + 0.0012), 0.002))
    const tip: V3 = [hxp + s * 0.001 * i, 0.012, i === 0 ? 0.166 : 0.152 - 0.007 * i]
    const segs = i === 0 ? 2 : 3
    let prev = head
    for (let k = 1; k <= segs; k++) {
      const pt = lerp3(head, tip, k / segs)
      const dir = norm(sub(pt, prev))
      fp.push(U(capsule(at(prev, [dir, 0.0025]), at(pt, [dir, -0.002]), (i === 0 ? 0.0055 : 0.0032) - k * 0.0003), 0.002))
      prev = pt
    }
  }
  const foot = polygonizeLite(fp, 0.0023, 0.0004)
  return merge([femur, shin, patella, foot])
}

/** Axial skeleton and girdles (skull, spine, ribcage, sternum, shoulder girdle, pelvis). */
export function buildAxialSkeleton(rig: Rig): MeshData {
  return merge([skull(rig.sex === 'F'), spine(rig), ribs(rig), sternum(), shoulderGirdle(rig), pelvis(rig)])
}

/** Limb bones including hands and feet. */
export function buildLimbSkeleton(rig: Rig): MeshData {
  return merge([armBones(rig.arms[0]), armBones(rig.arms[1]), legBones(rig.legs[0], rig), legBones(rig.legs[1], rig)])
}
