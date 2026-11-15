/**
 * HealthEngine: in-browser simulation + health intelligence pipeline.
 *
 *   adapters.read(simNow) -> canonical HealthObservation[] (data_origin SIMULATED)
 *     -> ingest: bounded history + streaming trackers (robust z, EWMA drift, persistence)
 *     -> evaluate(): metric status, combined rules, risk, regions, forecasts,
 *        anomalies, alerts, recommendations, audit
 *
 * Pure TypeScript, no React. The zustand store (src/state/store.ts) owns one engine,
 * calls advanceTo() on every tick and evaluate() a few times per real second, and
 * publishes only the slices whose version changed.
 *
 * v2: Earth communication delay (comms.ts), alert escalation (alerts.ts), daily check-ins
 * (checkins.ts), long-term mission days (missionDays.ts), the status timeline (one frame
 * every TIMELINE.frameEveryMin sim minutes) and the what-if comparison (intervention.ts).
 */
import type {
  Anomaly,
  AppState,
  Astronaut,
  AstronautHealth,
  AuditEvent,
  CheckIn,
  CommMessage,
  CommProfile,
  CommProfileId,
  DataOrigin,
  Device,
  EnvironmentState,
  HealthObservation,
  Intervention,
  InterventionComparison,
  InterventionKind,
  MetricCode,
  MetricState,
  Mission,
  MissionDaySummary,
  Prediction,
  RiskLevel,
  ScenarioId,
  Status,
  StatusFrame,
} from '../types/domain'
import { worstStatus } from '../lib/status'
import { COMM_PROFILES, CREW, METRIC_CATALOG, MISSION, SCENARIOS } from './catalog'
import {
  ALERTS,
  ASTRONAUT_METRICS,
  BASELINE,
  CABIN_FORECAST_METRICS,
  CABIN_METRICS,
  CHECKIN,
  COMMS,
  FORECAST,
  FORECAST_METRICS,
  MISSION_DAYS,
  SELF_REPORT_METRICS,
  SIM,
  TIMELINE,
} from './config'
import { MetricTracker, bucketCode, bucketFor, bucketFromCode, levelRank, type MetricAssessment } from './anomaly'
import { AlertManager } from './alerts'
import { checkInTime, checkInValues, sanitizeCheckIn, selfReportSummary, simulateCheckIn } from './checkins'
import { CommManager, delayPhrase, type ReplyContext, type SendInput } from './comms'
import { buildPrediction } from './forecast'
import { compareIntervention as projectIntervention, resolveMetric, type CompareInput } from './intervention'
import { heuristicLevel, isoDate, sameDay, synthDay } from './missionDays'
import { RecommendationManager, applySuppression, isActionable } from './recommendations'
import { assessRisk, buildRegions, combinedHits, hitFromAssessment, scoreHits, topHit, type RuleHit } from './risk'
import { linearSlope, round } from './stats'
import { DAY_MS, HOUR_MS, MIN_MS, fmtClock, fmtDuration, inlineLabel } from './text'
import {
  ActigraphyAdapter,
  AreaDosimeterAdapter,
  BioMonitorAdapter,
  EXERCISE_DEVICE_KINDS,
  EnvSensorAdapter,
  ExerciseDeviceAdapter,
  IntakeLogAdapter,
  PersonalDosimeterAdapter,
  ReactionTestAdapter,
  type AdapterStatus,
  type DeviceAdapter,
  type SimWorld,
} from './sim/adapters'
import { CabinModel, co2Mean, type CabinTruth } from './sim/cabin'
import { AstronautPhysiology } from './sim/physiology'
import { buildProfile } from './sim/profiles'
import { ScenarioModel } from './sim/scenarios'
import { SCHEDULE, dayIndex } from './sim/schedule'

export interface EngineOptions {
  scenarioId: ScenarioId
  seed?: number
  /** Sim epoch ms at which the scenario starts. Defaults to SIM.startIso. */
  startAt?: number
  historyDays?: number
  dailyHistoryDays?: number
  crew?: Astronaut[]
  /** Earth link profile (kept across scenario changes by the store). */
  commProfileId?: CommProfileId
  /** Compute status frames during pre-generation for this many hours (default TIMELINE.pregenHours). */
  timelinePregenHours?: number
}

export interface InterventionInput {
  astronautId: string
  kind: InterventionKind
  recommendationId?: string
  note?: string
}

interface Channel {
  subject: string
  metric: MetricCode
  tracker: MetricTracker
}

type AssessMap = Partial<Record<MetricCode, MetricAssessment>>

interface CrewRules {
  chans: Channel[]
  assess: AssessMap
  hits: RuleHit[]
  dq: RuleHit[]
  combined: RuleHit[]
  riskHits: RuleHit[]
}

export type SliceName =
  | 'crew'
  | 'devices'
  | 'health'
  | 'environment'
  | 'history'
  | 'anomalies'
  | 'alerts'
  | 'recommendations'
  | 'interventions'
  | 'audit'
  | 'mission'
  | 'comms'
  | 'checkIns'
  | 'missionDays'
  | 'statusTimeline'

const INTERVENTION_LABEL: Record<InterventionKind, string> = {
  REST_PROTOCOL: 'Rest protocol',
  SLEEP_EXTENSION: 'Sleep extension',
  HYDRATION: 'Hydration per protocol',
  EXERCISE_ADJUSTMENT: 'Exercise adjustment',
  SENSOR_CHECK: 'Sensor check',
  CABIN_VENTILATION: 'Cabin ventilation',
  MEDICAL_CONSULT: 'Flight surgeon consult',
}

const MISSION_START = Date.parse(MISSION.startedAt)
const MISSION_DAY0 = dayIndex(MISSION_START)
const REST_CODE = bucketCode('REST')
const CHECKIN_SOURCE = (id: string) => `APP-CHECKIN-${id}`

export function commProfileById(id: CommProfileId): CommProfile {
  return COMM_PROFILES.find((p) => p.id === id) ?? COMM_PROFILES[0]!
}
/** Approximate mean dose before the history window (mGy per day), simulated. */
const PRIOR_DOSE_PER_DAY = 0.42

export class HealthEngine implements SimWorld {
  readonly seed: number
  readonly missionId = MISSION.id
  readonly crewIds: string[]
  readonly scenario: ScenarioModel
  readonly scenarioId: ScenarioId
  readonly startedAt: number
  simTime: number

  private readonly crewBase: Astronaut[]
  private readonly physioMap = new Map<string, AstronautPhysiology>()
  private readonly cabinModel: CabinModel
  private readonly adapters: DeviceAdapter[] = []
  private readonly adapterById = new Map<string, DeviceAdapter>()
  private readonly channels = new Map<string, Map<MetricCode, Channel>>()
  private readonly channelList: Channel[] = []
  private readonly doses = new Map<string, number>()
  private isoT = NaN
  private isoS = ''
  private dataVersion = 0
  private historyBuiltAt = -1
  private lastForecastAt = -Infinity
  private readonly predCache = new Map<string, Partial<Record<MetricCode, Prediction>>>()
  private readonly prevLevels = new Map<string, RiskLevel | 'NO_DATA'>()
  private seqAnomaly = 0
  private seqAudit = 0
  private seqIntervention = 0
  private lastDevicesKey = ''
  private readonly alertMgr = new AlertManager()
  private readonly recMgr = new RecommendationManager()
  private readonly commMgr: CommManager
  /** Precise sim clock (the store's simNow); simTime only moves in whole minutes. */
  clockNow: number
  private readonly histStart: number
  private readonly dailyStart: number
  private seqCheckIn = 0
  private readonly checkInsBy = new Map<string, CheckIn[]>()
  /** Days (absolute UTC day index) answered in the UI: no simulated check-in for them. */
  private readonly manualDays = new Map<string, Set<number>>()
  private readonly doseAtDayStart = new Map<string, Map<number, number>>()
  private readonly frames: StatusFrame[] = []
  private framesPublished = -1
  private framesVersion = 0
  private readonly timelinePregenFrom: number
  private lastMissionDaysAt = -Infinity
  private lastMissionDay = -1
  private readonly crewChans = new Map<string, Channel[]>()
  private readonly checkInTimes = new Map<number, number[]>()

  // Published slices (replaced, never mutated, when they change)
  crew: Astronaut[]
  devices: Device[] = []
  health: Record<string, AstronautHealth> = {}
  environment: EnvironmentState = { metrics: {}, status: 'NO_DATA' }
  history: AppState['history'] = {}
  anomalies: Anomaly[] = []
  interventions: Intervention[] = []
  audit: AuditEvent[] = []
  mission: Mission
  commProfileId: CommProfileId
  checkIns: CheckIn[] = []
  missionDays: Record<string, MissionDaySummary[]> = {}
  statusTimeline: StatusFrame[] = []
  readonly versions: Record<SliceName, number> = {
    mission: 0,
    comms: 0,
    checkIns: 0,
    missionDays: 0,
    statusTimeline: 0,
    crew: 0,
    devices: 0,
    health: 0,
    environment: 0,
    history: 0,
    anomalies: 0,
    alerts: 0,
    recommendations: 0,
    interventions: 0,
    audit: 0,
  }

  constructor(opts: EngineOptions) {
    this.seed = opts.seed ?? SIM.seed
    this.scenarioId = opts.scenarioId
    this.startedAt = opts.startAt ?? Date.parse(SIM.startIso)
    this.crewBase = opts.crew ?? CREW
    this.crew = this.crewBase
    this.crewIds = this.crewBase.map((a) => a.id)
    const def = SCENARIOS.find((s) => s.id === opts.scenarioId)
    this.scenario = new ScenarioModel(opts.scenarioId, def?.targetAstronautId ?? null, this.startedAt)

    const historyDays = opts.historyDays ?? SIM.historyDays
    const dailyDays = Math.max(historyDays, opts.dailyHistoryDays ?? SIM.dailyHistoryDays)
    const histStart = this.startedAt - historyDays * DAY_MS
    this.simTime = histStart
    this.clockNow = this.startedAt
    this.histStart = histStart
    this.dailyStart = this.startedAt - dailyDays * DAY_MS
    this.timelinePregenFrom = this.startedAt - (opts.timelinePregenHours ?? TIMELINE.pregenHours) * HOUR_MS
    this.commProfileId = opts.commProfileId ?? COMMS.defaultProfile
    this.mission = { ...MISSION, commDelaySec: commProfileById(this.commProfileId).oneWayDelaySec }
    this.commMgr = new CommManager(this.seed)

    const sc = this.scenario
    this.crewBase.forEach((a, i) => {
      const profile = buildProfile(a, i, this.seed)
      const fx = { fatigue: (t: number) => sc.fatigue(a.id, t), acute: (t: number) => sc.acute(a.id, t), perfLoss: (t: number) => sc.perfLoss(a.id, t) }
      this.physioMap.set(a.id, new AstronautPhysiology(a.id, profile, this.seed, fx))
      const initDose = (PRIOR_DOSE_PER_DAY * profile.shieldFactor * Math.max(0, histStart - MISSION_START)) / DAY_MS
      this.doses.set(a.id, initDose)
      // Dose at the start of the day that contains histStart (for the mission day view).
      const dH = dayIndex(histStart)
      const startOfDay = initDose - (PRIOR_DOSE_PER_DAY * profile.shieldFactor * (histStart - dH * DAY_MS)) / DAY_MS
      this.doseAtDayStart.set(a.id, new Map([[dH, startOfDay]]))
      this.checkInsBy.set(a.id, [])
      this.manualDays.set(a.id, new Set())
    })
    this.cabinModel = new CabinModel(this.seed)

    for (const a of this.crewBase) {
      this.addAdapter(new BioMonitorAdapter(this, a.id, histStart))
      this.addAdapter(new ActigraphyAdapter(this, a.id, histStart))
      this.addAdapter(new PersonalDosimeterAdapter(this, a.id, histStart))
      this.addAdapter(new ReactionTestAdapter(this, a.id, histStart))
      this.addAdapter(new IntakeLogAdapter(this, a.id, histStart))
    }
    for (const kind of EXERCISE_DEVICE_KINDS) this.addAdapter(new ExerciseDeviceAdapter(this, kind, histStart))
    this.addAdapter(new EnvSensorAdapter(this, histStart))
    this.addAdapter(new AreaDosimeterAdapter(this, histStart))

    for (const a of this.crewBase) for (const m of ASTRONAUT_METRICS) this.addChannel(a.id, m)
    for (const m of CABIN_METRICS) this.addChannel('CABIN', m)
    for (const a of this.crewBase) this.crewChans.set(a.id, ASTRONAUT_METRICS.map((m) => this.channel(a.id, m)))

    // 1) Backfill daily metrics (sleep, exercise sessions, reaction tests) before the minute history.
    for (const ch of this.channelList) ch.tracker.recomputeEvery = BASELINE.recomputeEveryPregen
    const backfill: HealthObservation[] = []
    for (const ad of this.adapters) if (ad.readEvents) backfill.push(...ad.readEvents(this.startedAt - dailyDays * DAY_MS, histStart))
    backfill.sort((p, q) => (p.measured_at < q.measured_at ? -1 : p.measured_at > q.measured_at ? 1 : 0))
    for (const o of backfill) this.ingest(o, Date.parse(o.measured_at))
    // Simulated daily check-ins before the minute history (they only feed event metrics).
    this.generateCheckIns(this.startedAt - CHECKIN.historyDays * DAY_MS, histStart)

    // 2) History up to the scenario start (scenario effects are zero before it): 5 minute
    //    steps (the stored resolution) and 1 minute steps for the last SIM.fineWindowMin.
    this.runSteps(this.startedAt - SIM.fineWindowMin * MIN_MS, 'coarse', historyDays * 1440)
    this.runSteps(this.startedAt, 'fine', SIM.fineWindowMin + 10)
    for (const ch of this.channelList) {
      ch.tracker.recomputeEvery = BASELINE.recomputeEvery
      ch.tracker.recompute()
    }

    this.refreshMissionDays(true)
    const name = def?.name ?? opts.scenarioId
    this.addAudit(
      'SCENARIO_CHANGED',
      'system',
      `Scenario "${name}" started. Simulation reset (seed ${this.seed}); ${historyDays} days of simulated history regenerated. All device data is SIMULATED.`,
    )
    this.evaluate()
  }

  // -------------------------------------------------------------------------
  // SimWorld
  // -------------------------------------------------------------------------

  physio(id: string): AstronautPhysiology {
    return this.physioMap.get(id)!
  }

  cabin(): CabinTruth | null {
    return this.cabinModel.truth
  }

  personalDose(id: string): number {
    return this.doses.get(id) ?? 0
  }

  iso(t: number): string {
    if (t !== this.isoT) {
      this.isoT = t
      this.isoS = new Date(t).toISOString()
    }
    return this.isoS
  }

  // -------------------------------------------------------------------------
  // Setup helpers
  // -------------------------------------------------------------------------

  private addAdapter(a: DeviceAdapter): void {
    this.adapters.push(a)
    this.adapterById.set(a.id, a)
  }

  private addChannel(subject: string, metric: MetricCode): void {
    const ch: Channel = { subject, metric, tracker: new MetricTracker(subject, metric) }
    let bySubject = this.channels.get(subject)
    if (!bySubject) {
      bySubject = new Map()
      this.channels.set(subject, bySubject)
    }
    bySubject.set(metric, ch)
    this.channelList.push(ch)
  }

  private channel(subject: string, metric: MetricCode): Channel {
    return this.channels.get(subject)!.get(metric)!
  }

  /** Read-only access for tests and debugging. */
  tracker(subject: string, metric: MetricCode): MetricTracker {
    return this.channel(subject, metric).tracker
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  private ingest(o: HealthObservation, t: number): void {
    const ch = this.channels.get(o.subject_id)?.get(o.metric_code)
    if (!ch) return
    const bucket = bucketFor(o.context.activity, o.metadata.recovering === true, ch.tracker.cfg.bucketed)
    ch.tracker.ingest(t, o.value, bucket, o.quality.status, o.device_id)
  }

  private step(t: number, dtMin: number): void {
    const prevT = this.simTime
    const sc = this.scenario
    const cabin = this.cabinModel.step(t, dtMin, sc.co2Add(t))
    for (const id of this.crewIds) {
      this.physioMap.get(id)!.step(
        t,
        dtMin,
        { co2: cabin.co2, cabinTemp: cabin.temp },
        { fatigue: sc.fatigue(id, t), acute: sc.acute(id, t), perfLoss: sc.perfLoss(id, t), hydrationBoost: sc.hydrationBoost(id, t) },
      )
      const shield = this.physioMap.get(id)!.profile.shieldFactor
      this.doses.set(id, this.doses.get(id)! + (cabin.doseRate * shield * dtMin) / 60 / 1000)
    }
    const day = dayIndex(t)
    if (day !== dayIndex(prevT)) for (const id of this.crewIds) this.doseAtDayStart.get(id)!.set(day, this.doses.get(id)!)
    this.simTime = t
    const nowIso = this.iso(t)
    for (const ad of this.adapters) {
      const obs = ad.read(t)
      for (const o of obs) this.ingest(o, o.measured_at === nowIso ? t : Date.parse(o.measured_at))
    }
    // Mark gaps so charts show missing data instead of interpolating.
    for (const ch of this.channelList) {
      const tr = ch.tracker
      if (tr.cfg.kind !== 'continuous' || tr.series.lastPushT >= t) continue
      if (t % (tr.cfg.cadenceMin * MIN_MS) === 0) tr.ingestMissing(t, tr.lastBucket)
    }
    this.generateCheckIns(prevT, t)
    this.dataVersion++
    // Status timeline: one frame per TIMELINE.frameEveryMin boundary (cheap rules only).
    const frameMs = TIMELINE.frameEveryMin * MIN_MS
    if (t >= this.timelinePregenFrom && Math.floor(t / frameMs) > Math.floor(prevT / frameMs)) this.pushFrame(Math.floor(t / frameMs) * frameMs)
  }

  private runSteps(target: number, mode: 'auto' | 'fine' | 'coarse', maxSteps: number): void {
    let n = 0
    const coarseMs = SIM.coarseResolutionMin * MIN_MS
    while (n < maxSteps) {
      const remaining = Math.floor((target - this.simTime) / MIN_MS)
      if (remaining < 1) break
      const aligned = this.simTime % coarseMs === 0 && remaining >= SIM.coarseResolutionMin
      const coarse = aligned && (mode === 'coarse' || (mode === 'auto' && remaining > SIM.coarseStepThresholdMin))
      const stepMin = coarse ? SIM.coarseResolutionMin : 1
      this.step(this.simTime + stepMin * MIN_MS, stepMin)
      n++
    }
  }

  /** Advance the simulation to sim time t (whole minutes; the remainder carries over). */
  advanceTo(t: number): void {
    this.runSteps(t, 'auto', SIM.maxStepsPerAdvance)
    // Precise clock for comms timing (simTime is whole minutes). Never ahead of the simulation.
    const reached = this.simTime + MIN_MS > t ? t : this.simTime
    if (reached > this.clockNow) this.clockNow = reached
  }

  // -------------------------------------------------------------------------
  // Evaluation
  // -------------------------------------------------------------------------

  private deviceStatuses(now: number): Map<string, AdapterStatus> {
    const m = new Map<string, AdapterStatus>()
    for (const a of this.adapters) m.set(a.id, a.status(now))
    return m
  }

  private assessChannel(ch: Channel, now: number, statuses: Map<string, AdapterStatus>): MetricAssessment {
    const tr = ch.tracker
    let down = false
    if (tr.deviceId && tr.cfg.kind === 'continuous') {
      const ad = this.adapterById.get(tr.deviceId)
      const st = statuses.get(tr.deviceId)
      down = !!ad && ad.listed && !!st && (st.state === 'DATA_STALE' || st.state === 'OFFLINE')
    }
    return tr.assess(now, down)
  }

  private metricState(ch: Channel, a: MetricAssessment, now: number): MetricState {
    const tr = ch.tracker
    const def = METRIC_CATALOG[ch.metric]
    let trend: number | null = null
    if (!a.noData) {
      const pts = tr.cfg.kind === 'continuous' ? tr.series.lastValid(60) : tr.series.lastValid(5)
      const fresh = tr.cfg.kind === 'continuous' ? pts.filter((p) => now - p.t <= HOUR_MS) : pts
      const s = linearSlope(
        fresh.map((p) => (p.t - now) / HOUR_MS),
        fresh.map((p) => p.v as number),
      )
      trend = s === null ? null : round(s, 3)
    }
    return {
      metric: ch.metric,
      current: a.value === null ? null : round(a.value, def.decimals + 1),
      unit: def.unit,
      status: a.status,
      zScore: a.z === null ? null : round(a.z, 2),
      ewma: tr.ewma === null ? null : round(tr.ewma, def.decimals + 1),
      trendPerHour: trend,
      baseline: a.baseline,
      lastUpdated: Number.isFinite(tr.lastValidT) ? tr.lastValidT : now,
      quality: a.noData ? 'MISSING' : tr.lastQuality,
      data_origin: SELF_REPORT_METRICS.includes(ch.metric) ? this.selfReportOrigin(ch.subject) : 'SIMULATED',
      driftZ: a.driftZ === null ? null : round(a.driftZ, 2),
      deviationPct: a.deviationPct === null ? null : round(a.deviationPct, 1),
      persistenceHours: a.persistenceHours === null ? null : round(a.persistenceHours, 1),
      baselineContext: a.bucket,
      contextBaselines: tr.allBaselines(),
      ruleId: a.ruleId,
      explanation: a.label,
    }
  }

  /** One R-DQ-01 hit per silent device, one R-DQ-02 per device with a questionable signal. */
  private dataQualityHits(subjectId: string | null, chans: Channel[], assess: AssessMap, now: number): RuleHit[] {
    const silent = new Map<string, MetricCode[]>()
    const shaky = new Map<string, MetricCode[]>()
    for (const ch of chans) {
      const a = assess[ch.metric]
      const tr = ch.tracker
      if (!a || tr.cfg.kind !== 'continuous' || !tr.deviceId) continue
      const ad = this.adapterById.get(tr.deviceId)
      if (!ad || !ad.listed) continue
      if (a.noData) silent.set(tr.deviceId, [...(silent.get(tr.deviceId) ?? []), ch.metric])
      else if (tr.questionableShare() >= 0.2) shaky.set(tr.deviceId, [...(shaky.get(tr.deviceId) ?? []), ch.metric])
    }
    const out: RuleHit[] = []
    for (const [devId, metrics] of silent) {
      const ad = this.adapterById.get(devId)!
      const since = Math.min(...metrics.map((m) => now - this.channel(subjectId ?? 'CABIN', m).tracker.lastValidT))
      const devName = ad.name.replace(' (sim)', '')
      out.push({
        subjectId,
        ruleId: 'R-DQ-01',
        level: 'MODERATE',
        metric: metrics[0]!,
        region: subjectId ? METRIC_CATALOG[metrics[0]!].region : 'environment',
        method: 'DATA_QUALITY',
        kind: 'DATA_QUALITY',
        label: `No data from ${devName} for ${Number.isFinite(since) ? fmtDuration(since) : 'a while'} (${metrics.map(inlineLabel).join(', ')}): status unknown, not normal`,
        phrase: subjectId ? `Your ${devName} is not sending data` : `The ${devName} is not sending data`,
        title: `${devName} not sending data`,
      })
    }
    for (const [devId, metrics] of shaky) {
      const ad = this.adapterById.get(devId)!
      const devName = ad.name.replace(' (sim)', '')
      out.push({
        subjectId,
        ruleId: 'R-DQ-02',
        level: 'MODERATE',
        metric: metrics[0]!,
        region: subjectId ? METRIC_CATALOG[metrics[0]!].region : 'environment',
        method: 'DATA_QUALITY',
        kind: 'DATA_QUALITY',
        label: `${devName} signal is weak; ${metrics.map(inlineLabel).join(', ')} marked questionable and capped at Watch`,
        phrase: subjectId ? `Your ${devName} signal is weak` : `The ${devName} signal is weak`,
        title: `${devName} signal quality reduced`,
      })
    }
    return out
  }

  private forecastsFor(subject: string, metrics: MetricCode[], now: number): Partial<Record<MetricCode, Prediction>> {
    const out: Partial<Record<MetricCode, Prediction>> = {}
    for (const m of metrics) {
      const tr = this.channel(subject, m).tracker
      const cfg = tr.cfg
      if (cfg.kind === 'event') {
        const ref = tr.readyBaseline('ALL')
        out[m] = buildPrediction({
          astronautId: subject,
          metric: m,
          now,
          kind: 'event',
          points: tr.series.lastValid(14).map((p) => ({ t: p.t, v: p.v as number })),
          band: ref ? { low: ref.low, high: ref.high } : null,
          physicalMin: cfg.physicalMin,
          physicalMax: cfg.physicalMax,
        })
        continue
      }
      const ref = cfg.bucketed ? tr.readyBaseline('REST') : tr.readyBaseline('ALL')
      const pts: Array<{ t: number; v: number }> = []
      const multiplicative = m === 'HRV_RMSSD'
      tr.series.forEachSince(now - FORECAST.windowHours * HOUR_MS, (t, v, bc) => {
        if (v === null) return
        if (!cfg.bucketed) {
          pts.push({ t, v })
          return
        }
        const b = bucketFromCode(bc)
        if (b === 'EXERCISE' || !ref) return
        const bb = tr.readyBaseline(b)
        if (!bb) return
        pts.push({ t, v: multiplicative ? (v * ref.median) / bb.median : v - bb.median + ref.median })
      })
      out[m] = buildPrediction({
        astronautId: subject,
        metric: m,
        now,
        kind: 'continuous',
        points: pts,
        band: ref ? { low: ref.low, high: ref.high } : null,
        physicalMin: cfg.physicalMin,
        physicalMax: cfg.physicalMax,
        methodNote: cfg.bucketed ? 'context adjusted to resting values, exercise excluded' : undefined,
      })
    }
    return out
  }

  private noteLevel(subject: string, key: string, a: { level: RiskLevel; noData: boolean; method: Anomaly['method'] | null; label: string | null }, metric: MetricCode, now: number): void {
    const prev = this.prevLevels.get(key) ?? 'LOW'
    const cur: RiskLevel | 'NO_DATA' = a.noData ? 'NO_DATA' : a.level
    this.prevLevels.set(key, cur)
    let severity: RiskLevel | null = null
    if (cur === 'NO_DATA') {
      if (prev !== 'NO_DATA') severity = 'MODERATE'
    } else if (cur !== 'LOW' && (prev === 'NO_DATA' || levelRank(cur) > levelRank(prev as RiskLevel))) {
      severity = cur
    }
    if (!severity || !a.label) return
    const whose = subject === 'CABIN' ? 'recent cabin history' : 'your own recent history'
    const an: Anomaly = {
      id: `AN-${++this.seqAnomaly}`,
      astronautId: subject,
      metric,
      detectedAt: now,
      method: a.method ?? 'DATA_QUALITY',
      severity,
      explanation:
        cur === 'NO_DATA'
          ? `${a.label}. Missing data is never treated as normal.`
          : `${a.label}. Compared with ${whose}; a statistical flag for review, not a diagnosis.`,
    }
    const next = [an, ...this.anomalies]
    this.anomalies = next.length > ALERTS.maxAnomalies ? next.slice(0, ALERTS.maxAnomalies) : next
    this.versions.anomalies++
  }

  /** Recompute every derived slice from the current streaming state. Cheap (no sorting of history). */
  evaluate(): void {
    const now = this.simTime
    const statuses = this.deviceStatuses(now)
    const doForecast = now - this.lastForecastAt >= FORECAST.recomputeEveryMin * MIN_MS
    if (doForecast) this.lastForecastAt = now

    // Devices
    const devices: Device[] = []
    let key = ''
    for (const ad of this.adapters) {
      if (!ad.listed) continue
      const st = statuses.get(ad.id)!
      devices.push({
        id: ad.id,
        kind: ad.kind as Device['kind'],
        name: ad.name,
        assignedTo: ad.assignedTo,
        state: st.state,
        batteryPct: st.batteryPct,
        signalPct: st.signalPct,
        lastSeenAt: st.lastSeenAt,
        data_origin: 'SIMULATED',
        metrics: ad.metrics,
        detail: st.detail,
      })
      key += `${ad.id}:${st.state}:${st.batteryPct}:${st.signalPct}:${st.lastSeenAt}:${st.detail};`
    }
    if (key !== this.lastDevicesKey) {
      this.lastDevicesKey = key
      this.devices = devices
      this.versions.devices++
    }

    // Crew mission day
    const missionDay = Math.floor((now - MISSION_START) / DAY_MS)
    if (this.crew[0] && this.crew[0].missionDay !== missionDay) {
      this.crew = this.crewBase.map((a) => ({ ...a, missionDay }))
      this.versions.crew++
    }

    // Cabin
    const cabinChans = CABIN_METRICS.map((m) => this.channel('CABIN', m))
    const envAssess: AssessMap = {}
    const envMetrics: Partial<Record<MetricCode, MetricState>> = {}
    for (const ch of cabinChans) {
      const a = this.assessChannel(ch, now, statuses)
      envAssess[ch.metric] = a
      envMetrics[ch.metric] = this.metricState(ch, a, now)
      this.noteLevel('CABIN', `CABIN|${ch.metric}`, a, ch.metric, now)
    }
    const envHits: RuleHit[] = []
    for (const ch of cabinChans) {
      const h = hitFromAssessment(null, envAssess[ch.metric]!)
      if (h) envHits.push(h)
    }
    const envDq = this.dataQualityHits(null, cabinChans, envAssess, now)
    const allHits: RuleHit[] = [...envHits, ...envDq]
    if (doForecast) this.predCache.set('CABIN', this.forecastsFor('CABIN', CABIN_FORECAST_METRICS, now))
    const envTop = topHit([...envHits, ...envDq])
    this.environment = {
      metrics: envMetrics,
      status: worstStatus(Object.values(envMetrics).map((m) => m!.status)),
      predictions: this.predCache.get('CABIN') ?? {},
      headline: envTop
        ? `${envTop.phrase}, so ${envTop.kind === 'DATA_QUALITY' ? 'a sensor check is suggested' : 'a cabin air check is suggested'}.`
        : 'Cabin air and radiation are within their usual range.',
    }
    this.versions.environment++

    // Crew
    const health: Record<string, AstronautHealth> = {}
    for (const a of this.crewBase) {
      const { chans, assess, hits, dq, combined, riskHits } = this.crewRules(a.id, now, statuses, envAssess, envHits)
      const metrics: Partial<Record<MetricCode, MetricState>> = {}
      for (const ch of chans) {
        const as = assess[ch.metric]!
        metrics[ch.metric] = this.metricState(ch, as, now)
        this.noteLevel(a.id, `${a.id}|${ch.metric}`, as, ch.metric, now)
      }
      for (const c of combined) {
        if (c.kind !== 'COMBINED') continue
        this.noteLevel(a.id, `${a.id}|${c.ruleId}`, { level: c.level, noData: false, method: 'COMBINED', label: c.label }, c.metric ?? 'HEART_RATE', now)
      }
      const extra: string[] = []
      const truth = this.physio(a.id).truth
      if (this.scenario.targetId === a.id && this.scenario.id !== 'NOMINAL') extra.push('A demo scenario is active for this crew member.')
      const risk = assessRisk({ astronautId: a.id, now, hits: riskHits, assessments: assess, extraLimitations: extra })
      const regions = buildRegions(metrics, assess, riskHits)
      if (doForecast) this.predCache.set(a.id, this.forecastsFor(a.id, FORECAST_METRICS, now))
      health[a.id] = {
        astronautId: a.id,
        activity: truth?.activity ?? 'REST',
        metrics,
        regions,
        risk,
        predictions: this.predCache.get(a.id) ?? {},
      }
      allHits.push(...hits, ...dq, ...combined)
    }
    this.health = health
    this.versions.health++

    // Alerts and recommendations. Self report feeds recommendations, never alerts.
    const actionable = applySuppression(allHits.filter(isActionable))
    const name = (id: string | null) => this.callsign(id)
    const changes = this.alertMgr.sync(
      actionable.filter((h) => h.kind !== 'SELF_REPORT'),
      now,
      name,
    )
    if (changes.length) this.versions.alerts++
    for (const c of changes) {
      if (c.kind === 'RESOLVED') continue
      this.addAudit(
        'RULE_EVALUATED',
        'system',
        `Rule ${c.alert.ruleId} ${c.kind === 'CREATED' ? 'raised' : 'escalated'} a ${c.alert.severity} alert (${c.alert.title}): ${c.alert.detail}`,
      )
      // Automatic health packet to Earth when an alert reaches HIGH or CRITICAL (once per alert).
      if (levelRank(c.alert.severity) >= levelRank(COMMS.autoPacketLevel) && !this.commMgr.hasPacketFor(c.alert.id)) {
        this.commMgr.markPacketFor(c.alert.id)
        this.downlink(
          {
            astronautId: c.alert.astronautId,
            kind: 'HEALTH_PACKET',
            title: `Automatic health packet: ${c.alert.title}`,
            body: this.packetBody(c.alert.astronautId, `${c.alert.severity} alert ${c.alert.id}: ${c.alert.title}.`, health),
            alertId: c.alert.id,
          },
          'SIMULATED',
          'system',
        )
      }
    }
    for (const a of this.alertMgr.escalate(now)) {
      this.versions.alerts++
      const step = a.escalationLevel === 1 ? 're-announced to the whole crew' : 'flagged to the crew medical officer and to the ground team'
      this.addAudit(
        'ALERT_ESCALATED',
        'system',
        `Alert ${a.id} (${a.severity}: ${a.title}) not acknowledged for ${fmtDuration((a.escalatedAt ?? now) - a.createdAt)}: escalation level ${a.escalationLevel}, ${step}.`,
      )
    }
    if (this.recMgr.sync(actionable, now, { profile: this.commProfile, reviewMin: COMMS.reviewMinMin })) this.versions.recommendations++

    // Earth link: deliveries and simulated ground replies up to the precise clock.
    this.processComms()

    // Timeline and long-term view
    if (this.framesPublished !== this.framesVersion) {
      this.framesPublished = this.framesVersion
      this.statusTimeline = this.frames.slice()
      this.versions.statusTimeline++
    }
    this.refreshMissionDays(false)

    // History (only when new data arrived)
    if (this.historyBuiltAt !== this.dataVersion) {
      this.historyBuiltAt = this.dataVersion
      const h: AppState['history'] = {}
      for (const ch of this.channelList) {
        const subj = (h[ch.subject] ??= {})
        subj[ch.metric] = ch.tracker.series.toTimePoints()
      }
      this.history = h
      this.versions.history++
    }
  }

  // -------------------------------------------------------------------------
  // Shared rule evaluation (evaluate() and status frames)
  // -------------------------------------------------------------------------

  private crewRules(id: string, now: number, statuses: Map<string, AdapterStatus>, envAssess: AssessMap, envHits: RuleHit[]): CrewRules {
    const chans = this.crewChans.get(id)!
    const assess: AssessMap = {}
    let hits: RuleHit[] = []
    for (const ch of chans) {
      const as = this.assessChannel(ch, now, statuses)
      assess[ch.metric] = as
      const h = hitFromAssessment(id, as)
      if (h) hits.push(h)
    }
    const dq = this.dataQualityHits(id, chans, assess, now)
    const combined = combinedHits(id, assess, envAssess, selfReportSummary(this.checkInsBy.get(id) ?? [], now))
    // A combined self report factor replaces the plain per metric hit of the same rule.
    if (combined.some((c) => c.kind === 'SELF_REPORT')) {
      const ids = new Set(combined.map((c) => c.ruleId))
      hits = hits.filter((h) => !ids.has(h.ruleId))
    }
    return { chans, assess, hits, dq, combined, riskHits: [...hits, ...dq, ...combined, ...envHits] }
  }

  private cabinRules(now: number, statuses: Map<string, AdapterStatus>): { assess: AssessMap; hits: RuleHit[]; status: Status } {
    const assess: AssessMap = {}
    const hits: RuleHit[] = []
    const list: Status[] = []
    for (const m of CABIN_METRICS) {
      const a = this.assessChannel(this.channel('CABIN', m), now, statuses)
      assess[m] = a
      list.push(a.status)
      const h = hitFromAssessment(null, a)
      if (h) hits.push(h)
    }
    return { assess, hits, status: worstStatus(list) }
  }

  /** Append one status frame (risk level per astronaut and the cabin status) at sim time t. */
  private pushFrame(t: number): void {
    const now = this.simTime
    const statuses = this.deviceStatuses(now)
    const cabin = this.cabinRules(now, statuses)
    const levels: Record<string, Status> = { CABIN: cabin.status }
    for (const id of this.crewIds) levels[id] = scoreHits(this.crewRules(id, now, statuses, cabin.assess, cabin.hits).riskHits).level
    const last = this.frames[this.frames.length - 1]
    if (last && last.t >= t) return
    this.frames.push({ t, levels })
    const cut = t - SIM.historyDays * DAY_MS
    let drop = 0
    while (drop < this.frames.length && this.frames[drop]!.t < cut) drop++
    if (drop > 0) this.frames.splice(0, drop)
    this.framesVersion++
  }

  // -------------------------------------------------------------------------
  // Daily check-ins
  // -------------------------------------------------------------------------

  /** Generate simulated check-ins whose time falls in (from, to]. */
  private generateCheckIns(from: number, to: number): void {
    let added = false
    for (let d = dayIndex(from); d <= dayIndex(to); d++) {
      let times = this.checkInTimes.get(d)
      if (!times) {
        times = this.crewIds.map((id) => checkInTime(this.seed, id, d))
        this.checkInTimes.set(d, times)
        if (this.checkInTimes.size > 64) this.checkInTimes.delete(this.checkInTimes.keys().next().value!)
      }
      for (let i = 0; i < this.crewIds.length; i++) {
        const id = this.crewIds[i]!
        const t = times[i]!
        if (t <= from || t > to) continue
        if (this.manualDays.get(id)!.has(d)) continue
        const ph = this.physio(id)
        const cabin = this.cabinModel.truth
        const co2 = cabin && Math.abs(cabin.t - t) <= 15 * MIN_MS ? cabin.co2 : co2Mean(t) + this.scenario.co2Add(t)
        const c = simulateCheckIn(this.seed, id, ph.profile, d, t, {
          fatigue: this.scenario.fatigue(id, t),
          co2,
          perfLoss: this.scenario.perfLoss(id, t),
          night: ph.schedule.night(d - 1, to),
        })
        this.recordCheckIn({ ...c, id: `CHK-${++this.seqCheckIn}` }, false)
        added = true
      }
    }
    if (added) this.publishCheckIns()
  }

  private recordCheckIn(c: CheckIn, replaceSameDay: boolean): void {
    const list = this.checkInsBy.get(c.astronautId)!
    const day = dayIndex(c.at)
    const idx = replaceSameDay ? list.findIndex((x) => dayIndex(x.at) === day) : -1
    if (idx >= 0) {
      list.splice(idx, 1)
      list.unshift(c)
      list.sort((a, b) => b.at - a.at)
      this.rebuildSelfReport(c.astronautId)
      return
    }
    list.unshift(c)
    if (list.length > 1 && list[1]!.at > c.at) list.sort((a, b) => b.at - a.at)
    const max = Math.ceil(CHECKIN.maxCheckIns / Math.max(1, this.crewIds.length))
    if (list.length > max) list.length = max
    if (list[0] === c) this.ingestCheckIn(c)
    else this.rebuildSelfReport(c.astronautId)
  }

  private ingestCheckIn(c: CheckIn): void {
    for (const { metric, value } of checkInValues(c)) {
      this.channel(c.astronautId, metric).tracker.ingest(c.at, value, 'ALL', 'VALID', CHECKIN_SOURCE(c.astronautId))
    }
  }

  /** Rebuild the self report trackers of one astronaut from the check-in list (after a replacement). */
  private rebuildSelfReport(id: string): void {
    for (const m of SELF_REPORT_METRICS) this.channel(id, m).tracker = new MetricTracker(id, m)
    const list = this.checkInsBy.get(id)!
    for (let i = list.length - 1; i >= 0; i--) this.ingestCheckIn(list[i]!)
  }

  private publishCheckIns(): void {
    const all: CheckIn[] = []
    for (const list of this.checkInsBy.values()) all.push(...list)
    all.sort((a, b) => b.at - a.at)
    this.checkIns = all.length > CHECKIN.maxCheckIns ? all.slice(0, CHECKIN.maxCheckIns) : all
    this.versions.checkIns++
    this.dataVersion++
  }

  private selfReportOrigin(id: string): DataOrigin {
    return this.checkInsBy.get(id)?.[0]?.data_origin ?? 'SIMULATED'
  }

  // -------------------------------------------------------------------------
  // Earth link
  // -------------------------------------------------------------------------

  get commProfile(): CommProfile {
    return commProfileById(this.commProfileId)
  }

  get comms(): CommMessage[] {
    return this.commMgr.messages
  }

  private callsign(id: string | null): string {
    if (!id || id === 'CABIN') return 'Cabin'
    return this.crewBase.find((c) => c.id === id)?.callsign ?? id
  }

  private downlink(input: SendInput, origin: DataOrigin, actor: string): CommMessage {
    const p = this.commProfile
    const m = this.commMgr.send(input, this.clockNow, p, origin)
    this.versions.comms++
    this.addAudit(
      'COMM_SENT',
      actor,
      `${m.title} sent to Earth (${p.label}, ${delayPhrase(p)}); arrives ${fmtClock(m.arrivesAt)}.${origin === 'SIMULATED' ? ' Simulated data.' : ''}`,
    )
    return m
  }

  /** Plain text health packet: risk summary and latest key values (simulated data). */
  private packetBody(astronautId: string | null, reason: string, health: Record<string, AstronautHealth> = this.health): string {
    const parts: string[] = [reason]
    if (astronautId && health[astronautId]) {
      const h = health[astronautId]!
      parts.push(`${this.callsign(astronautId)}: attention level ${h.risk.risk_level} (score ${h.risk.risk_score}/100, confidence ${Math.round(h.risk.confidence * 100)}%).`)
      const vals: string[] = []
      for (const m of ['HEART_RATE', 'SPO2', 'HRV_RMSSD', 'RESPIRATORY_RATE', 'SYSTOLIC_BP'] as MetricCode[]) {
        const ms = h.metrics[m]
        vals.push(`${inlineLabel(m)} ${ms && ms.current !== null ? `${ms.current} ${ms.unit}` : 'no data'}`)
      }
      parts.push(`Latest: ${vals.join(', ')}.`)
      if (h.risk.contributing_factors.length) parts.push(`Factors: ${h.risk.contributing_factors.slice(0, 3).map((f) => f.label).join('; ')}.`)
    } else {
      const co2 = this.environment.metrics.CO2
      parts.push(`Cabin: CO₂ ${co2 && co2.current !== null ? `${co2.current} ppm` : 'no data'}, status ${this.environment.status}.`)
    }
    parts.push('Simulated data (data_origin SIMULATED). Decision support, not a diagnosis.')
    return parts.join(' ')
  }

  private replyContext(req: CommMessage): ReplyContext {
    const alert = req.relatedAlertId ? this.alertMgr.alerts.find((a) => a.id === req.relatedAlertId) : undefined
    const rec = req.relatedRecommendationId ? this.recMgr.recs.find((r) => r.id === req.relatedRecommendationId) : undefined
    const risk = req.astronautId ? this.health[req.astronautId]?.risk.risk_level : undefined
    return {
      callsign: req.astronautId ? this.callsign(req.astronautId) : null,
      level: alert?.severity ?? rec?.priority ?? risk ?? null,
      topic: alert?.title ?? rec?.title ?? null,
    }
  }

  private processComms(): void {
    const events = this.commMgr.process(this.clockNow, this.commProfile, (req) => this.replyContext(req))
    if (!events.length) return
    this.versions.comms++
    for (const e of events) {
      const m = e.message
      if (e.kind === 'SENT') {
        this.addAudit('COMM_SENT', 'flight surgeon (simulated)', `Ground reply sent from Earth at ${fmtClock(m.sentAt)} (${m.title}); arrives on board ${fmtClock(m.arrivesAt)}.`)
      } else if (m.direction === 'DOWNLINK') {
        this.addAudit('COMM_RECEIVED', 'ground (simulated)', `Earth received "${m.title}" at ${fmtClock(m.arrivesAt)} (sent ${fmtClock(m.sentAt)}).`)
      } else {
        this.addAudit('COMM_RECEIVED', 'crew', `Ground reply received on board at ${fmtClock(m.arrivesAt)}: ${m.title}.`)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Long-term mission view
  // -------------------------------------------------------------------------

  /** Mean of the REST context values of a continuous metric in [from, to). Null if none. */
  private restMean(id: string, metric: MetricCode, from: number, to: number): number | null {
    let sum = 0
    let n = 0
    this.channel(id, metric).tracker.series.forEachSince(from, (t, v, b) => {
      if (t < to && v !== null && b === REST_CODE) {
        sum += v
        n++
      }
    })
    return n >= 6 ? sum / n : null
  }

  private buildMissionDays(id: string, fromDay: number, toDay: number): MissionDaySummary[] {
    const now = this.simTime
    const ph = this.physio(id)
    const P = ph.profile
    const doses = this.doseAtDayStart.get(id)!
    const dH = dayIndex(this.histStart)
    // Synthesized doses for the days before the minute history (mission day 0 included), scaled
    // so they add up to the dosimeter reading at the start of the history day.
    const synthDays = dH - MISSION_DAY0
    let synthScale = 1
    let cum = 0
    if (fromDay < synthDays) {
      let raw = 0
      for (let d = 0; d < synthDays; d++) raw += synthDay(this.seed, id, P, d).doseRaw
      synthScale = raw > 0 ? (doses.get(dH) ?? 0) / raw : 1
      for (let d = 0; d < fromDay; d++) cum += synthDay(this.seed, id, P, d).doseRaw * synthScale
    }
    const out: MissionDaySummary[] = []
    const frameLevels = new Map<number, Status[]>()
    for (const f of this.frames) {
      const d = dayIndex(f.t)
      const lv = f.levels[id]
      if (!lv) continue
      const arr = frameLevels.get(d)
      if (arr) arr.push(lv)
      else frameLevels.set(d, [lv])
    }
    for (let md = fromDay; md <= toDay; md++) {
      const abs = MISSION_DAY0 + md
      const dayStart = abs * DAY_MS
      const dayEnd = dayStart + DAY_MS
      const syn = synthDay(this.seed, id, P, md)
      const inDaily = dayStart >= this.dailyStart
      let sleepHours: number | null = syn.sleepHours
      let exerciseMinutes: number | null = syn.exerciseMinutes
      let exerciseLoadPct: number | null = syn.exerciseLoadPct
      if (inDaily) {
        const wake = dayStart + SCHEDULE.wakeMin * MIN_MS
        sleepHours = now >= wake ? round(ph.schedule.night(abs - 1, now).durationH, 2) : null
        const ses = ph.schedule.session(abs, now)
        if (now >= ses.end) {
          exerciseMinutes = ses.skipped ? 0 : SCHEDULE.exerciseDurationMin
          exerciseLoadPct = ses.skipped ? null : round(100 * ses.perf, 1)
        } else {
          exerciseMinutes = null
          exerciseLoadPct = null
        }
      }
      let restingHr: number | null = syn.restingHr
      let hrv: number | null = syn.hrv
      if (dayEnd > this.histStart) {
        const from = Math.max(dayStart, this.histStart)
        const to = Math.min(dayEnd, now + 1)
        const hr = this.restMean(id, 'HEART_RATE', from, to)
        const hv = this.restMean(id, 'HRV_RMSSD', from, to)
        restingHr = hr === null ? null : round(hr, 1)
        hrv = hv === null ? null : round(hv, 1)
      }
      let dose: number
      let cumulative: number
      if (abs >= dH) {
        const start = doses.get(abs) ?? this.doses.get(id)!
        const end = doses.get(abs + 1) ?? this.doses.get(id)!
        dose = end - start
        cumulative = end
      } else {
        dose = syn.doseRaw * synthScale
        cum += dose
        cumulative = cum
      }
      const lv = frameLevels.get(abs)
      const riskLevel: Status = lv && lv.length ? worstStatus(lv) : heuristicLevel(P, sleepHours, exerciseLoadPct)
      out.push({
        astronautId: id,
        missionDay: md,
        date: isoDate(dayStart),
        sleepHours,
        exerciseMinutes,
        exercisePlannedMinutes: SCHEDULE.exerciseDurationMin,
        restingHr,
        hrv,
        radiationDoseMgy: round(dose, 3),
        cumulativeDoseMgy: round(cumulative, 3),
        riskLevel,
        data_origin: 'SIMULATED',
        exerciseLoadPct,
        synthesized: !inDaily,
      })
    }
    return out
  }

  /**
   * Mission day 1 .. current mission day per astronaut. Completed days are kept (same object
   * references); the current day (and the previous one at a day change) is rebuilt at most every
   * MISSION_DAYS.refreshEveryMin sim minutes.
   */
  private refreshMissionDays(force: boolean): void {
    const now = this.simTime
    const current = Math.floor((now - MISSION_START) / DAY_MS)
    if (!force && current === this.lastMissionDay && now - this.lastMissionDaysAt < MISSION_DAYS.refreshEveryMin * MIN_MS) return
    this.lastMissionDaysAt = now
    this.lastMissionDay = current
    let changed = false
    const next: Record<string, MissionDaySummary[]> = {}
    for (const id of this.crewIds) {
      const prev = this.missionDays[id]
      if (!prev || prev.length === 0 || force) {
        const built = this.buildMissionDays(id, 1, current)
        next[id] = built
        changed = true
        continue
      }
      const from = Math.max(1, prev.length) // rebuild the last known day (it was the current day)
      const tail = this.buildMissionDays(id, from, current)
      const keep = prev.slice(0, from - 1)
      let diff = false
      for (const s of tail) {
        const old = prev[s.missionDay - 1]
        if (sameDay(old, s)) keep.push(old!)
        else {
          keep.push(s)
          diff = true
        }
      }
      next[id] = diff || keep.length !== prev.length ? keep : prev
      if (next[id] !== prev) changed = true
    }
    if (changed) {
      this.missionDays = next
      this.versions.missionDays++
    }
  }

  get alerts() {
    return this.alertMgr.alerts
  }

  get recommendations() {
    return this.recMgr.recs
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  private addAudit(action: AuditEvent['action'], actor: string, detail: string): void {
    const ev: AuditEvent = { id: `AU-${++this.seqAudit}`, at: this.simTime, actor, action, detail }
    const next = [ev, ...this.audit]
    this.audit = next.length > ALERTS.maxAudit ? next.slice(0, ALERTS.maxAudit) : next
    this.versions.audit++
  }

  acknowledgeAlert(alertId: string, actor = 'crew'): boolean {
    const a = this.alertMgr.acknowledge(alertId, actor, this.simTime)
    if (!a) return false
    this.versions.alerts++
    this.addAudit('ALERT_ACK', actor, `Alert ${a.id} acknowledged (${a.severity}: ${a.title}).`)
    return true
  }

  logIntervention(input: InterventionInput, actor = 'crew'): Intervention {
    const i: Intervention = {
      id: `INT-${++this.seqIntervention}`,
      astronautId: input.astronautId,
      kind: input.kind,
      recommendationId: input.recommendationId ?? null,
      loggedAt: this.simTime,
      actor,
      note: input.note ?? `${INTERVENTION_LABEL[input.kind]} logged`,
    }
    this.scenario.addIntervention(i)
    this.interventions = [i, ...this.interventions]
    this.versions.interventions++

    const done: string[] = []
    if (input.recommendationId) {
      if (this.recMgr.setStatus(input.recommendationId, 'DONE')) done.push(input.recommendationId)
    } else {
      for (const r of this.recMgr.recs) {
        if (r.status !== 'PENDING' || r.interventionKind !== input.kind) continue
        if (r.astronautId === input.astronautId || (input.kind === 'CABIN_VENTILATION' && r.astronautId === 'CABIN')) {
          this.recMgr.setStatus(r.id, 'DONE')
          done.push(r.id)
        }
      }
    }
    if (done.length) this.versions.recommendations++
    const who = input.astronautId === 'CABIN' ? 'Cabin' : (this.crewBase.find((c) => c.id === input.astronautId)?.callsign ?? input.astronautId)
    this.addAudit(
      'INTERVENTION_LOGGED',
      actor,
      `${who}: ${INTERVENTION_LABEL[input.kind]} logged${done.length ? ` (recommendation ${done.join(', ')} marked done)` : ''}. SIMULATION: the simulator applies a hypothetical recovery effect; this is not a clinical outcome.`,
    )
    return i
  }

  // -------------------------------------------------------------------------
  // v2 actions
  // -------------------------------------------------------------------------

  /** Switch the Earth link profile. Messages already in transit keep their arrival time. */
  setCommProfile(id: CommProfileId, actor = 'mission control'): boolean {
    if (id === this.commProfileId || !COMM_PROFILES.some((p) => p.id === id)) return false
    this.commProfileId = id
    const p = this.commProfile
    this.mission = { ...this.mission, commDelaySec: p.oneWayDelaySec }
    this.versions.mission++
    this.addAudit('COMM_PROFILE_CHANGED', actor, `Earth link set to ${p.label} (${delayPhrase(p)}). Messages already in transit keep their arrival time.`)
    return true
  }

  /** Queue a downlink typed or requested in the UI (data_origin MANUAL). Returns the message id. */
  sendToGround(input: SendInput, actor = 'crew'): string {
    const body = input.kind === 'HEALTH_PACKET' && !input.body ? this.packetBody(input.astronautId, 'Health packet requested by the crew.') : input.body
    return this.downlink({ ...input, body }, 'MANUAL', actor).id
  }

  /**
   * Record a check-in typed in the UI (data_origin MANUAL) at the current sim time. It becomes
   * that UTC day's check-in for the astronaut: it replaces the simulated one if that one was
   * already generated, a later manual answer the same day replaces the earlier one, and no
   * simulated check-in is generated for that day afterwards.
   */
  submitCheckIn(input: Omit<CheckIn, 'id' | 'at' | 'data_origin'>, actor = 'crew'): CheckIn | null {
    if (!this.crewIds.includes(input.astronautId)) return null
    const at = this.clockNow
    const c: CheckIn = { ...sanitizeCheckIn(input, at, 'MANUAL'), id: `CHK-${++this.seqCheckIn}` }
    this.manualDays.get(c.astronautId)!.add(dayIndex(at))
    this.recordCheckIn(c, true)
    this.publishCheckIns()
    this.addAudit(
      'CHECKIN_RECORDED',
      actor,
      `${this.callsign(c.astronautId)} daily check-in: mood ${c.mood}/5, fatigue ${c.fatigue}/5, stress ${c.stress}/5, sleep quality ${c.sleepQuality}/5${c.symptoms.length ? `, reported: ${c.symptoms.join(', ')}` : ''}. Self report, not a diagnosis.`,
    )
    return c
  }

  /** Hypothetical with / without trajectories (pure, no state change). Null when not applicable. */
  compareIntervention(input: CompareInput): InterventionComparison | null {
    const metric = resolveMetric(input)
    if (!metric) return null
    const cabin = metric === 'CO2'
    if (!cabin && !this.physioMap.has(input.astronautId)) return null
    const subject = cabin ? 'CABIN' : input.astronautId
    const tr = this.channels.get(subject)?.get(metric)?.tracker
    const ctxBucket = tr?.cfg.bucketed ? 'REST' : 'ALL'
    return projectIntervention(input, {
      now: this.simTime,
      scenario: this.scenario,
      profile: cabin ? null : this.physio(input.astronautId).profile,
      baseline: tr ? tr.readyBaseline(ctxBucket) : null,
    })
  }

  dismissRecommendation(id: string, actor = 'crew'): boolean {
    const r = this.recMgr.setStatus(id, 'DISMISSED')
    if (!r) return false
    this.versions.recommendations++
    this.addAudit('RECOMMENDATION_UPDATED', actor, `Recommendation ${r.id} dismissed (${r.title}).`)
    return true
  }
}
