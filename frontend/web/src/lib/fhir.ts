/**
 * Minimal FHIR R4 export (client side, no server).
 *
 * Builds a Bundle of type "collection" with:
 * - Patient resources with pseudonymized ids only (no name, birth date, gender or other PII),
 * - Device resources (simulated adapters),
 * - Observation resources for the current value of every tracked metric.
 *
 * LOINC codes are used only where they are well established (vital signs below). Every other
 * metric uses the local code system "urn:ahi:metric". Data origin (SIMULATED, MANUAL...) is
 * carried as a meta tag on every resource. This is an interoperability demo, not a validated
 * clinical interface.
 */
import type { AppState, DataOrigin, Device, MetricCode, MetricState } from '../types/domain'
import { METRIC_CATALOG } from '../engine/catalog'

export const AHI_METRIC_SYSTEM = 'urn:ahi:metric'
export const AHI_ORIGIN_SYSTEM = 'urn:ahi:data-origin'
export const AHI_CREW_SYSTEM = 'urn:ahi:crew-pseudonym'
export const AHI_DEVICE_SYSTEM = 'urn:ahi:device'
export const LOINC = 'http://loinc.org'
export const UCUM = 'http://unitsofmeasure.org'

/** LOINC codes we are certain about. Everything else stays local. */
export const LOINC_CODES: Partial<Record<MetricCode, { code: string; display: string }>> = {
  HEART_RATE: { code: '8867-4', display: 'Heart rate' },
  RESPIRATORY_RATE: { code: '9279-1', display: 'Respiratory rate' },
  SYSTOLIC_BP: { code: '8480-6', display: 'Systolic blood pressure' },
  DIASTOLIC_BP: { code: '8462-4', display: 'Diastolic blood pressure' },
  SPO2: { code: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry' },
}

/** UCUM codes for catalog units. Units without a clean UCUM code are exported as text only. */
const UCUM_CODES: Record<string, string> = {
  bpm: '/min',
  'br/min': '/min',
  mmHg: 'mm[Hg]',
  '%': '%',
  ms: 'ms',
  '°C': 'Cel',
  h: 'h',
  ppm: '[ppm]',
  'µGy/h': 'uGy/h',
  mGy: 'mGy',
}

const ORIGIN_DISPLAY: Record<DataOrigin, string> = {
  SIMULATED: 'Simulated',
  REAL_PUBLIC: 'Real public dataset',
  DERIVED: 'Derived',
  MANUAL: 'Manual entry',
}

// ---------------------------------------------------------------------------
// Minimal R4 types (only what we emit)
// ---------------------------------------------------------------------------

export interface FhirCoding {
  system?: string
  code: string
  display?: string
}
export interface FhirCodeableConcept {
  coding?: FhirCoding[]
  text?: string
}
export interface FhirReference {
  reference?: string
  identifier?: { system: string; value: string }
  display?: string
}
export interface FhirMeta {
  tag?: FhirCoding[]
  lastUpdated?: string
}
export interface FhirPatient {
  resourceType: 'Patient'
  id: string
  meta: FhirMeta
  identifier: { system: string; value: string }[]
  active: boolean
}
export interface FhirDevice {
  resourceType: 'Device'
  id: string
  meta: FhirMeta
  identifier: { system: string; value: string }[]
  status: 'active' | 'inactive' | 'entered-in-error' | 'unknown'
  deviceName: { name: string; type: 'user-friendly-name' | 'model-name' | 'other' }[]
  type: FhirCodeableConcept
  patient?: FhirReference
  note?: { text: string }[]
}
export interface FhirObservation {
  resourceType: 'Observation'
  id: string
  meta: FhirMeta
  status: 'final' | 'preliminary'
  category?: FhirCodeableConcept[]
  code: FhirCodeableConcept
  subject: FhirReference
  effectiveDateTime: string
  valueQuantity?: { value: number; unit: string; system?: string; code?: string }
  dataAbsentReason?: FhirCodeableConcept
  device?: FhirReference
  note?: { text: string }[]
}
export type FhirResource = FhirPatient | FhirDevice | FhirObservation
export interface FhirBundle {
  resourceType: 'Bundle'
  id: string
  meta: FhirMeta
  identifier: { system: string; value: string }
  type: 'collection'
  timestamp: string
  entry: { fullUrl: string; resource: FhirResource }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** FHIR id: [A-Za-z0-9\-\.]{1,64} */
export function fhirId(raw: string): string {
  const s = raw.replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '')
  return (s || 'x').slice(0, 64)
}

/** Deterministic UUID-shaped string from a key (FNV-1a), so exports are stable and testable. */
export function uuidFromKey(key: string): string {
  const parts: string[] = []
  for (let round = 0; round < 4; round++) {
    let h = 0x811c9dc5 ^ (round * 0x9e3779b1)
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    parts.push((h >>> 0).toString(16).padStart(8, '0'))
  }
  const hex = parts.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function originTag(origin: DataOrigin): FhirCoding {
  return { system: AHI_ORIGIN_SYSTEM, code: origin, display: ORIGIN_DISPLAY[origin] }
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

const DEVICE_STATUS: Record<Device['state'], FhirDevice['status']> = {
  ONLINE: 'active',
  DEGRADED: 'active',
  DATA_STALE: 'active',
  OFFLINE: 'inactive',
}

function round(v: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(v * f) / f
}

export type FhirExportInput = Pick<AppState, 'mission' | 'crew' | 'devices' | 'health' | 'environment'> & { simNow: number }

export function metricObservation(
  ms: MetricState,
  subject: FhirReference,
  subjectKey: string,
  device: Device | undefined,
): FhirObservation {
  const def = METRIC_CATALOG[ms.metric]
  const loinc = LOINC_CODES[ms.metric]
  const coding: FhirCoding[] = []
  if (loinc) coding.push({ system: LOINC, code: loinc.code, display: loinc.display })
  coding.push({ system: AHI_METRIC_SYSTEM, code: ms.metric, display: def.label })
  const obs: FhirObservation = {
    resourceType: 'Observation',
    id: fhirId(`obs-${subjectKey}-${ms.metric}`.toLowerCase()),
    meta: { tag: [originTag(ms.data_origin)], lastUpdated: iso(ms.lastUpdated) },
    status: ms.quality === 'VALID' ? 'final' : 'preliminary',
    code: { coding, text: def.label },
    subject,
    effectiveDateTime: iso(ms.lastUpdated),
  }
  if (loinc) obs.category = [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }]
  if (ms.current != null && Number.isFinite(ms.current)) {
    const ucum = UCUM_CODES[def.unit]
    obs.valueQuantity = ucum ? { value: round(ms.current, def.decimals), unit: def.unit, system: UCUM, code: ucum } : { value: round(ms.current, def.decimals), unit: def.unit }
  } else {
    // Missing data is never exported as a value (and never as zero).
    obs.dataAbsentReason = { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason', code: 'unknown', display: 'Unknown' }], text: 'No current reading (device offline or data stale)' }
  }
  if (device) obs.device = { reference: `Device/${fhirId(device.id)}`, display: device.name }
  obs.note = [{ text: `Personal baseline status: ${ms.status}. Quality: ${ms.quality}. Decision support only, not a diagnosis.` }]
  return obs
}

function findDevice(devices: Device[], subjectId: string | null, metric: MetricCode): Device | undefined {
  return devices.find((d) => d.assignedTo === subjectId && d.metrics.includes(metric))
}

/** Builds the FHIR R4 collection Bundle for the current values. Pure function. */
export function buildFhirBundle(input: FhirExportInput): FhirBundle {
  const entry: FhirBundle['entry'] = []
  const push = (resource: FhirResource) => entry.push({ fullUrl: `urn:uuid:${uuidFromKey(`${resource.resourceType}/${resource.id}`)}`, resource })

  for (const c of input.crew) {
    push({
      resourceType: 'Patient',
      id: fhirId(c.id),
      meta: { tag: [originTag('SIMULATED')] },
      identifier: [{ system: AHI_CREW_SYSTEM, value: c.id }],
      active: true,
    })
  }

  for (const d of input.devices) {
    const dev: FhirDevice = {
      resourceType: 'Device',
      id: fhirId(d.id),
      meta: { tag: [originTag(d.data_origin)], lastUpdated: iso(d.lastSeenAt) },
      identifier: [{ system: AHI_DEVICE_SYSTEM, value: d.id }],
      status: DEVICE_STATUS[d.state],
      deviceName: [{ name: d.name, type: 'user-friendly-name' }],
      type: { coding: [{ system: 'urn:ahi:device-kind', code: d.kind }], text: d.kind },
      note: [{ text: `Adapter state: ${d.state}.${d.detail ? ` ${d.detail}` : ''}` }],
    }
    if (d.assignedTo) dev.patient = { reference: `Patient/${fhirId(d.assignedTo)}` }
    push(dev)
  }

  for (const c of input.crew) {
    const h = input.health[c.id]
    if (!h) continue
    const subject: FhirReference = { reference: `Patient/${fhirId(c.id)}` }
    for (const code of Object.keys(h.metrics) as MetricCode[]) {
      const ms = h.metrics[code]
      if (!ms) continue
      push(metricObservation(ms, subject, c.id, findDevice(input.devices, c.id, code)))
    }
  }

  const cabinSubject: FhirReference = { identifier: { system: 'urn:ahi:subject', value: 'CABIN' }, display: 'Cabin environment' }
  for (const code of Object.keys(input.environment.metrics) as MetricCode[]) {
    const ms = input.environment.metrics[code]
    if (!ms) continue
    push(metricObservation(ms, cabinSubject, 'cabin', findDevice(input.devices, null, code)))
  }

  const stamp = iso(input.simNow)
  return {
    resourceType: 'Bundle',
    id: fhirId(`ahi-${input.mission.id}-${input.simNow}`.toLowerCase()),
    meta: { tag: [originTag('SIMULATED')], lastUpdated: stamp },
    identifier: { system: 'urn:ahi:export', value: `${input.mission.id}-${input.simNow}` },
    type: 'collection',
    timestamp: stamp,
    entry,
  }
}

/** Triggers a client-side download of a JSON document. Browser only. */
export function downloadJson(filename: string, data: unknown, mime = 'application/fhir+json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
