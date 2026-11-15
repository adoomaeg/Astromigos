/**
 * Short horizon statistical projection: damped Holt linear smoothing.
 *
 *   level_t = alpha y_t + (1 - alpha)(level_{t-1} + phi trend_{t-1})
 *   trend_t = beta (level_t - level_{t-1}) + (1 - beta) phi trend_{t-1}
 *   yhat_{t+h} = level_t + (phi + phi^2 + ... + phi^h) trend_t
 *
 * The 80% interval uses the one step residual SD widened with the horizon:
 *   sd_h = sd_1 x sqrt(1 + sum_{j=1}^{h-1} (alpha (1 + beta (phi + ... + phi^j)))^2)
 *
 * Horizons are shown only when there is enough recent data (PROJECT_MASTER 9.6).
 * This is a statistical projection of simulated data, never a clinical prediction.
 */
import type { MetricCode, Prediction } from '../types/domain'
import { FORECAST, FORECAST_METHOD } from './config'
import { clamp, sd } from './stats'
import { DAY_MS, HOUR_MS, MIN_MS } from './text'

export interface HoltFit {
  level: number
  trend: number
  residSd: number
  n: number
  alpha: number
  beta: number
  phi: number
}

export function holtFit(y: number[], alpha: number = FORECAST.alpha, beta: number = FORECAST.beta, phi: number = FORECAST.phi): HoltFit | null {
  const n = y.length
  if (n < 3) return null
  let level = y[0]!
  let trend = (y[Math.min(n - 1, 3)]! - y[0]!) / Math.min(n - 1, 3)
  const resid: number[] = []
  for (let i = 1; i < n; i++) {
    const pred = level + phi * trend
    resid.push(y[i]! - pred)
    const prevLevel = level
    level = alpha * y[i]! + (1 - alpha) * (level + phi * trend)
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend
  }
  // Use recent residuals: the series may have changed regime.
  const recent = resid.slice(-Math.max(6, Math.floor(resid.length / 2)))
  let residSd = Math.sqrt(recent.reduce((s, r) => s + r * r, 0) / Math.max(1, recent.length))
  if (!Number.isFinite(residSd) || residSd === 0) residSd = sd(y) || 1e-6
  return { level, trend, residSd, n, alpha, beta, phi }
}

export function holtForecast(fit: HoltFit, steps: number): number[] {
  const out: number[] = []
  let phiSum = 0
  let phiPow = 1
  for (let h = 1; h <= steps; h++) {
    phiPow *= fit.phi
    phiSum += phiPow
    out.push(fit.level + phiSum * fit.trend)
  }
  return out
}

/** SD of the h step ahead forecast error (approximation for damped Holt). */
export function holtIntervalSd(fit: HoltFit, h: number): number {
  let acc = 1
  let phiSum = 0
  let phiPow = 1
  for (let j = 1; j < h; j++) {
    phiPow *= fit.phi
    phiSum += phiPow
    const c = fit.alpha * (1 + fit.beta * phiSum)
    acc += c * c
  }
  return fit.residSd * Math.sqrt(acc)
}

/** Mean per time bin, skipping empty bins. */
export function binMeans(points: Array<{ t: number; v: number }>, t0: number, binMs: number): Array<{ t: number; v: number }> {
  const sums = new Map<number, { s: number; n: number }>()
  for (const p of points) {
    if (p.t < t0) continue
    const k = Math.floor((p.t - t0) / binMs)
    const e = sums.get(k)
    if (e) {
      e.s += p.v
      e.n++
    } else sums.set(k, { s: p.v, n: 1 })
  }
  return [...sums.entries()].sort((a, b) => a[0] - b[0]).map(([k, e]) => ({ t: t0 + (k + 0.5) * binMs, v: e.s / e.n }))
}

export const FORECAST_DISCLAIMER =
  'Statistical projection from recent simulated data. Not a clinical prediction: uncertainty grows with the horizon and the projection assumes recent conditions continue.'

export interface ForecastInput {
  astronautId: string
  metric: MetricCode
  now: number
  kind: 'continuous' | 'event'
  /** Continuous: raw (context adjusted) points of the last FORECAST.windowHours. Event: one point per day. */
  points: Array<{ t: number; v: number }>
  band: { low: number; high: number } | null
  physicalMin?: number
  physicalMax?: number
  methodNote?: string
}

function ineligible(input: ForecastInput, why: string): Prediction {
  return {
    astronautId: input.astronautId,
    metric: input.metric,
    method: FORECAST_METHOD,
    horizonHours: 0,
    points: [],
    intervalLabel: '80% interval',
    hoursToBandExit: null,
    eligible: false,
    disclaimer: `Insufficient data for a projection (${why}).`,
  }
}

export function buildPrediction(input: ForecastInput): Prediction {
  const lo = input.physicalMin ?? -Infinity
  const hi = input.physicalMax ?? Infinity
  let series: Array<{ t: number; v: number }>
  let stepMs: number
  let steps: number
  if (input.kind === 'continuous') {
    const binMs = FORECAST.binMin * MIN_MS
    const t0 = input.now - FORECAST.windowHours * HOUR_MS
    series = binMeans(input.points, t0, binMs)
    if (series.length < FORECAST.minBins) return ineligible(input, `${series.length} of ${FORECAST.minBins} half-hour windows with data`)
    const last = series[series.length - 1]!
    if (input.now - last.t > 2 * HOUR_MS) return ineligible(input, 'no recent values')
    stepMs = binMs
    const horizonH = series.length >= FORECAST.binsFor24h ? 24 : 6
    steps = (horizonH * HOUR_MS) / binMs
  } else {
    series = input.points.slice(-14)
    if (series.length < FORECAST.minEvents) return ineligible(input, `${series.length} of ${FORECAST.minEvents} daily values`)
    const last = series[series.length - 1]!
    if (input.now - last.t > 2 * DAY_MS) return ineligible(input, 'no recent values')
    stepMs = DAY_MS
    steps = series.length >= FORECAST.eventsFor72h ? 3 : 1
  }
  const fit = holtFit(series.map((p) => p.v))
  if (!fit) return ineligible(input, 'too few points')
  const central = holtForecast(fit, steps)
  const lastT = series[series.length - 1]!.t
  const startT = input.kind === 'continuous' ? input.now : lastT
  const pts = central.map((v, i) => {
    const h = i + 1
    const s = FORECAST.z80 * holtIntervalSd(fit, h)
    return {
      t: startT + h * stepMs,
      v: clamp(v, lo, hi),
      lo: clamp(v - s, lo, hi),
      hi: clamp(v + s, lo, hi),
    }
  })
  let hoursToBandExit: number | null = null
  if (input.band) {
    const band = input.band
    const outside = (v: number) => v < band.low || v > band.high
    // Judge "outside now" on the latest observed window, not on the smoothed level,
    // which lags behind a fast change (for example right after a recovery).
    const lastV = series[series.length - 1]!.v
    if (outside(lastV)) hoursToBandExit = 0
    else {
      const first = pts.find((p) => outside(p.v))
      if (first) {
        // A series that just came back from the opposite side of the band is recovering:
        // its downward (or upward) momentum is not a drift out of the normal range.
        // Recovering = a recent excursion outside the band and the trend points back from it.
        // The smoothed level lags, so the projection can still sit on either side of the band.
        const recent = series.slice(-FORECAST.recoveryLookbackBins)
        const recovering =
          (fit.trend < 0 && recent.some((p) => p.v > band.high)) || (fit.trend > 0 && recent.some((p) => p.v < band.low))
        if (!recovering) hoursToBandExit = Math.max(0, (first.t - input.now) / HOUR_MS)
      }
    }
  }
  const horizonHours = Math.round((pts[pts.length - 1]!.t - input.now) / HOUR_MS)
  return {
    astronautId: input.astronautId,
    metric: input.metric,
    method: input.methodNote ? `${FORECAST_METHOD} (${input.methodNote})` : FORECAST_METHOD,
    horizonHours,
    points: pts,
    intervalLabel: '80% interval',
    hoursToBandExit,
    eligible: true,
    disclaimer: FORECAST_DISCLAIMER,
  }
}
