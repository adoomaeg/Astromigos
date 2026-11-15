/** Minimal tuple vector math used by the procedural anatomy builder (worker safe, no three.js). */
export type V3 = [number, number, number]
export type Basis = [V3, V3, V3]

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const len = (a: V3): number => Math.sqrt(dot(a, a))
export const norm = (a: V3): V3 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Sum of weighted vectors: base + v1*s1 + v2*s2 ... */
export function at(base: V3, ...terms: [V3, number][]): V3 {
  let x = base[0]
  let y = base[1]
  let z = base[2]
  for (const [v, s] of terms) {
    x += v[0] * s
    y += v[1] * s
    z += v[2] * s
  }
  return [x, y, z]
}

/** Orthonormal basis whose local Y is `dir`; local Z stays as close as possible to `hintZ`. Rows are [X, Y, Z]. */
export function basisFromY(dir: V3, hintZ: V3 = [0, 0, 1]): Basis {
  const y = norm(dir)
  let h = hintZ
  if (Math.abs(dot(y, norm(h))) > 0.98) h = [1, 0, 0]
  const x = norm(cross(y, h))
  const z = cross(x, y)
  return [x, y, z]
}

/** Basis from an explicit pair: local Z = normal, local Y = up projected onto the plane. */
export function basisFromZY(normal: V3, up: V3): Basis {
  const z = norm(normal)
  const y = norm(sub(up, mul(z, dot(up, z))))
  const x = cross(y, z)
  return [x, y, z]
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Deterministic PRNG (mulberry32) so the procedural model is identical on every load. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
