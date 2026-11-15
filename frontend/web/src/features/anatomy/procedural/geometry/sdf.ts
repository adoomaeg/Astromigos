/**
 * Signed distance primitives and a sparse, block-culled Surface Nets polygonizer.
 *
 * Shapes are closures with an axis-aligned bounding box. A model is an ordered list of
 * prims (smooth union or smooth subtraction). The polygonizer only evaluates 8^3 node
 * blocks that are close to the surface, and only with the prims overlapping each block,
 * so a full human body at 5 mm resolution builds in a few hundred milliseconds.
 */
import type { Basis, V3 } from './vec.ts'
import { clamp } from './vec.ts'

export type SdfFn = (x: number, y: number, z: number) => number

export interface Shape {
  f: SdfFn
  min: V3
  max: V3
}

export interface Prim extends Shape {
  /** 0 = smooth union, 1 = smooth subtraction */
  op: 0 | 1
  k: number
}

export interface MeshData {
  position: Float32Array
  normal: Float32Array
  index: Uint32Array
  /** Optional per-vertex scalar (arc length for vessels). */
  dist?: Float32Array
}

export const U = (s: Shape, k = 0): Prim => ({ f: s.f, min: s.min, max: s.max, op: 0, k })
export const S = (s: Shape, k = 0): Prim => ({ f: s.f, min: s.min, max: s.max, op: 1, k })

export function smin(a: number, b: number, k: number): number {
  const h = k - Math.abs(a - b)
  if (h <= 0) return a < b ? a : b
  const hk = h / k
  return (a < b ? a : b) - hk * hk * k * 0.25
}

export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k)
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export function sphere(c: V3, r: number): Shape {
  const [cx, cy, cz] = c
  return {
    f: (x, y, z) => {
      const dx = x - cx
      const dy = y - cy
      const dz = z - cz
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - r
    },
    min: [cx - r, cy - r, cz - r],
    max: [cx + r, cy + r, cz + r],
  }
}

/** Ellipsoid with optional orientation (basis rows are the local X, Y, Z axes in world space). */
export function ellipsoid(c: V3, r: V3, basis?: Basis): Shape {
  const [cx, cy, cz] = c
  const [rx, ry, rz] = r
  const b = basis ?? [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]
  const [ax0, ax1, ax2] = b[0]
  const [ay0, ay1, ay2] = b[1]
  const [az0, az1, az2] = b[2]
  const irx = 1 / rx
  const iry = 1 / ry
  const irz = 1 / rz
  const rmin = Math.min(rx, ry, rz)
  const ext: V3 = [
    Math.abs(ax0) * rx + Math.abs(ay0) * ry + Math.abs(az0) * rz,
    Math.abs(ax1) * rx + Math.abs(ay1) * ry + Math.abs(az1) * rz,
    Math.abs(ax2) * rx + Math.abs(ay2) * ry + Math.abs(az2) * rz,
  ]
  return {
    f: (x, y, z) => {
      const dx = x - cx
      const dy = y - cy
      const dz = z - cz
      const lx = (dx * ax0 + dy * ax1 + dz * ax2) * irx
      const ly = (dx * ay0 + dy * ay1 + dz * ay2) * iry
      const lz = (dx * az0 + dy * az1 + dz * az2) * irz
      const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz)
      const qx = lx * irx
      const qy = ly * iry
      const qz = lz * irz
      const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz)
      if (k1 < 1e-9) return -rmin
      return (k0 * (k0 - 1)) / k1
    },
    min: [cx - ext[0], cy - ext[1], cz - ext[2]],
    max: [cx + ext[0], cy + ext[1], cz + ext[2]],
  }
}

export function capsule(a: V3, b: V3, r: number): Shape {
  const [ax, ay, az] = a
  const bx = b[0] - ax
  const by = b[1] - ay
  const bz = b[2] - az
  const bb = bx * bx + by * by + bz * bz || 1e-12
  return {
    f: (x, y, z) => {
      const px = x - ax
      const py = y - ay
      const pz = z - az
      const h = clamp((px * bx + py * by + pz * bz) / bb, 0, 1)
      const dx = px - bx * h
      const dy = py - by * h
      const dz = pz - bz * h
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - r
    },
    min: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r],
    max: [Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r],
  }
}

/** Exact round cone (Inigo Quilez): sphere ra at a smoothly tapering to sphere rb at b. */
export function roundCone(a: V3, b: V3, ra: number, rb: number): Shape {
  const [ax, ay, az] = a
  const bax = b[0] - ax
  const bay = b[1] - ay
  const baz = b[2] - az
  const l2 = bax * bax + bay * bay + baz * baz
  const rr = ra - rb
  const a2 = l2 - rr * rr
  const il2 = 1 / l2
  const r = Math.max(ra, rb)
  return {
    f: (x, y, z) => {
      const pax = x - ax
      const pay = y - ay
      const paz = z - az
      const yy = pax * bax + pay * bay + paz * baz
      const zz = yy - l2
      const wx = pax * l2 - bax * yy
      const wy = pay * l2 - bay * yy
      const wz = paz * l2 - baz * yy
      const x2 = wx * wx + wy * wy + wz * wz
      const y2 = yy * yy * l2
      const z2 = zz * zz * l2
      const k = Math.sign(rr) * rr * rr * x2
      if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb
      if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra
    },
    min: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r],
    max: [Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r],
  }
}

/** Rounded cylinder along local Y (radius r, half height hh, edge rounding rd). */
export function roundedCylinder(c: V3, r: number, hh: number, rd: number, basis: Basis): Shape {
  const [cx, cy, cz] = c
  const [ax0, ax1, ax2] = basis[0]
  const [ay0, ay1, ay2] = basis[1]
  const [az0, az1, az2] = basis[2]
  const e = Math.max(r, hh) + rd
  return {
    f: (x, y, z) => {
      const dx = x - cx
      const dy = y - cy
      const dz = z - cz
      const lx = dx * ax0 + dy * ax1 + dz * ax2
      const ly = dx * ay0 + dy * ay1 + dz * ay2
      const lz = dx * az0 + dy * az1 + dz * az2
      const d0 = Math.sqrt(lx * lx + lz * lz) - r + rd
      const d1 = Math.abs(ly) - hh + rd
      const o0 = Math.max(d0, 0)
      const o1 = Math.max(d1, 0)
      return Math.min(Math.max(d0, d1), 0) + Math.sqrt(o0 * o0 + o1 * o1) - rd
    },
    min: [cx - e, cy - e, cz - e],
    max: [cx + e, cy + e, cz + e],
  }
}

/** Torus lying in the local XZ plane. */
export function torus(c: V3, R: number, r: number, basis: Basis): Shape {
  const [cx, cy, cz] = c
  const [ax0, ax1, ax2] = basis[0]
  const [ay0, ay1, ay2] = basis[1]
  const [az0, az1, az2] = basis[2]
  const e = R + r
  return {
    f: (x, y, z) => {
      const dx = x - cx
      const dy = y - cy
      const dz = z - cz
      const lx = dx * ax0 + dy * ax1 + dz * ax2
      const ly = dx * ay0 + dy * ay1 + dz * ay2
      const lz = dx * az0 + dy * az1 + dz * az2
      const q = Math.sqrt(lx * lx + lz * lz) - R
      return Math.sqrt(q * q + ly * ly) - r
    },
    min: [cx - e, cy - e, cz - e],
    max: [cx + e, cy + e, cz + e],
  }
}

export interface LoftKey {
  y: number
  rx: number
  rz: number
  cx: number
  cz: number
}

/**
 * Vertical loft: elliptical cross sections interpolated (Catmull-Rom) between keys sorted by y.
 * Ideal for torso and lungs. Returns the shape plus a sampler for the profile at any y.
 */
export function loft(input: LoftKey[]): Shape & { at: (y: number) => LoftKey } {
  const keys = [...input].sort((a, b) => a.y - b.y)
  const n = keys.length
  const y0 = keys[0]!.y
  const y1 = keys[n - 1]!.y
  const M = 256
  const tab = new Float32Array(M * 4)
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  const fields: (keyof LoftKey)[] = ['rx', 'rz', 'cx', 'cz']
  for (let i = 0; i < M; i++) {
    const y = y0 + ((y1 - y0) * i) / (M - 1)
    let s = 0
    while (s < n - 2 && keys[s + 1]!.y < y) s++
    const k1 = keys[s]!
    const k2 = keys[s + 1]!
    const k0 = keys[Math.max(0, s - 1)]!
    const k3 = keys[Math.min(n - 1, s + 2)]!
    const t = clamp((y - k1.y) / (k2.y - k1.y), 0, 1)
    fields.forEach((f, fi) => {
      tab[i * 4 + fi] = cr(k0[f], k1[f], k2[f], k3[f], t)
    })
  }
  const sample = (y: number, out: number[]) => {
    const t = (clamp(y, y0, y1) - y0) / (y1 - y0) * (M - 1)
    const i = Math.min(M - 2, Math.floor(t))
    const f = t - i
    for (let j = 0; j < 4; j++) out[j] = tab[i * 4 + j]! * (1 - f) + tab[(i + 1) * 4 + j]! * f
  }
  const tmp = [0, 0, 0, 0]
  let mnx = Infinity
  let mxx = -Infinity
  let mnz = Infinity
  let mxz = -Infinity
  for (let i = 0; i < M; i++) {
    const rx = tab[i * 4]!
    const rz = tab[i * 4 + 1]!
    const cx = tab[i * 4 + 2]!
    const cz = tab[i * 4 + 3]!
    mnx = Math.min(mnx, cx - rx)
    mxx = Math.max(mxx, cx + rx)
    mnz = Math.min(mnz, cz - rz)
    mxz = Math.max(mxz, cz + rz)
  }
  return {
    f: (x, y, z) => {
      sample(y, tmp)
      const rx = tmp[0]!
      const rz = tmp[1]!
      const qx = (x - tmp[2]!) / rx
      const qz = (z - tmp[3]!) / rz
      const k0 = Math.sqrt(qx * qx + qz * qz)
      const k1 = Math.sqrt((qx / rx) * (qx / rx) + (qz / rz) * (qz / rz))
      const d2 = k1 < 1e-9 ? -Math.min(rx, rz) : (k0 * (k0 - 1)) / k1
      const dy = Math.max(y0 - y, y - y1)
      if (dy > 0) {
        const o = Math.max(d2, 0)
        return Math.sqrt(o * o + dy * dy)
      }
      return Math.max(d2, dy)
    },
    min: [mnx, y0, mnz],
    max: [mxx, y1, mxz],
    at: (y: number) => {
      sample(y, tmp)
      return { y, rx: tmp[0]!, rz: tmp[1]!, cx: tmp[2]!, cz: tmp[3]! }
    },
  }
}

export function custom(f: SdfFn, min: V3, max: V3): Shape {
  return { f, min, max }
}

/** Collapses an ordered prim list into a single shape (used for sub-assemblies with local ops). */
export function group(prims: Prim[]): Shape {
  const min: V3 = [Infinity, Infinity, Infinity]
  const max: V3 = [-Infinity, -Infinity, -Infinity]
  for (const p of prims) {
    if (p.op !== 0) continue
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a]!, p.min[a]! - p.k * 0.5)
      max[a] = Math.max(max[a]!, p.max[a]! + p.k * 0.5)
    }
  }
  return { f: (x, y, z) => evalList(prims, x, y, z), min, max }
}

/** Adds a displacement field to a shape (e.g. brain gyri). `amp` widens the bounds. */
export function displaced(s: Shape, fn: SdfFn, amp: number): Shape {
  const f0 = s.f
  return {
    f: (x, y, z) => f0(x, y, z) + fn(x, y, z),
    min: [s.min[0] - amp, s.min[1] - amp, s.min[2] - amp],
    max: [s.max[0] + amp, s.max[1] + amp, s.max[2] + amp],
  }
}

/** Hollow shell of thickness t on the inside of a shape. */
export function shell(s: Shape, t: number): Shape {
  const f0 = s.f
  const ht = t * 0.5
  return { f: (x, y, z) => Math.abs(f0(x, y, z) + ht) - ht, min: s.min, max: s.max }
}

export function evalList(list: Prim[], x: number, y: number, z: number): number {
  let d = 1e9
  for (let i = 0; i < list.length; i++) {
    const p = list[i]!
    const s = p.f(x, y, z)
    if (p.op === 0) d = p.k > 0 ? smin(d, s, p.k) : s < d ? s : d
    else d = p.k > 0 ? smax(d, -s, p.k) : -s > d ? -s : d
  }
  return d
}

// ---------------------------------------------------------------------------
// Polygonizer (Surface Nets on a block-sparse grid)
// ---------------------------------------------------------------------------

const CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
]
const EDGES = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]

export interface PolygonizeOptions {
  /** Safety factor for the block skip test. Raise for noisy (non Lipschitz) fields. */
  lipschitz?: number
  /** Only polygonize inside this box (the mesh is open where the surface crosses it). */
  box?: { min: V3; max: V3 }
}

export function polygonize(prims: Prim[], h: number, opts: PolygonizeOptions = {}): MeshData {
  const L = opts.lipschitz ?? 2
  const mn: V3 = [Infinity, Infinity, Infinity]
  const mx: V3 = [-Infinity, -Infinity, -Infinity]
  let kmax = 0
  for (const p of prims) {
    if (p.op !== 0) continue
    for (let a = 0; a < 3; a++) {
      mn[a] = Math.min(mn[a]!, p.min[a]!)
      mx[a] = Math.max(mx[a]!, p.max[a]!)
    }
    kmax = Math.max(kmax, p.k)
  }
  const pad = 3 * h + kmax * 0.5
  for (let a = 0; a < 3; a++) {
    mn[a] = mn[a]! - pad
    mx[a] = mx[a]! + pad
    if (opts.box) {
      mn[a] = Math.max(mn[a]!, opts.box.min[a]!)
      mx[a] = Math.min(mx[a]!, opts.box.max[a]!)
    }
  }
  const nx = Math.ceil((mx[0] - mn[0]) / h) + 1
  const ny = Math.ceil((mx[1] - mn[1]) / h) + 1
  const nz = Math.ceil((mx[2] - mn[2]) / h) + 1
  const sy = nx
  const sz = nx * ny
  const N = nx * ny * nz
  const vals = new Float32Array(N).fill(1)
  const B = 8
  const bnx = Math.ceil(nx / B)
  const bny = Math.ceil(ny / B)
  const bnz = Math.ceil(nz / B)
  const nb = bnx * bny * bnz
  const lists: (Prim[] | null)[] = new Array(nb).fill(null)
  const act = new Uint8Array(nb)
  const np = prims.length
  const exMin = new Float64Array(np * 3)
  const exMax = new Float64Array(np * 3)
  for (let p = 0; p < np; p++) {
    const pr = prims[p]!
    const m = pr.k + 3 * h
    for (let a = 0; a < 3; a++) {
      exMin[p * 3 + a] = pr.min[a]! - m
      exMax[p * 3 + a] = pr.max[a]! + m
    }
  }
  const R = Math.sqrt(3) * B * h * 0.5
  const skip = L * R + 2 * h
  // Per node culling bounds (tighter than the block margin).
  const nMin = new Float64Array(np * 3)
  const nMax = new Float64Array(np * 3)
  for (let p = 0; p < np; p++) {
    const pr = prims[p]!
    const m = pr.k + 2 * h
    for (let a = 0; a < 3; a++) {
      nMin[p * 3 + a] = pr.min[a]! - m
      nMax[p * 3 + a] = pr.max[a]! + m
    }
  }
  const evalCulled = (ids: number[], x: number, y: number, z: number): number => {
    let d = 1e9
    for (let i = 0; i < ids.length; i++) {
      const pi = ids[i]!
      const o = pi * 3
      if (x < nMin[o]! || x > nMax[o]! || y < nMin[o + 1]! || y > nMax[o + 1]! || z < nMin[o + 2]! || z > nMax[o + 2]!) continue
      const p = prims[pi]!
      const s = p.f(x, y, z)
      if (p.op === 0) d = p.k > 0 ? smin(d, s, p.k) : s < d ? s : d
      else d = p.k > 0 ? smax(d, -s, p.k) : -s > d ? -s : d
    }
    return d > 4 * h ? 4 * h : d
  }

  for (let bz = 0; bz < bnz; bz++) {
    const k0 = bz * B
    const k1 = Math.min(k0 + B, nz)
    const z0 = mn[2] + k0 * h
    const z1 = mn[2] + k1 * h
    for (let by = 0; by < bny; by++) {
      const j0 = by * B
      const j1 = Math.min(j0 + B, ny)
      const y0 = mn[1] + j0 * h
      const y1 = mn[1] + j1 * h
      for (let bx = 0; bx < bnx; bx++) {
        const i0 = bx * B
        const i1 = Math.min(i0 + B, nx)
        const x0 = mn[0] + i0 * h
        const x1 = mn[0] + i1 * h
        let list: Prim[] | null = null
        const ids: number[] = []
        let hasU = false
        for (let p = 0; p < np; p++) {
          const o = p * 3
          if (exMax[o]! < x0 || exMin[o]! > x1 || exMax[o + 1]! < y0 || exMin[o + 1]! > y1 || exMax[o + 2]! < z0 || exMin[o + 2]! > z1) continue
          const pr = prims[p]!
          if (!list) list = []
          list.push(pr)
          ids.push(p)
          if (pr.op === 0) hasU = true
        }
        if (!list || !hasU) continue
        const b = bx + bnx * (by + bny * bz)
        lists[b] = list
        const dc = evalList(list, (x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5)
        if (Math.abs(dc) > skip) {
          if (dc < 0) {
            for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) vals[i + sy * j + sz * k] = -1
          }
          continue
        }
        act[b] = 1
        for (let k = k0; k < k1; k++) {
          const z = mn[2] + k * h
          for (let j = j0; j < j1; j++) {
            const y = mn[1] + j * h
            let idx = i0 + sy * j + sz * k
            for (let i = i0; i < i1; i++, idx++) vals[idx] = evalCulled(ids, mn[0] + i * h, y, z)
          }
        }
      }
    }
  }

  // Pass 2: one vertex per sign-changing cell.
  const cellIdx = new Int32Array(N).fill(-1)
  const pos: number[] = []
  const co = CORNERS.map(([a, b, c]) => a! + sy * b! + sz * c!)
  const cv = new Float64Array(8)
  let vc = 0
  const forActive = (fn: (i0: number, i1: number, j0: number, j1: number, k0: number, k1: number) => void) => {
    for (let bz = 0; bz < bnz; bz++)
      for (let by = 0; by < bny; by++)
        for (let bx = 0; bx < bnx; bx++) {
          if (!act[bx + bnx * (by + bny * bz)]) continue
          fn(bx * B, Math.min(bx * B + B, nx), by * B, Math.min(by * B + B, ny), bz * B, Math.min(bz * B + B, nz))
        }
  }
  forActive((i0, i1, j0, j1, k0, k1) => {
    for (let k = k0; k < Math.min(k1, nz - 1); k++)
      for (let j = j0; j < Math.min(j1, ny - 1); j++)
        for (let i = i0; i < Math.min(i1, nx - 1); i++) {
          const idx = i + sy * j + sz * k
          let mask = 0
          for (let c = 0; c < 8; c++) {
            const v = vals[idx + co[c]!]!
            cv[c] = v
            if (v < 0) mask |= 1 << c
          }
          if (mask === 0 || mask === 255) continue
          let ax = 0
          let ay = 0
          let az = 0
          let cnt = 0
          for (let e = 0; e < 12; e++) {
            const ea = EDGES[e]![0]!
            const eb = EDGES[e]![1]!
            const va = cv[ea]!
            const vb = cv[eb]!
            if (va < 0 === vb < 0) continue
            const t = va / (va - vb)
            const A = CORNERS[ea]!
            const Bc = CORNERS[eb]!
            ax += A[0]! + (Bc[0]! - A[0]!) * t
            ay += A[1]! + (Bc[1]! - A[1]!) * t
            az += A[2]! + (Bc[2]! - A[2]!) * t
            cnt++
          }
          pos.push(mn[0] + (i + ax / cnt) * h, mn[1] + (j + ay / cnt) * h, mn[2] + (k + az / cnt) * h)
          cellIdx[idx] = vc++
        }
  })

  // Pass 3: quads across sign-changing grid edges.
  const tris: number[] = []
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    const ia = cellIdx[a]!
    const ib = cellIdx[b]!
    const ic = cellIdx[c]!
    const id = cellIdx[d]!
    if (ia < 0 || ib < 0 || ic < 0 || id < 0) return
    if (!flip) tris.push(ia, ib, ic, ia, ic, id)
    else tris.push(ia, ic, ib, ia, id, ic)
  }
  forActive((i0, i1, j0, j1, k0, k1) => {
    for (let k = k0; k < k1; k++)
      for (let j = j0; j < j1; j++)
        for (let i = i0; i < i1; i++) {
          const idx = i + sy * j + sz * k
          const in0 = vals[idx]! < 0
          if (i < nx - 1 && j > 0 && k > 0 && in0 !== vals[idx + 1]! < 0) quad(idx - sy - sz, idx - sz, idx, idx - sy, !in0)
          if (j < ny - 1 && i > 0 && k > 0 && in0 !== vals[idx + sy]! < 0) quad(idx - 1 - sz, idx - 1, idx, idx - sz, !in0)
          if (k < nz - 1 && i > 0 && j > 0 && in0 !== vals[idx + sz]! < 0) quad(idx - 1 - sy, idx - sy, idx, idx - 1, !in0)
        }
  })

  // Pass 4: analytic normals from the field gradient, then project vertices onto the surface.
  const position = new Float32Array(pos.length)
  const normal = new Float32Array(pos.length)
  const eps = h * 0.4
  const ibx = 1 / (B * h)
  for (let v = 0; v < vc; v++) {
    let x = pos[v * 3]!
    let y = pos[v * 3 + 1]!
    let z = pos[v * 3 + 2]!
    const bx = Math.min(bnx - 1, Math.max(0, Math.floor((x - mn[0]) * ibx)))
    const by = Math.min(bny - 1, Math.max(0, Math.floor((y - mn[1]) * ibx)))
    const bz = Math.min(bnz - 1, Math.max(0, Math.floor((z - mn[2]) * ibx)))
    const list = lists[bx + bnx * (by + bny * bz)] ?? prims
    let gx = evalList(list, x + eps, y, z) - evalList(list, x - eps, y, z)
    let gy = evalList(list, x, y + eps, z) - evalList(list, x, y - eps, z)
    let gz = evalList(list, x, y, z + eps) - evalList(list, x, y, z - eps)
    const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1
    gx /= gl
    gy /= gl
    gz /= gl
    const d = clamp(evalList(list, x, y, z), -h * 0.6, h * 0.6)
    x -= gx * d
    y -= gy * d
    z -= gz * d
    position[v * 3] = x
    position[v * 3 + 1] = y
    position[v * 3 + 2] = z
    normal[v * 3] = gx
    normal[v * 3 + 1] = gy
    normal[v * 3 + 2] = gz
  }
  const index = new Uint32Array(tris)
  orientOutward(position, normal, index)
  return { position, normal, index }
}

/** Makes triangle winding agree with the vertex normals (counter clockwise = front). */
export function orientOutward(position: Float32Array, normal: Float32Array, index: Uint32Array) {
  let score = 0
  const step = Math.max(1, Math.floor(index.length / 3 / 400))
  for (let t = 0; t < index.length; t += 3 * step) {
    const a = index[t]! * 3
    const b = index[t + 1]! * 3
    const c = index[t + 2]! * 3
    const e1x = position[b]! - position[a]!
    const e1y = position[b + 1]! - position[a + 1]!
    const e1z = position[b + 2]! - position[a + 2]!
    const e2x = position[c]! - position[a]!
    const e2y = position[c + 1]! - position[a + 1]!
    const e2z = position[c + 2]! - position[a + 2]!
    const fx = e1y * e2z - e1z * e2y
    const fy = e1z * e2x - e1x * e2z
    const fz = e1x * e2y - e1y * e2x
    score += Math.sign(fx * normal[a]! + fy * normal[a + 1]! + fz * normal[a + 2]!)
  }
  if (score < 0) {
    for (let t = 0; t < index.length; t += 3) {
      const tmp = index[t + 1]!
      index[t + 1] = index[t + 2]!
      index[t + 2] = tmp
    }
  }
}
