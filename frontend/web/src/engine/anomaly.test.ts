import { describe, expect, it } from 'vitest'
import { MetricTracker } from './anomaly'
import { DAY_MS, HOUR_MS, MIN_MS } from './text'

const T0 = Date.parse('2026-11-01T00:00:00Z')
const noise = (i: number) => 1.5 * Math.sin(i * 0.7) + 0.8 * Math.sin(i * 0.13)

/** Feed `minutes` of resting heart rate around `level`, starting at t. Returns the next t. */
function feed(tr: MetricTracker, t: number, minutes: number, level: (i: number) => number, quality: 'VALID' | 'QUESTIONABLE' = 'VALID'): number {
  for (let i = 0; i < minutes; i++) {
    tr.ingest(t, level(i) + noise(t / MIN_MS), 'REST', quality, 'DEV-TEST')
    t += MIN_MS
  }
  return t
}

function readyTracker(): { tr: MetricTracker; t: number } {
  const tr = new MetricTracker('AST-T', 'HEART_RATE')
  const t = feed(tr, T0, 2 * 24 * 60, () => 60)
  tr.recompute()
  return { tr, t }
}

describe('MetricTracker (continuous)', () => {
  it('builds a personal baseline and stays LOW on normal data', () => {
    const { tr, t } = readyTracker()
    const b = tr.readyBaseline('REST')
    expect(b?.status).toBe('READY')
    expect(b!.median).toBeGreaterThan(58)
    expect(b!.median).toBeLessThan(62)
    const a = tr.assess(t - MIN_MS, false)
    expect(a.status).toBe('LOW')
    expect(a.noData).toBe(false)
  })

  it('robust z flags an acute jump as CRITICAL within a few readings', () => {
    const { tr, t } = readyTracker()
    const t2 = feed(tr, t, 3, () => 145)
    const a = tr.assess(t2 - MIN_MS, false)
    expect(a.status).toBe('CRITICAL')
    expect(a.method === 'ROBUST_Z' || a.method === 'PERSISTENCE').toBe(true)
    expect(a.z!).toBeGreaterThan(7)
    expect(a.label).toMatch(/above your normal at rest|resting ceiling/)
  })

  it('a single spike is filtered by the 3 reading median', () => {
    const { tr, t } = readyTracker()
    let t2 = feed(tr, t, 1, () => 140)
    t2 = feed(tr, t2, 2, () => 60)
    expect(tr.assess(t2 - MIN_MS, false).status).toBe('LOW')
  })

  it('EWMA drift detects a sustained shift that no single value would flag, and escalates with persistence', () => {
    const { tr, t } = readyTracker()
    // +9 bpm: about 2.5 robust SD, below the acute thresholds.
    let t2 = feed(tr, t, 60, () => 69)
    expect(tr.assess(t2 - MIN_MS, false).status).toBe('LOW')
    t2 = feed(tr, t2, 5 * 60, () => 69)
    const mid = tr.assess(t2 - MIN_MS, false)
    expect(mid.status).toBe('MODERATE')
    expect(mid.method).toBe('EWMA')
    expect(mid.label).toMatch(/above your normal for \d+ hours/)
    t2 = feed(tr, t2, 9 * 60, () => 69)
    const late = tr.assess(t2 - MIN_MS, false)
    expect(late.status).toBe('HIGH')
    expect(late.persistenceHours!).toBeGreaterThan(12)
    // The shifted values were kept out of the baseline (gate), so "normal" did not move.
    expect(tr.readyBaseline('REST')!.median).toBeLessThan(62)
  })

  it('missing or stale data is NO_DATA, never LOW', () => {
    const { tr, t } = readyTracker()
    const stale = tr.assess(t + 20 * MIN_MS, false)
    expect(stale.status).toBe('NO_DATA')
    expect(stale.value).toBeNull()
    const down = tr.assess(t, true)
    expect(down.status).toBe('NO_DATA')
    expect(down.ruleId).toBe('R-DQ-01')
  })

  it('questionable data cannot escalate beyond MODERATE', () => {
    const { tr, t } = readyTracker()
    const t2 = feed(tr, t, 3, () => 150, 'QUESTIONABLE')
    const a = tr.assess(t2 - MIN_MS, false)
    expect(a.status).toBe('MODERATE')
    expect(a.label).toMatch(/questionable/)
  })

  it('is context aware: exercise heart rate is compared with the exercise baseline', () => {
    const tr = new MetricTracker('AST-T', 'HEART_RATE')
    let t = T0
    for (let d = 0; d < 4; d++) {
      for (let i = 0; i < 23 * 60; i++, t += MIN_MS) tr.ingest(t, 60 + noise(i), 'REST', 'VALID', 'DEV')
      for (let i = 0; i < 60; i++, t += MIN_MS) tr.ingest(t, 140 + 3 * noise(i), 'EXERCISE', 'VALID', 'DEV')
    }
    tr.recompute()
    for (let i = 0; i < 5; i++, t += MIN_MS) tr.ingest(t, 142, 'EXERCISE', 'VALID', 'DEV')
    expect(tr.assess(t - MIN_MS, false).status).toBe('LOW')
  })
})

describe('MetricTracker (daily metric)', () => {
  it('flags consecutive short nights with persistence wording', () => {
    const tr = new MetricTracker('AST-T', 'SLEEP_DURATION')
    let t = T0
    for (let d = 0; d < 10; d++, t += DAY_MS) tr.ingest(t, 7 + 0.2 * Math.sin(d), 'ALL', 'VALID', 'DEV-ACT')
    expect(tr.assess(t - DAY_MS, false).status).toBe('LOW')
    tr.ingest(t, 5.2, 'ALL', 'VALID', 'DEV-ACT')
    t += DAY_MS
    tr.ingest(t, 5.0, 'ALL', 'VALID', 'DEV-ACT')
    const two = tr.assess(t, false)
    expect(two.status).toBe('MODERATE')
    expect(two.label).toMatch(/2 nights/)
    t += DAY_MS
    tr.ingest(t, 4.9, 'ALL', 'VALID', 'DEV-ACT')
    const three = tr.assess(t + HOUR_MS, false)
    expect(three.status).toBe('HIGH')
    expect(three.label).toMatch(/below your normal for 3 nights/)
    expect(three.phrase).toMatch(/Sleep has been shorter than your normal/)
  })
})
