/**
 * Quadric error mesh decimation (half edge collapse, Garland and Heckbert).
 *
 * Surface Nets output is uniformly dense: flat and gently curved areas carry as many triangles
 * as fingers or facial features. Collapsing vertices onto a neighbor while the summed squared
 * distance to the original face planes stays below a tolerance removes most of those triangles
 * with no visible change. Half edge collapse keeps surviving vertices exactly where they were,
 * so the analytic SDF normals (and any per vertex attribute) stay valid.
 */
import type { MeshData, PolygonizeOptions, Prim } from './sdf.ts'
import { polygonize } from './sdf.ts'

export interface DecimateOptions {
  /** Max geometric deviation in meters (compared against the accumulated quadric error). */
  tol: number
  /** Never go below this fraction of the input triangles (default 0.08). */
  minRatio?: number
  /** Reject collapses producing triangles worse than this shape quality (0..1, default 0.12). */
  minQuality?: number
}

export function decimate(m: MeshData, o: DecimateOptions): MeshData {
  const nv = m.position.length / 3
  const nf = m.index.length / 3
  if (nf < 64) return m
  const P = m.position
  const N = m.normal
  const F = new Int32Array(m.index)
  const faceAlive = new Uint8Array(nf).fill(1)
  const Q = new Float64Array(nv * 10)
  // vertex to face lists in fixed capacity slots (no per vertex arrays, no GC churn)
  const CAP = 32
  const vfD = new Int32Array(nv * CAP)
  const vfN = new Int32Array(nv)
  const frozen = new Uint8Array(nv)
  const addVF = (v: number, f: number) => {
    if (vfN[v]! < CAP) vfD[v * CAP + vfN[v]!] = f
    else frozen[v] = 1
    vfN[v] = vfN[v]! + 1
  }
  const tol2 = o.tol * o.tol
  const minQ = o.minQuality ?? 0.12
  const target = Math.floor(nf * (o.minRatio ?? 0.08))

  for (let f = 0; f < nf; f++) {
    addVF(F[f * 3]!, f)
    addVF(F[f * 3 + 1]!, f)
    addVF(F[f * 3 + 2]!, f)
  }
  // Quadric per vertex from its analytic (SDF gradient) tangent plane. Unlike face planes these
  // are not disturbed by the zigzag orientation of Surface Nets triangles on thin features.
  for (let v = 0; v < nv; v++) {
    const nx = N[v * 3]!
    const ny = N[v * 3 + 1]!
    const nz = N[v * 3 + 2]!
    const d = -(nx * P[v * 3]! + ny * P[v * 3 + 1]! + nz * P[v * 3 + 2]!)
    const q = v * 10
    Q[q] = nx * nx
    Q[q + 1] = nx * ny
    Q[q + 2] = nx * nz
    Q[q + 3] = nx * d
    Q[q + 4] = ny * ny
    Q[q + 5] = ny * nz
    Q[q + 6] = ny * d
    Q[q + 7] = nz * nz
    Q[q + 8] = nz * d
    Q[q + 9] = d * d
  }

  // Lock vertices on open or non manifold edges (every edge of a closed manifold has exactly 2 faces).
  const locked = new Uint8Array(nv)
  const ids = new Int32Array(CAP * 2)
  const cnt = new Int32Array(CAP * 2)
  for (let v = 0; v < nv; v++) {
    const len = vfN[v]!
    if (len === 0 || frozen[v]) {
      locked[v] = 1
      continue
    }
    let n = 0
    for (let i = 0; i < len; i++) {
      const b = vfD[v * CAP + i]! * 3
      for (let k = 0; k < 3; k++) {
        const w = F[b + k]!
        if (w === v) continue
        let j = 0
        while (j < n && ids[j] !== w) j++
        if (j === n) {
          ids[n] = w
          cnt[n++] = 1
        } else cnt[j] = cnt[j]! + 1
      }
    }
    for (let i = 0; i < n; i++) if (cnt[i] !== 2) locked[v] = 1
  }

  const qErr = (q: number, v: number) => {
    const x = P[v * 3]!
    const y = P[v * 3 + 1]!
    const z = P[v * 3 + 2]!
    return (
      Q[q]! * x * x +
      2 * Q[q + 1]! * x * y +
      2 * Q[q + 2]! * x * z +
      2 * Q[q + 3]! * x +
      Q[q + 4]! * y * y +
      2 * Q[q + 5]! * y * z +
      2 * Q[q + 6]! * y +
      Q[q + 7]! * z * z +
      2 * Q[q + 8]! * z +
      Q[q + 9]!
    )
  }
  /** Qv(p_v), refreshed whenever Qv grows. */
  const selfErr = new Float64Array(nv)
  for (let v = 0; v < nv; v++) selfErr[v] = qErr(v * 10, v)
  /** Cost of moving u onto t: (Qu + Qt)(p_t) = Qu(p_t) + Qt(p_t). */
  const cost = (u: number, t: number) => Math.max(0, qErr(u * 10, t) + selfErr[t]!)

  /**
   * One ring of u into out (returns the count). On a closed oriented manifold every neighbor is
   * the vertex after u in exactly one face, so no dedupe is needed; locked vertices dedupe.
   */
  const neighbors = (u: number, out: Int32Array): number => {
    const o = u * CAP
    const len = Math.min(CAP, vfN[u]!)
    let n = 0
    if (!locked[u]) {
      for (let i = 0; i < len; i++) {
        const b = vfD[o + i]! * 3
        out[n++] = F[b] === u ? F[b + 1]! : F[b + 1] === u ? F[b + 2]! : F[b]!
      }
      return n
    }
    for (let i = 0; i < len; i++) {
      const b = vfD[o + i]! * 3
      for (let k = 0; k < 3; k++) {
        const w = F[b + k]!
        if (w === u) continue
        let seen = false
        for (let j = 0; j < n; j++)
          if (out[j] === w) {
            seen = true
            break
          }
        if (!seen && n < out.length) out[n++] = w
      }
    }
    return n
  }

  const nbU = new Int32Array(256)
  const nbT = new Int32Array(256)
  const valid = (u: number, t: number): boolean => {
    if (locked[u] || frozen[t] || vfN[u]! + vfN[t]! - 4 > CAP) return false
    let shared = 0
    const fo = u * CAP
    const fn = vfN[u]!
    for (let i = 0; i < fn; i++) {
      const b = vfD[fo + i]! * 3
      if (F[b] === t || F[b + 1] === t || F[b + 2] === t) shared++
    }
    if (shared !== 2) return false
    const cu = neighbors(u, nbU)
    const ct = neighbors(t, nbT)
    let common = 0
    for (let i = 0; i < cu; i++)
      for (let j = 0; j < ct; j++)
        if (nbU[i] === nbT[j]) {
          common++
          break
        }
    if (common !== 2) return false
    const tx = P[t * 3]!
    const ty = P[t * 3 + 1]!
    const tz = P[t * 3 + 2]!
    for (let fi = 0; fi < fn; fi++) {
      const f = vfD[fo + fi]!
      const i0 = F[f * 3]!
      const i1 = F[f * 3 + 1]!
      const i2 = F[f * 3 + 2]!
      if (i0 === t || i1 === t || i2 === t) continue
      // old and new triangle (u replaced by t)
      const ax = P[i0 * 3]!
      const ay = P[i0 * 3 + 1]!
      const az = P[i0 * 3 + 2]!
      const bx = P[i1 * 3]!
      const by = P[i1 * 3 + 1]!
      const bz = P[i1 * 3 + 2]!
      const cx = P[i2 * 3]!
      const cy = P[i2 * 3 + 1]!
      const cz = P[i2 * 3 + 2]!
      const on = triNormal(ax, ay, az, bx, by, bz, cx, cy, cz, tmpA)
      const nax = i0 === u ? tx : ax
      const nay = i0 === u ? ty : ay
      const naz = i0 === u ? tz : az
      const nbx = i1 === u ? tx : bx
      const nby = i1 === u ? ty : by
      const nbz = i1 === u ? tz : bz
      const ncx = i2 === u ? tx : cx
      const ncy = i2 === u ? ty : cy
      const ncz = i2 === u ? tz : cz
      const nn = triNormal(nax, nay, naz, nbx, nby, nbz, ncx, ncy, ncz, tmpB)
      if (nn < 1e-16 || on < 1e-16) return false
      const dp = (tmpA[0]! * tmpB[0]! + tmpA[1]! * tmpB[1]! + tmpA[2]! * tmpB[2]!) / Math.sqrt(on * nn)
      if (dp < 0.35) return false
      // new face must agree with the analytic normals it will be shaded with
      const j0 = (i0 === u ? t : i0) * 3
      const j1 = (i1 === u ? t : i1) * 3
      const j2 = (i2 === u ? t : i2) * 3
      const vx = N[j0]! + N[j1]! + N[j2]!
      const vy = N[j0 + 1]! + N[j1 + 1]! + N[j2 + 1]!
      const vz = N[j0 + 2]! + N[j1 + 2]! + N[j2 + 2]!
      if ((vx * tmpB[0]! + vy * tmpB[1]! + vz * tmpB[2]!) / Math.sqrt(nn) < 0.6) return false
      // shape quality: 4 sqrt(3) area / sum of squared edge lengths (1 = equilateral)
      const e = (nbx - nax) ** 2 + (nby - nay) ** 2 + (nbz - naz) ** 2 + (ncx - nbx) ** 2 + (ncy - nby) ** 2 + (ncz - nbz) ** 2 + (nax - ncx) ** 2 + (nay - ncy) ** 2 + (naz - ncz) ** 2
      if ((2 * Math.sqrt(3) * Math.sqrt(nn)) / e < minQ) return false
    }
    return true
  }

  // Batched passes: every pass collapses the cheapest candidates whose neighborhoods do not
  // overlap, then only the touched vertices get their best target recomputed (no global heap).
  const best = new Int32Array(nv).fill(-1)
  const bestCost = new Float64Array(nv).fill(Infinity)
  const dirty = new Uint8Array(nv).fill(1)
  const stamp = new Int32Array(nv).fill(-1)
  const alive = new Uint8Array(nv).fill(1)
  const nb = new Int32Array(256)
  const ring = new Int32Array(256)
  let faces = nf
  const cand = new Int32Array(nv)
  const order = new Int32Array(nv)
  const bucketOf = new Uint8Array(nv)
  const BUCKETS = 48
  const bucketCount = new Int32Array(BUCKETS + 1)
  for (let pass = 0; pass < 40 && faces > target; pass++) {
    let nc = 0
    for (let u = 0; u < nv; u++) {
      if (!alive[u] || locked[u]) continue
      if (dirty[u]) {
        dirty[u] = 0
        const cn = neighbors(u, nb)
        let bc = Infinity
        let bt = -1
        for (let i = 0; i < cn; i++) {
          const c = cost(u, nb[i]!)
          if (c < bc) {
            bc = c
            bt = nb[i]!
          }
        }
        best[u] = bt
        bestCost[u] = bc
      }
      if (bestCost[u]! <= tol2) cand[nc++] = u
    }
    if (nc === 0) break
    // approximate cost order via counting sort into buckets (exact order is not needed)
    bucketCount.fill(0)
    for (let i = 0; i < nc; i++) {
      const bk = Math.min(BUCKETS - 1, Math.floor(Math.sqrt(bestCost[cand[i]!]! / tol2) * BUCKETS))
      bucketOf[i] = bk
      bucketCount[bk + 1] = bucketCount[bk + 1]! + 1
    }
    for (let k = 1; k <= BUCKETS; k++) bucketCount[k] = bucketCount[k]! + bucketCount[k - 1]!
    for (let i = 0; i < nc; i++) {
      const bk = bucketOf[i]!
      order[bucketCount[bk]!] = cand[i]!
      bucketCount[bk] = bucketCount[bk]! + 1
    }
    let collapsed = 0
    for (let i = 0; i < nc && faces > target; i++) {
      const u = order[i]!
      const t = best[u]!
      if (stamp[u] === pass || t < 0 || stamp[t] === pass || !alive[t]) continue
      if (!valid(u, t)) {
        // stays out until its neighborhood changes
        bestCost[u] = Infinity
        continue
      }
      // collapse u -> t
      const cr = neighbors(u, ring)
      for (let k = 0; k < cr; k++) stamp[ring[k]!] = pass
      for (let k = 0; k < 10; k++) Q[t * 10 + k] = Q[t * 10 + k]! + Q[u * 10 + k]!
      selfErr[t] = qErr(t * 10, t)
      const un = vfN[u]!
      for (let j = 0; j < un; j++) {
        const f = vfD[u * CAP + j]!
        const b = f * 3
        if (F[b] === t || F[b + 1] === t || F[b + 2] === t) {
          faceAlive[f] = 0
          faces--
          for (let k = 0; k < 3; k++) {
            const w = F[b + k]!
            if (w === u) continue
            const wo = w * CAP
            const wn = vfN[w]!
            for (let q = 0; q < wn; q++) {
              if (vfD[wo + q] !== f) continue
              vfD[wo + q] = vfD[wo + wn - 1]!
              vfN[w] = wn - 1
              break
            }
          }
        } else {
          for (let k = 0; k < 3; k++) if (F[b + k] === u) F[b + k] = t
          vfD[t * CAP + vfN[t]!] = f
          vfN[t] = vfN[t]! + 1
        }
      }
      vfN[u] = 0
      alive[u] = 0
      stamp[u] = pass
      stamp[t] = pass
      dirty[t] = 1
      const ct = neighbors(t, ring)
      for (let k = 0; k < ct; k++) {
        stamp[ring[k]!] = pass
        dirty[ring[k]!] = 1
      }
      collapsed++
    }
    if (collapsed === 0) break
  }
  // compact
  const remap = new Int32Array(nv).fill(-1)
  let nvOut = 0
  const outIdx = new Uint32Array(faces * 3)
  let fi = 0
  for (let f = 0; f < nf; f++) {
    if (!faceAlive[f]) continue
    for (let k = 0; k < 3; k++) {
      const v = F[f * 3 + k]!
      if (remap[v]! < 0) remap[v] = nvOut++
      outIdx[fi++] = remap[v]!
    }
  }
  const position = new Float32Array(nvOut * 3)
  const normal = new Float32Array(nvOut * 3)
  const dist = m.dist ? new Float32Array(nvOut) : undefined
  for (let v = 0; v < nv; v++) {
    const r = remap[v]!
    if (r < 0) continue
    position[r * 3] = P[v * 3]!
    position[r * 3 + 1] = P[v * 3 + 1]!
    position[r * 3 + 2] = P[v * 3 + 2]!
    normal[r * 3] = N[v * 3]!
    normal[r * 3 + 1] = N[v * 3 + 1]!
    normal[r * 3 + 2] = N[v * 3 + 2]!
    if (dist && m.dist) dist[r] = m.dist[v]!
  }
  return dist ? { position, normal, index: outIdx, dist } : { position, normal, index: outIdx }
}

const tmpA = [0, 0, 0]
const tmpB = [0, 0, 0]
/** Unnormalized triangle normal into out; returns its squared length. */
function triNormal(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, out: number[]): number {
  const ux = bx - ax
  const uy = by - ay
  const uz = bz - az
  const vx = cx - ax
  const vy = cy - ay
  const vz = cz - az
  out[0] = uy * vz - uz * vy
  out[1] = uz * vx - ux * vz
  out[2] = ux * vy - uy * vx
  return out[0] * out[0] + out[1] * out[1] + out[2] * out[2]
}

/** Polygonize then decimate. `tol` defaults to 12 percent of the grid step. */
export function polygonizeLite(prims: Prim[], h: number, tol = h * 0.12, opts: PolygonizeOptions = {}): MeshData {
  return decimate(polygonize(prims, h, opts), { tol })
}
