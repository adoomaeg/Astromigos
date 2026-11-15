import { describe, expect, it } from 'vitest'
import { Reservoir, computeBaseline } from './baseline'

const opts = { metric: 'HEART_RATE' as const, minN: 10, minScale: 1, windowLabel: 'test' }

describe('computeBaseline', () => {
  it('is INSUFFICIENT_DATA below the minimum sample size', () => {
    const b = computeBaseline([60, 61, 62], opts)
    expect(b.status).toBe('INSUFFICIENT_DATA')
    expect(b.n).toBe(3)
    expect(computeBaseline([], opts).status).toBe('INSUFFICIENT_DATA')
  })

  it('computes robust stats and a band of median +/- 2 robust SD', () => {
    const values = Array.from({ length: 101 }, (_, i) => 60 + (i % 11) - 5) // 55..65, median 60
    const b = computeBaseline(values, opts)
    expect(b.status).toBe('READY')
    expect(b.median).toBe(60)
    expect(b.mad).toBeCloseTo(3, 0)
    const rsd = Math.max(1.4826 * b.mad, 1)
    expect(b.low).toBeCloseTo(60 - 2 * rsd)
    expect(b.high).toBeCloseTo(60 + 2 * rsd)
    expect(b.p05).toBeLessThan(b.median)
    expect(b.p95).toBeGreaterThan(b.median)
  })

  it('is robust to outliers (median and band barely move)', () => {
    const clean = Array.from({ length: 100 }, (_, i) => 60 + (i % 5))
    const dirty = [...clean, 200, 210, 220]
    const a = computeBaseline(clean, opts)
    const b = computeBaseline(dirty, opts)
    expect(Math.abs(a.median - b.median)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(a.high - b.high)).toBeLessThan(1)
    // the mean is pulled by the outliers, the median is not
    expect(b.mean - a.mean).toBeGreaterThan(3)
  })

  it('clamps the band to physical limits', () => {
    const b = computeBaseline(Array.from({ length: 50 }, (_, i) => 98 + (i % 3) * 0.6), { ...opts, metric: 'SPO2', physicalMax: 100, minScale: 1 })
    expect(b.high).toBeLessThanOrEqual(100)
  })
})

describe('Reservoir', () => {
  it('keeps only the most recent capacity values', () => {
    const r = new Reservoir(3)
    for (const v of [1, 2, 3, 4, 5]) r.push(v)
    expect(r.size).toBe(3)
    expect([...r.values()].sort()).toEqual([3, 4, 5])
  })
})
