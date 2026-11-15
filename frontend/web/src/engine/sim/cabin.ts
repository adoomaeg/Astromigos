/**
 * Simulated cabin environment: CO2, air temperature, humidity and radiation dose rate.
 * Nominal values are in a plausible range for a crewed module; they are simulation
 * values, not ISS measurements.
 */
import { OUProcess, hash01, hashSeed } from '../random'
import { DAY_MS, HOUR_MS, MIN_MS } from '../text'

export interface CabinTruth {
  t: number
  co2: number
  temp: number
  rh: number
  /** Area dose rate in µGy/h. */
  doseRate: number
}

/** ISS-like orbital period (minutes). */
const ORBIT_MIN = 92.7

/** Noise free nominal cabin CO2 (ppm) at sim time t, before scenario additions. */
export function co2Mean(t: number): number {
  const h = (((t % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS
  return 2600 + 220 * Math.sin((2 * Math.PI * (h - 10)) / 24)
}

export class CabinModel {
  private readonly seed: number
  private readonly n: Record<'co2' | 'temp' | 'rh' | 'rad', OUProcess>
  truth: CabinTruth | null = null

  constructor(seed: number) {
    this.seed = seed
    const ou = (name: string, tau: number) => new OUProcess(hashSeed(seed, 'cabin', name), tau)
    this.n = { co2: ou('co2', 45), temp: ou('temp', 90), rh: ou('rh', 90), rad: ou('rad', 5) }
  }

  /** Dose rate model: latitude modulation twice per orbit plus South Atlantic Anomaly passes on some orbits. */
  doseRateAt(t: number, noise: number): number {
    const orbitMs = ORBIT_MIN * MIN_MS
    const orbit = Math.floor(t / orbitMs)
    const phaseMin = (t - orbit * orbitMs) / MIN_MS
    let rate = 13 + 5 * Math.abs(Math.sin((2 * Math.PI * phaseMin) / ORBIT_MIN))
    if (hash01(this.seed, 'saa', orbit) < 0.4) {
      const center = 20 + 50 * hash01(this.seed, 'saa-c', orbit)
      rate += 26 * Math.exp(-(((phaseMin - center) / 4) ** 2))
    }
    return Math.max(0, rate + 0.8 * noise)
  }

  step(t: number, dtMin: number, co2Add: number): CabinTruth {
    const h = (((t % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS
    const nCo2 = this.n.co2.step(dtMin)
    const nTemp = this.n.temp.step(dtMin)
    const nRh = this.n.rh.step(dtMin)
    const nRad = this.n.rad.step(dtMin)
    const day = Math.sin((2 * Math.PI * (h - 10)) / 24)
    this.truth = {
      t,
      co2: 2600 + 220 * day + 130 * nCo2 + co2Add, // mean part: co2Mean(t)
      temp: 22.6 + 0.35 * Math.sin((2 * Math.PI * (h - 15)) / 24) + 0.22 * nTemp,
      rh: 45 + 2.5 * day + 1.8 * nRh,
      doseRate: this.doseRateAt(t, nRad),
    }
    return this.truth
  }
}
