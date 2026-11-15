/**
 * Seeded, reproducible randomness for the simulator.
 * Every noise channel gets its own stream derived from (seed, channel name), so adding
 * a channel never shifts the values of another one.
 */

/** FNV-1a 32 bit string hash. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function hashSeed(...parts: Array<string | number>): number {
  return hashString(parts.join('|'))
}

/** mulberry32: small, fast, good enough PRNG for simulation. Returns [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private readonly nextU: () => number
  private spare: number | null = null

  constructor(seed: number) {
    this.nextU = mulberry32(seed)
  }

  uniform(): number {
    return this.nextU()
  }

  /** Standard normal (Box-Muller). */
  normal(): number {
    if (this.spare !== null) {
      const s = this.spare
      this.spare = null
      return s
    }
    let u = 0
    while (u <= 1e-12) u = this.nextU()
    const v = this.nextU()
    const r = Math.sqrt(-2 * Math.log(u))
    this.spare = r * Math.sin(2 * Math.PI * v)
    return r * Math.cos(2 * Math.PI * v)
  }
}

/** Deterministic uniform [0, 1) from a key. */
export function hash01(...parts: Array<string | number>): number {
  return mulberry32(hashSeed(...parts))()
}

/** Deterministic standard normal from a key. */
export function hashNormal(...parts: Array<string | number>): number {
  return new Rng(hashSeed(...parts)).normal()
}

/**
 * Ornstein-Uhlenbeck process in standard units (stationary SD = 1).
 * Gives smooth, correlated noise instead of white jitter. Exact discretization,
 * so it behaves the same for 1 minute and 5 minute steps.
 */
export class OUProcess {
  private readonly rng: Rng
  private readonly tauMin: number
  x: number

  constructor(seed: number, tauMin: number) {
    this.rng = new Rng(seed)
    this.tauMin = tauMin
    this.x = this.rng.normal()
  }

  step(dtMin: number): number {
    const e = Math.exp(-dtMin / this.tauMin)
    this.x = this.x * e + Math.sqrt(1 - e * e) * this.rng.normal()
    return this.x
  }
}
