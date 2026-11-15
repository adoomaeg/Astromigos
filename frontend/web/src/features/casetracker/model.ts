import type { Alert, AppState, BodyRegionId, MetricCode, Recommendation, RiskLevel } from '../../types/domain'
import { METRIC_CATALOG } from '../../engine/catalog'

export interface FollowUp {
  note: string
  at: number
  reviewed: boolean
}
export interface CaseMeasurement {
  metric: MetricCode
  detected: number | null
  current: number | null
  low: number | null
  high: number | null
  trend: 'Within personal range' | 'Closer to personal range' | 'Further from personal range' | 'Outside personal range' | 'Data unavailable' | 'Baseline not ready'
}
export interface IssueCase {
  id: string
  subjectId: string
  ruleId: string
  title: string
  detail: string
  priority: RiskLevel
  detectedAt: number
  clearedAt: number | null
  active: boolean
  status: 'Open' | 'Awaiting follow-up' | 'Resolved'
  alerts: Alert[]
  recommendations: Recommendation[]
  interventions: AppState['interventions']
  measurements: CaseMeasurement[]
  followUps: FollowUp[]
}
export type CaseSnapshot = Pick<AppState, 'alerts' | 'recommendations' | 'interventions' | 'health' | 'environment' | 'history'>
const rank: Record<RiskLevel, number> = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 }
const subject = (a: Alert) => a.astronautId ?? 'CABIN'
const belongs = (id: string, selected: string) => id === selected || id === 'CABIN'
const distance = (v: number, low: number, high: number) => Math.max(low - v, v - high, 0)

/** A completed action or dismissed recommendation is never evidence that an issue cleared. */
export function issueCases(astronautId: string, snapshot: CaseSnapshot, reviews: Readonly<Record<string, readonly FollowUp[]>> = {}): IssueCase[] {
  const { alerts, recommendations, interventions, health, environment, history } = snapshot
  const relevantAlerts = alerts.filter((a) => belongs(subject(a), astronautId))
  const relevantRecs = recommendations.filter((r) => belongs(r.astronautId, astronautId))
  const assigned = new Set<string>()
  const seeds = relevantAlerts.map((alert) => {
    const nextAt = relevantAlerts.filter((a) => a.ruleId === alert.ruleId && subject(a) === subject(alert) && a.createdAt > alert.createdAt).reduce((n, a) => Math.min(n, a.createdAt), Infinity)
    const recs = relevantRecs.filter((r) => r.ruleId === alert.ruleId && r.astronautId === subject(alert) && r.createdAt >= alert.createdAt - 5 * 60_000 && r.createdAt < nextAt)
    recs.forEach((r) => assigned.add(r.id))
    return { id: `alert-${alert.id}`, alert: alert as Alert | undefined, recs, subjectId: subject(alert), ruleId: alert.ruleId, at: alert.createdAt, nextAt }
  })
  for (const rec of relevantRecs) {
    if (assigned.has(rec.id)) continue
    const existing = seeds.find((s) => !s.alert && s.ruleId === rec.ruleId && s.subjectId === rec.astronautId && Math.abs(s.at - rec.createdAt) < 30 * 60_000)
    if (existing) existing.recs.push(rec)
    else seeds.push({ id: `recommendation-${rec.id}`, alert: undefined, recs: [rec], subjectId: rec.astronautId, ruleId: rec.ruleId, at: rec.createdAt, nextAt: Infinity })
  }
  return seeds.map((seed): IssueCase => {
    const ownAlerts = seed.alert ? [seed.alert] : []
    const metrics = new Set<MetricCode>(ownAlerts.flatMap((a) => a.metric ? [a.metric] : []))
    const metricStates = seed.subjectId === 'CABIN' ? environment.metrics : health[seed.subjectId]?.metrics
    const regions = seed.subjectId === 'CABIN' ? undefined : health[seed.subjectId]?.regions
    const ruleActive = health[seed.subjectId]?.risk.triggered_rules.includes(seed.ruleId) ?? false
    // Some grouped rules have no one metric: inspect the same system their recommendation names.
    const caseRegions = new Set<BodyRegionId>(seed.recs.flatMap((r) => r.region && r.region !== 'environment' ? [r.region] : []))
    for (const region of caseRegions) for (const metric of regions?.[region]?.metrics ?? []) metrics.add(metric)
    const measurements = [...metrics].map((metric): CaseMeasurement => {
      const state = metricStates?.[metric]
      const points = history[seed.subjectId]?.[metric] ?? []
      const point = points.findLast((p) => p.t <= seed.at && p.t >= seed.at - 15 * 60_000)
      const baseline = state?.baseline?.status === 'READY' ? state.baseline : null
      const current = state?.current ?? null
      const detected = point?.v ?? null
      let trend: CaseMeasurement['trend'] = 'Data unavailable'
      if (current != null) {
        if (!baseline) trend = 'Baseline not ready'
        else {
          const now = distance(current, baseline.low, baseline.high)
          const before = detected == null ? null : distance(detected, baseline.low, baseline.high)
          trend = now === 0 ? 'Within personal range' : before == null || Math.abs(now - before) < 0.001 ? 'Outside personal range' : now < before ? 'Closer to personal range' : 'Further from personal range'
        }
      }
      return { metric, detected, current, low: baseline?.low ?? null, high: baseline?.high ?? null, trend }
    })
    const hasUnknownOrAbnormalData = [...metrics].some((m) => !metricStates?.[m] || metricStates[m]!.current == null || metricStates[m]!.status !== 'LOW')
    const hasAbnormalRegion = [...caseRegions].some((r) => !regions?.[r] || regions[r].status !== 'LOW')
    const active = ownAlerts.some((a) => a.resolvedAt == null) || seed.recs.some((r) => r.active !== false) || ruleActive || hasUnknownOrAbnormalData || hasAbnormalRegion
    const ownInterventions = interventions.filter((i) => {
      if (i.astronautId !== seed.subjectId) return false
      if (i.recommendationId) return seed.recs.some((r) => r.id === i.recommendationId)
      return i.loggedAt >= seed.at && i.loggedAt < seed.nextAt && seed.recs.some((r) => r.interventionKind === i.kind)
    }).sort((a, b) => b.loggedAt - a.loggedAt)
    const followUps = [...(reviews[seed.id] ?? [])].sort((a, b) => b.at - a.at)
    const clearedAt = active ? null : Math.max(seed.at, ...ownAlerts.map((a) => a.resolvedAt ?? seed.at))
    const reviewed = !active && followUps.some((r) => r.reviewed && r.note.trim() && r.at >= (clearedAt ?? seed.at))
    const levels = [...ownAlerts.map((a) => a.severity), ...seed.recs.map((r) => r.priority)]
    const priority = levels.reduce((level, next) => rank[next] > rank[level] ? next : level, 'LOW' as RiskLevel)
    return {
      id: seed.id, subjectId: seed.subjectId, ruleId: seed.ruleId,
      title: seed.alert?.title ?? seed.recs[0]?.title ?? 'Health issue',
      detail: seed.alert?.detail ?? seed.recs[0]?.rationale ?? '',
      priority, detectedAt: seed.at, clearedAt, active,
      status: active ? 'Open' : reviewed ? 'Resolved' : 'Awaiting follow-up',
      alerts: ownAlerts, recommendations: seed.recs, interventions: ownInterventions, measurements, followUps,
    }
  }).sort((a, b) => {
    const order = { Open: 0, 'Awaiting follow-up': 1, Resolved: 2 }
    return order[a.status] - order[b.status] || rank[b.priority] - rank[a.priority] || b.detectedAt - a.detectedAt
  })
}

export function caseMetricLabel(metric: MetricCode): string { return METRIC_CATALOG[metric].label }
