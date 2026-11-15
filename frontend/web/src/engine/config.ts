/**
 * AHI engine configuration.
 *
 * DEMO CONFIGURATION, NOT OFFICIAL LIMITS.
 * Every fixed number in this file is a demo value chosen so the prototype behaves
 * sensibly with simulated data. None of them is an official NASA limit, a flight
 * rule or a clinical threshold. Personal baseline bands drive status first; the few
 * fixed thresholds below are a safety net for the demo and must be reviewed by a
 * flight surgeon before any real use.
 */
import type { CommProfileId, InterventionKind, MetricCode, MissionPlan, RiskLevel } from '../types/domain'

export const ENGINE_VERSION = 'ahi-engine 2.0.0'
export const RISK_MODEL_VERSION = 'AHI transparent rules v2.0 (demo)'
export const BASELINE_VERSION = 'robust-baseline v1 (median/MAD)'
export const FORECAST_METHOD = 'Damped Holt linear smoothing v1'
export const REC_CATALOG_VERSION = 'rec-catalog v2.0'

/** Simulation clock and history. */
export const SIM = {
  seed: 20261114,
  /** Sim time at which every scenario starts (morning, after wake-up). */
  startIso: '2026-11-14T08:00:00Z',
  /** Minute level history pre-generated before the scenario starts. */
  historyDays: 5,
  /** Daily metrics (sleep, exercise sessions, reaction tests) get a longer backfill. */
  dailyHistoryDays: 14,
  /** Points newer than this keep 1 minute resolution; older ones keep 5 minutes. */
  fineWindowMin: 120,
  coarseResolutionMin: 5,
  /** When an advance needs more than this many minutes, the sim steps 5 minutes at a time. */
  coarseStepThresholdMin: 60,
  /** Safety cap per advance call. */
  maxStepsPerAdvance: 3000,
  /** Max event points kept per daily metric. */
  maxEventPoints: 40,
} as const

/** Sim seconds per real second. */
export const SPEED_PRESETS = [1, 60, 3600, 21600] as const
export const DEFAULT_SPEED = 60

/** Personal baseline settings. */
export const BASELINE = {
  /** Normal band = median +/- bandK robust SD (robust SD = 1.4826 x MAD, floored per metric). */
  bandK: 2,
  minN: { continuous: 72, exercise: 36, event: 5 },
  /** Reservoir size per context bucket: 5 days at 5 minute resolution. */
  reservoirSize: 5 * 288,
  eventReservoirSize: 28,
  /** Recompute a bucket baseline after this many new accepted samples (2 sim hours). */
  recomputeEvery: 24,
  /** Same, while pre-generating history (keeps startup fast). */
  recomputeEveryPregen: 144,
  /** Samples further than this robust z are not added to the baseline (outlier gate). */
  gateZ: 3.5,
  gateEventZ: 2.5,
  /** While the drift indicator is above this, samples are not added (keeps a slow decline out of "normal"). */
  gateDrift: 1.0,
} as const

/** Anomaly detection settings. */
export const ANOMALY = {
  /** Robust z of the 3 sample median, in the bad direction. */
  acuteZ: { MODERATE: 4, HIGH: 5.5, CRITICAL: 7 },
  drift: {
    halfLifeMin: 180,
    moderate: 1.0,
    moderateMinHours: 3,
    high: 2.0,
    highMinHours: 12,
    clear: 0.8,
    zClamp: 6,
  },
  /** Daily metrics: consecutive values outside the band. */
  event: { moderateRun: 2, highRun: 3, singleValueZ: 3 },
  ewmaDisplayHalfLifeMin: 10,
  recentWindow: 3,
  questionableWindow: 15,
} as const

/**
 * Risk score: noisy-OR of rule weights (see risk.ts).
 * score = 100 x (1 - product(1 - w_i)), one weight per triggered rule.
 */
export const RISK = {
  weights: { LOW: 0, MODERATE: 0.2, HIGH: 0.45, CRITICAL: 0.85 } satisfies Record<RiskLevel, number>,
  bands: { MODERATE: 20, HIGH: 45, CRITICAL: 80 },
  /** Without an acute CRITICAL rule the level is capped at HIGH (slow patterns call for review, not emergency). */
  slowPatternCap: 'HIGH' as RiskLevel,
  /**
   * Self reported rules (R-PSY-*) share ONE weight in the score (the largest of them), so the
   * check-in alone can reach MODERATE at most. A reported symptom counts with this small weight.
   */
  selfReportGroup: 'SELF_REPORT',
  symptomWeight: 0.05,
  /** R-FAT-01 is corroborated by self report when fatigue was at least this high (1..5) ... */
  selfReportHighFatigue: 4,
  /** ... in at least this many consecutive recent check-ins. */
  selfReportCorroborateRun: 2,
} as const

export const ALERTS = {
  /** An alert auto-resolves after its rule has been clear for this long. */
  resolveAfterMin: 10,
  maxAlerts: 150,
  maxAnomalies: 200,
  maxAudit: 300,
  maxRecommendations: 120,
  recommendationEpisodeGapMin: 30,
} as const

export const FORECAST = {
  binMin: 30,
  windowHours: 24,
  minBins: 12,
  binsFor24h: 40,
  minEvents: 5,
  eventsFor72h: 10,
  alpha: 0.4,
  beta: 0.15,
  phi: 0.9,
  z80: 1.2816,
  /** Bins checked for a recent excursion on the opposite side of the band (recovery, not drift). */
  recoveryLookbackBins: 6,
  recomputeEveryMin: 10,
} as const

export type ThresholdOp = 'above' | 'below'

export interface FixedThreshold {
  ruleId: string
  metric: MetricCode
  op: ThresholdOp
  value: number
  level: RiskLevel
  /** Only applies outside exercise and recovery. */
  restOnly?: boolean
  /** Short name used in explanations, e.g. "demo safety floor". */
  name: string
}

/**
 * Fixed thresholds. DEMO CONFIGURATION, NOT OFFICIAL LIMITS.
 * Ordered from most to least severe per metric.
 */
export const FIXED_THRESHOLDS: FixedThreshold[] = [
  { ruleId: 'R-SPO2-02', metric: 'SPO2', op: 'below', value: 90, level: 'CRITICAL', name: 'demo safety floor' },
  { ruleId: 'R-SPO2-02', metric: 'SPO2', op: 'below', value: 92, level: 'HIGH', name: 'demo watch floor' },
  { ruleId: 'R-HR-03', metric: 'HEART_RATE', op: 'above', value: 135, level: 'CRITICAL', restOnly: true, name: 'demo resting ceiling' },
  { ruleId: 'R-HR-03', metric: 'HEART_RATE', op: 'above', value: 120, level: 'HIGH', restOnly: true, name: 'demo resting watch level' },
  { ruleId: 'R-ENV-CO2-01', metric: 'CO2', op: 'above', value: 7500, level: 'CRITICAL', name: 'demo critical level' },
  { ruleId: 'R-ENV-CO2-01', metric: 'CO2', op: 'above', value: 5300, level: 'HIGH', name: 'demo warning level' },
  { ruleId: 'R-ENV-CO2-01', metric: 'CO2', op: 'above', value: 4000, level: 'MODERATE', name: 'demo watch level' },
  { ruleId: 'R-ENV-TEMP-01', metric: 'CABIN_TEMPERATURE', op: 'above', value: 27, level: 'MODERATE', name: 'demo comfort band' },
  { ruleId: 'R-ENV-TEMP-01', metric: 'CABIN_TEMPERATURE', op: 'below', value: 18, level: 'MODERATE', name: 'demo comfort band' },
  { ruleId: 'R-ENV-RH-01', metric: 'RELATIVE_HUMIDITY', op: 'above', value: 70, level: 'MODERATE', name: 'demo comfort band' },
  { ruleId: 'R-ENV-RH-01', metric: 'RELATIVE_HUMIDITY', op: 'below', value: 25, level: 'MODERATE', name: 'demo comfort band' },
  { ruleId: 'R-ENV-RAD-01', metric: 'RADIATION_DOSE_RATE', op: 'above', value: 100, level: 'HIGH', name: 'demo particle event level' },
  { ruleId: 'R-RAD-02', metric: 'RADIATION_DOSE', op: 'above', value: 50, level: 'MODERATE', name: 'demo mission dose watch level' },
]

export interface MetricRuleConfig {
  kind: 'continuous' | 'event'
  /** Context aware baseline (sleep / rest / work / exercise). */
  bucketed: boolean
  /** Floor for the robust SD so a very stable signal does not make tiny changes look huge. */
  minScale: number
  acute: boolean
  drift: boolean
  /** Minutes without a valid value before the metric becomes NO_DATA. */
  staleMin: number
  /** Expected cadence in minutes (continuous metrics), used to mark gaps. */
  cadenceMin: number
  acuteRule: string
  driftRule: string
  /** Event metrics: unit word for persistence labels. */
  eventUnit?: [string, string]
  physicalMin?: number
  physicalMax?: number
  /** Highest level this metric can reach on its own (self report is capped at MODERATE). */
  maxLevel?: RiskLevel
}

const C = (o: Partial<MetricRuleConfig> & Pick<MetricRuleConfig, 'acuteRule' | 'minScale'>): MetricRuleConfig => ({
  kind: 'continuous',
  bucketed: true,
  acute: true,
  drift: true,
  staleMin: 10,
  cadenceMin: 1,
  driftRule: o.acuteRule,
  ...o,
})

export const METRIC_RULES: Record<MetricCode, MetricRuleConfig> = {
  HEART_RATE: C({ acuteRule: 'R-HR-01', driftRule: 'R-HR-02', minScale: 3.5, physicalMin: 25, physicalMax: 220 }),
  HRV_RMSSD: C({ acuteRule: 'R-HRV-01', acute: false, minScale: 4, physicalMin: 3 }),
  SPO2: C({ acuteRule: 'R-SPO2-01', minScale: 0.7, physicalMin: 60, physicalMax: 100 }),
  RESPIRATORY_RATE: C({ acuteRule: 'R-RR-01', minScale: 1, physicalMin: 4 }),
  SYSTOLIC_BP: C({ acuteRule: 'R-BP-01', minScale: 4, staleMin: 20, cadenceMin: 5 }),
  DIASTOLIC_BP: C({ acuteRule: 'R-BP-01', minScale: 3, staleMin: 20, cadenceMin: 5 }),
  SKIN_TEMPERATURE: C({ acuteRule: 'R-TEMP-01', minScale: 0.25 }),
  ACTIVITY_LEVEL: C({ acuteRule: 'R-ACT-01', acute: false, minScale: 6, physicalMin: 0, physicalMax: 100 }),
  HYDRATION: C({ acuteRule: 'R-HYD-01', acute: false, bucketed: false, minScale: 4, staleMin: 90, cadenceMin: 30, physicalMin: 0, physicalMax: 100 }),
  SLEEP_DURATION: { kind: 'event', bucketed: false, minScale: 0.35, acute: false, drift: false, staleMin: 36 * 60, cadenceMin: 0, acuteRule: 'R-SLEEP-01', driftRule: 'R-SLEEP-01', eventUnit: ['night', 'nights'], physicalMin: 0 },
  SLEEP_EFFICIENCY: { kind: 'event', bucketed: false, minScale: 2.5, acute: false, drift: false, staleMin: 36 * 60, cadenceMin: 0, acuteRule: 'R-SLEEP-02', driftRule: 'R-SLEEP-02', eventUnit: ['night', 'nights'], physicalMin: 0, physicalMax: 100 },
  EXERCISE_LOAD: { kind: 'event', bucketed: false, minScale: 3.5, acute: false, drift: false, staleMin: 32 * 60, cadenceMin: 0, acuteRule: 'R-EX-01', driftRule: 'R-EX-01', eventUnit: ['session', 'sessions'], physicalMin: 0 },
  REACTION_TIME: { kind: 'event', bucketed: false, minScale: 12, acute: false, drift: false, staleMin: 18 * 60, cadenceMin: 0, acuteRule: 'R-RT-01', driftRule: 'R-RT-01', eventUnit: ['test', 'tests'], physicalMin: 100 },
  // v2 self reported check-in metrics (1..5 scale, one answer per sim day), compared with the
  // person's own recent answers. Integer answers make the MAD often 0, so the scale floor (0.75)
  // sets the band: median +/- 1.5. One answer 2 points away is outside the band; 2 check-ins in a
  // row outside the band (or 1 answer 3 points away) is MODERATE. Self report alone is capped at
  // MODERATE (maxLevel): it corroborates objective signals, it never escalates on its own.
  MOOD: { kind: 'event', bucketed: false, minScale: 0.75, acute: false, drift: false, staleMin: 50 * 60, cadenceMin: 0, acuteRule: 'R-PSY-01', driftRule: 'R-PSY-01', eventUnit: ['check-in', 'check-ins'], physicalMin: 1, physicalMax: 5, maxLevel: 'MODERATE' },
  PERCEIVED_FATIGUE: { kind: 'event', bucketed: false, minScale: 0.75, acute: false, drift: false, staleMin: 50 * 60, cadenceMin: 0, acuteRule: 'R-PSY-02', driftRule: 'R-PSY-02', eventUnit: ['check-in', 'check-ins'], physicalMin: 1, physicalMax: 5, maxLevel: 'MODERATE' },
  STRESS: { kind: 'event', bucketed: false, minScale: 0.75, acute: false, drift: false, staleMin: 50 * 60, cadenceMin: 0, acuteRule: 'R-PSY-03', driftRule: 'R-PSY-03', eventUnit: ['check-in', 'check-ins'], physicalMin: 1, physicalMax: 5, maxLevel: 'MODERATE' },
  // Cabin metrics: fixed demo thresholds only (a module has no "personal" normal to drift from).
  CO2: C({ acuteRule: 'R-ENV-CO2-01', acute: false, drift: false, bucketed: false, minScale: 150 }),
  CABIN_TEMPERATURE: C({ acuteRule: 'R-ENV-TEMP-01', acute: false, drift: false, bucketed: false, minScale: 0.4 }),
  RELATIVE_HUMIDITY: C({ acuteRule: 'R-ENV-RH-01', acute: false, drift: false, bucketed: false, minScale: 3 }),
  RADIATION_DOSE_RATE: C({ acuteRule: 'R-ENV-RAD-01', acute: false, drift: false, bucketed: false, minScale: 3 }),
  RADIATION_DOSE: C({ acuteRule: 'R-RAD-02', acute: false, drift: false, bucketed: false, minScale: 1, staleMin: 45, cadenceMin: 15 }),
}

/** Metrics evaluated per astronaut (in display order). */
export const ASTRONAUT_METRICS: MetricCode[] = [
  'HEART_RATE',
  'HRV_RMSSD',
  'SPO2',
  'RESPIRATORY_RATE',
  'SYSTOLIC_BP',
  'DIASTOLIC_BP',
  'SKIN_TEMPERATURE',
  'ACTIVITY_LEVEL',
  'SLEEP_DURATION',
  'SLEEP_EFFICIENCY',
  'EXERCISE_LOAD',
  'REACTION_TIME',
  'HYDRATION',
  'RADIATION_DOSE',
  'MOOD',
  'PERCEIVED_FATIGUE',
  'STRESS',
]

/** Check-in metrics (self report, data_origin of the check-in). */
export const SELF_REPORT_METRICS: MetricCode[] = ['MOOD', 'PERCEIVED_FATIGUE', 'STRESS']

/** Metrics evaluated for the cabin ("CABIN" subject). */
export const CABIN_METRICS: MetricCode[] = ['CO2', 'CABIN_TEMPERATURE', 'RELATIVE_HUMIDITY', 'RADIATION_DOSE_RATE']

/** Metrics that get a forecast. */
export const FORECAST_METRICS: MetricCode[] = ['HEART_RATE', 'HRV_RMSSD', 'SPO2', 'SLEEP_DURATION', 'EXERCISE_LOAD']
export const CABIN_FORECAST_METRICS: MetricCode[] = ['CO2']

// ---------------------------------------------------------------------------
// v2: Earth communication, escalation, check-ins, mission plan, timeline
// All values below are DEMO CONFIGURATION, NOT OFFICIAL LIMITS or procedures.
// ---------------------------------------------------------------------------

export const COMMS = {
  defaultProfile: 'ISS' as CommProfileId,
  /** Simulated flight surgeon review time on Earth before a reply is sent (sim minutes, seeded per message). */
  reviewMinMin: 4,
  reviewMaxMin: 8,
  /** Kinds of delivered downlinks that get a simulated flight surgeon reply. */
  replyTo: ['CONSULT_REQUEST', 'HEALTH_PACKET'] as const,
  /** Re-check interval suggested in the simulated reply, by alert or recommendation level (sim minutes). */
  recheckMin: { LOW: 120, MODERATE: 60, HIGH: 30, CRITICAL: 10 } satisfies Record<RiskLevel, number>,
  /** Alerts at or above this level downlink a HEALTH_PACKET automatically (once per alert). */
  autoPacketLevel: 'HIGH' as RiskLevel,
  maxMessages: 120,
  /** Profiles where the crew must act before Earth can answer (onboard first step recommendations). */
  deepSpaceProfiles: ['MARS_NEAR', 'MARS_FAR'] as CommProfileId[],
} as const

/**
 * Escalation of unacknowledged alerts: [minutes to level 1, minutes to level 2] since the alert
 * was raised. Stops as soon as the alert is acknowledged or resolved. Demo configuration.
 */
export const ESCALATION: Partial<Record<RiskLevel, number[]>> = {
  CRITICAL: [5, 15],
  HIGH: [30, 90],
}

export const CHECKIN = {
  /** Simulated crew answer the daily check-in at about this time (minutes after 00:00 UTC, after wake). */
  minuteOfDay: 7 * 60,
  /** Personal offset spread around that time (+/- minutes, seeded per astronaut). */
  jitterMin: 20,
  /** Check-ins are generated for this many days before the scenario start (baselines need 5). */
  historyDays: 14,
  maxCheckIns: 4 * 30,
  /** A check-in counts as "today" for symptom factors for this many hours. */
  symptomWindowHours: 24,
} as const

/** Long-term mission plan for the mission view. Demo configuration, not official limits. */
export const MISSION_PLAN: MissionPlan = {
  plannedDurationDays: 180,
  radiationBudgetMgy: 100,
  // The simulated schedule has one 60 min exercise block per day (CEVIS, ARED or T2 rotating).
  exercisePlanMinutesPerDay: 60,
  sleepTargetHours: 8,
  note: 'Demo configuration, not official limits.',
}

/** Long-term synthesis of older mission days (simulated, seeded). */
export const MISSION_DAYS = {
  /** Mean absorbed dose per day (mGy), ISS-like order of magnitude; scaled by the personal shield factor. */
  doseMgyPerDay: 0.42,
  /** Share of days with a higher dose (e.g. more South Atlantic Anomaly passes or a small particle event). */
  highDoseDayShare: 0.05,
  missedSessionShare: 0.06,
  /** The current day summary is refreshed at most this often (sim minutes). */
  refreshEveryMin: 15,
} as const

export const TIMELINE = {
  /** One status frame every this many sim minutes. */
  frameEveryMin: 15,
  /** Frames computed during startup pre-generation (sim hours before the scenario start). */
  pregenHours: 24,
} as const

/** compareIntervention defaults (hypothetical projections, not clinical efficacy). */
export const COMPARE = {
  defaultMetric: {
    SLEEP_EXTENSION: 'HRV_RMSSD',
    REST_PROTOCOL: 'HEART_RATE',
    MEDICAL_CONSULT: 'HEART_RATE',
    CABIN_VENTILATION: 'CO2',
    EXERCISE_ADJUSTMENT: 'EXERCISE_LOAD',
    HYDRATION: 'HYDRATION',
    SENSOR_CHECK: null,
  } satisfies Record<InterventionKind, MetricCode | null>,
  /** Default horizon (hours) per metric; an active acute pattern uses acuteHorizonHours. */
  defaultHorizonHours: { HRV_RMSSD: 48, HEART_RATE: 24, CO2: 8, EXERCISE_LOAD: 120, HYDRATION: 12, SPO2: 24, RESPIRATORY_RATE: 24 } as Partial<Record<MetricCode, number>>,
  acuteHorizonHours: 2,
  maxHorizonHours: 168,
  disclaimer: 'Simulation for discussion only. Not evidence of clinical efficacy.',
} as const
