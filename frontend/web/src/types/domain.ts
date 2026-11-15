/**
 * AHI shared domain contract.
 *
 * This file is the single source of truth shared by the engine (src/engine),
 * the state store (src/state) and every UI feature (src/features, src/components).
 * Change it only additively; never rename or remove fields used by other modules.
 *
 * Canonical model follows PROJECT_MASTER.md section 6.3.
 * Every observation carries data_origin. In this MVP all device data is SIMULATED.
 */

// ---------------------------------------------------------------------------
// Basic enums (string unions; erasableSyntaxOnly forbids TS enums)
// ---------------------------------------------------------------------------

export type DataOrigin = 'REAL_PUBLIC' | 'DERIVED' | 'SIMULATED' | 'MANUAL'

export type QualityStatus = 'VALID' | 'QUESTIONABLE' | 'INVALID' | 'MISSING'

/** Operational attention level (prototype, NOT a medical classification). */
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'

/** UI status for anything colorable. NO_DATA covers DATA_STALE / DEVICE_OFFLINE. */
export type Status = RiskLevel | 'NO_DATA'

export type MissionPhase = 'PRE_FLIGHT' | 'IN_FLIGHT' | 'POST_FLIGHT'

export type ActivityContext = 'SLEEP' | 'REST' | 'WORK' | 'EXERCISE' | 'EVA'

export type MetricCode =
  | 'HEART_RATE'
  | 'HRV_RMSSD'
  | 'SPO2'
  | 'RESPIRATORY_RATE'
  | 'SYSTOLIC_BP'
  | 'DIASTOLIC_BP'
  | 'SKIN_TEMPERATURE'
  | 'ACTIVITY_LEVEL'
  | 'SLEEP_DURATION'
  | 'SLEEP_EFFICIENCY'
  | 'EXERCISE_LOAD'
  | 'REACTION_TIME'
  | 'HYDRATION'
  | 'CO2'
  | 'CABIN_TEMPERATURE'
  | 'RELATIVE_HUMIDITY'
  | 'RADIATION_DOSE_RATE'
  | 'RADIATION_DOSE'
  // Additive (v2): daily crew check-in, self reported on a 1..5 scale
  | 'MOOD'
  | 'PERCEIVED_FATIGUE'
  | 'STRESS'

/**
 * Body regions rendered by the 3D anatomy viewer and used to group metrics.
 * Each region maps to one or more metrics (see METRIC_CATALOG[].region).
 */
export type BodyRegionId =
  | 'brain' // sleep, cognition, reaction time
  | 'heart' // HR, HRV, blood pressure
  | 'lungs' // SpO2, respiratory rate
  | 'kidneys' // hydration
  | 'muscles' // exercise load, activity
  | 'bones' // bone loss context, radiation exposure
  | 'skin' // skin temperature, thermal load

export type DeviceKind =
  | 'BIO_MONITOR' // Astroskin / Bio-Monitor style smart shirt (simulated)
  | 'ACTIGRAPHY' // Actiwatch style wrist device (simulated)
  | 'BP_MONITOR'
  | 'EXERCISE_CEVIS'
  | 'EXERCISE_ARED'
  | 'EXERCISE_T2'
  | 'ENV_SENSOR' // cabin CO2 / temperature / humidity (simulated)
  | 'DOSIMETER' // radiation (simulated)

export type DeviceState = 'ONLINE' | 'DEGRADED' | 'DATA_STALE' | 'OFFLINE'

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface MetricDefinition {
  code: MetricCode
  label: string // short UI label, e.g. "Heart rate"
  shortLabel: string // e.g. "HR"
  unit: string // canonical unit, e.g. "bpm"
  region: BodyRegionId | 'environment'
  decimals: number
  /** Which direction is bad. 'both' means deviation either way matters. */
  badDirection: 'up' | 'down' | 'both'
  /** Plain-language one-liner for non-experts. */
  plainLanguage: string
  /** Typical physiologic display range for charts (not a clinical limit). */
  displayRange: [number, number]
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Astronaut {
  id: string // pseudonymized, e.g. "AST-01"
  callsign: string // Display name used throughout health views and reports.
  portrait?: string
  agency?: string
  role: string // e.g. "Commander"
  roleShort: string // e.g. "CDR"
  age: number
  sex: 'F' | 'M'
  missionDay: number
  /** Accent color used for this crew member in charts/avatars. */
  color: string
}

export interface Mission {
  id: string
  name: string
  vehicle: string // e.g. "ISS (simulated analog)"
  phase: MissionPhase
  startedAt: string // ISO UTC
  /** One-way comm delay in seconds (ISS ~0, Moon ~1.3, Mars 180..1320). */
  commDelaySec: number
}

export interface SourceReference {
  repository: string | null
  dataset_accession: string | null
  file_name: string | null
  record_reference: string | null
}

/** Canonical HealthObservation (PROJECT_MASTER.md 6.3). */
export interface HealthObservation {
  observation_id: string
  subject_id: string // astronaut id or "CABIN" for environment
  mission_id: string
  device_id: string
  metric_code: MetricCode
  value: number | null // null = missing, never replaced by zero
  unit: string
  measured_at: string // ISO UTC (simulated clock)
  received_at: string
  data_origin: DataOrigin
  source_reference: SourceReference
  quality: { status: QualityStatus; confidence: number; is_estimated: boolean }
  context: { mission_phase: MissionPhase; activity: ActivityContext }
  metadata: Record<string, unknown>
}

export interface Device {
  id: string
  kind: DeviceKind
  name: string // e.g. "Bio-Monitor shirt (sim)"
  assignedTo: string | null // astronaut id or null for cabin devices
  state: DeviceState
  batteryPct: number | null
  signalPct: number | null
  lastSeenAt: number // sim epoch ms
  data_origin: DataOrigin
  metrics: MetricCode[]
  /** Additive (engine v1): plain-language device status, e.g. "No data since 08:22 UTC". */
  detail?: string
}

/** Compact time-series point used for charts/history. t = sim epoch ms. */
export interface TimePoint {
  t: number
  v: number | null
}

export interface Baseline {
  metric: MetricCode
  status: 'READY' | 'INSUFFICIENT_DATA'
  n: number
  mean: number
  median: number
  sd: number
  mad: number
  p05: number
  p95: number
  /** Personal "normal band" used in charts and rules. */
  low: number
  high: number
  windowLabel: string // e.g. "Mission days 1 to 5, rest context"
  version: string
}

export interface MetricState {
  metric: MetricCode
  current: number | null
  unit: string
  status: Status
  zScore: number | null // robust z vs personal baseline
  ewma: number | null
  trendPerHour: number | null // slope of recent window
  baseline: Baseline | null
  lastUpdated: number // sim epoch ms
  quality: QualityStatus
  data_origin: DataOrigin
  // Additive fields (engine v1). Optional so older code keeps compiling.
  /** Drift indicator: EWMA of the robust z (signed, half-life 3 sim hours). */
  driftZ?: number | null
  /** Smoothed deviation from the personal median, in % (daily metrics: mean of the current run). */
  deviationPct?: number | null
  /** Hours the current drift has persisted (null when no drift). */
  persistenceHours?: number | null
  /** Activity context of the baseline used for the current value. */
  baselineContext?: 'ALL' | 'SLEEP' | 'REST' | 'WORK' | 'EXERCISE'
  /** Personal baselines per activity context (for drawing context bands). */
  contextBaselines?: Partial<Record<'ALL' | 'SLEEP' | 'REST' | 'WORK' | 'EXERCISE', Baseline>>
  /** Rule that set the status, if any (e.g. "R-HR-01"). */
  ruleId?: string | null
  /** Plain-language explanation of the status, if not normal. */
  explanation?: string | null
}

export interface Anomaly {
  id: string
  astronautId: string
  metric: MetricCode
  detectedAt: number
  method: 'ROBUST_Z' | 'EWMA' | 'PERSISTENCE' | 'COMBINED' | 'DATA_QUALITY'
  severity: RiskLevel
  explanation: string // plain language, non-diagnostic
}

export interface ContributingFactor {
  metric: MetricCode | null
  label: string // e.g. "HRV 28% below personal baseline for 3 days"
  weight: number // 0..1 relative contribution
}

export interface RiskAssessment {
  astronautId: string
  risk_level: RiskLevel
  risk_score: number // 0..100, documented in engine/risk.ts
  contributing_factors: ContributingFactor[]
  triggered_rules: string[] // rule ids
  confidence: number // 0..1, lowered by poor data quality
  model_version: string
  evaluated_at: number
  data_window: string
  limitations: string[]
  /** One plain-language sentence summarizing the state for the crew. */
  headline: string
}

export interface ForecastPoint {
  t: number
  v: number
  lo: number // lower bound of uncertainty interval
  hi: number // upper bound
}

export interface Prediction {
  astronautId: string
  metric: MetricCode
  method: string // e.g. "Holt linear smoothing v1"
  horizonHours: number
  points: ForecastPoint[]
  intervalLabel: string // e.g. "80% interval"
  /** Hours until the central forecast leaves the personal band, null if not projected. */
  hoursToBandExit: number | null
  eligible: boolean // false => show "insufficient data"
  disclaimer: string
}

export interface Recommendation {
  id: string
  astronautId: string
  ruleId: string
  title: string // short imperative, e.g. "Review sleep schedule and light exposure"
  rationale: string // why, in plain language
  priority: RiskLevel
  audience: 'CREW' | 'FLIGHT_SURGEON' | 'MISSION_CONTROL'
  region: BodyRegionId | 'environment' | null
  requiresHumanReview: boolean
  createdAt: number
  status: 'PENDING' | 'DONE' | 'DISMISSED'
  /** If the crew logs this action, the simulator can apply a hypothetical effect. */
  interventionKind: InterventionKind | null
  /** Additive (engine v1): false once the triggering rule has been clear for a while. */
  active?: boolean
  /** Additive (engine v1): recommendation catalog version. */
  catalogVersion?: string
  /**
   * Additive (v2): who can close the loop. ONBOARD = crew can act now (crew medical officer
   * or self care). GROUND_REVIEW = needs the flight surgeon on Earth (subject to comm delay).
   */
  autonomy?: 'ONBOARD' | 'GROUND_REVIEW'
}

export type InterventionKind =
  | 'REST_PROTOCOL'
  | 'SLEEP_EXTENSION'
  | 'HYDRATION'
  | 'EXERCISE_ADJUSTMENT'
  | 'SENSOR_CHECK'
  | 'CABIN_VENTILATION'
  | 'MEDICAL_CONSULT'

export interface Intervention {
  id: string
  astronautId: string
  kind: InterventionKind
  recommendationId: string | null
  loggedAt: number
  actor: string
  note: string
}

export interface Alert {
  id: string
  astronautId: string | null // null = cabin/environment
  severity: RiskLevel
  title: string
  detail: string
  region: BodyRegionId | 'environment' | null
  metric: MetricCode | null
  ruleId: string
  createdAt: number
  acknowledgedAt: number | null
  acknowledgedBy: string | null
  /** Additive (engine v1): set when the rule has been clear for a while (auto-resolved). */
  resolvedAt?: number | null
  /** Additive (v2): set when a HIGH/CRITICAL alert stays unacknowledged past ESCALATION config. */
  escalatedAt?: number | null
  /** Additive (v2): number of escalation steps reached (0 = none). */
  escalationLevel?: number
}

export interface AuditEvent {
  id: string
  at: number
  actor: string
  action:
    | 'ALERT_ACK'
    | 'INTERVENTION_LOGGED'
    | 'SCENARIO_CHANGED'
    | 'RULE_EVALUATED'
    | 'RECOMMENDATION_UPDATED'
    // Additive (v2)
    | 'ALERT_ESCALATED'
    | 'COMM_SENT'
    | 'COMM_RECEIVED'
    | 'COMM_PROFILE_CHANGED'
    | 'CHECKIN_RECORDED'
  detail: string
}

export interface RegionState {
  region: BodyRegionId
  status: Status
  metrics: MetricCode[]
  summary: string // plain language, e.g. "Heart rate trending up, HRV below your normal"
}

export interface AstronautHealth {
  astronautId: string
  activity: ActivityContext
  metrics: Partial<Record<MetricCode, MetricState>>
  regions: Record<BodyRegionId, RegionState>
  risk: RiskAssessment
  predictions: Partial<Record<MetricCode, Prediction>>
}

export interface EnvironmentState {
  metrics: Partial<Record<MetricCode, MetricState>>
  status: Status
  /** Additive (engine v1): cabin forecasts (e.g. CO2), astronautId "CABIN". */
  predictions?: Partial<Record<MetricCode, Prediction>>
  /** Additive (engine v1): one plain sentence about the cabin. */
  headline?: string
}

// ---------------------------------------------------------------------------
// Scenarios (PROJECT_MASTER.md section 13)
// ---------------------------------------------------------------------------

export type ScenarioId =
  | 'NOMINAL'
  | 'PROGRESSIVE_FATIGUE'
  | 'ENVIRONMENTAL_CO2'
  | 'PERFORMANCE_DECLINE'
  | 'SENSOR_FAILURE'
  | 'ACUTE_CARDIO' // sudden tachycardia + SpO2 drop for alert demo

export interface ScenarioDefinition {
  id: ScenarioId
  name: string
  description: string
  /** Which astronaut is affected (cabin scenarios affect everyone). */
  targetAstronautId: string | null
}

export interface SimulationClock {
  scenarioId: ScenarioId
  running: boolean
  /** Simulated seconds per real second (e.g. 1 = real time, 21600 = 6 h/s). */
  speed: number
  simNow: number // sim epoch ms
  startedAt: number // sim epoch ms at scenario start
}

// ---------------------------------------------------------------------------
// Store contract (implemented in src/state/store.ts with zustand)
// ---------------------------------------------------------------------------

export interface AppState extends AppStateV2 {
  /** Unique scenario-run identity for isolated case follow-up notes. */
  simulationRunId: string
  mission: Mission
  crew: Astronaut[]
  devices: Device[]
  scenarios: ScenarioDefinition[]
  clock: SimulationClock

  /** Latest computed health per astronaut id. */
  health: Record<string, AstronautHealth>
  environment: EnvironmentState
  /** Rolling history per astronaut id (or "CABIN") per metric. */
  history: Record<string, Partial<Record<MetricCode, TimePoint[]>>>

  anomalies: Anomaly[]
  alerts: Alert[]
  recommendations: Recommendation[]
  interventions: Intervention[]
  audit: AuditEvent[]

  // UI selection state
  selectedAstronautId: string
  selectedRegion: BodyRegionId | null
  selectedMetric: MetricCode | null
  /**
   * Additive (v3, anatomical atlas): id of the anatomical structure selected in the 3D viewer
   * (see src/features/anatomy/atlas). null when only a body region or nothing is selected.
   */
  selectedStructureId: string | null

  // actions
  selectAstronaut: (id: string) => void
  selectRegion: (region: BodyRegionId | null) => void
  selectMetric: (metric: MetricCode | null) => void
  /**
   * Additive (v3): select an anatomical structure and, atomically, the body region it maps to
   * (null when the structure has no monitored region). selectRegion() clears the structure.
   */
  selectStructure: (structureId: string | null, region?: BodyRegionId | null) => void
  setScenario: (id: ScenarioId) => void
  play: () => void
  pause: () => void
  setSpeed: (speed: number) => void
  reset: () => void
  acknowledgeAlert: (alertId: string, actor?: string) => void
  logIntervention: (input: { astronautId: string; kind: InterventionKind; recommendationId?: string; note?: string }) => void
  dismissRecommendation: (id: string) => void
  /** Advance simulation by dtRealMs (called by the ticker). */
  /** Advance the simulation synchronously by simMs and publish (used by the guided demo). */
  fastForward: (simMs: number) => void
  tick: (dtRealMs: number) => void
}

// ---------------------------------------------------------------------------
// v2 additions (UX + functional package). All additive.
// ---------------------------------------------------------------------------

/** Communication profile with Earth (hazard: Distance from Earth). */
export type CommProfileId = 'ISS' | 'MOON' | 'MARS_NEAR' | 'MARS_FAR'

export interface CommProfile {
  id: CommProfileId
  label: string // e.g. "Mars (farthest)"
  oneWayDelaySec: number // ISS ~0.5, Moon ~1.3, Mars 240..1320
  description: string
}

/** A message between the vehicle and Earth. Delivery is delayed by the one-way delay. */
export interface CommMessage {
  id: string
  direction: 'DOWNLINK' | 'UPLINK' // DOWNLINK = vehicle to Earth, UPLINK = Earth to vehicle
  astronautId: string | null
  kind: 'HEALTH_PACKET' | 'CONSULT_REQUEST' | 'GROUND_REPLY' | 'HANDOVER_REPORT'
  title: string
  body: string
  sentAt: number // sim epoch ms
  arrivesAt: number // sim epoch ms
  /** IN_TRANSIT until arrivesAt, then DELIVERED. */
  status: 'IN_TRANSIT' | 'DELIVERED'
  relatedRecommendationId: string | null
  relatedAlertId: string | null
  data_origin: DataOrigin // SIMULATED for ground replies
}

/** Daily subjective check-in (NASA Standard Measures style questionnaire, simplified). */
export interface CheckIn {
  id: string
  astronautId: string
  at: number // sim epoch ms
  mood: number // 1 (very low) .. 5 (very good)
  fatigue: number // 1 (rested) .. 5 (exhausted)
  stress: number // 1 (calm) .. 5 (very stressed)
  sleepQuality: number // 1 (very poor) .. 5 (very good)
  symptoms: string[] // free tags, e.g. "headache", "congestion", "back pain"
  note: string
  /** MANUAL when typed by the user in the UI, SIMULATED for auto-generated crew answers. */
  data_origin: DataOrigin
}

/** One mission day summary for the long-term view (day 1 .. current mission day). */
export interface MissionDaySummary {
  astronautId: string
  missionDay: number
  date: string // ISO date (UTC)
  sleepHours: number | null
  exerciseMinutes: number | null
  exercisePlannedMinutes: number
  restingHr: number | null
  hrv: number | null
  radiationDoseMgy: number // dose received that day
  cumulativeDoseMgy: number
  riskLevel: Status
  data_origin: DataOrigin
  /** Additive (v2): mean exercise output that day, % of the personal usual (null = no session). */
  exerciseLoadPct?: number | null
  /** Additive (v2): true when the summary is synthesized (older days), false when derived from the simulated history. */
  synthesized?: boolean
}

/** Long-term mission plan and budgets. Demo configuration, not official limits. */
export interface MissionPlan {
  plannedDurationDays: number
  radiationBudgetMgy: number // demo budget for the whole mission
  exercisePlanMinutesPerDay: number
  sleepTargetHours: number
  note: string
}

/** Coarse status snapshot used by the timeline strip. */
export interface StatusFrame {
  t: number // sim epoch ms
  levels: Record<string, Status> // astronaut id (and "CABIN") -> status
}

/** Hypothetical trajectory comparison (US-022). Never a claim of clinical efficacy. */
export interface InterventionComparison {
  astronautId: string
  metric: MetricCode
  kind: InterventionKind
  horizonHours: number
  without: TimePoint[]
  with: TimePoint[]
  band: { low: number; high: number } | null
  assumptions: string[]
  disclaimer: string
}

/** Engine evaluation summary (generated by npm run evaluate into src/engine/evaluation.json). */
export interface EngineEvaluation {
  generatedAt: string
  engineVersion: string
  nominal: {
    simulatedHours: number
    crewHours: number
    falseAlertsPerCrewDay: number
    maxLevel: Status
    /** Additive (v2): alerts at MODERATE or above per crew day (any rule). */
    moderateAlertsPerCrewDay?: number
    /** Additive (v2): seeds evaluated (each one simulatedHours long). */
    seeds?: number[]
    /** Additive (v2): share of 15 min frames per level across the nominal runs. */
    levelShare?: Partial<Record<Status, number>>
  }
  scenarios: Array<{
    scenarioId: ScenarioId
    target: string | null
    timeToFirstAlertMin: number | null
    timeToHighMin: number | null
    timeToCriticalMin: number | null
    peakLevel: Status
    /** Additive (v2): rule of the first alert and the simulated duration of the run. */
    firstAlertRule?: string | null
    simulatedHours?: number
    peakScore?: number
  }>
  notes: string[]
}

/** A real public dataset record (provenance, PROJECT_MASTER 6.5). */
export interface DatasetRecord {
  id: string
  source_name: string // e.g. "NASA OSDR"
  source_url: string
  dataset_accession: string | null
  dataset_version: string | null
  title: string
  downloaded_at: string // ISO
  license: string | null
  access_classification: string
  file_name: string | null
  sha256: string | null
  parser_version: string | null
  study_population: string | null // only if verified from the source metadata
  mission: string | null
  study_design: string | null
  collection_phase: string | null
  notes: string
  data_origin: 'REAL_PUBLIC' | 'DERIVED'
}

/**
 * v2 store contract additions (AppState extends this).
 * Implemented in src/state/store.ts by the engine.
 */
export interface AppStateV2 {
  commProfiles: CommProfile[]
  commProfileId: CommProfileId
  comms: CommMessage[] // newest first
  checkIns: CheckIn[] // newest first
  missionPlan: MissionPlan
  missionDays: Record<string, MissionDaySummary[]> // astronaut id -> day 1..N ascending
  statusTimeline: StatusFrame[] // ascending by t
  setCommProfile: (id: CommProfileId) => void
  /** Queue a downlink message (e.g. consult request for a recommendation). Returns the message id. */
  sendToGround: (input: {
    astronautId: string | null
    kind: CommMessage['kind']
    title: string
    body: string
    recommendationId?: string
    alertId?: string
  }) => string
  submitCheckIn: (input: Omit<CheckIn, 'id' | 'at' | 'data_origin'>) => void
  /** Pure projection: two trajectories for the next hours, with and without the intervention. */
  compareIntervention: (input: { astronautId: string; kind: InterventionKind; metric?: MetricCode; horizonHours?: number }) => InterventionComparison | null
}
