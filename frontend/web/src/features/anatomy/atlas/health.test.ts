import { describe, expect, it } from 'vitest'
import type { Alert, Anomaly, AstronautHealth, BodyRegionId, MetricCode, MetricState, RegionState } from '../../../types/domain'
import { METRIC_CATALOG, REGION_LABELS } from '../../../engine/catalog'
import { structureById, structuresOfSystem } from './manifest'
import type { AnatomySystemId, AtlasStructure } from './types'
import { REQUIRED_STRUCTURE_IDS } from './types'
import {
  ANOMALY_METHOD_LABEL,
  CONTEXT_ONLY_TEXT,
  ORIGIN_INFO,
  REFERENCE_MODEL_NOTE,
  REGION_RELATION,
  SYSTEM_INFO,
  alertRegion,
  atlasCoverage,
  isActiveAlert,
  isBrainStructure,
  isContextOnly,
  metricsOfRegion,
  observedAt,
  primaryStructureOfRegion,
  regionAlerts,
  regionAnomalies,
  regionOfStructure,
  regionStructureCount,
  relatedMetrics,
  selectStructureHealth,
  sideLabel,
  structureStatus,
  structuresOfRegion,
} from './health'
import { FIXTURE_MANIFEST as M, fixtureStructure } from './__fixtures__/manifest.fixture'

const SYSTEMS: AnatomySystemId[] = ['integumentary', 'skeletal', 'muscular', 'cardiovascular', 'respiratory', 'nervous', 'digestive', 'urinary', 'other']
const REGIONS: BodyRegionId[] = ['brain', 'heart', 'lungs', 'kidneys', 'muscles', 'bones', 'skin']
/** Em dash and en dash, built from char codes so this file itself stays free of them. */
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']')

function get(id: string): AtlasStructure {
  const s = structureById(M, id)
  if (!s) throw new Error(`fixture has no ${id}`)
  return s
}

function metricState(metric: MetricCode, status: MetricState['status'], current: number | null): MetricState {
  return { metric, current, unit: METRIC_CATALOG[metric].unit, status, zScore: null, ewma: null, trendPerHour: null, baseline: null, lastUpdated: 0, quality: 'VALID', data_origin: 'SIMULATED' }
}

function healthWith(regions: Partial<Record<BodyRegionId, Pick<RegionState, 'status' | 'summary'>>>, metrics: MetricState[] = []): AstronautHealth {
  const full = {} as Record<BodyRegionId, RegionState>
  for (const r of REGIONS) full[r] = { region: r, status: regions[r]?.status ?? 'LOW', metrics: metricsOfRegion(r), summary: regions[r]?.summary ?? 'Within your normal range.' }
  return {
    astronautId: 'AST-01',
    activity: 'REST',
    metrics: Object.fromEntries(metrics.map((m) => [m.metric, m])),
    regions: full,
    risk: { astronautId: 'AST-01', risk_level: 'LOW', risk_score: 0, contributing_factors: [], triggered_rules: [], confidence: 1, model_version: 't', evaluated_at: 0, data_window: '', limitations: [], headline: '' },
    predictions: {},
  }
}

function alert(over: Partial<Alert>): Alert {
  return { id: 'AL-1', astronautId: 'AST-01', severity: 'HIGH', title: 't', detail: 'd', region: null, metric: null, ruleId: 'R-1', createdAt: 1000, acknowledgedAt: null, acknowledgedBy: null, ...over }
}

function anomaly(over: Partial<Anomaly>): Anomaly {
  return { id: 'AN-1', astronautId: 'AST-01', metric: 'HEART_RATE', detectedAt: 1000, method: 'ROBUST_Z', severity: 'MODERATE', explanation: 'e', ...over }
}

describe('structure to region mapping', () => {
  it('maps every anatomical system by rule', () => {
    const expected: Record<string, BodyRegionId | null> = {
      skin: 'skin',
      'femur-left': 'bones',
      'costal-cartilages': 'bones',
      teeth: null,
      'biceps-brachii-left': 'muscles',
      'calcaneal-tendon-right': 'muscles',
      heart: 'heart',
      aorta: 'heart',
      'superior-vena-cava': 'heart',
      'lung-left': 'lungs',
      'lung-right': 'lungs',
      'lung-left-superior-lobe': 'lungs',
      trachea: 'lungs',
      brain: 'brain',
      cerebellum: 'brain',
      'corpus-callosum': 'brain',
      'spinal-cord': null,
      'sciatic-nerve-left': null,
      stomach: null,
      liver: null,
      'kidney-left': 'kidneys',
      'kidney-right': 'kidneys',
      'urinary-bladder': null,
      'ureter-left': null,
      'thyroid-gland': null,
      spleen: null,
      'eyeball-left': null,
    }
    // The fixture and the expectation table cover the same structures, and every system.
    expect(Object.keys(expected).sort()).toEqual(M.structures.map((s) => s.id).sort())
    for (const sys of SYSTEMS) expect(structuresOfSystem(M, sys).length, sys).toBeGreaterThan(0)
    for (const s of M.structures) {
      expect(regionOfStructure(s), s.id).toBe(expected[s.id])
      expect(isContextOnly(s), s.id).toBe(expected[s.id] === null)
    }
  })

  it('maps only brain structures of the nervous system to the brain region', () => {
    for (const s of structuresOfSystem(M, 'nervous')) {
      expect(regionOfStructure(s) === 'brain', s.id).toBe(isBrainStructure(s))
      // No other region ever comes out of the nervous system.
      expect([null, 'brain']).toContain(regionOfStructure(s))
    }
    // Brain parts are recognized by id even when the material class is generic.
    expect(regionOfStructure(fixtureStructure('cerebrum-left', 'Left cerebral hemisphere', 'nervous', 'organ'))).toBe('brain')
    expect(regionOfStructure(fixtureStructure('brainstem', 'Brainstem', 'nervous', 'nerve'))).toBe('brain')
    // The spinal cord and nerves never count as brain, whatever material they are drawn with.
    expect(regionOfStructure(fixtureStructure('spinal-cord', 'Spinal cord', 'nervous', 'brain'))).toBeNull()
    expect(regionOfStructure(fixtureStructure('optic-nerve-left', 'Left optic nerve', 'nervous', 'brain'))).toBeNull()
    expect(regionOfStructure(fixtureStructure('brachial-plexus-right', 'Right brachial plexus', 'nervous', 'nerve'))).toBeNull()
    // A brain named structure outside the nervous system is not a brain structure.
    expect(isBrainStructure(fixtureStructure('brain-case', 'Brain case', 'skeletal', 'bone'))).toBe(false)
  })

  it('maps only the kidneys of the urinary system, and keeps their procedural origin', () => {
    for (const s of structuresOfSystem(M, 'urinary')) {
      expect(regionOfStructure(s), s.id).toBe(s.tissue === 'kidney' ? 'kidneys' : null)
    }
    expect(get('kidney-left').origin).toBe('ahi-procedural')
    expect(ORIGIN_INFO[get('kidney-left').origin].label).toBe('AHI procedural')
    expect(ORIGIN_INFO[get('heart').origin].label).toBe('Z-Anatomy atlas')
    expect(
      structuresOfRegion(M, 'kidneys')
        .map((s) => s.id)
        .sort(),
    ).toEqual(['kidney-left', 'kidney-right'])
  })

  it('keeps digestive organs, glands, lymphoid and sense organs context only', () => {
    for (const sys of ['digestive', 'other'] as const) {
      for (const s of structuresOfSystem(M, sys)) {
        expect(regionOfStructure(s), s.id).toBeNull()
        expect(relatedMetrics(s), s.id).toEqual([])
        expect(structureStatus(healthWith({}), s), s.id).toBeNull()
      }
    }
  })

  it('maps the structure ids the application relies on', () => {
    const want: Record<(typeof REQUIRED_STRUCTURE_IDS)[number], BodyRegionId> = {
      skin: 'skin',
      heart: 'heart',
      'lung-left': 'lungs',
      'lung-right': 'lungs',
      brain: 'brain',
      'kidney-left': 'kidneys',
      'kidney-right': 'kidneys',
    }
    for (const id of REQUIRED_STRUCTURE_IDS) expect(regionOfStructure(get(id)), id).toBe(want[id])
  })

  it('finds the primary structure of a region', () => {
    expect(primaryStructureOfRegion(M, 'heart')?.id).toBe('heart')
    expect(primaryStructureOfRegion(M, 'brain')?.id).toBe('brain')
    expect(primaryStructureOfRegion(M, 'skin')?.id).toBe('skin')
    expect(primaryStructureOfRegion(M, 'lungs')?.id).toBe('lung-left')
    expect(primaryStructureOfRegion(M, 'kidneys')?.id).toBe('kidney-left')
    // Whole body systems have no single representative structure.
    expect(primaryStructureOfRegion(M, 'muscles')).toBeNull()
    expect(primaryStructureOfRegion(M, 'bones')).toBeNull()
    // An atlas without the organ gives null instead of a guess.
    expect(primaryStructureOfRegion({ ...M, structures: M.structures.filter((s) => s.system !== 'cardiovascular') }, 'heart')).toBeNull()
  })

  it('counts atlas structures per system and per region', () => {
    expect(atlasCoverage(M, get('aorta'))).toEqual({ system: 'cardiovascular', systemCount: 3, monitoredCount: 3 })
    expect(atlasCoverage(M, get('brain'))).toEqual({ system: 'nervous', systemCount: 5, monitoredCount: 3 })
    expect(atlasCoverage(M, get('liver'))).toEqual({ system: 'digestive', systemCount: 2, monitoredCount: 0 })
    let total = 0
    for (const r of REGIONS) {
      expect(regionStructureCount(M, r), r).toBe(structuresOfRegion(M, r).length)
      total += regionStructureCount(M, r)
    }
    expect(total).toBe(M.structures.filter((s) => !isContextOnly(s)).length)
  })
})

describe('related metrics', () => {
  it('returns only catalog codes of the structure region', () => {
    const catalog = new Set(Object.keys(METRIC_CATALOG))
    for (const s of M.structures) {
      const region = regionOfStructure(s)
      const codes = relatedMetrics(s)
      if (!region) {
        expect(codes, s.id).toEqual([])
        continue
      }
      expect(codes.length, s.id).toBeGreaterThan(0)
      for (const c of codes) {
        expect(catalog.has(c), `${s.id} ${c}`).toBe(true)
        expect(METRIC_CATALOG[c].region, `${s.id} ${c}`).toBe(region)
      }
      // Complete: every catalog metric of the region is listed, none from other regions or the cabin.
      expect(codes).toEqual((Object.keys(METRIC_CATALOG) as MetricCode[]).filter((c) => METRIC_CATALOG[c].region === region))
    }
  })

  it('relates the expected indicators, and never cabin metrics', () => {
    expect(relatedMetrics(get('heart'))).toEqual(['HEART_RATE', 'HRV_RMSSD', 'SYSTOLIC_BP', 'DIASTOLIC_BP'])
    expect(relatedMetrics(get('aorta'))).toEqual(relatedMetrics(get('heart')))
    expect(relatedMetrics(get('lung-left'))).toEqual(['SPO2', 'RESPIRATORY_RATE'])
    expect(relatedMetrics(get('kidney-right'))).toEqual(['HYDRATION'])
    expect(relatedMetrics(get('skin'))).toEqual(['SKIN_TEMPERATURE'])
    expect(relatedMetrics(get('femur-left'))).toEqual(['RADIATION_DOSE'])
    expect(relatedMetrics(get('biceps-brachii-left')).sort()).toEqual(['ACTIVITY_LEVEL', 'EXERCISE_LOAD'])
    // Brain: sleep, reaction time and self report only.
    expect(relatedMetrics(get('brain')).sort()).toEqual(['MOOD', 'PERCEIVED_FATIGUE', 'REACTION_TIME', 'SLEEP_DURATION', 'SLEEP_EFFICIENCY', 'STRESS'])
    for (const s of M.structures) for (const c of relatedMetrics(s)) expect(METRIC_CATALOG[c].region).not.toBe('environment')
  })
})

describe('structure status', () => {
  it('is null for context only structures, whatever the health state', () => {
    const critical = healthWith(Object.fromEntries(REGIONS.map((r) => [r, { status: 'CRITICAL', summary: 'x' }])))
    for (const id of ['liver', 'stomach', 'spinal-cord', 'sciatic-nerve-left', 'urinary-bladder', 'thyroid-gland', 'spleen', 'eyeball-left', 'teeth']) {
      expect(structureStatus(critical, get(id)), id).toBeNull()
      expect(structureStatus(undefined, get(id)), id).toBeNull()
    }
  })

  it('is NO_DATA when health is missing, never normal', () => {
    for (const id of ['heart', 'aorta', 'lung-left', 'brain', 'kidney-left', 'skin', 'femur-left', 'biceps-brachii-left']) {
      expect(structureStatus(undefined, get(id)), id).toBe('NO_DATA')
      expect(structureStatus({ astronautId: 'AST-01' } as AstronautHealth, get(id)), id).toBe('NO_DATA')
    }
  })

  it('follows the status of the region', () => {
    const h = healthWith({ heart: { status: 'CRITICAL', summary: 'Heart rate 40% above your normal.' }, lungs: { status: 'NO_DATA', summary: 'No data.' } })
    expect(structureStatus(h, get('heart'))).toBe('CRITICAL')
    expect(structureStatus(h, get('superior-vena-cava'))).toBe('CRITICAL')
    expect(structureStatus(h, get('trachea'))).toBe('NO_DATA')
    expect(structureStatus(h, get('brain'))).toBe('LOW')
  })
})

describe('region alerts, anomalies and observed values', () => {
  const alerts: Alert[] = [
    alert({ id: 'a1', severity: 'MODERATE', metric: 'HEART_RATE', createdAt: 3000 }),
    alert({ id: 'a2', severity: 'CRITICAL', region: 'heart', metric: 'SPO2', createdAt: 2000 }),
    alert({ id: 'a3', severity: 'CRITICAL', metric: 'HRV_RMSSD', createdAt: 2500 }),
    alert({ id: 'a4', severity: 'HIGH', metric: 'HEART_RATE', acknowledgedAt: 2600, acknowledgedBy: 'crew' }),
    alert({ id: 'a5', severity: 'HIGH', metric: 'HEART_RATE', resolvedAt: 2700 }),
    alert({ id: 'a6', severity: 'HIGH', metric: 'HEART_RATE', astronautId: 'AST-02' }),
    alert({ id: 'a7', severity: 'HIGH', metric: 'SPO2' }),
    alert({ id: 'a8', severity: 'HIGH', metric: 'CO2', astronautId: null, region: 'environment' }),
  ]

  it('keeps active alerts of the astronaut and region, most severe then newest first', () => {
    expect(regionAlerts(alerts, 'AST-01', 'heart').map((a) => a.id)).toEqual(['a3', 'a2', 'a1'])
    expect(regionAlerts(alerts, 'AST-01', 'lungs').map((a) => a.id)).toEqual(['a7'])
    expect(regionAlerts(alerts, 'AST-02', 'heart').map((a) => a.id)).toEqual(['a6'])
    expect(regionAlerts(alerts, 'AST-01', 'brain')).toEqual([])
    expect(isActiveAlert(alerts[3]!)).toBe(false)
    expect(isActiveAlert(alerts[4]!)).toBe(false)
    // The alert region wins over the metric region; the metric region is the fallback.
    expect(alertRegion(alerts[1]!)).toBe('heart')
    expect(alertRegion(alerts[0]!)).toBe('heart')
    expect(alertRegion(alert({}))).toBeNull()
  })

  it('keeps anomalies of the astronaut and region, newest first, inside the window', () => {
    const list: Anomaly[] = [
      anomaly({ id: 'n1', metric: 'HEART_RATE', detectedAt: 100 }),
      anomaly({ id: 'n2', metric: 'SYSTOLIC_BP', detectedAt: 900 }),
      anomaly({ id: 'n3', metric: 'SPO2', detectedAt: 950 }),
      anomaly({ id: 'n4', metric: 'HEART_RATE', detectedAt: 990, astronautId: 'AST-02' }),
      anomaly({ id: 'n5', metric: 'CO2', detectedAt: 990, astronautId: 'CABIN' }),
    ]
    expect(regionAnomalies(list, 'AST-01', 'heart').map((a) => a.id)).toEqual(['n2', 'n1'])
    expect(regionAnomalies(list, 'AST-01', 'heart', 500).map((a) => a.id)).toEqual(['n2'])
    expect(regionAnomalies(list, 'AST-01', 'lungs').map((a) => a.id)).toEqual(['n3'])
    expect(regionAnomalies(list, 'AST-01', 'skin')).toEqual([])
  })

  it('reads the last value at or before a time, and never invents one', () => {
    const pts = [
      { t: 10, v: 60 },
      { t: 20, v: 62 },
      { t: 30, v: null },
      { t: 40, v: 90 },
    ]
    expect(observedAt(pts, 10)).toBe(60)
    expect(observedAt(pts, 25)).toBe(62)
    expect(observedAt(pts, 39)).toBeNull() // the reading was missing at that time
    expect(observedAt(pts, 40)).toBe(90)
    expect(observedAt(pts, 1000)).toBe(90)
    expect(observedAt(pts, 5)).toBeNull() // before the history starts
    expect(observedAt([], 5)).toBeNull()
    expect(observedAt(undefined, 5)).toBeNull()
  })
})

describe('structure health view', () => {
  const health = healthWith({ heart: { status: 'HIGH', summary: 'Heart rate 30% above your normal.' } }, [metricState('HEART_RATE', 'HIGH', 120), metricState('SYSTOLIC_BP', 'LOW', 118), metricState('SPO2', 'LOW', 97)])
  const state = {
    health: { 'AST-01': health },
    alerts: [alert({ id: 'a1', metric: 'HEART_RATE' }), alert({ id: 'a2', metric: 'SPO2' }), alert({ id: 'a3', metric: 'HEART_RATE', astronautId: 'AST-02' })],
    anomalies: [anomaly({ id: 'n1', metric: 'HEART_RATE', detectedAt: 100 }), anomaly({ id: 'n2', metric: 'HRV_RMSSD', detectedAt: 5000 }), anomaly({ id: 'n3', metric: 'SPO2', detectedAt: 5000 })],
  }

  it('joins a monitored structure with the data of its region', () => {
    const v = selectStructureHealth(state, 'AST-01', get('aorta'))
    expect(v.region).toBe('heart')
    expect(v.monitored).toBe(true)
    expect(v.status).toBe('HIGH')
    expect(v.summary).toBe('Heart rate 30% above your normal.')
    expect(v.system.label).toBe('Cardiovascular system')
    expect(v.metricCodes).toEqual(['HEART_RATE', 'HRV_RMSSD', 'SYSTOLIC_BP', 'DIASTOLIC_BP'])
    expect(v.metrics.map((m) => m.metric)).toEqual(['HEART_RATE', 'SYSTOLIC_BP'])
    // Metrics without any state are listed as missing, not silently dropped.
    expect(v.missing).toEqual(['HRV_RMSSD', 'DIASTOLIC_BP'])
    expect(v.alerts.map((a) => a.id)).toEqual(['a1'])
    expect(v.anomalies.map((a) => a.id)).toEqual(['n2', 'n1'])
    expect(v.contextNote).toBeNull()
    expect(selectStructureHealth(state, 'AST-01', get('aorta'), { anomaliesSinceMs: 1000 }).anomalies.map((a) => a.id)).toEqual(['n2'])
  })

  it('gives NO_DATA, not normal, when the astronaut has no health yet', () => {
    const v = selectStructureHealth(state, 'AST-09', get('heart'))
    expect(v.status).toBe('NO_DATA')
    expect(v.metrics).toEqual([])
    expect(v.missing).toEqual(v.metricCodes)
    expect(v.alerts).toEqual([])
  })

  it('gives a context only structure a plain note and no status, metrics, alerts or anomalies', () => {
    for (const id of ['liver', 'spinal-cord', 'urinary-bladder', 'thyroid-gland']) {
      const v = selectStructureHealth(state, 'AST-01', get(id))
      expect(v.region, id).toBeNull()
      expect(v.monitored, id).toBe(false)
      expect(v.status, id).toBeNull()
      expect(v.metricCodes, id).toEqual([])
      expect(v.metrics, id).toEqual([])
      expect(v.alerts, id).toEqual([])
      expect(v.anomalies, id).toEqual([])
      expect(v.contextNote, id).toBe(CONTEXT_ONLY_TEXT)
    }
    expect(CONTEXT_ONLY_TEXT).toMatch(/No device or metric monitors this structure/)
  })
})

describe('plain language catalog', () => {
  it('labels and describes every anatomical system', () => {
    expect(Object.keys(SYSTEM_INFO).sort()).toEqual([...SYSTEMS].sort())
    for (const sys of SYSTEMS) {
      const info = SYSTEM_INFO[sys]
      expect(info.label.length, sys).toBeGreaterThan(3)
      expect(info.description.length, sys).toBeGreaterThan(10)
      expect(info.monitoring.length, sys).toBeGreaterThan(10)
      // Coverage matches the mapping rules on the fixture.
      const list = structuresOfSystem(M, sys)
      const monitored = list.filter((s) => !isContextOnly(s)).length
      expect(info.coverage, sys).toBe(monitored === 0 ? 'context' : monitored === list.length ? 'monitored' : 'partial')
    }
  })

  it('explains every region relation and never claims a diagnosis or a neurological measurement', () => {
    expect(Object.keys(REGION_RELATION).sort()).toEqual([...REGIONS].sort())
    for (const r of REGIONS) {
      expect(REGION_LABELS[r]).toBeDefined()
      expect(REGION_RELATION[r].basis.length).toBeGreaterThan(10)
      expect(REGION_RELATION[r].caveat).toMatch(/\bnot\b|\bNo\b/)
    }
    expect(REGION_RELATION.brain.basis).toMatch(/related indicators/)
    expect(REGION_RELATION.brain.caveat).toMatch(/not neurological measurements/)
    expect(REGION_RELATION.kidneys.caveat).toMatch(/not a measurement of kidney function/)
    expect(REFERENCE_MODEL_NOTE).toMatch(/not a scan of this astronaut/)
  })

  it('names sides and anomaly methods, with no em dash or en dash anywhere', () => {
    expect(sideLabel({ side: 'L' })).toBe('Left side')
    expect(sideLabel({ side: 'R' })).toBe('Right side')
    expect(sideLabel({ side: null })).toBeNull()
    const texts = [
      ...Object.values(SYSTEM_INFO).flatMap((i) => [i.label, i.description, i.monitoring]),
      ...Object.values(REGION_RELATION).flatMap((i) => [i.basis, i.caveat]),
      ...Object.values(ORIGIN_INFO).flatMap((i) => [i.label, i.detail]),
      ...Object.values(ANOMALY_METHOD_LABEL),
      CONTEXT_ONLY_TEXT,
      REFERENCE_MODEL_NOTE,
    ]
    for (const t of texts) expect(DASHES.test(t), t).toBe(false)
  })
})
