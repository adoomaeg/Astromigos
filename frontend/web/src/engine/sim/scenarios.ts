/**
 * Scenario model: time varying modifiers applied to the target astronaut or cabin.
 *
 * Each scenario returns a severity in 0..1 that evolves from the scenario start
 * (clock.startedAt). Logged interventions apply a clearly HYPOTHETICAL recovery
 * effect: relief(t) = maxRelief x (1 - exp(-(t - loggedAt) / tau)). The effect is a
 * simulation device for the demo, never a claim about clinical outcomes.
 */
import type { Intervention, InterventionKind, ScenarioId } from '../../types/domain'
import { clamp, smoothstep } from '../stats'
import { HOUR_MS, MIN_MS } from '../text'

export type SensorStage = 'OK' | 'DEGRADED' | 'STALE' | 'OFFLINE'

interface Relief {
  kind: InterventionKind
  max: number
  tauMin: number
}

/** Hypothetical relief per scenario (simulation only). */
const RELIEF = {
  fatigue: [
    { kind: 'SLEEP_EXTENSION', max: 0.85, tauMin: 18 * 60 },
    { kind: 'REST_PROTOCOL', max: 0.4, tauMin: 12 * 60 },
    { kind: 'MEDICAL_CONSULT', max: 0.3, tauMin: 24 * 60 },
  ],
  acute: [
    { kind: 'REST_PROTOCOL', max: 0.55, tauMin: 25 },
    { kind: 'MEDICAL_CONSULT', max: 0.95, tauMin: 12 },
  ],
  perf: [
    { kind: 'EXERCISE_ADJUSTMENT', max: 0.7, tauMin: 24 * 60 },
    { kind: 'REST_PROTOCOL', max: 0.2, tauMin: 24 * 60 },
  ],
  co2: [{ kind: 'CABIN_VENTILATION', max: 0.9, tauMin: 40 }],
} satisfies Record<string, Relief[]>

export interface ScenarioTiming {
  /** Hours for progressive fatigue to reach full severity. */
  fatigueRampHours: number
  /** Minutes (from start) when the acute event begins and when it peaks. */
  acuteOnsetMin: number
  acutePeakMin: number
  /** Hours for cabin CO2 to reach its peak. */
  co2RampHours: number
  co2PeakAddPpm: number
  /** Sensor failure stages (minutes after start). */
  sensorDegradedMin: number
  sensorStaleMin: number
  sensorOfflineMin: number
  sensorRestoreDelayMin: number
}

export const SCENARIO_TIMING: ScenarioTiming = {
  fatigueRampHours: 54,
  acuteOnsetMin: 2,
  acutePeakMin: 14,
  co2RampHours: 3.5,
  co2PeakAddPpm: 3900,
  sensorDegradedMin: 10,
  sensorStaleMin: 20,
  sensorOfflineMin: 45,
  sensorRestoreDelayMin: 3,
}

export class ScenarioModel {
  readonly id: ScenarioId
  readonly targetId: string | null
  readonly startedAt: number
  private interventions: Intervention[] = []

  constructor(id: ScenarioId, targetId: string | null, startedAt: number) {
    this.id = id
    this.targetId = targetId
    this.startedAt = startedAt
  }

  addIntervention(i: Intervention): void {
    this.interventions = [...this.interventions, i]
  }

  /** Copy with one more (hypothetical) intervention. Used by the what-if comparison only. */
  withIntervention(i: Intervention | null): ScenarioModel {
    const m = new ScenarioModel(this.id, this.targetId, this.startedAt)
    m.interventions = i ? [...this.interventions, i] : this.interventions
    return m
  }

  /** Product of (1 - relief) over matching interventions logged before t. */
  private remaining(reliefs: Relief[], t: number, astronautId: string | null): number {
    let rem = 1
    for (const i of this.interventions) {
      if (i.loggedAt > t) continue
      if (astronautId !== null && i.astronautId !== astronautId) continue
      for (const r of reliefs) {
        if (r.kind !== i.kind) continue
        const k = 1 - Math.exp(-(t - i.loggedAt) / (r.tauMin * MIN_MS))
        rem *= 1 - r.max * k
      }
    }
    return rem
  }

  private elapsed(t: number): number {
    return t - this.startedAt
  }

  private targets(astronautId: string): boolean {
    return this.targetId === astronautId
  }

  /** Progressive fatigue severity (0..1). */
  fatigue(astronautId: string, t: number): number {
    if (this.id !== 'PROGRESSIVE_FATIGUE' || !this.targets(astronautId)) return 0
    const e = this.elapsed(t)
    if (e <= 0) return 0
    const s = smoothstep(e / (SCENARIO_TIMING.fatigueRampHours * HOUR_MS))
    return s * this.remaining(RELIEF.fatigue, t, astronautId)
  }

  /** Acute cardio event severity (0..1). */
  acute(astronautId: string, t: number): number {
    if (this.id !== 'ACUTE_CARDIO' || !this.targets(astronautId)) return 0
    const eMin = this.elapsed(t) / MIN_MS
    const { acuteOnsetMin: on, acutePeakMin: peak } = SCENARIO_TIMING
    if (eMin <= on) return 0
    return smoothstep((eMin - on) / (peak - on)) * this.remaining(RELIEF.acute, t, astronautId)
  }

  /** Exercise performance loss (0..0.32 fraction of the usual output). */
  perfLoss(astronautId: string, t: number): number {
    if (this.id !== 'PERFORMANCE_DECLINE' || !this.targets(astronautId)) return 0
    const eDays = this.elapsed(t) / (24 * HOUR_MS)
    if (eDays <= 0) return 0
    return clamp(0.03 + 0.075 * eDays, 0, 0.32) * this.remaining(RELIEF.perf, t, astronautId)
  }

  /** Extra cabin CO2 in ppm. */
  co2Add(t: number): number {
    if (this.id !== 'ENVIRONMENTAL_CO2') return 0
    const eH = this.elapsed(t) / HOUR_MS
    if (eH <= 0) return 0
    const s = smoothstep((eH - 0.1) / SCENARIO_TIMING.co2RampHours)
    return SCENARIO_TIMING.co2PeakAddPpm * s * this.remaining(RELIEF.co2, t, null)
  }

  /** Bio-Monitor stage for an astronaut. SENSOR_CHECK restores the device after a short delay. */
  sensorStage(astronautId: string, t: number): SensorStage {
    if (this.id !== 'SENSOR_FAILURE' || !this.targets(astronautId)) return 'OK'
    for (const i of this.interventions) {
      if (i.kind === 'SENSOR_CHECK' && i.astronautId === astronautId && t >= i.loggedAt + SCENARIO_TIMING.sensorRestoreDelayMin * MIN_MS) {
        return 'OK'
      }
    }
    const eMin = this.elapsed(t) / MIN_MS
    if (eMin < SCENARIO_TIMING.sensorDegradedMin) return 'OK'
    if (eMin < SCENARIO_TIMING.sensorStaleMin) return 'DEGRADED'
    if (eMin < SCENARIO_TIMING.sensorOfflineMin) return 'STALE'
    return 'OFFLINE'
  }

  /** Hydration index boost from logged HYDRATION interventions (hypothetical). */
  hydrationBoost(astronautId: string, t: number): number {
    let boost = 0
    for (const i of this.interventions) {
      if (i.kind !== 'HYDRATION' || i.astronautId !== astronautId || i.loggedAt > t) continue
      const dtMin = (t - i.loggedAt) / MIN_MS
      boost += 8 * (1 - Math.exp(-dtMin / 60)) * Math.exp(-dtMin / (12 * 60))
    }
    return boost
  }
}
