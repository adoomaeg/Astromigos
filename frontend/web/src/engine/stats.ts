/** Small, dependency free statistics helpers used by the engine. */

/** 1.4826 x MAD estimates the SD of normally distributed data. */
export const MAD_TO_SD = 1.4826

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Smooth 0..1 ramp. */
export function smoothstep(x: number): number {
  const t = clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}

/** Linear interpolated quantile of an already sorted array. */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length
  if (n === 0) return NaN
  if (n === 1) return sorted[0]!
  const pos = clamp(q, 0, 1) * (n - 1)
  const lo = Math.floor(pos)
  const hi = Math.min(n - 1, lo + 1)
  const frac = pos - lo
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * frac
}

export function sortedCopy(values: ArrayLike<number>): Float64Array {
  const a = Float64Array.from(values as ArrayLike<number>)
  a.sort()
  return a
}

export function median(values: ArrayLike<number>): number {
  return quantileSorted(sortedCopy(values), 0.5)
}

/** Median absolute deviation around a given center. */
export function mad(values: ArrayLike<number>, center: number): number {
  const dev = new Float64Array(values.length)
  for (let i = 0; i < values.length; i++) dev[i] = Math.abs(values[i]! - center)
  dev.sort()
  return quantileSorted(dev, 0.5)
}

export function mean(values: ArrayLike<number>): number {
  if (values.length === 0) return NaN
  let s = 0
  for (let i = 0; i < values.length; i++) s += values[i]!
  return s / values.length
}

export function sd(values: ArrayLike<number>, m = mean(values)): number {
  if (values.length < 2) return 0
  let s = 0
  for (let i = 0; i < values.length; i++) s += (values[i]! - m) ** 2
  return Math.sqrt(s / (values.length - 1))
}

/** Robust scale: 1.4826 x MAD, floored so a perfectly flat signal never divides by ~0. */
export function robustScale(madValue: number, minScale: number): number {
  return Math.max(MAD_TO_SD * madValue, minScale)
}

/** Robust z-score: (x - median) / (1.4826 x MAD), with a scale floor. */
export function robustZ(x: number, med: number, madValue: number, minScale: number): number {
  return (x - med) / robustScale(madValue, minScale)
}

/** EWMA smoothing factor for an irregular step dt, given a half-life (same units). */
export function ewmaAlpha(dt: number, halfLife: number): number {
  if (dt <= 0) return 0
  return 1 - Math.pow(0.5, dt / halfLife)
}

export function ewmaUpdate(prev: number | null, x: number, alpha: number): number {
  return prev === null ? x : prev + alpha * (x - prev)
}

/** z in the "bad" direction for a metric. Positive means worse. */
export function badZ(z: number, dir: 'up' | 'down' | 'both'): number {
  return dir === 'up' ? z : dir === 'down' ? -z : Math.abs(z)
}

/** Median of a short list (copy, no mutation). */
export function smallMedian(xs: number[]): number {
  const a = xs.slice().sort((p, q) => p - q)
  const n = a.length
  if (n === 0) return NaN
  return n % 2 ? a[(n - 1) / 2]! : (a[n / 2 - 1]! + a[n / 2]!) / 2
}

/** Least squares slope of v over t. Returns units per t unit, or null with fewer than 3 points. */
export function linearSlope(ts: number[], vs: number[]): number | null {
  const n = ts.length
  if (n < 3) return null
  let mt = 0
  let mv = 0
  for (let i = 0; i < n; i++) {
    mt += ts[i]!
    mv += vs[i]!
  }
  mt /= n
  mv /= n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const dt = ts[i]! - mt
    num += dt * (vs[i]! - mv)
    den += dt * dt
  }
  return den === 0 ? null : num / den
}

export function round(x: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(x * f) / f
}
