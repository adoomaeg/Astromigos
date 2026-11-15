/**
 * Alert manager.
 * - One active alert per subject + rule (dedupe). Escalation updates the active alert
 *   in place if it is not acknowledged yet; if it was acknowledged, a new alert is raised
 *   so the escalation is seen.
 * - An alert auto-resolves (resolvedAt set) after its rule has been clear for
 *   ALERTS.resolveAfterMin. Acknowledged and resolved alerts stay in the history.
 * - (v2) Escalation: a HIGH or CRITICAL alert that stays unacknowledged and unresolved past
 *   the ESCALATION steps (config.ts, demo configuration) gets escalationLevel 1, then 2, and
 *   escalatedAt. Escalation stops as soon as the alert is acknowledged or resolved.
 */
import type { Alert, RiskLevel } from '../types/domain'
import { ALERTS, ESCALATION } from './config'
import { levelRank } from './anomaly'
import type { RuleHit } from './risk'
import { MIN_MS } from './text'

export interface AlertChange {
  kind: 'CREATED' | 'ESCALATED' | 'RESOLVED'
  alert: Alert
}

export class AlertManager {
  alerts: Alert[] = []
  private readonly active = new Map<string, { id: string; lastSeen: number }>()
  private seq = 0

  /** `hits` must already be actionable and suppressed. Returns the changes. */
  sync(hits: RuleHit[], now: number, subjectName: (id: string | null) => string): AlertChange[] {
    const changes: AlertChange[] = []
    let alerts = this.alerts
    const seen = new Set<string>()
    const replace = (id: string, fn: (a: Alert) => Alert): Alert | null => {
      const idx = alerts.findIndex((a) => a.id === id)
      if (idx < 0) return null
      const next = fn(alerts[idx]!)
      alerts = alerts.slice()
      alerts[idx] = next
      return next
    }
    const create = (hit: RuleHit, key: string): Alert => {
      const a: Alert = {
        id: `AL-${++this.seq}`,
        astronautId: hit.subjectId,
        severity: hit.level,
        title: hit.subjectId ? `${subjectName(hit.subjectId)}: ${hit.title}` : hit.title,
        detail: `${hit.label}. Decision support only, not a diagnosis.`,
        region: hit.region,
        metric: hit.metric,
        ruleId: hit.ruleId,
        createdAt: now,
        acknowledgedAt: null,
        acknowledgedBy: null,
        resolvedAt: null,
        escalatedAt: null,
        escalationLevel: 0,
      }
      alerts = [a, ...alerts]
      this.active.set(key, { id: a.id, lastSeen: now })
      return a
    }

    for (const hit of hits) {
      const key = `${hit.subjectId ?? 'CABIN'}|${hit.ruleId}`
      if (seen.has(key)) continue
      seen.add(key)
      const entry = this.active.get(key)
      if (!entry) {
        changes.push({ kind: 'CREATED', alert: create(hit, key) })
        continue
      }
      entry.lastSeen = now
      const current = alerts.find((a) => a.id === entry.id)
      if (!current || levelRank(hit.level) <= levelRank(current.severity)) continue
      if (current.acknowledgedAt === null) {
        const updated = replace(current.id, (a) => ({ ...a, severity: hit.level, detail: `${hit.label}. Decision support only, not a diagnosis.` }))
        if (updated) changes.push({ kind: 'ESCALATED', alert: updated })
      } else {
        replace(current.id, (a) => ({ ...a, resolvedAt: now }))
        changes.push({ kind: 'ESCALATED', alert: create(hit, key) })
      }
    }

    for (const [key, entry] of this.active) {
      if (seen.has(key)) continue
      if (now - entry.lastSeen >= ALERTS.resolveAfterMin * MIN_MS) {
        this.active.delete(key)
        const resolved = replace(entry.id, (a) => ({ ...a, resolvedAt: now }))
        if (resolved) changes.push({ kind: 'RESOLVED', alert: resolved })
      }
    }

    if (alerts.length > ALERTS.maxAlerts) {
      // Drop the oldest resolved alerts first.
      const keep = alerts.slice()
      for (let i = keep.length - 1; i >= 0 && keep.length > ALERTS.maxAlerts; i--) {
        if (keep[i]!.resolvedAt != null) keep.splice(i, 1)
      }
      alerts = keep.slice(0, ALERTS.maxAlerts)
    }
    if (alerts !== this.alerts) this.alerts = alerts
    return changes
  }

  /**
   * Escalate unacknowledged HIGH / CRITICAL alerts. Steps are minutes since the alert was raised
   * (ESCALATION[severity]). Returns the alerts whose escalation level went up.
   */
  escalate(now: number, steps: Partial<Record<RiskLevel, number[]>> = ESCALATION): Alert[] {
    const changed: Alert[] = []
    let alerts = this.alerts
    for (let i = 0; i < alerts.length; i++) {
      const a = alerts[i]!
      if (a.acknowledgedAt !== null || a.resolvedAt != null) continue
      const thresholds = steps[a.severity]
      if (!thresholds || thresholds.length === 0) continue
      const ageMin = (now - a.createdAt) / MIN_MS
      let level = 0
      for (const th of thresholds) if (ageMin >= th) level++
      const current = a.escalationLevel ?? 0
      if (level <= current) continue
      // escalatedAt is the moment the step was due (not when it was noticed), so it does not
      // depend on how often the engine is evaluated.
      const due = a.createdAt + thresholds[level - 1]! * MIN_MS
      const next: Alert = { ...a, escalationLevel: level, escalatedAt: due }
      if (alerts === this.alerts) alerts = alerts.slice()
      alerts[i] = next
      changed.push(next)
    }
    if (changed.length) this.alerts = alerts
    return changed
  }

  acknowledge(id: string, actor: string, now: number): Alert | null {
    const idx = this.alerts.findIndex((a) => a.id === id)
    if (idx < 0) return null
    const cur = this.alerts[idx]!
    if (cur.acknowledgedAt !== null) return null
    const next = { ...cur, acknowledgedAt: now, acknowledgedBy: actor }
    const alerts = this.alerts.slice()
    alerts[idx] = next
    this.alerts = alerts
    return next
  }
}
