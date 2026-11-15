import { describe, expect, it } from 'vitest'
import { binMeans, buildPrediction, holtFit, holtForecast, holtIntervalSd } from './forecast'
import { DAY_MS, HOUR_MS, MIN_MS } from './text'

const NOW = Date.parse('2026-11-14T12:00:00Z')

describe('Holt linear smoothing', () => {
  it('follows a linear trend (damped)', () => {
    const y = Array.from({ length: 40 }, (_, i) => 10 + 0.5 * i)
    const fit = holtFit(y, 0.5, 0.3, 1)!
    const f = holtForecast(fit, 4)
    expect(f[0]).toBeCloseTo(30, 0)
    expect(f[3]).toBeCloseTo(31.5, 0)
    const damped = holtForecast(holtFit(y, 0.5, 0.3, 0.8)!, 20)
    // damping keeps long horizons from running away
    expect(damped[19]! - damped[0]!).toBeLessThan(0.5 * 19)
  })

  it('returns null with too few points', () => {
    expect(holtFit([1, 2])).toBeNull()
  })

  it('interval widens with the horizon', () => {
    const y = Array.from({ length: 30 }, (_, i) => 50 + Math.sin(i))
    const fit = holtFit(y)!
    const s1 = holtIntervalSd(fit, 1)
    const s12 = holtIntervalSd(fit, 12)
    expect(s12).toBeGreaterThan(s1)
  })

  it('bins irregular points into time windows', () => {
    const b = binMeans(
      [
        { t: 0, v: 1 },
        { t: 10, v: 3 },
        { t: 100, v: 5 },
      ],
      0,
      50,
    )
    expect(b).toEqual([
      { t: 25, v: 2 },
      { t: 125, v: 5 },
    ])
  })
})

describe('buildPrediction', () => {
  const rising = (hours: number) =>
    Array.from({ length: hours * 60 }, (_, i) => ({ t: NOW - (hours * 60 - i) * MIN_MS, v: 60 + (i / 60) * 0.8 + Math.sin(i / 7) }))

  it('is not eligible with insufficient data', () => {
    const p = buildPrediction({ astronautId: 'A', metric: 'HEART_RATE', now: NOW, kind: 'continuous', points: rising(2), band: { low: 50, high: 70 } })
    expect(p.eligible).toBe(false)
    expect(p.points).toHaveLength(0)
    expect(p.disclaimer).toMatch(/Insufficient data/)
  })

  it('gives a 6 h horizon with partial data and 24 h with a full day, with widening 80% intervals', () => {
    const p6 = buildPrediction({ astronautId: 'A', metric: 'HEART_RATE', now: NOW, kind: 'continuous', points: rising(8), band: { low: 50, high: 70 } })
    expect(p6.eligible).toBe(true)
    expect(p6.horizonHours).toBe(6)
    const p24 = buildPrediction({ astronautId: 'A', metric: 'HEART_RATE', now: NOW, kind: 'continuous', points: rising(24), band: { low: 50, high: 90 } })
    expect(p24.horizonHours).toBe(24)
    expect(p24.intervalLabel).toBe('80% interval')
    const first = p24.points[0]!
    const last = p24.points[p24.points.length - 1]!
    expect(last.hi - last.lo).toBeGreaterThan(first.hi - first.lo)
    expect(first.lo).toBeLessThanOrEqual(first.v)
    expect(first.hi).toBeGreaterThanOrEqual(first.v)
    expect(p24.disclaimer).toMatch(/Not a clinical prediction/)
  })

  it('estimates hours until the central forecast leaves the personal band', () => {
    // currently ~79 and rising 0.8/h; band high 80 -> exit within a few hours
    const p = buildPrediction({ astronautId: 'A', metric: 'HEART_RATE', now: NOW, kind: 'continuous', points: rising(24), band: { low: 50, high: 80 } })
    expect(p.hoursToBandExit).not.toBeNull()
    expect(p.hoursToBandExit!).toBeGreaterThan(0)
    expect(p.hoursToBandExit!).toBeLessThan(12)
    const inside = buildPrediction({ astronautId: 'A', metric: 'HEART_RATE', now: NOW, kind: 'continuous', points: rising(24), band: { low: 0, high: 500 } })
    expect(inside.hoursToBandExit).toBeNull()
  })

  it('handles daily metrics with day steps', () => {
    const pts = Array.from({ length: 12 }, (_, i) => ({ t: NOW - (12 - i) * DAY_MS + 6 * HOUR_MS, v: 7 - i * 0.1 }))
    const p = buildPrediction({ astronautId: 'A', metric: 'SLEEP_DURATION', now: NOW, kind: 'event', points: pts, band: { low: 6, high: 8 }, physicalMin: 0 })
    expect(p.eligible).toBe(true)
    expect(p.points).toHaveLength(3)
    expect(p.points[2]!.v).toBeLessThan(p.points[0]!.v)
  })

  it('does not report a band exit while a metric is recovering from the opposite side', () => {
    // 20 h at 62 bpm, then an acute spike to 140 for 2 h, then a fast return to 62 in the last hour
    const pts = Array.from({ length: 23 * 60 }, (_, i) => {
      const hAgo = 23 - i / 60
      const v = hAgo > 3 ? 62 : hAgo > 1 ? 140 : 62
      return { t: NOW - hAgo * HOUR_MS, v }
    })
    const p = buildPrediction({ astronautId: 'A', metric: 'HEART_RATE', now: NOW, kind: 'continuous', points: pts, band: { low: 52, high: 78 } })
    expect(p.eligible).toBe(true)
    expect(p.hoursToBandExit).toBeNull()
  })
})
