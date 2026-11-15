import { describe, expect, it } from 'vitest'
import type { AstronautHealth, Device, MetricState } from '../types/domain'
import { CREW, MISSION } from '../engine/catalog'
import { AHI_METRIC_SYSTEM, AHI_ORIGIN_SYSTEM, LOINC, buildFhirBundle, fhirId, uuidFromKey, type FhirObservation } from './fhir'

const T = Date.parse('2026-11-14T10:00:00Z')

function ms(metric: MetricState['metric'], current: number | null, unit: string, origin: MetricState['data_origin'] = 'SIMULATED'): MetricState {
  return {
    metric,
    current,
    unit,
    status: current == null ? 'NO_DATA' : 'LOW',
    zScore: null,
    ewma: null,
    trendPerHour: null,
    baseline: null,
    lastUpdated: T,
    quality: current == null ? 'MISSING' : 'VALID',
    data_origin: origin,
  }
}

const astro = CREW[0]!
const devices: Device[] = [
  { id: 'BIO-AST-01', kind: 'BIO_MONITOR', name: 'Bio-Monitor shirt (sim)', assignedTo: astro.id, state: 'ONLINE', batteryPct: 80, signalPct: 90, lastSeenAt: T, data_origin: 'SIMULATED', metrics: ['HEART_RATE', 'SPO2'] },
  { id: 'ENV-01', kind: 'ENV_SENSOR', name: 'Cabin sensor (sim)', assignedTo: null, state: 'ONLINE', batteryPct: null, signalPct: null, lastSeenAt: T, data_origin: 'SIMULATED', metrics: ['CO2'] },
]
const health = {
  [astro.id]: {
    astronautId: astro.id,
    metrics: { HEART_RATE: ms('HEART_RATE', 71.6, 'bpm'), SPO2: ms('SPO2', null, '%'), MOOD: ms('MOOD', 4, '1-5', 'MANUAL') },
  } as unknown as AstronautHealth,
}

const bundle = buildFhirBundle({
  mission: MISSION,
  crew: [astro],
  devices,
  health,
  environment: { status: 'LOW', metrics: { CO2: ms('CO2', 2900, 'ppm') } },
  simNow: T,
})
const obs = bundle.entry.map((e) => e.resource).filter((r): r is FhirObservation => r.resourceType === 'Observation')
const byLocal = (code: string) => obs.find((o) => o.code.coding?.some((c) => c.system === AHI_METRIC_SYSTEM && c.code === code))!

describe('FHIR R4 export', () => {
  it('builds a collection bundle with unique full urls', () => {
    expect(bundle.resourceType).toBe('Bundle')
    expect(bundle.type).toBe('collection')
    expect(bundle.timestamp).toBe('2026-11-14T10:00:00.000Z')
    const urls = bundle.entry.map((e) => e.fullUrl)
    expect(new Set(urls).size).toBe(urls.length)
    for (const u of urls) expect(u).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('pseudonymizes patients (no PII fields)', () => {
    const p = bundle.entry.find((e) => e.resource.resourceType === 'Patient')!.resource as unknown as Record<string, unknown>
    expect(p.id).toBe('AST-01')
    for (const k of ['name', 'birthDate', 'gender', 'telecom', 'address']) expect(p[k]).toBeUndefined()
    expect(JSON.stringify(bundle)).not.toContain(astro.callsign)
  })

  it('uses LOINC only for known vital signs and a local system otherwise', () => {
    const hr = byLocal('HEART_RATE')
    expect(hr.code.coding?.find((c) => c.system === LOINC)?.code).toBe('8867-4')
    expect(hr.valueQuantity).toEqual({ value: 72, unit: 'bpm', system: 'http://unitsofmeasure.org', code: '/min' })
    expect(hr.subject.reference).toBe('Patient/AST-01')
    expect(hr.device?.reference).toBe('Device/BIO-AST-01')
    const mood = byLocal('MOOD')
    expect(mood.code.coding?.some((c) => c.system === LOINC)).toBe(false)
    expect(mood.valueQuantity).toEqual({ value: 4, unit: '1-5' })
  })

  it('tags data origin on every observation', () => {
    for (const o of obs) expect(o.meta.tag?.[0]?.system).toBe(AHI_ORIGIN_SYSTEM)
    expect(byLocal('HEART_RATE').meta.tag?.[0]?.code).toBe('SIMULATED')
    expect(byLocal('MOOD').meta.tag?.[0]?.code).toBe('MANUAL')
  })

  it('never exports missing data as a value', () => {
    const spo2 = byLocal('SPO2')
    expect(spo2.valueQuantity).toBeUndefined()
    expect(spo2.dataAbsentReason?.coding?.[0]?.code).toBe('unknown')
  })

  it('exports cabin observations without a patient', () => {
    const co2 = byLocal('CO2')
    expect(co2.subject.reference).toBeUndefined()
    expect(co2.subject.identifier?.value).toBe('CABIN')
  })

  it('makes valid FHIR ids and stable uuids', () => {
    expect(fhirId('obs AST_01/HR')).toBe('obs-AST-01-HR')
    expect(uuidFromKey('a')).toBe(uuidFromKey('a'))
    expect(uuidFromKey('a')).not.toBe(uuidFromKey('b'))
  })
})
