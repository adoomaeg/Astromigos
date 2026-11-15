/**
 * Major arteries as tubes. Each vertex carries `dist`: arc length from the aortic valve, so the
 * shader can run a pressure pulse wave outward from the heart in sync with the live heart rate.
 */
import type { MeshData } from './sdf.ts'
import type { TubeResult } from './mesh.ts'
import { distAlong, merge, tube } from './mesh.ts'
import type { Rig } from './rig.ts'
import type { V3 } from './vec.ts'
import { at, lerp3 } from './vec.ts'

const Z: V3 = [0, 0, 1]
const Y: V3 = [0, 1, 0]

export function buildVessels(rig: Rig): MeshData {
  const parts: MeshData[] = []
  const add = (t: TubeResult) => {
    parts.push(t)
    return t
  }
  const taper = (a: number, b: number) => (t: number) => a + (b - a) * t

  const aorta = add(
    tube(
      [
        [0.008, 1.36, 0.046],
        [0.002, 1.385, 0.04],
        [0.0, 1.402, 0.024],
        [0.01, 1.408, 0.0],
        [0.021, 1.395, -0.028],
        [0.024, 1.36, -0.045],
        [0.022, 1.3, -0.053],
        [0.018, 1.22, -0.05],
        [0.012, 1.15, -0.026],
        [0.006, 1.09, -0.006],
        [0.004, 1.047, 0.0],
      ],
      { r: taper(0.0115, 0.0078), radial: 12, density: 120 },
    ),
  )

  // Arch branches
  const bc0: V3 = [-0.001, 1.402, 0.03]
  const brachio = add(tube([bc0, [-0.008, 1.42, 0.034], [-0.015, 1.432, 0.035]], { r: 0.0065, radial: 8, dist0: distAlong(aorta, bc0), density: 200 }))
  const split: V3 = [-0.015, 1.432, 0.035]
  const dSplit = distAlong(brachio, split, brachio.dist ? brachio.dist[0]! : 0)
  const carotid = (start: V3, s: number, d0: number) =>
    add(
      tube([start, [s * 0.022, 1.47, 0.034], [s * 0.026, 1.52, 0.034], [s * 0.031, 1.565, 0.03], [s * 0.036, 1.6, 0.02], [s * 0.03, 1.635, 0.005]], {
        r: taper(0.0048, 0.0036),
        radial: 7,
        dist0: d0,
        density: 140,
        cap: 0.004,
      }),
    )
  carotid(split, -1, dSplit)
  const lc0: V3 = [0.007, 1.406, 0.018]
  carotid(lc0, 1, distAlong(aorta, lc0))

  for (const arm of rig.arms) {
    const s = arm.s
    const start: V3 = s < 0 ? split : [0.015, 1.405, 0.004]
    const d0 = s < 0 ? dSplit : distAlong(aorta, start)
    const { S: Sh, E, W, f, d, w } = arm
    add(
      tube(
        [
          start,
          [s * 0.05, 1.447, 0.03],
          [s * 0.11, 1.438, 0.02],
          at(Sh, [[s, 0, 0], -0.022], [Y, -0.035], [Z, 0.012]),
          at(lerp3(Sh, E, 0.45), [[s, 0, 0], -0.018], [Z, 0.008]),
          at(E, [Z, 0.022], [Y, 0.006]),
          at(lerp3(E, W, 0.5), [Z, 0.014]),
          at(W, [Z, 0.012], [f, -0.006]),
          at(W, [d, 0.04], [w, 0.012]),
        ],
        { r: taper(0.0052, 0.0026), radial: 7, dist0: d0, density: 120, cap: 0.004 },
      ),
    )
  }

  // Renal arteries
  for (const s of [-1, 1]) {
    const p0: V3 = [s * 0.006, 1.115, -0.014]
    add(tube([p0, [s * 0.022, 1.115, -0.025], [s * 0.04, 1.113 + (s > 0 ? 0.008 : 0), -0.04]], { r: 0.0033, radial: 6, dist0: distAlong(aorta, p0), density: 200, cap: 0.003 }))
  }

  // Iliac, femoral, popliteal, posterior tibial, plantar
  const bif: V3 = [0.004, 1.047, 0.0]
  const dBif = distAlong(aorta, bif)
  for (const leg of rig.legs) {
    const { H, K, A, s } = leg
    const X: V3 = [s, 0, 0]
    add(
      tube(
        [
          bif,
          [s * 0.035, 1.005, 0.002],
          [s * 0.062, 0.955, 0.028],
          at(H, [X, -0.006], [Y, -0.008], [Z, 0.045]),
          at(lerp3(H, K, 0.3), [X, -0.012], [Z, 0.03]),
          at(lerp3(H, K, 0.72), [X, -0.022], [Z, -0.004]),
          at(K, [Y, 0.025], [Z, -0.032]),
          at(K, [Y, -0.03], [Z, -0.03]),
          at(lerp3(K, A, 0.5), [Z, -0.014], [X, -0.004]),
          at(A, [X, -0.016], [Z, -0.016], [Y, 0.004]),
          [s * 0.112, 0.022, 0.03],
          [s * 0.118, 0.02, 0.09],
        ],
        { r: taper(0.0068, 0.0024), radial: 8, dist0: dBif, density: 110, cap: 0.004 },
      ),
    )
  }
  return merge(parts)
}
