import { describe, expect, it } from 'vitest'
import type { MetricCode, MetricState, RiskLevel } from '../types/domain'
import type { MetricAssessment } from './anomaly'
import { AlertManager } from './alerts'
import { RecommendationManager, applySuppression, isActionable } from './recommendations'
import { assessRisk, buildRegions, combinedHits, headlineFor, levelFromScore, scoreHits, type RuleHit } from './risk'
import { MIN_MS } from './text'

function hit(ruleId: string, level: RiskLevel, extra: Partial<RuleHit> = {}): RuleHit {
  return {
    subjectId: 'AST-01',
    ruleId,
    level,
    metric: 'HEART_RATE',
    region: 'heart',
    method: 'EWMA',
    kind: 'PHYSIO',
    label: `${ruleId} label`,
    phrase: `${ruleId} phrase`,
    title: `${ruleId} title`,
    ...extra,
  }
}

function assessment(metric: MetricCode, level: RiskLevel | 'NO_DATA', extra: Partial<MetricAssessment> = {}): MetricAssessment {
  const noData = level === 'NO_DATA'
  return {
    metric,
    status: level,
    level: noData ? 'LOW' : level,
    method: noData ? 'DATA_QUALITY' : level === 'LOW' ? null : 'ROBUST_Z',
    ruleId: level === 'LOW' ? null : 'R-X',
    label: level === 'LOW' ? null : `${metric} label`,
    phrase: level === 'LOW' ? null : `${metric} phrase`,
    value: noData ? null : 100,
    z: noData ? null : 0,
    noData,
    questionable: false,
    baseline: null,
    bucket: 'REST',
    driftZ: 0,
    deviationPct: null,
    persistenceHours: null,
    ...extra,
  }
}

describe('risk score (noisy-OR)', () => {
  it('maps bands to levels', () => {
    expect(levelFromScore(0)).toBe('LOW')
    expect(levelFromScore(20)).toBe('MODERATE')
    expect(levelFromScore(45)).toBe('HIGH')
    expect(levelFromScore(80)).toBe('CRITICAL')
  })

  it('combined deviations escalate: three MODERATE rules become HIGH', () => {
    expect(scoreHits([hit('A', 'MODERATE')])).toMatchObject({ score: 20, level: 'MODERATE' })
    expect(scoreHits([hit('A', 'MODERATE'), hit('B', 'MODERATE')]).level).toBe('MODERATE')
    expect(scoreHits([hit('A', 'MODERATE'), hit('B', 'MODERATE'), hit('C', 'MODERATE')])).toMatchObject({ score: 49, level: 'HIGH' })
  })

  it('counts each rule once and caps slow patterns at HIGH without a CRITICAL rule', () => {
    expect(scoreHits([hit('A', 'MODERATE'), hit('A', 'MODERATE')]).score).toBe(20)
    const slow = scoreHits([hit('A', 'HIGH'), hit('B', 'HIGH'), hit('C', 'HIGH'), hit('D', 'HIGH')])
    expect(slow.level).toBe('HIGH')
    expect(slow.score).toBe(79)
    expect(scoreHits([hit('A', 'CRITICAL')]).level).toBe('CRITICAL')
  })

  it('data quality rules are capped at the MODERATE weight', () => {
    expect(scoreHits([hit('R-DQ-01', 'HIGH', { kind: 'DATA_QUALITY' })]).score).toBe(20)
  })
})

describe('combined rules', () => {
  it('R-CARD-01: heart rate and SpO2 both HIGH or worse is CRITICAL', () => {
    const hits = combinedHits('AST-01', { HEART_RATE: assessment('HEART_RATE', 'CRITICAL'), SPO2: assessment('SPO2', 'HIGH') }, {})
    expect(hits.map((h) => h.ruleId)).toContain('R-CARD-01')
    expect(hits.find((h) => h.ruleId === 'R-CARD-01')!.level).toBe('CRITICAL')
    expect(combinedHits('AST-01', { HEART_RATE: assessment('HEART_RATE', 'CRITICAL'), SPO2: assessment('SPO2', 'LOW') }, {})).toHaveLength(0)
  })

  it('R-FAT-01: two of sleep / HRV / resting HR is MODERATE, all three is HIGH', () => {
    const two = combinedHits(
      'AST-02',
      { SLEEP_DURATION: assessment('SLEEP_DURATION', 'MODERATE'), HRV_RMSSD: assessment('HRV_RMSSD', 'MODERATE', { driftZ: -1.5 }), HEART_RATE: assessment('HEART_RATE', 'LOW', { driftZ: 0.2 }) },
      {},
    )
    expect(two.find((h) => h.ruleId === 'R-FAT-01')!.level).toBe('MODERATE')
    const three = combinedHits(
      'AST-02',
      { SLEEP_DURATION: assessment('SLEEP_DURATION', 'MODERATE'), HRV_RMSSD: assessment('HRV_RMSSD', 'MODERATE', { driftZ: -1.5 }), HEART_RATE: assessment('HEART_RATE', 'MODERATE', { driftZ: 1.4 }) },
      {},
    )
    const fat = three.find((h) => h.ruleId === 'R-FAT-01')!
    expect(fat.level).toBe('HIGH')
    expect(fat.label).toMatch(/shorter sleep, lower HRV and higher resting heart rate/)
  })

  it('missing data never counts as a normal component', () => {
    const hits = combinedHits('AST-01', { HEART_RATE: assessment('HEART_RATE', 'NO_DATA'), SPO2: assessment('SPO2', 'NO_DATA') }, {})
    expect(hits).toHaveLength(0)
  })
})

describe('risk assessment output', () => {
  it('has rules, factors, lowered confidence for missing data, limitations and a calm headline', () => {
    const r = assessRisk({
      astronautId: 'AST-01',
      now: 0,
      hits: [hit('R-HRV-01', 'HIGH', { label: 'HRV 28% below your normal for 3 days', phrase: 'HRV has been below your normal for 3 days' })],
      assessments: { HEART_RATE: assessment('HEART_RATE', 'NO_DATA'), HRV_RMSSD: assessment('HRV_RMSSD', 'HIGH') },
    })
    expect(r.risk_level).toBe('HIGH')
    expect(r.triggered_rules).toEqual(['R-HRV-01'])
    expect(r.contributing_factors[0]!.label).toBe('HRV 28% below your normal for 3 days')
    expect(r.confidence).toBeLessThan(0.95)
    expect(r.limitations.join(' ')).toMatch(/not official NASA limits/)
    expect(r.headline).toBe('HRV has been below your normal for 3 days, so a flight surgeon review is suggested.')
    expect(r.headline).not.toMatch(/[\u2013\u2014]/)
  })

  it('headline for no findings', () => {
    expect(headlineFor('LOW', null, 0)).toBe('All indicators are within your normal range.')
    expect(headlineFor('LOW', null, 2)).toMatch(/missing/)
  })

  it('regions: all metrics missing is NO_DATA, unmonitored regions are NO_DATA, not LOW', () => {
    const ms = (status: MetricState['status']): MetricState => ({
      metric: 'HEART_RATE',
      current: null,
      unit: 'bpm',
      status,
      zScore: null,
      ewma: null,
      trendPerHour: null,
      baseline: null,
      lastUpdated: 0,
      quality: 'MISSING',
      data_origin: 'SIMULATED',
    })
    const regions = buildRegions(
      { HEART_RATE: ms('NO_DATA'), HRV_RMSSD: { ...ms('NO_DATA'), metric: 'HRV_RMSSD' }, SLEEP_DURATION: { ...ms('LOW'), metric: 'SLEEP_DURATION' } },
      {},
      [],
    )
    expect(regions.heart.status).toBe('NO_DATA')
    expect(regions.heart.summary).toMatch(/No data/)
    expect(regions.brain.status).toBe('LOW')
  })
})

describe('alerts and recommendations', () => {
  const name = (id: string | null) => id ?? 'Cabin'

  it('dedupes per subject + rule, escalates, auto-resolves and keeps acknowledged history', () => {
    const m = new AlertManager()
    m.sync([hit('R-HR-02', 'MODERATE')], 0, name)
    m.sync([hit('R-HR-02', 'MODERATE')], MIN_MS, name)
    expect(m.alerts).toHaveLength(1)
    m.sync([hit('R-HR-02', 'HIGH')], 2 * MIN_MS, name)
    expect(m.alerts).toHaveLength(1)
    expect(m.alerts[0]!.severity).toBe('HIGH')
    const id = m.alerts[0]!.id
    expect(m.acknowledge(id, 'crew', 3 * MIN_MS)?.acknowledgedBy).toBe('crew')
    // escalation after acknowledgement raises a new alert
    m.sync([hit('R-HR-02', 'CRITICAL')], 4 * MIN_MS, name)
    expect(m.alerts).toHaveLength(2)
    // rule clear for 10+ min: resolved, history kept
    m.sync([], 5 * MIN_MS, name)
    m.sync([], 20 * MIN_MS, name)
    expect(m.alerts.every((a) => a.resolvedAt != null)).toBe(true)
    expect(m.alerts.some((a) => a.acknowledgedAt !== null)).toBe(true)
  })

  it('acute MODERATE z blips are not actionable; trends and data quality are', () => {
    expect(isActionable(hit('R-HR-01', 'MODERATE', { method: 'ROBUST_Z' }))).toBe(false)
    expect(isActionable(hit('R-HR-02', 'MODERATE', { method: 'EWMA' }))).toBe(true)
    expect(isActionable(hit('R-DQ-01', 'MODERATE', { method: 'DATA_QUALITY', kind: 'DATA_QUALITY' }))).toBe(true)
    expect(isActionable(hit('R-HR-01', 'HIGH', { method: 'ROBUST_Z' }))).toBe(true)
  })

  it('combined rules group their components', () => {
    const hits = [hit('R-FAT-01', 'HIGH', { kind: 'COMBINED', suppresses: ['R-HRV-01', 'R-SLEEP-01'] }), hit('R-HRV-01', 'HIGH'), hit('R-SLEEP-01', 'MODERATE'), hit('R-RT-01', 'MODERATE')]
    expect(applySuppression(hits).map((h) => h.ruleId)).toEqual(['R-FAT-01', 'R-RT-01'])
  })

  it('recommendations: one per astronaut + rule, human review for HIGH, linked intervention', () => {
    const r = new RecommendationManager()
    r.sync([hit('R-SLEEP-01', 'MODERATE')], 0)
    r.sync([hit('R-SLEEP-01', 'MODERATE')], MIN_MS)
    expect(r.recs).toHaveLength(1)
    expect(r.recs[0]!.interventionKind).toBe('SLEEP_EXTENSION')
    expect(r.recs[0]!.requiresHumanReview).toBe(false)
    r.sync([hit('R-SLEEP-01', 'HIGH')], 2 * MIN_MS)
    expect(r.recs).toHaveLength(1)
    expect(r.recs[0]!.priority).toBe('HIGH')
    expect(r.recs[0]!.requiresHumanReview).toBe(true)
    r.sync([hit('R-CARD-01', 'CRITICAL', { kind: 'COMBINED' })], 3 * MIN_MS)
    const card = r.recs.find((x) => x.ruleId === 'R-CARD-01')!
    expect(card.audience).toBe('FLIGHT_SURGEON')
    expect(card.interventionKind).toBe('MEDICAL_CONSULT')
  })
})
