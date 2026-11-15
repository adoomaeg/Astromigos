import clsx from 'clsx'
import { ArrowDownLeft, ArrowUpRight, Check, Earth, Inbox, Send, Stethoscope, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../state/store'
import type { AppState, CommMessage, CommProfileId } from '../../types/domain'
import { METRIC_CATALOG, VITAL_METRICS } from '../../engine/catalog'
import { STATUS_META } from '../../lib/status'
import { Badge, Button, Drawer, SectionLabel } from '../../components/ui'
import { fmtMetric, formatUtcTime, relTime } from '../../components/format'
import { COMM_KIND_LABEL, PROFILE_SHORT, delayMeaning, formatCountdown, formatDelay, isInTransit, useCommsUi } from './delay'

/** Plain text body of a health packet for one astronaut (current state snapshot). */
function healthPacketBody(s: AppState, astronautId: string): string {
  const a = s.crew.find((c) => c.id === astronautId)
  const h = s.health[astronautId]
  if (!a || !h) return 'No health data available.'
  const vitals = VITAL_METRICS.map((m) => {
    const ms = h.metrics[m]
    const def = METRIC_CATALOG[m]
    return `${def.shortLabel} ${ms?.current == null ? 'no data' : `${fmtMetric(m, ms.current)} ${def.unit}`}`
  }).join(', ')
  const factors = h.risk.contributing_factors
    .slice(0, 3)
    .map((f) => f.label)
    .join('; ')
  return [`${a.callsign} (${a.roleShort}). Status: ${STATUS_META[h.risk.risk_level].label}.`, h.risk.headline, `Vitals: ${vitals}.`, factors ? `Factors: ${factors}.` : '', 'Simulated data. Decision support only.']
    .filter(Boolean)
    .join('\n')
}

function consultBody(s: AppState, astronautId: string): { body: string; recommendationId?: string; alertId?: string } {
  const a = s.crew.find((c) => c.id === astronautId)
  const h = s.health[astronautId]
  const rec = s.recommendations
    .filter((r) => r.astronautId === astronautId && r.status === 'PENDING' && r.active !== false)
    .sort((x, y) => STATUS_META[y.priority].rank - STATUS_META[x.priority].rank || y.createdAt - x.createdAt)[0]
  const alert = s.alerts.filter((al) => al.astronautId === astronautId && al.acknowledgedAt == null && al.resolvedAt == null).sort((x, y) => y.createdAt - x.createdAt)[0]
  const lines = [
    `Flight surgeon review requested for ${a?.callsign ?? astronautId}.`,
    h ? `Current status: ${STATUS_META[h.risk.risk_level].label}. ${h.risk.headline}` : '',
    rec ? `Open recommendation: ${rec.title}. ${rec.rationale}` : 'No open recommendation.',
    alert ? `Open alert: ${alert.title}.` : '',
    'Simulated data. Decision support only, not a diagnosis.',
  ]
  return { body: lines.filter(Boolean).join('\n'), recommendationId: rec?.id, alertId: alert?.id }
}

function MessageItem({ m, now, callsign }: { m: CommMessage; now: number; callsign: (id: string | null) => string }) {
  const [expanded, setExpanded] = useState(false)
  const transit = isInTransit(m, now)
  const uplink = m.direction === 'UPLINK'
  const reply = m.kind === 'GROUND_REPLY'
  const total = Math.max(1, m.arrivesAt - m.sentAt)
  const pct = transit ? Math.min(100, Math.max(0, ((now - m.sentAt) / total) * 100)) : 100
  const Icon = uplink ? ArrowDownLeft : ArrowUpRight
  return (
    <li
      className={clsx(
        'rounded-xl p-3 ring-1',
        reply && !transit ? 'bg-accent/[0.06] ring-accent/25' : transit ? 'bg-white/[0.04] ring-white/[0.08]' : 'bg-white/[0.025] ring-white/[0.05]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase', uplink ? 'text-accent' : 'text-ink-300')}>
          <Icon size={12} aria-hidden />
          {uplink ? 'From Earth' : 'To Earth'} · {COMM_KIND_LABEL[m.kind]}
        </span>
        {m.data_origin === 'SIMULATED' && <Badge tone="sim">Simulated</Badge>}
      </div>
      <div className="mt-1 text-[11px] font-semibold tracking-wide text-ink-500">{callsign(m.astronautId)}</div>
      <div className={clsx('mt-0.5 text-[13.5px] leading-snug font-semibold', transit || reply ? 'text-ink-100' : 'text-ink-300')}>{m.title}</div>
      {m.body && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={clsx('focus-ring mt-1 w-full rounded text-left text-xs leading-relaxed whitespace-pre-line text-ink-300', expanded ? 'block' : 'line-clamp-2')}
          title={expanded ? 'Show less' : 'Show full message'}
        >
          {m.body}
        </button>
      )}
      {transit ? (
        <div className="mt-2.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Transit progress">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="tabular mt-1.5 flex items-center justify-between text-[11px] text-ink-500">
            <span>Sent {formatUtcTime(m.sentAt, false)} UTC</span>
            <span className="inline-flex items-center gap-1 font-semibold text-ink-300">
              <Timer size={11} aria-hidden /> Arrives in {formatCountdown(m.arrivesAt - now)}
            </span>
          </div>
        </div>
      ) : (
        <div className="tabular mt-1.5 flex items-center gap-1 text-[11px] text-ink-500">
          <Check size={12} aria-hidden /> Delivered {formatUtcTime(m.arrivesAt, false)} UTC · {relTime(m.arrivesAt, now)}
        </div>
      )}
    </li>
  )
}

function CommsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profiles, profileId, comms, crew, selectedId, setCommProfile } = useAppStore(
    useShallow((s) => ({
      profiles: s.commProfiles,
      profileId: s.commProfileId,
      comms: s.comms,
      crew: s.crew,
      selectedId: s.selectedAstronautId,
      setCommProfile: s.setCommProfile,
    })),
  )
  const now = useAppStore((s) => Math.floor(s.clock.simNow / 1000) * 1000)
  const [sent, setSent] = useState<{ text: string; ok: boolean } | null>(null)
  const profile = profiles.find((p) => p.id === profileId) ?? profiles[0]
  const astronaut = crew.find((c) => c.id === selectedId)
  const callsign = useMemo(() => {
    const map = new Map(crew.map((c) => [c.id, c.callsign]))
    return (id: string | null) => (id ? (map.get(id) ?? id) : 'Whole crew')
  }, [crew])
  const { transit, delivered } = useMemo(() => {
    const sorted = [...comms].sort((a, b) => b.sentAt - a.sentAt)
    return { transit: sorted.filter((m) => isInTransit(m, now)).sort((a, b) => a.arrivesAt - b.arrivesAt), delivered: sorted.filter((m) => !isInTransit(m, now)).sort((a, b) => b.arrivesAt - a.arrivesAt) }
  }, [comms, now])

  const send = (kind: 'HEALTH_PACKET' | 'CONSULT_REQUEST') => {
    if (!astronaut) return
    const s = useAppStore.getState()
    let id = ''
    if (kind === 'HEALTH_PACKET') {
      id = s.sendToGround({ astronautId: astronaut.id, kind, title: `Health packet: ${astronaut.callsign}`, body: healthPacketBody(s, astronaut.id) })
    } else {
      const c = consultBody(s, astronaut.id)
      id = s.sendToGround({ astronautId: astronaut.id, kind, title: `Flight surgeon consult: ${astronaut.callsign}`, body: c.body, recommendationId: c.recommendationId, alertId: c.alertId })
    }
    const delay = profile ? profile.oneWayDelaySec : 0
    setSent(
      id
        ? { ok: true, text: `${kind === 'HEALTH_PACKET' ? 'Health packet' : 'Consult request'} queued. Reaches Earth in about ${formatDelay(delay)}${kind === 'CONSULT_REQUEST' ? `, a reply needs at least ${formatDelay(delay * 2)}` : ''} (sim time).` }
        : { ok: false, text: 'The Earth link did not accept the message in this build. Try again later.' },
    )
  }

  return (
    <Drawer
      open={open}
      onClose={() => {
        setSent(null)
        onClose()
      }}
      title="Earth link"
      icon={<Earth size={17} className="text-accent" aria-hidden />}
      footer={<p className="text-[11px] leading-relaxed text-ink-500">Simulated link. Delays are approximate light time; ground replies are simulated. Decision support only.</p>}
    >
      <SectionLabel>Distance from Earth</SectionLabel>
      <div role="radiogroup" aria-label="Communication profile" className="mt-2 grid grid-cols-2 gap-2">
        {profiles.map((p) => {
          const on = p.id === profileId
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setCommProfile(p.id as CommProfileId)}
              className={clsx(
                'focus-ring rounded-xl px-3 py-2.5 text-left transition-colors',
                on ? 'bg-accent/10 ring-1 ring-accent/40' : 'bg-white/[0.03] ring-1 ring-white/[0.06] hover:bg-white/[0.06]',
              )}
            >
              <div className={clsx('text-[13px] font-semibold', on ? 'text-accent' : 'text-ink-100')}>{p.label}</div>
              <div className="tabular mt-0.5 text-[11px] text-ink-500">
                {formatDelay(p.oneWayDelaySec)} one way · {formatDelay(p.oneWayDelaySec * 2)} round trip
              </div>
            </button>
          )
        })}
      </div>
      {profile && (
        <div className="mt-3 flex gap-2.5 rounded-xl bg-white/[0.035] p-3 ring-1 ring-white/[0.06]">
          <Timer size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <div>
            <p className="text-[13px] leading-snug font-semibold text-ink-100">{delayMeaning(profile)}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">{profile.description}</p>
          </div>
        </div>
      )}

      <SectionLabel className="mt-6" right={astronaut ? <span className="text-[11px] font-semibold tracking-wide text-ink-300">{astronaut.callsign}</span> : null}>
        Send to ground
      </SectionLabel>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <Button variant="ghost" className="justify-start py-2.5" onClick={() => send('HEALTH_PACKET')} disabled={!astronaut}>
          <Send size={14} aria-hidden /> Send health packet
        </Button>
        <Button variant="ghost" className="justify-start py-2.5" onClick={() => send('CONSULT_REQUEST')} disabled={!astronaut}>
          <Stethoscope size={14} aria-hidden /> Request flight surgeon consult
        </Button>
      </div>
      {sent && (
        <div
          role="status"
          className={clsx('animate-fade-in mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ring-1', sent.ok ? 'bg-accent/[0.07] text-ink-100 ring-accent/25' : 'bg-white/[0.04] text-ink-300 ring-white/10')}
        >
          {sent.ok ? <Check size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden /> : <Inbox size={13} className="mt-0.5 shrink-0" aria-hidden />}
          {sent.text}
        </div>
      )}

      <SectionLabel className="mt-6" right={<span className="tabular text-[11px] text-ink-500">{transit.length}</span>}>
        In transit
      </SectionLabel>
      {transit.length === 0 ? (
        <div className="mt-2 rounded-xl bg-white/[0.025] px-3 py-2.5 text-[13px] text-ink-500 ring-1 ring-white/[0.05]">Nothing on the way right now.</div>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {transit.map((m) => (
            <MessageItem key={m.id} m={m} now={now} callsign={callsign} />
          ))}
        </ul>
      )}

      <SectionLabel className="mt-6" right={<span className="tabular text-[11px] text-ink-500">{delivered.length}</span>}>
        Delivered
      </SectionLabel>
      {delivered.length === 0 ? (
        <div className="mt-2 rounded-xl bg-white/[0.025] px-3 py-2.5 text-[13px] text-ink-500 ring-1 ring-white/[0.05]">No messages yet. Health packets and consult requests you send appear here.</div>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {delivered.slice(0, 30).map((m) => (
            <MessageItem key={m.id} m={m} now={now} callsign={callsign} />
          ))}
        </ul>
      )}
    </Drawer>
  )
}

/** Top bar control: Earth link profile (ISS, Moon, Mars), delay and message queue. Opens its own drawer. */
export function CommsIndicator() {
  const open = useCommsUi((s) => s.open)
  const setOpen = useCommsUi((s) => s.setOpen)
  const { profileId, delaySec } = useAppStore(
    useShallow((s) => ({ profileId: s.commProfileId, delaySec: s.commProfiles.find((p) => p.id === s.commProfileId)?.oneWayDelaySec ?? 0 })),
  )
  const inTransit = useAppStore((s) => {
    let n = 0
    for (const m of s.comms) if (isInTransit(m, s.clock.simNow)) n++
    return n
  })
  const unreadReply = useAppStore((s) => s.comms.some((m) => m.kind === 'GROUND_REPLY' && !isInTransit(m, s.clock.simNow) && s.clock.simNow - m.arrivesAt < 30 * 60000))
  const label = `${PROFILE_SHORT[profileId]} ${formatDelay(delaySec)}`
  return (
    <>
      <button
        type="button"
        data-tour="comms"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Earth link: ${PROFILE_SHORT[profileId]}, ${formatDelay(delaySec)} one way delay${inTransit ? `, ${inTransit} message${inTransit === 1 ? '' : 's'} in transit` : ''}`}
        title="Earth link: delay and messages to Mission Control"
        className="focus-ring relative flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-300 ring-1 ring-white/[0.07] transition-colors hover:bg-white/[0.05] hover:text-ink-100"
      >
        <Earth size={14} className="text-accent" aria-hidden />
        <span className="tabular whitespace-nowrap">{label}</span>
        {inTransit > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-accent/10 py-px pr-1.5 pl-1 text-[10px] font-bold text-accent ring-1 ring-accent/25" aria-hidden>
            <span className="animate-breathe h-1.5 w-1.5 rounded-full bg-accent" />
            {inTransit}
          </span>
        )}
        {unreadReply && inTransit === 0 && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent ring-2 ring-space-900" aria-hidden />}
      </button>
      {/* Portaled: the top bar uses backdrop-filter, which would trap a fixed drawer inside it. */}
      {open && createPortal(<CommsDrawer open onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
