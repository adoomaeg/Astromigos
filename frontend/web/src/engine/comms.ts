/**
 * Earth communication model (hazard: Distance from Earth). SIMULATED.
 *
 * - DOWNLINK (vehicle to Earth) messages arrive at sentAt + one way delay of the active comm
 *   profile (catalog.ts COMM_PROFILES). Status is IN_TRANSIT until then, DELIVERED after.
 * - When a CONSULT_REQUEST or HEALTH_PACKET reaches Earth, a simulated flight surgeon reviews
 *   it (COMMS.reviewMinMin..reviewMaxMin sim minutes, seeded per message) and sends a short
 *   templated GROUND_REPLY (UPLINK) that again takes the one way delay. The reply message
 *   appears in the list when Earth sends it (IN_TRANSIT), and is DELIVERED on board after the
 *   delay. Replies acknowledge, ask to continue the onboard protocol and re-check; they never
 *   prescribe medication and are marked as simulated.
 * - All timing uses the scheduled times (not the moment the engine happens to evaluate), so
 *   results do not depend on the simulation speed.
 *
 * Pure TypeScript: the engine calls process(now) and reads `messages` (newest first, bounded).
 */
import type { CommMessage, CommProfile, DataOrigin, RiskLevel } from '../types/domain'
import { COMMS } from './config'
import { hash01 } from './random'
import { fmtClock, fmtDuration } from './text'

export interface SendInput {
  astronautId: string | null
  kind: CommMessage['kind']
  title: string
  body: string
  recommendationId?: string
  alertId?: string
}

/** What the ground reply needs to know about the request (the engine resolves names and levels). */
export interface ReplyContext {
  callsign: string | null
  level: RiskLevel | null
  topic: string | null
}

export interface CommEvent {
  kind: 'SENT' | 'DELIVERED'
  message: CommMessage
}

interface PendingReply {
  request: CommMessage
  sendAt: number
}

export function oneWayMs(profile: CommProfile): number {
  return Math.round(profile.oneWayDelaySec * 1000)
}

/** Seeded Earth review time for a request (ms). */
export function reviewMs(seed: number, requestId: string): number {
  const u = hash01(seed, 'review', requestId)
  return Math.round((COMMS.reviewMinMin + (COMMS.reviewMaxMin - COMMS.reviewMinMin) * u) * 60) * 1000
}

/** Short, non-prescriptive simulated flight surgeon reply. */
export function groundReplyText(req: CommMessage, ctx: ReplyContext, receivedAt: number): { title: string; body: string } {
  const who = ctx.callsign ?? 'the crew'
  const recheck = COMMS.recheckMin[ctx.level ?? 'MODERATE']
  const about = ctx.topic ? ` about "${ctx.topic}"` : ''
  const what = req.kind === 'HEALTH_PACKET' ? 'health packet' : 'consult request'
  let title: string
  let middle: string
  if (ctx.level === 'CRITICAL' || ctx.level === 'HIGH') {
    title = `Flight surgeon (simulated): received, continue onboard protocol for ${who}`
    middle =
      `We reviewed the ${what}${about} received at ${fmtClock(receivedAt)}. Keep ${who} at rest, continue the onboard assessment ` +
      `protocol led by the crew medical officer, and re-check vital signs in ${recheck} min. Send a new health packet right away if anything changes.`
  } else {
    title = `Flight surgeon (simulated): received, keep monitoring ${who}`
    middle =
      `We reviewed the ${what}${about} received at ${fmtClock(receivedAt)}. Continue the current onboard plan and re-check in ${recheck} min. ` +
      'Send a new health packet if the trend continues.'
  }
  return {
    title,
    body: `${middle} This is a simulated ground reply for the demo, not medical advice; follow your crew medical procedures.`,
  }
}

export class CommManager {
  messages: CommMessage[] = []
  private readonly pending: PendingReply[] = []
  private readonly packetAlerts = new Set<string>()
  private seq = 0
  private readonly seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  /** True once an automatic packet was sent for this alert. */
  hasPacketFor(alertId: string): boolean {
    return this.packetAlerts.has(alertId)
  }

  markPacketFor(alertId: string): void {
    this.packetAlerts.add(alertId)
  }

  private push(m: CommMessage): void {
    // Newest first by sentAt (a late processed reply can carry an earlier sentAt).
    const next = [m, ...this.messages].sort((a, b) => b.sentAt - a.sentAt)
    this.messages = next.length > COMMS.maxMessages ? next.slice(0, COMMS.maxMessages) : next
  }

  /** Queue a DOWNLINK. Returns the new message. */
  send(input: SendInput, now: number, profile: CommProfile, origin: DataOrigin): CommMessage {
    const m: CommMessage = {
      id: `COM-${++this.seq}`,
      direction: 'DOWNLINK',
      astronautId: input.astronautId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      sentAt: now,
      arrivesAt: now + oneWayMs(profile),
      status: 'IN_TRANSIT',
      relatedRecommendationId: input.recommendationId ?? null,
      relatedAlertId: input.alertId ?? null,
      data_origin: origin,
    }
    this.push(m)
    return m
  }

  /**
   * Deliver due messages and emit due ground replies, in time order, up to `now`.
   * `reply(req)` resolves the reply context. Returns the events (for the audit trail).
   */
  process(now: number, profile: CommProfile, reply: (req: CommMessage) => ReplyContext): CommEvent[] {
    const events: CommEvent[] = []
    // Loop because a delivery can schedule a reply that is itself due before `now`.
    for (let guard = 0; guard < 50; guard++) {
      let progressed = false
      // 1) Deliveries, oldest first.
      const due = this.messages.filter((m) => m.status === 'IN_TRANSIT' && m.arrivesAt <= now).sort((a, b) => a.arrivesAt - b.arrivesAt)
      if (due.length) {
        const ids = new Set(due.map((m) => m.id))
        const delivered = new Map<string, CommMessage>()
        this.messages = this.messages.map((m) => {
          if (!ids.has(m.id)) return m
          const d: CommMessage = { ...m, status: 'DELIVERED' }
          delivered.set(m.id, d)
          return d
        })
        for (const m of due) {
          const d = delivered.get(m.id)!
          events.push({ kind: 'DELIVERED', message: d })
          if (d.direction === 'DOWNLINK' && (COMMS.replyTo as readonly string[]).includes(d.kind)) {
            this.pending.push({ request: d, sendAt: d.arrivesAt + reviewMs(this.seed, d.id) })
          }
        }
        progressed = true
      }
      // 2) Ground replies whose review is done: Earth sends them now (with the current delay).
      this.pending.sort((a, b) => a.sendAt - b.sendAt)
      while (this.pending.length && this.pending[0]!.sendAt <= now) {
        const p = this.pending.shift()!
        const ctx = reply(p.request)
        const text = groundReplyText(p.request, ctx, p.request.arrivesAt)
        const m: CommMessage = {
          id: `COM-${++this.seq}`,
          direction: 'UPLINK',
          astronautId: p.request.astronautId,
          kind: 'GROUND_REPLY',
          title: text.title,
          body: text.body,
          sentAt: p.sendAt,
          arrivesAt: p.sendAt + oneWayMs(profile),
          status: 'IN_TRANSIT',
          relatedRecommendationId: p.request.relatedRecommendationId,
          relatedAlertId: p.request.relatedAlertId,
          data_origin: 'SIMULATED',
        }
        this.push(m)
        events.push({ kind: 'SENT', message: m })
        progressed = true
      }
      if (!progressed) break
    }
    return events
  }
}

/** Plain-language delay phrase, e.g. "about 22 min each way". */
export function delayPhrase(profile: CommProfile): string {
  return profile.oneWayDelaySec < 60 ? `about ${profile.oneWayDelaySec} s each way` : `about ${fmtDuration(profile.oneWayDelaySec * 1000)} each way`
}
