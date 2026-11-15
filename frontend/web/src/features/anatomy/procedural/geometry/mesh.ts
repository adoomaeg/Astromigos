/** Mesh utilities: tubes along splines, merging, transforms, primitive spheres, and Perlin noise. */
import type { MeshData } from './sdf.ts'
import type { Basis, V3 } from './vec.ts'
import { add, cross, dot, len, mul, norm, sub } from './vec.ts'

// ---------------------------------------------------------------------------
// Catmull-Rom sampling
// ---------------------------------------------------------------------------

export function sampleSpline(ctrl: V3[], samples: number): V3[] {
  const n = ctrl.length
  if (n < 2) return ctrl.slice()
  const P = (i: number): V3 => {
    if (i < 0) return sub(mul(ctrl[0]!, 2), ctrl[1]!)
    if (i >= n) return sub(mul(ctrl[n - 1]!, 2), ctrl[n - 2]!)
    return ctrl[i]!
  }
  const out: V3[] = []
  for (let s = 0; s <= samples; s++) {
    const u = (s / samples) * (n - 1)
    const i = Math.min(n - 2, Math.floor(u))
    const t = u - i
    const p0 = P(i - 1)
    const p1 = P(i)
    const p2 = P(i + 1)
    const p3 = P(i + 2)
    const t2 = t * t
    const t3 = t2 * t
    const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3)
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), c(p0[2], p1[2], p2[2], p3[2])])
  }
  return out
}

export function polylineLength(pts: V3[]): number {
  let l = 0
  for (let i = 1; i < pts.length; i++) l += len(sub(pts[i]!, pts[i - 1]!))
  return l
}

export interface TubeOptions {
  /** Radius, constant or as a function of normalized arc length t in [0,1]. */
  r: number | ((t: number) => number)
  radial?: number
  /** Samples per meter of curve. */
  density?: number
  /** Arc length offset written into `dist` (for pulse propagation). */
  dist0?: number
  /** Round the two ends by shrinking the radius over this length (meters). */
  cap?: number
}

export interface TubeResult extends MeshData {
  samples: V3[]
  cum: number[]
  length: number
}

/** Tube with parallel-transport frames along a Catmull-Rom spline through `ctrl`. */
export function tube(ctrl: V3[], o: TubeOptions): TubeResult {
  const radial = o.radial ?? 8
  const rough = polylineLength(ctrl)
  const nseg = Math.max(4, Math.min(160, Math.ceil(rough * (o.density ?? 160))))
  const pts = sampleSpline(ctrl, nseg)
  const cum: number[] = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + len(sub(pts[i]!, pts[i - 1]!)))
  const L = cum[cum.length - 1]! || 1e-6
  const rf = typeof o.r === 'number' ? () => o.r as number : o.r
  const cap = o.cap ?? 0
  const m = pts.length
  const position = new Float32Array(m * radial * 3)
  const normal = new Float32Array(m * radial * 3)
  const dist = new Float32Array(m * radial)
  let T = norm(sub(pts[1]!, pts[0]!))
  let Nv: V3 = Math.abs(T[1]) < 0.9 ? norm(cross(T, [0, 1, 0])) : norm(cross(T, [1, 0, 0]))
  for (let i = 0; i < m; i++) {
    const a = pts[Math.max(0, i - 1)]!
    const b = pts[Math.min(m - 1, i + 1)]!
    T = norm(sub(b, a))
    Nv = norm(sub(Nv, mul(T, dot(Nv, T))))
    const Bv = cross(T, Nv)
    const s = cum[i]!
    let r = rf(s / L)
    if (cap > 0) {
      const e = Math.min(s, L - s)
      if (e < cap) {
        const q = 1 - e / cap
        r *= Math.sqrt(Math.max(0, 1 - q * q))
      }
    }
    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * Math.PI * 2
      const c = Math.cos(ang)
      const sn = Math.sin(ang)
      const nx = Nv[0] * c + Bv[0] * sn
      const ny = Nv[1] * c + Bv[1] * sn
      const nz = Nv[2] * c + Bv[2] * sn
      const vi = i * radial + j
      position[vi * 3] = pts[i]![0] + nx * r
      position[vi * 3 + 1] = pts[i]![1] + ny * r
      position[vi * 3 + 2] = pts[i]![2] + nz * r
      normal[vi * 3] = nx
      normal[vi * 3 + 1] = ny
      normal[vi * 3 + 2] = nz
      dist[vi] = (o.dist0 ?? 0) + s
    }
  }
  const index = new Uint32Array((m - 1) * radial * 6)
  let t = 0
  for (let i = 0; i < m - 1; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j
      const b = i * radial + ((j + 1) % radial)
      const c = a + radial
      const d = b + radial
      index[t++] = a
      index[t++] = b
      index[t++] = c
      index[t++] = b
      index[t++] = d
      index[t++] = c
    }
  return { position, normal, index, dist, samples: pts, cum, length: L }
}

/** Arc length along a tube closest to point p (to start branch pulses in sync). */
export function distAlong(t: TubeResult, p: V3, dist0 = 0): number {
  let best = Infinity
  let bi = 0
  for (let i = 0; i < t.samples.length; i++) {
    const d = len(sub(t.samples[i]!, p))
    if (d < best) {
      best = d
      bi = i
    }
  }
  return dist0 + t.cum[bi]!
}

// ---------------------------------------------------------------------------
// Merge / transform
// ---------------------------------------------------------------------------

export function merge(parts: MeshData[]): MeshData {
  let nv = 0
  let ni = 0
  const withDist = parts.some((p) => p.dist)
  for (const p of parts) {
    nv += p.position.length / 3
    ni += p.index.length
  }
  const position = new Float32Array(nv * 3)
  const normal = new Float32Array(nv * 3)
  const index = new Uint32Array(ni)
  const dist = withDist ? new Float32Array(nv) : undefined
  let vo = 0
  let io = 0
  for (const p of parts) {
    position.set(p.position, vo * 3)
    normal.set(p.normal, vo * 3)
    if (dist && p.dist) dist.set(p.dist, vo)
    for (let i = 0; i < p.index.length; i++) index[io + i] = p.index[i]! + vo
    vo += p.position.length / 3
    io += p.index.length
  }
  return dist ? { position, normal, index, dist } : { position, normal, index }
}

/** Applies scale (local), then basis rotation (rows = local axes in world), then translation. */
export function transform(m: MeshData, scale: V3, basis: Basis, t: V3): MeshData {
  const n = m.position.length / 3
  const position = new Float32Array(n * 3)
  const normal = new Float32Array(n * 3)
  const [X, Y, Z] = basis
  for (let i = 0; i < n; i++) {
    const px = m.position[i * 3]! * scale[0]
    const py = m.position[i * 3 + 1]! * scale[1]
    const pz = m.position[i * 3 + 2]! * scale[2]
    position[i * 3] = t[0] + X[0] * px + Y[0] * py + Z[0] * pz
    position[i * 3 + 1] = t[1] + X[1] * px + Y[1] * py + Z[1] * pz
    position[i * 3 + 2] = t[2] + X[2] * px + Y[2] * py + Z[2] * pz
    const nx = m.normal[i * 3]! / scale[0]
    const ny = m.normal[i * 3 + 1]! / scale[1]
    const nz = m.normal[i * 3 + 2]! / scale[2]
    const wx = X[0] * nx + Y[0] * ny + Z[0] * nz
    const wy = X[1] * nx + Y[1] * ny + Z[1] * nz
    const wz = X[2] * nx + Y[2] * ny + Z[2] * nz
    const l = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1
    normal[i * 3] = wx / l
    normal[i * 3 + 1] = wy / l
    normal[i * 3 + 2] = wz / l
  }
  return { position, normal, index: m.index.slice() }
}

export function uvSphere(c: V3, r: number, seg = 20): MeshData {
  const rings = Math.max(6, Math.floor(seg * 0.6))
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= rings; i++) {
    const th = (i / rings) * Math.PI
    for (let j = 0; j <= seg; j++) {
      const ph = (j / seg) * Math.PI * 2
      const n: V3 = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]
      const p = add(c, mul(n, r))
      pos.push(p[0], p[1], p[2])
      nor.push(n[0], n[1], n[2])
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j
      const b = a + seg + 1
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  return { position: new Float32Array(pos), normal: new Float32Array(nor), index: new Uint32Array(idx) }
}

// ---------------------------------------------------------------------------
// Improved Perlin noise (deterministic permutation)
// ---------------------------------------------------------------------------

const PERM = (() => {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  let s = 1337
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647
    const j = s % (i + 1)
    const t = p[i]!
    p[i] = p[j]!
    p[j] = t
  }
  const out = new Uint8Array(512)
  for (let i = 0; i < 512; i++) out[i] = p[i & 255]!
  return out
})()

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const grad = (h: number, x: number, y: number, z: number) => {
  const g = h & 15
  const u = g < 8 ? x : y
  const v = g < 4 ? y : g === 12 || g === 14 ? x : z
  return ((g & 1) === 0 ? u : -u) + ((g & 2) === 0 ? v : -v)
}

export function perlin(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const Z = Math.floor(z) & 255
  x -= Math.floor(x)
  y -= Math.floor(y)
  z -= Math.floor(z)
  const u = fade(x)
  const v = fade(y)
  const w = fade(z)
  const A = PERM[X]! + Y
  const AA = PERM[A]! + Z
  const AB = PERM[A + 1]! + Z
  const Bq = PERM[X + 1]! + Y
  const BA = PERM[Bq]! + Z
  const BB = PERM[Bq + 1]! + Z
  const l = (a: number, b: number, t: number) => a + t * (b - a)
  return l(
    l(l(grad(PERM[AA]!, x, y, z), grad(PERM[BA]!, x - 1, y, z), u), l(grad(PERM[AB]!, x, y - 1, z), grad(PERM[BB]!, x - 1, y - 1, z), u), v),
    l(l(grad(PERM[AA + 1]!, x, y, z - 1), grad(PERM[BA + 1]!, x - 1, y, z - 1), u), l(grad(PERM[AB + 1]!, x, y - 1, z - 1), grad(PERM[BB + 1]!, x - 1, y - 1, z - 1), u), v),
    w,
  )
}

// ---------------------------------------------------------------------------
// Plane clipping (joins meshes polygonized at different resolutions)
// ---------------------------------------------------------------------------

/** A cut plane through `p` with normal `n`, applied only within radius `r` of the axis (p, n). */
export interface Cut {
  p: V3
  n: V3
  r: number
}

/**
 * Splits triangles exactly at the cut planes and keeps one side: `inside` keeps the part on the
 * +n side of a cut (within its radius), otherwise everything else. Two meshes of the same surface
 * clipped with complementary sides meet on the plane with no visible seam.
 */
export function clipByCuts(m: MeshData, cuts: Cut[], inside: boolean): MeshData {
  const P = m.position
  const Nn = m.normal
  const pos: number[] = Array.from(P)
  const nor: number[] = Array.from(Nn)
  const idx: number[] = []
  const sd = [0, 0, 0]
  const lerpV = (a: number, b: number, t: number) => {
    const i = pos.length / 3
    for (let k = 0; k < 3; k++) pos.push(pos[a * 3 + k]! + (pos[b * 3 + k]! - pos[a * 3 + k]!) * t)
    let nx = nor[a * 3]! + (nor[b * 3]! - nor[a * 3]!) * t
    let ny = nor[a * 3 + 1]! + (nor[b * 3 + 1]! - nor[a * 3 + 1]!) * t
    let nz = nor[a * 3 + 2]! + (nor[b * 3 + 2]! - nor[a * 3 + 2]!) * t
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
    nx /= l
    ny /= l
    nz /= l
    nor.push(nx, ny, nz)
    return i
  }
  for (let f = 0; f < m.index.length; f += 3) {
    const v = [m.index[f]!, m.index[f + 1]!, m.index[f + 2]!]
    const cx = (P[v[0]! * 3]! + P[v[1]! * 3]! + P[v[2]! * 3]!) / 3
    const cy = (P[v[0]! * 3 + 1]! + P[v[1]! * 3 + 1]! + P[v[2]! * 3 + 1]!) / 3
    const cz = (P[v[0]! * 3 + 2]! + P[v[1]! * 3 + 2]! + P[v[2]! * 3 + 2]!) / 3
    let cut: Cut | null = null
    for (const c of cuts) {
      const d: V3 = [cx - c.p[0], cy - c.p[1], cz - c.p[2]]
      const along = dot(d, c.n)
      const perp = sub(d, mul(c.n, along))
      if (len(perp) < c.r) {
        cut = c
        break
      }
    }
    if (!cut) {
      if (!inside) idx.push(v[0]!, v[1]!, v[2]!)
      continue
    }
    let nIn = 0
    for (let k = 0; k < 3; k++) {
      const q = v[k]! * 3
      const s = (P[q]! - cut.p[0]) * cut.n[0] + (P[q + 1]! - cut.p[1]) * cut.n[1] + (P[q + 2]! - cut.p[2]) * cut.n[2]
      sd[k] = inside ? s : -s
      if (sd[k]! >= 0) nIn++
    }
    if (nIn === 3) {
      idx.push(v[0]!, v[1]!, v[2]!)
      continue
    }
    if (nIn === 0) continue
    // rotate so the lone vertex (inside when nIn = 1, outside when nIn = 2) comes first, keeping winding
    let r = 0
    for (let k = 0; k < 3; k++) if ((sd[k]! >= 0) === (nIn === 1)) r = k
    const a = v[r]!
    const b = v[(r + 1) % 3]!
    const c = v[(r + 2) % 3]!
    const sa = sd[r]!
    const sb = sd[(r + 1) % 3]!
    const sc = sd[(r + 2) % 3]!
    const ab = lerpV(a, b, sa / (sa - sb))
    const ac = lerpV(a, c, sa / (sa - sc))
    if (nIn === 1) idx.push(a, ab, ac)
    else idx.push(ab, b, c, ab, c, ac)
  }
  // drop unreferenced vertices
  const remap = new Int32Array(pos.length / 3).fill(-1)
  let n = 0
  const index = new Uint32Array(idx.length)
  for (let i = 0; i < idx.length; i++) {
    const o = idx[i]!
    if (remap[o]! < 0) remap[o] = n++
    index[i] = remap[o]!
  }
  const position = new Float32Array(n * 3)
  const normal = new Float32Array(n * 3)
  for (let o = 0; o < remap.length; o++) {
    const r = remap[o]!
    if (r < 0) continue
    for (let k = 0; k < 3; k++) {
      position[r * 3 + k] = pos[o * 3 + k]!
      normal[r * 3 + k] = nor[o * 3 + k]!
    }
  }
  return { position, normal, index }
}
