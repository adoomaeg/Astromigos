/**
 * Recommendation engine (PROJECT_MASTER 9.7).
 * 1. Rules identify a condition (risk.ts).
 * 2. This versioned catalog offers a non-prescriptive action for that rule.
 * 3. One recommendation per astronaut + rule per episode (dedupe); a new one is only
 *    created after the rule has been clear for a while and triggers again.
 * 4. HIGH and CRITICAL items, and anything addressed to the flight surgeon, require
 *    human review. No diagnosis, no medication, no invented clinical limits.
 * 5. (v2) Every item says who can close the loop: autonomy ONBOARD (crew self care, crew
 *    medical officer, onboard checks) or GROUND_REVIEW (flight surgeon or mission control on
 *    Earth, subject to the comm delay). Under deep space comm profiles (Mars), a HIGH or
 *    CRITICAL GROUND_REVIEW item also gets an ONBOARD first step, because Earth cannot answer
 *    before 2 x one way delay + review time.
 */
import type { BodyRegionId, CommProfile, InterventionKind, Recommendation, RiskLevel } from '../types/domain'
import { ALERTS, COMMS, REC_CATALOG_VERSION } from './config'
import { levelRank } from './anomaly'
import type { RuleHit } from './risk'
import { MIN_MS, fmtClock, fmtDuration } from './text'

export interface RecTemplate {
  title: string
  why: string
  audience: Recommendation['audience']
  region: BodyRegionId | 'environment' | null
  interventionKind: InterventionKind | null
  /** Default: CREW is ONBOARD, FLIGHT_SURGEON and MISSION_CONTROL are GROUND_REVIEW. */
  autonomy?: Recommendation['autonomy']
}

export function autonomyOf(tpl: RecTemplate): NonNullable<Recommendation['autonomy']> {
  return tpl.autonomy ?? (tpl.audience === 'CREW' ? 'ONBOARD' : 'GROUND_REVIEW')
}

const SLEEP: RecTemplate = {
  title: 'Review sleep schedule and light exposure',
  why: 'Sleep timing, light exposure and pre-sleep workload are common, adjustable factors.',
  audience: 'CREW',
  region: 'brain',
  interventionKind: 'SLEEP_EXTENSION',
}

const MONITOR = (title: string, region: BodyRegionId | 'environment', kind: InterventionKind | null = 'REST_PROTOCOL'): RecTemplate => ({
  title,
  why: 'A single window can be noise. Keep monitoring and review if it persists in the next window.',
  audience: 'CREW',
  region,
  interventionKind: kind,
})

export const REC_CATALOG: { version: string; byRule: Record<string, RecTemplate> } = {
  version: REC_CATALOG_VERSION,
  byRule: {
    'R-SLEEP-01': SLEEP,
    'R-SLEEP-02': SLEEP,
    'R-HRV-01': { ...SLEEP, title: 'Review recovery: sleep, workload and exercise intensity', why: 'Lower HRV than your normal often goes with poor recovery or stress.', region: 'heart' },
    'R-HR-02': MONITOR('Keep monitoring resting heart rate in the next window', 'heart'),
    'R-FAT-01': {
      title: 'Request flight surgeon review of the recovery pattern',
      why: 'Several recovery signals moved together. A human review can decide on sleep, workload and exercise adjustments.',
      audience: 'FLIGHT_SURGEON',
      region: 'brain',
      interventionKind: 'SLEEP_EXTENSION',
    },
    'R-HR-01': {
      title: 'Pause activity, rest, and request flight surgeon review',
      why: 'The change is large compared with your own history in the same activity context.',
      audience: 'FLIGHT_SURGEON',
      region: 'heart',
      interventionKind: 'REST_PROTOCOL',
    },
    'R-HR-03': {
      title: 'Pause activity, rest, and request flight surgeon review',
      why: 'Heart rate at rest is above the demo safety net level.',
      audience: 'FLIGHT_SURGEON',
      region: 'heart',
      interventionKind: 'REST_PROTOCOL',
    },
    'R-CARD-01': {
      title: 'Request flight surgeon review now',
      why: 'Two vital signs changed together and quickly. Follow your crew medical procedures; the system does not diagnose.',
      audience: 'FLIGHT_SURGEON',
      region: 'heart',
      interventionKind: 'MEDICAL_CONSULT',
    },
    'R-SPO2-01': {
      title: 'Check sensor fit, then request review if it persists',
      why: 'Low blood oxygen readings can come from sensor contact or from a real change; both need a check.',
      audience: 'FLIGHT_SURGEON',
      region: 'lungs',
      interventionKind: 'MEDICAL_CONSULT',
    },
    'R-SPO2-02': {
      title: 'Request flight surgeon review of blood oxygen',
      why: 'Blood oxygen is below the demo safety net level.',
      audience: 'FLIGHT_SURGEON',
      region: 'lungs',
      interventionKind: 'MEDICAL_CONSULT',
    },
    'R-RR-01': MONITOR('Keep monitoring breathing rate in the next window', 'lungs'),
    'R-BP-01': MONITOR('Repeat the measurement at rest and keep monitoring', 'heart'),
    'R-TEMP-01': MONITOR('Check thermal comfort and clothing layers', 'skin', null),
    'R-ACT-01': MONITOR('Review daily activity and workload balance', 'muscles', 'EXERCISE_ADJUSTMENT'),
    'R-EX-01': {
      title: 'Adjust exercise load and recovery with the trainer',
      why: 'Output is below your own usual sessions. Load, recovery and sleep are the usual levers.',
      audience: 'CREW',
      region: 'muscles',
      interventionKind: 'EXERCISE_ADJUSTMENT',
    },
    'R-RT-01': { ...MONITOR('Review rest and workload before critical tasks', 'brain'), why: 'Slower reactions than your normal can come with fatigue or cabin conditions.' },
    'R-HYD-01': {
      title: 'Hydrate per protocol',
      why: 'The hydration index from intake logs is below your normal.',
      audience: 'CREW',
      region: 'kidneys',
      interventionKind: 'HYDRATION',
    },
    'R-RAD-02': { title: 'Review accumulated dose with mission control', why: 'Dose planning is a mission control decision.', audience: 'MISSION_CONTROL', region: 'bones', interventionKind: null },
    'R-ENV-CO2-01': {
      title: 'Ventilate the module and check the CO₂ scrubber',
      why: 'Cabin CO₂ is above the demo level. Air circulation and scrubber status are the first things to check.',
      audience: 'MISSION_CONTROL',
      region: 'environment',
      interventionKind: 'CABIN_VENTILATION',
      // The crew can ventilate and check the scrubber on board; mission control is informed.
      autonomy: 'ONBOARD',
    },
    'R-ENV-CO2-02': {
      title: 'Ventilate and keep monitoring breathing and reaction time',
      why: 'Signals moved while CO₂ was elevated. This is co-occurrence, not proof of cause.',
      audience: 'CREW',
      region: 'lungs',
      interventionKind: 'CABIN_VENTILATION',
    },
    'R-ENV-TEMP-01': { title: 'Check cabin thermal control', why: 'Cabin temperature is outside the demo comfort band.', audience: 'MISSION_CONTROL', region: 'environment', interventionKind: 'CABIN_VENTILATION', autonomy: 'ONBOARD' },
    'R-ENV-RH-01': { title: 'Check cabin humidity control', why: 'Humidity is outside the demo comfort band.', audience: 'MISSION_CONTROL', region: 'environment', interventionKind: 'CABIN_VENTILATION', autonomy: 'ONBOARD' },
    'R-ENV-RAD-01': { title: 'Follow the radiation shelter procedure from mission control', why: 'Dose rate is above the demo particle event level.', audience: 'MISSION_CONTROL', region: 'environment', interventionKind: null },
    'R-DQ-01': {
      title: 'Check sensor fit and connection',
      why: 'Missing data is never treated as normal. Until the device sends data again, these signals are unknown.',
      audience: 'CREW',
      region: null,
      interventionKind: 'SENSOR_CHECK',
    },
    'R-DQ-02': { title: 'Check sensor fit and skin contact', why: 'Values are marked questionable and cannot escalate on their own.', audience: 'CREW', region: null, interventionKind: 'SENSOR_CHECK' },
    // v2 self report (daily check-in). Supportive, non-diagnostic, crew first.
    'R-PSY-01': {
      title: 'Check in with the crew medical officer and plan some recovery time',
      why: 'Your own answers are lower than usual. A short private talk and some protected time often help; this is not a diagnosis.',
      audience: 'CREW',
      region: 'brain',
      interventionKind: 'REST_PROTOCOL',
    },
    'R-PSY-02': {
      title: 'Review workload and sleep opportunity for the next shifts',
      why: 'You reported more fatigue than usual. Workload, sleep timing and light exposure are adjustable factors.',
      audience: 'CREW',
      region: 'brain',
      interventionKind: 'SLEEP_EXTENSION',
    },
    'R-PSY-03': {
      title: 'Take a short break and review the task load',
      why: 'You reported more stress than usual. A short break and a look at the task list can help; a private conference with the ground support team is an option.',
      audience: 'CREW',
      region: 'brain',
      interventionKind: 'REST_PROTOCOL',
    },
  },
}

/** Comm context for autonomy (deep space first steps). */
export interface CommContext {
  profile: CommProfile
  /** Minimum simulated review time on Earth (minutes). */
  reviewMin: number
}

/** Earliest possible Earth reply after a request sent now: 2 x one way delay + review time (ms). */
export function earliestReplyMs(ctx: CommContext): number {
  return 2 * ctx.profile.oneWayDelaySec * 1000 + ctx.reviewMin * MIN_MS
}

const ONBOARD_FIRST_STEP = 'Crew medical officer: start the onboard assessment protocol now'

function onboardRationale(hit: RuleHit, ctx: CommContext, now: number): string {
  const oneWay = fmtDuration(ctx.profile.oneWayDelaySec * 1000)
  const earliest = earliestReplyMs(ctx)
  return (
    `${hit.label}. Earth is about ${oneWay} away each way (${ctx.profile.label}), so the earliest flight surgeon reply ` +
    `is about ${fmtDuration(earliest)} after a request (2 x ${oneWay} light time plus at least ${ctx.reviewMin} min review), ` +
    `not before ${fmtClock(now + earliest)} if sent now. Start the onboard assessment protocol and send a health packet; ` +
    'the ground review follows when the reply arrives.'
  )
}

/** Which hits produce alerts and recommendations (acute single z blips at MODERATE do not). */
export function isActionable(hit: RuleHit): boolean {
  if (levelRank(hit.level) >= levelRank('HIGH')) return true
  if (hit.level !== 'MODERATE') return false
  return hit.kind !== 'PHYSIO' || hit.method !== 'ROBUST_Z'
}

/**
 * Group hits under a combined rule for the same subject: while the combined rule is
 * active its component rules do not raise separate alerts or recommendations, unless
 * a component is CRITICAL and the combined rule is not (never hide an acute signal).
 */
export function applySuppression(hits: RuleHit[]): RuleHit[] {
  const suppressed = new Map<string, RiskLevel>()
  for (const h of hits) {
    if (!h.suppresses) continue
    for (const r of h.suppresses) {
      const key = `${h.subjectId ?? 'CABIN'}|${r}`
      const prev = suppressed.get(key)
      if (!prev || levelRank(h.level) > levelRank(prev)) suppressed.set(key, h.level)
    }
  }
  return hits.filter((h) => {
    const lvl = suppressed.get(`${h.subjectId ?? 'CABIN'}|${h.ruleId}`)
    if (!lvl) return true
    return h.level === 'CRITICAL' && lvl !== 'CRITICAL'
  })
}

export function requiresReview(level: RiskLevel, audience: Recommendation['audience']): boolean {
  return levelRank(level) >= levelRank('HIGH') || audience === 'FLIGHT_SURGEON'
}

export class RecommendationManager {
  recs: Recommendation[] = []
  private readonly episodes = new Map<string, { recId: string; lastSeen: number }>()
  private seq = 0

  /**
   * Returns true when the list changed. `hits` must already be actionable and suppressed.
   * `comm` (optional) enables the deep space ONBOARD first step for GROUND_REVIEW items.
   */
  sync(hits: RuleHit[], now: number, comm?: CommContext): boolean {
    let changed = false
    const seen = new Set<string>()
    let recs = this.recs
    for (const hit of hits) {
      const tpl = REC_CATALOG.byRule[hit.ruleId]
      if (!tpl) continue
      const subject = hit.subjectId ?? 'CABIN'
      const key = `${subject}|${hit.ruleId}`
      if (seen.has(key)) continue
      seen.add(key)
      // Deep space: a HIGH/CRITICAL ground review item gets an onboard first step.
      const deep = !!comm && (COMMS.deepSpaceProfiles as readonly string[]).includes(comm.profile.id)
      if (deep && autonomyOf(tpl) === 'GROUND_REVIEW' && levelRank(hit.level) >= levelRank('HIGH') && hit.subjectId) {
        // One onboard first step per astronaut, whatever the number of ground review rules.
        const okey = `${subject}|ONBOARD-FIRST-STEP`
        seen.add(okey)
        const oep = this.episodes.get(okey)
        if (oep) {
          oep.lastSeen = now
          const idx = recs.findIndex((r) => r.id === oep.recId)
          const rec = idx >= 0 ? recs[idx]! : null
          if (rec && rec.status === 'PENDING' && (levelRank(hit.level) > levelRank(rec.priority) || rec.active === false)) {
            recs = recs.slice()
            recs[idx] = { ...rec, priority: levelRank(hit.level) > levelRank(rec.priority) ? hit.level : rec.priority, rationale: onboardRationale(hit, comm!, now), active: true }
            changed = true
          }
        } else {
          const rec: Recommendation = {
            id: `REC-${++this.seq}`,
            astronautId: subject,
            ruleId: hit.ruleId,
            title: ONBOARD_FIRST_STEP,
            rationale: onboardRationale(hit, comm!, now),
            priority: hit.level,
            audience: 'CREW',
            region: tpl.region ?? hit.region,
            requiresHumanReview: true,
            createdAt: now,
            status: 'PENDING',
            interventionKind: 'REST_PROTOCOL',
            active: true,
            catalogVersion: REC_CATALOG.version,
            autonomy: 'ONBOARD',
          }
          recs = [rec, ...recs]
          this.episodes.set(okey, { recId: rec.id, lastSeen: now })
          changed = true
        }
      }
      const ep = this.episodes.get(key)
      if (ep) {
        ep.lastSeen = now
        const idx = recs.findIndex((r) => r.id === ep.recId)
        const rec = idx >= 0 ? recs[idx]! : null
        if (rec && rec.status === 'PENDING' && (levelRank(hit.level) > levelRank(rec.priority) || rec.active === false)) {
          const priority = levelRank(hit.level) > levelRank(rec.priority) ? hit.level : rec.priority
          recs = recs.slice()
          recs[idx] = { ...rec, priority, rationale: `${hit.label}. ${tpl.why}`, requiresHumanReview: requiresReview(priority, tpl.audience), active: true }
          changed = true
        }
        continue
      }
      const rec: Recommendation = {
        id: `REC-${++this.seq}`,
        astronautId: subject,
        ruleId: hit.ruleId,
        title: tpl.title,
        rationale: `${hit.label}. ${tpl.why}`,
        priority: hit.level,
        audience: tpl.audience,
        region: tpl.region ?? hit.region,
        requiresHumanReview: requiresReview(hit.level, tpl.audience),
        createdAt: now,
        status: 'PENDING',
        interventionKind: tpl.interventionKind,
        active: true,
        catalogVersion: REC_CATALOG.version,
        autonomy: autonomyOf(tpl),
      }
      recs = [rec, ...recs]
      this.episodes.set(key, { recId: rec.id, lastSeen: now })
      changed = true
    }
    // Close episodes whose rule has been clear long enough.
    for (const [key, ep] of this.episodes) {
      if (seen.has(key)) continue
      if (now - ep.lastSeen >= ALERTS.recommendationEpisodeGapMin * MIN_MS) {
        this.episodes.delete(key)
        const idx = recs.findIndex((r) => r.id === ep.recId)
        if (idx >= 0 && recs[idx]!.active !== false) {
          recs = recs.slice()
          recs[idx] = { ...recs[idx]!, active: false }
          changed = true
        }
      }
    }
    if (recs.length > ALERTS.maxRecommendations) {
      recs = recs.slice(0, ALERTS.maxRecommendations)
      changed = true
    }
    if (changed) this.recs = recs
    return changed
  }

  setStatus(id: string, status: Recommendation['status']): Recommendation | null {
    const idx = this.recs.findIndex((r) => r.id === id)
    if (idx < 0) return null
    const rec = { ...this.recs[idx]!, status }
    const recs = this.recs.slice()
    recs[idx] = rec
    this.recs = recs
    return rec
  }
}
