import { describe, expect, it } from 'vitest'
import { MAD_TO_SD, badZ, ewmaAlpha, ewmaUpdate, linearSlope, mad, median, quantileSorted, robustZ } from './stats'
import { OUProcess, Rng, hash01 } from './random'

describe('robust statistics', () => {
  it('computes median, MAD and quantiles', () => {
    const xs = [1, 2, 3, 4, 100]
    expect(median(xs)).toBe(3)
    expect(mad(xs, 3)).toBe(1)
    expect(quantileSorted([0, 10], 0.25)).toBe(2.5)
  })

  it('robust z ignores a single outlier and honors the scale floor', () => {
    const xs = [60, 61, 62, 63, 64, 200]
    const med = median(xs)
    const m = mad(xs, med)
    // the outlier barely moves median/MAD, so a normal value has a small z
    expect(Math.abs(robustZ(62, med, m, 0.1))).toBeLessThan(1)
    expect(robustZ(80, med, m, 0.1)).toBeGreaterThan(5)
    // flat signal: MAD 0, floor keeps z finite
    expect(robustZ(51, 50, 0, 2)).toBe(0.5)
    expect(MAD_TO_SD).toBeCloseTo(1.4826)
  })

  it('badZ orients z so that positive means worse', () => {
    expect(badZ(-3, 'down')).toBe(3)
    expect(badZ(-3, 'up')).toBe(-3)
    expect(badZ(-3, 'both')).toBe(3)
  })
})

describe('EWMA', () => {
  it('alpha follows the half-life for irregular steps', () => {
    expect(ewmaAlpha(10, 10)).toBeCloseTo(0.5)
    expect(ewmaAlpha(0, 10)).toBe(0)
    // two steps of 5 equal one step of 10
    const a5 = ewmaAlpha(5, 10)
    let x: number | null = 0
    x = ewmaUpdate(x, 1, a5)
    x = ewmaUpdate(x, 1, a5)
    expect(x).toBeCloseTo(0.5)
  })

  it('tracks a step change smoothly', () => {
    let x: number | null = null
    const a = ewmaAlpha(1, 3)
    for (let i = 0; i < 3; i++) x = ewmaUpdate(x, 0, a)
    for (let i = 0; i < 3; i++) x = ewmaUpdate(x, 10, a)
    expect(x!).toBeGreaterThan(4)
    expect(x!).toBeLessThan(6)
  })
})

describe('seeded randomness', () => {
  it('is reproducible', () => {
    const a = new Rng(42)
    const b = new Rng(42)
    for (let i = 0; i < 10; i++) expect(a.normal()).toBe(b.normal())
    expect(hash01('x', 1)).toBe(hash01('x', 1))
    expect(hash01('x', 1)).not.toBe(hash01('x', 2))
  })

  it('OU noise is smooth (strongly autocorrelated at short lags) with unit variance', () => {
    const ou = new OUProcess(7, 20)
    const xs: number[] = []
    for (let i = 0; i < 20000; i++) xs.push(ou.step(1))
    const m = xs.reduce((s, v) => s + v, 0) / xs.length
    const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length
    let c = 0
    for (let i = 1; i < xs.length; i++) c += (xs[i]! - m) * (xs[i - 1]! - m)
    const lag1 = c / xs.length / v
    expect(v).toBeGreaterThan(0.7)
    expect(v).toBeLessThan(1.3)
    expect(lag1).toBeGreaterThan(0.9)
  })

  it('linear slope', () => {
    expect(linearSlope([0, 1, 2, 3], [1, 3, 5, 7])).toBeCloseTo(2)
    expect(linearSlope([0, 1], [0, 1])).toBeNull()
  })
})
