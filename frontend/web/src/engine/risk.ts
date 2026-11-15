/**
 * Transparent risk engine (operational attention level, NOT a medical classification).
 *
 * 1. Each metric is assessed against the personal baseline (anomaly.ts) and the demo
 *    thresholds (config.ts). Every hit carries a rule id, e.g. R-HR-01.
 * 2. Combined rules escalate patterns that matter together:
 *      R-FAT-01   shorter sleep + lower HRV + higher resting HR (2 of 3: MODERATE, 3 of 3: HIGH)
 *      R-CARD-01  heart rate and SpO2 both at HIGH or worse at the same time (CRITICAL)
 *      R-ENV-CO2-02  cabin CO2 elevated while breathing rate or reaction time shift (MODERATE,
 *                    co-occurrence only, not proof of cause)
 *      R-DQ-01 / R-DQ-02  device not sending data / questionable signal (MODERATE)
 *      Self report (v2): R-PSY-01/02/03 (mood, fatigue, stress vs the person's own answers,
 *        capped at MODERATE) and R-PSY-04 (reported symptoms, informational). All self report
 *        rules share ONE weight in the score, so a check-in alone reaches MODERATE at most.
 *        Self reported high fatigue corroborates R-FAT-01 (extra factor, no extra level).
 * 3. Risk score (0..100), a noisy-OR of one weight per triggered rule:
 *      score = 100 x (1 - product over rules of (1 - w(level)))
 *      w(MODERATE) = 0.20, w(HIGH) = 0.45, w(CRITICAL) = 0.85, data quality capped at 0.20
 *    Bands: < 20 LOW, 20 to 44 MODERATE, 45 to 79 HIGH, >= 80 CRITICAL.
 *    One MODERATE rule = 20 (MODERATE); three MODERATE rules = 49 (HIGH): combined
 *    deviations escalate by construction. CRITICAL requires at least one CRITICAL
 *    (acute) rule; slow multi-day patterns are capped at HIGH (score <= 79) because
 *    they call for review, not emergency response.
 * 4. Confidence starts at 0.95 and is lowered by missing or questionable key data and
 *    by baselines that are not ready.
 */
import type { BodyRegionId, ContributingFactor, MetricCode, MetricState, RegionState, RiskAssessment, RiskLevel, Status } from '../types/domain'
import { worstStatus } from '../lib/status'
import { METRIC_CATALOG, REGION_LABELS } from './catalog'
import { RISK, RISK_MODEL_VERSION, SELF_REPORT_METRICS, SIM } from './config'
import { levelRank, type AnomalyMethod, type MetricAssessment } from './anomaly'
import { badZ } from './stats'

export type HitKind = 'PHYSIO' | 'DATA_QUALITY' | 'COMBINED' | 'ENVIRONMENT' | 'SELF_REPORT'

export interface RuleHit {
  /** Astronaut id, or null for the cabin. */
  subjectId: string | null
  ruleId: string
  level: RiskLevel
  metric: MetricCode | null
  region: BodyRegionId | 'environment' | null
  method: AnomalyMethod
  kind: HitKind
  /** Factor label with numbers. */
  label: string
  /** Crew phrase (no trailing period). */
  phrase: string
  /** Short alert title. */
  title: string
  /** Rule ids whose alerts/recommendations are grouped under this one. */
  suppresses?: string[]
  /** Rules with the same group share one weight in the score (the largest). Default: the rule id. */
  scoreGroup?: string
  /** Explicit weight (overrides the level weight), e.g. a reported symptom. */
  weight?: number
}

/** Summary of the recent daily check-ins of one astronaut (engine.ts builds it). */
export interface SelfReportSummary {
  /** Consecutive most recent check-ins (last 3 days) with fatigue >= RISK.selfReportHighFatigue. */
  highFatigueRun: number
  /** Symptom tags reported in the last CHECKIN.symptomWindowHours. */
  symptoms: string[]
}

export const RULE_TITLES: Record<string, string> = {
  'R-HR-01': 'Heart rate far from personal normal',
  'R-HR-02': 'Resting heart rate drifting from personal normal',
  'R-HR-03': 'Heart rate above demo resting ceiling',
  'R-HRV-01': 'HRV below personal baseline',
  'R-SPO2-01': 'Blood oxygen below personal normal',
  'R-SPO2-02': 'Blood oxygen below demo floor',
  'R-RR-01': 'Breathing rate outside personal range',
  'R-BP-01': 'Blood pressure outside personal range',
  'R-TEMP-01': 'Skin temperature outside personal range',
  'R-ACT-01': 'Activity below personal normal',
  'R-HYD-01': 'Hydration index below personal normal',
  'R-SLEEP-01': 'Short sleep on consecutive nights',
  'R-SLEEP-02': 'Sleep efficiency below personal normal',
  'R-EX-01': 'Exercise performance declining',
  'R-RT-01': 'Reaction time slower than personal normal',
  'R-RAD-02': 'Accumulated dose above demo watch level',
  'R-ENV-CO2-01': 'Cabin CO₂ elevated',
  'R-ENV-CO2-02': 'Crew response while CO₂ is elevated',
  'R-ENV-TEMP-01': 'Cabin temperature outside demo comfort band',
  'R-ENV-RH-01': 'Cabin humidity outside demo comfort band',
  'R-ENV-RAD-01': 'Radiation dose rate elevated',
  'R-FAT-01': 'Fatigue pattern: sleep, HRV and resting heart rate',
  'R-CARD-01': 'Heart rate and blood oxygen changed together',
  'R-DQ-01': 'Device not sending data',
  'R-DQ-02': 'Questionable signal quality',
  'R-PSY-01': 'Lower mood than usual (self report)',
  'R-PSY-02': 'More fatigue than usual (self report)',
  'R-PSY-03': 'More stress than usual (self report)',
  'R-PSY-04': 'Symptom reported in the daily check-in',
}

const isSelfReport = (m: MetricCode) => SELF_REPORT_METRICS.includes(m)

function joinList(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

const withArticle = (tag: string) => (/^(headache|cough|rash)$/.test(tag) ? `a ${tag}` : tag)

export function regionOf(metric: MetricCode): BodyRegionId | 'environment' {
  return METRIC_CATALOG[metric].region
}

/** Turn a metric assessment into a rule hit (null when nothing triggered or no data). */
export function hitFromAssessment(subjectId: string | null, a: MetricAssessment): RuleHit | null {
  if (a.noData || a.level === 'LOW' || !a.ruleId || !a.label || !a.phrase || !a.method) return null
  const env = subjectId === null
  const self = isSelfReport(a.metric)
  return {
    subjectId,
    ruleId: a.ruleId,
    level: a.level,
    metric: a.metric,
    region: regionOf(a.metric),
    method: a.method === 'EWMA' && a.persistenceHours !== null && a.persistenceHours >= 12 ? 'PERSISTENCE' : a.method,
    kind: env ? 'ENVIRONMENT' : self ? 'SELF_REPORT' : 'PHYSIO',
    label: a.label,
    phrase: a.phrase,
    title: RULE_TITLES[a.ruleId] ?? a.ruleId,
    scoreGroup: self ? RISK.selfReportGroup : undefined,
  }
}

type AssessMap = Partial<Record<MetricCode, MetricAssessment>>

const isAtLeast = (a: MetricAssessment | undefined, l: RiskLevel) => !!a && !a.noData && levelRank(a.level) >= levelRank(l)

/**
 * Combined pattern rules for one astronaut. `self` (daily check-ins) adds corroboration and
 * symptom factors; it never raises a level on its own.
 */
export function combinedHits(astronautId: string, m: AssessMap, env: AssessMap, self?: SelfReportSummary): RuleHit[] {
  const out: RuleHit[] = []

  // R-CARD-01: heart rate and SpO2 both HIGH or worse.
  const hr = m.HEART_RATE
  const spo2 = m.SPO2
  if (isAtLeast(hr, 'HIGH') && isAtLeast(spo2, 'HIGH')) {
    out.push({
      subjectId: astronautId,
      ruleId: 'R-CARD-01',
      level: 'CRITICAL',
      metric: 'HEART_RATE',
      region: 'heart',
      method: 'COMBINED',
      kind: 'COMBINED',
      label: `Heart rate ${hr!.value?.toFixed(0)} bpm and blood oxygen ${spo2!.value?.toFixed(0)}% changed together, far from your normal`,
      phrase: 'Your heart rate and blood oxygen changed quickly together',
      title: RULE_TITLES['R-CARD-01']!,
      suppresses: ['R-HR-01', 'R-HR-03', 'R-SPO2-01', 'R-SPO2-02', 'R-RR-01', 'R-BP-01'],
    })
  }

  // R-FAT-01: sleep + HRV + resting HR.
  const sleepLow = isAtLeast(m.SLEEP_DURATION, 'MODERATE') || isAtLeast(m.SLEEP_EFFICIENCY, 'MODERATE')
  const hrv = m.HRV_RMSSD
  const hrvLow = !!hrv && !hrv.noData && hrv.driftZ !== null && (isAtLeast(hrv, 'MODERATE') || -hrv.driftZ >= 1.2)
  const hrUp = !!hr && !hr.noData && hr.driftZ !== null && hr.driftZ >= 1.0
  const parts: string[] = []
  if (sleepLow) parts.push('shorter sleep')
  if (hrvLow) parts.push('lower HRV')
  if (hrUp) parts.push('higher resting heart rate')
  if (parts.length >= 2) {
    const all = parts.length === 3
    const list = parts.length === 3 ? `${parts[0]}, ${parts[1]} and ${parts[2]}` : `${parts[0]} and ${parts[1]}`
    const run = self?.highFatigueRun ?? 0
    const corroborated = run >= RISK.selfReportCorroborateRun
    out.push({
      subjectId: astronautId,
      ruleId: 'R-FAT-01',
      level: all ? 'HIGH' : 'MODERATE',
      metric: 'HRV_RMSSD',
      region: 'brain',
      method: 'COMBINED',
      kind: 'COMBINED',
      label: `Combined recovery pattern: ${list} at the same time${corroborated ? ', matching what you reported in your check-ins' : ''}`,
      phrase: `${list.charAt(0).toUpperCase()}${list.slice(1)} are showing up together`,
      title: RULE_TITLES['R-FAT-01']!,
      suppresses: ['R-SLEEP-01', 'R-SLEEP-02', 'R-HRV-01', 'R-HR-02', 'R-PSY-02'],
    })
    if (corroborated) {
      // Self report corroborates the objective pattern: an extra factor, never an extra level.
      const selfHigh = isAtLeast(m.PERCEIVED_FATIGUE, 'MODERATE')
      const label = `You also reported high fatigue in your last ${run} check-ins`
      out.push({
        subjectId: astronautId,
        ruleId: 'R-PSY-02',
        level: selfHigh ? 'MODERATE' : 'LOW',
        metric: 'PERCEIVED_FATIGUE',
        region: 'brain',
        method: 'COMBINED',
        kind: 'SELF_REPORT',
        label,
        phrase: label,
        title: RULE_TITLES['R-PSY-02']!,
        scoreGroup: RISK.selfReportGroup,
        weight: selfHigh ? undefined : RISK.symptomWeight,
      })
    }
  }

  // R-PSY-04: symptoms from today's check-in. Informational factor, not a diagnosis.
  if (self && self.symptoms.length > 0) {
    const label = `You reported ${joinList(self.symptoms.map(withArticle))} today`
    out.push({
      subjectId: astronautId,
      ruleId: 'R-PSY-04',
      level: 'LOW',
      metric: null,
      region: 'brain',
      method: 'COMBINED',
      kind: 'SELF_REPORT',
      label,
      phrase: label,
      title: RULE_TITLES['R-PSY-04']!,
      scoreGroup: RISK.selfReportGroup,
      weight: RISK.symptomWeight,
    })
  }

  // R-ENV-CO2-02: CO2 elevated and crew response (co-occurrence, not causation).
  const co2 = env.CO2
  if (isAtLeast(co2, 'MODERATE')) {
    const rr = m.RESPIRATORY_RATE
    const rt = m.REACTION_TIME
    const rrUp = !!rr && !rr.noData && rr.driftZ !== null && rr.driftZ >= 0.8
    const rtUp = isAtLeast(rt, 'MODERATE') || (!!rt && rt.z !== null && badZ(rt.z, 'up') >= 2)
    if (rrUp || rtUp) {
      const what = rrUp && rtUp ? 'breathing rate and reaction time are' : rrUp ? 'breathing rate is' : 'reaction time is'
      out.push({
        subjectId: astronautId,
        ruleId: 'R-ENV-CO2-02',
        level: 'MODERATE',
        metric: rrUp ? 'RESPIRATORY_RATE' : 'REACTION_TIME',
        region: 'lungs',
        method: 'COMBINED',
        kind: 'COMBINED',
        label: `Your ${what} above your normal while cabin CO₂ is elevated (co-occurrence, not proof of cause)`,
        phrase: `Your ${what} up while cabin CO₂ is elevated`,
        title: RULE_TITLES['R-ENV-CO2-02']!,
        suppresses: ['R-RR-01', 'R-RT-01'],
      })
    }
  }
  return out
}

export function levelFromScore(score: number): RiskLevel {
  if (score >= RISK.bands.CRITICAL) return 'CRITICAL'
  if (score >= RISK.bands.HIGH) return 'HIGH'
  if (score >= RISK.bands.MODERATE) return 'MODERATE'
  return 'LOW'
}

/** Noisy-OR risk score. One weight per rule id (the worst level of that rule). */
export function scoreHits(hits: RuleHit[]): { score: number; level: RiskLevel; perRule: Map<string, { hit: RuleHit; w: number }> } {
  const perRule = new Map<string, { hit: RuleHit; w: number }>()
  for (const h of hits) {
    let w = h.weight ?? RISK.weights[h.level]
    if (h.kind === 'DATA_QUALITY') w = Math.min(w, RISK.weights.MODERATE)
    const key = h.ruleId
    const prev = perRule.get(key)
    if (!prev || w > prev.w) perRule.set(key, { hit: h, w })
  }
  // Rules in the same score group (self report) share one weight: the largest.
  const groups = new Map<string, number>()
  let hasCritical = false
  for (const { hit, w } of perRule.values()) {
    const g = hit.scoreGroup ?? hit.ruleId
    groups.set(g, Math.max(groups.get(g) ?? 0, w))
    if (hit.level === 'CRITICAL') hasCritical = true
  }
  let keep = 1
  for (const w of groups.values()) keep *= 1 - w
  let score = Math.round(100 * (1 - keep))
  if (!hasCritical) score = Math.min(score, RISK.bands.CRITICAL - 1)
  return { score, level: levelFromScore(score), perRule }
}

const KIND_PRIORITY: Record<HitKind, number> = { COMBINED: 3, PHYSIO: 2, ENVIRONMENT: 1, DATA_QUALITY: 0, SELF_REPORT: -1 }

export function topHit(hits: RuleHit[]): RuleHit | null {
  let best: RuleHit | null = null
  for (const h of hits) {
    if (!best) {
      best = h
      continue
    }
    const d = levelRank(h.level) - levelRank(best.level)
    if (d > 0 || (d === 0 && KIND_PRIORITY[h.kind] > KIND_PRIORITY[best.kind])) best = h
  }
  return best
}

/** One calm, plain-English sentence for the crew. */
export function headlineFor(level: RiskLevel, top: RuleHit | null, noDataCount: number): string {
  if (!top) {
    return noDataCount > 0 ? 'Some readings are missing, so this picture is incomplete.' : 'All indicators are within your normal range.'
  }
  let tail: string
  if (top.kind === 'DATA_QUALITY') tail = 'a sensor check is suggested'
  else if (top.kind === 'SELF_REPORT') tail = 'a short talk with the crew medical officer may help'
  else if (top.kind === 'ENVIRONMENT') tail = level === 'CRITICAL' ? 'cabin air action is requested now' : 'a cabin air check is suggested'
  else if (level === 'CRITICAL') tail = 'medical review is requested now'
  else if (level === 'HIGH') tail = 'a flight surgeon review is suggested'
  else tail = 'keep an eye on it'
  return `${top.phrase}, so ${tail}.`
}

export const BASE_LIMITATIONS = [
  'Simulated data only (data_origin SIMULATED); no real astronaut data.',
  'Decision support for review, not a diagnosis or a medical device.',
  'Fixed thresholds are demo configuration, not official NASA limits.',
  'Correlation between signals does not prove cause.',
]

export interface RiskInput {
  astronautId: string
  now: number
  hits: RuleHit[]
  assessments: AssessMap
  extraLimitations?: string[]
}

const KEY_METRICS: MetricCode[] = ['HEART_RATE', 'HRV_RMSSD', 'SPO2', 'RESPIRATORY_RATE', 'SLEEP_DURATION']

export function assessRisk(input: RiskInput): RiskAssessment {
  const { score, level, perRule } = scoreHits(input.hits)
  const totalW = [...perRule.values()].reduce((s, e) => s + e.w, 0)
  const factors: ContributingFactor[] = [...perRule.values()]
    .sort((a, b) => b.w - a.w)
    .map(({ hit, w }) => ({ metric: hit.metric, label: hit.label, weight: totalW > 0 ? Math.round((w / totalW) * 100) / 100 : 0 }))

  let confidence = 0.95
  const limitations = [...BASE_LIMITATIONS]
  const missing: string[] = []
  for (const m of KEY_METRICS) {
    const a = input.assessments[m]
    if (!a || a.noData) {
      confidence -= 0.15
      missing.push(METRIC_CATALOG[m].label.toLowerCase())
    } else {
      if (a.questionable) confidence -= 0.07
      if (!a.baseline || a.baseline.status !== 'READY') confidence -= 0.05
    }
  }
  if (missing.length) limitations.push(`No current data for ${missing.join(', ')}; status for those signals is unknown, not normal.`)
  if (input.extraLimitations) limitations.push(...input.extraLimitations)
  confidence = Math.round(Math.min(0.95, Math.max(0.15, confidence)) * 100) / 100

  const ruleIds = [...perRule.values()].sort((a, b) => levelRank(b.hit.level) - levelRank(a.hit.level)).map((e) => e.hit.ruleId)
  const noDataCount = Object.values(input.assessments).filter((a) => a?.noData).length
  return {
    astronautId: input.astronautId,
    risk_level: level,
    risk_score: score,
    contributing_factors: factors,
    triggered_rules: ruleIds,
    confidence,
    model_version: RISK_MODEL_VERSION,
    evaluated_at: input.now,
    data_window: `Personal baseline: last ${SIM.historyDays} days (daily metrics: last ${SIM.dailyHistoryDays} days). Current values: last 3 readings.`,
    limitations,
    headline: headlineFor(level, topHit(input.hits.filter((h) => h.level !== 'LOW')), noDataCount),
  }
}

export const REGIONS: BodyRegionId[] = ['brain', 'heart', 'lungs', 'kidneys', 'muscles', 'bones', 'skin']

/** Region status = worst status of its metrics and of combined rules mapped to it. */
export function buildRegions(metrics: Partial<Record<MetricCode, MetricState>>, assessments: AssessMap, hits: RuleHit[]): Record<BodyRegionId, RegionState> {
  const out = {} as Record<BodyRegionId, RegionState>
  for (const region of REGIONS) {
    const codes = (Object.keys(metrics) as MetricCode[]).filter((c) => METRIC_CATALOG[c].region === region)
    const statuses: Status[] = codes.map((c) => metrics[c]!.status)
    const combined = hits.filter((h) => h.kind === 'COMBINED' && h.region === region)
    for (const h of combined) statuses.push(h.level)
    if (codes.length === 0 && combined.length === 0) {
      out[region] = { region, status: 'NO_DATA', metrics: [], summary: `Not directly monitored in this prototype. ${REGION_LABELS[region].description}` }
      continue
    }
    const status = worstStatus(statuses)
    const issues: string[] = []
    for (const h of combined.sort((a, b) => levelRank(b.level) - levelRank(a.level))) issues.push(h.phrase)
    const flagged = codes
      .map((c) => assessments[c])
      .filter((a): a is MetricAssessment => !!a && !a.noData && a.level !== 'LOW' && !!a.phrase)
      .sort((a, b) => levelRank(b.level) - levelRank(a.level))
    for (const a of flagged) issues.push(a.phrase!)
    const noData = codes.filter((c) => metrics[c]!.status === 'NO_DATA')
    let summary: string
    if (status === 'NO_DATA') summary = `No data: ${noData.map((c) => METRIC_CATALOG[c].label.toLowerCase()).join(', ')} not being received.`
    else if (issues.length === 0) summary = noData.length ? `Within your normal range, but no data for ${noData.map((c) => METRIC_CATALOG[c].label.toLowerCase()).join(', ')}.` : 'Within your normal range.'
    else summary = issues.slice(0, 2).map((s) => `${s}.`).join(' ')
    out[region] = { region, status, metrics: codes, summary }
  }
  return out
}
