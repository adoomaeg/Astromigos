import { Check, FileJson, FileText, Printer, RefreshCw, Send } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../state/store'
import { STATUS_META } from '../../lib/status'
import { METRIC_CATALOG, REGION_LABELS } from '../../engine/catalog'
import type { Alert, AppState, Astronaut, CheckIn, CommMessage, CommProfile, ContributingFactor, Intervention, Prediction, Recommendation, Status } from '../../types/domain'
import { StatusIcon } from '../../components/Status'
import { Button } from '../../components/ui'
import { formatHours, formatMET, formatUtcDate, formatUtcTime } from '../../components/format'
import { buildFhirBundle, downloadJson } from '../../lib/fhir'
import { Modal, TOPBAR_BUTTON } from '../mission/Modal'
import { MENU_ITEM, MenuRow } from '../topbar/menu'
import { COMM_KIND_LABEL, formatDelay } from '../comms/delay'
import { INTERVENTION_LABEL } from '../timeline/labels'

const H = 3600000
const WINDOW_H = 24
const PRIORITY_LABEL: Record<Recommendation['priority'], string> = { LOW: 'Low', MODERATE: 'Medium', HIGH: 'High', CRITICAL: 'Urgent' }
const AUDIENCE_LABEL: Record<Recommendation['audience'], string> = { CREW: 'Crew', FLIGHT_SURGEON: 'Flight surgeon', MISSION_CONTROL: 'Mission control' }
const PHASE_LABEL = { PRE_FLIGHT: 'Pre-flight', IN_FLIGHT: 'In flight', POST_FLIGHT: 'Post-flight' } as const

const SCALE_WORDS = {
  mood: ['very low', 'low', 'okay', 'good', 'very good'],
  fatigue: ['rested', 'slightly tired', 'tired', 'very tired', 'exhausted'],
  stress: ['calm', 'a little', 'moderate', 'high', 'very high'],
  sleepQuality: ['very poor', 'poor', 'fair', 'good', 'very good'],
} as const

interface CrewSection {
  astronaut: Astronaut
  status: Status
  headline: string
  factors: ContributingFactor[]
  confidence: number | null
  alerts: Alert[]
  interventions: Intervention[]
  checkIns: CheckIn[]
  pending: Recommendation[]
  forecasts: Prediction[]
}

interface Snapshot {
  at: number
  from: number
  state: AppState
  profile: CommProfile | undefined
  crew: CrewSection[]
  cabin: { status: Status; headline: string; alerts: Alert[]; forecasts: Prediction[]; pending: Recommendation[] }
  comms: CommMessage[]
}

function notableForecasts(preds: Partial<Record<string, Prediction>> | undefined): Prediction[] {
  return Object.values(preds ?? {})
    .filter((p): p is Prediction => !!p && p.eligible && p.hoursToBandExit != null)
    .sort((a, b) => (a.hoursToBandExit ?? 0) - (b.hoursToBandExit ?? 0))
}

function buildSnapshot(s: AppState): Snapshot {
  const at = s.clock.simNow
  const from = at - WINDOW_H * H
  const inWindow = (t: number) => t >= from && t <= at
  const byTimeDesc = <T,>(arr: T[], key: (x: T) => number) => [...arr].sort((a, b) => key(b) - key(a))
  const pendingFor = (id: string) =>
    s.recommendations
      .filter((r) => r.astronautId === id && r.status === 'PENDING' && r.active !== false)
      .sort((a, b) => STATUS_META[b.priority].rank - STATUS_META[a.priority].rank || b.createdAt - a.createdAt)
  const crew: CrewSection[] = s.crew.map((c) => {
    const h = s.health[c.id]
    const lost = !h || (h.metrics.HEART_RATE?.current == null && h.metrics.SPO2?.current == null)
    const level: Status = !h ? 'NO_DATA' : lost && h.risk.risk_level === 'LOW' ? 'NO_DATA' : h.risk.risk_level
    return {
      astronaut: c,
      status: level,
      headline: h ? (lost ? 'No live readings from the wearable. Missing data is never treated as normal.' : h.risk.headline) : 'No health data available.',
      factors: [...(h?.risk.contributing_factors ?? [])].sort((a, b) => b.weight - a.weight).slice(0, 3),
      confidence: h ? h.risk.confidence : null,
      alerts: byTimeDesc(
        s.alerts.filter((a) => a.astronautId === c.id && (inWindow(a.createdAt) || (a.acknowledgedAt == null && a.resolvedAt == null))),
        (a) => a.createdAt,
      ),
      interventions: byTimeDesc(
        s.interventions.filter((i) => i.astronautId === c.id && inWindow(i.loggedAt)),
        (i) => i.loggedAt,
      ),
      checkIns: byTimeDesc(
        s.checkIns.filter((k) => k.astronautId === c.id && inWindow(k.at)),
        (k) => k.at,
      ),
      pending: pendingFor(c.id),
      forecasts: notableForecasts(h?.predictions),
    }
  })
  return {
    at,
    from,
    state: s,
    profile: s.commProfiles.find((p) => p.id === s.commProfileId),
    crew,
    cabin: {
      status: s.environment.status,
      headline: s.environment.headline ?? 'Cabin environment summary not available.',
      alerts: byTimeDesc(
        s.alerts.filter((a) => a.astronautId == null && (inWindow(a.createdAt) || (a.acknowledgedAt == null && a.resolvedAt == null))),
        (a) => a.createdAt,
      ),
      forecasts: notableForecasts(s.environment.predictions),
      pending: pendingFor('CABIN'),
    },
    comms: byTimeDesc(
      s.comms.filter((m) => inWindow(m.sentAt) || inWindow(m.arrivesAt)),
      (m) => m.sentAt,
    ),
  }
}

function stamp(t: number): string {
  return `${formatUtcDate(t)} ${formatUtcTime(t, false)} UTC`
}

function alertState(a: Alert, at: number): string {
  if (a.acknowledgedAt != null) return `acknowledged by ${a.acknowledgedBy ?? 'crew'} at ${formatUtcTime(a.acknowledgedAt, false)}`
  if (a.resolvedAt != null && a.resolvedAt <= at) return `resolved at ${formatUtcTime(a.resolvedAt, false)}`
  return a.escalatedAt != null ? 'open, escalated' : 'open, not acknowledged'
}

function alertWhere(a: Alert): string {
  if (a.metric) return METRIC_CATALOG[a.metric].label
  if (a.region === 'environment') return 'Cabin environment'
  if (a.region) return REGION_LABELS[a.region].label
  return ''
}

function checkInText(k: CheckIn): string {
  const w = (key: keyof typeof SCALE_WORDS, v: number) => SCALE_WORDS[key][Math.min(5, Math.max(1, Math.round(v))) - 1]
  const sym = k.symptoms.filter((x) => x !== 'none')
  return `mood ${w('mood', k.mood)}, fatigue ${w('fatigue', k.fatigue)}, stress ${w('stress', k.stress)}, sleep ${w('sleepQuality', k.sleepQuality)}; symptoms: ${sym.length ? sym.join(', ') : 'none'}${k.note ? `; note: "${k.note}"` : ''}`
}

function forecastText(p: Prediction): string {
  return `${METRIC_CATALOG[p.metric].label} projected to leave the personal normal range in ${formatHours(p.hoursToBandExit!)} (${p.method}, ${p.intervalLabel})`
}

/** Plain text version sent to ground (kept short: Earth link bandwidth). */
function reportText(snap: Snapshot): string {
  const s = snap.state
  const lines: string[] = [
    `SHIFT HANDOVER REPORT (SIMULATED DATA)`,
    `${s.mission.name}, ${s.mission.vehicle}. Period ${stamp(snap.from)} to ${stamp(snap.at)}. MET ${formatMET(s.mission.startedAt, snap.at)}.`,
    '',
  ]
  for (const c of snap.crew) {
    lines.push(`${c.astronaut.callsign} (${c.astronaut.roleShort}): ${STATUS_META[c.status].label}. ${c.headline}`)
    if (c.factors.length) lines.push(`  Factors: ${c.factors.map((f) => f.label).join('; ')}`)
    const open = c.alerts.filter((a) => a.acknowledgedAt == null && a.resolvedAt == null)
    lines.push(`  Alerts 24 h: ${c.alerts.length} (${open.length} open). Actions logged: ${c.interventions.length}. Pending recommendations: ${c.pending.length}.`)
    for (const p of c.forecasts.slice(0, 2)) lines.push(`  Forecast: ${forecastText(p)}`)
  }
  lines.push(`Cabin: ${STATUS_META[snap.cabin.status].label}. ${snap.cabin.headline}`)
  lines.push('', 'Decision support only. Not a diagnosis. Demo configuration, not official limits.')
  return lines.join('\n')
}

function StatusChip({ status }: { status: Status }) {
  return (
    <span className="rp-status">
      <StatusIcon status={status} size={12} />
      {STATUS_META[status].crewLabel} · {STATUS_META[status].label}
    </span>
  )
}

function Empty({ children }: { children: string }) {
  return <p className="rp-empty">{children}</p>
}

function CrewBlock({ c, at }: { c: CrewSection; at: number }) {
  return (
    <section className="rp-section">
      <div className="rp-crew-head">
        <h3 className="rp-h3">
          <span className="rp-dot" style={{ background: c.astronaut.color }} aria-hidden />
          {c.astronaut.callsign} <span className="rp-muted">· {c.astronaut.role}</span>
        </h3>
        <StatusChip status={c.status} />
      </div>
      <p className="rp-headline">{c.headline}</p>
      <div className="rp-grid">
        <div>
          <h4 className="rp-h4">Top contributing factors</h4>
          {c.factors.length ? (
            <ul className="rp-list">
              {c.factors.map((f) => (
                <li key={f.label}>{f.label}</li>
              ))}
            </ul>
          ) : (
            <Empty>None. Readings within the personal normal ranges.</Empty>
          )}
          {c.confidence != null && c.confidence < 0.7 && <p className="rp-note">Lower confidence ({Math.round(c.confidence * 100)}%): some data is missing or questionable.</p>}
        </div>
        <div>
          <h4 className="rp-h4">Notable forecasts</h4>
          {c.forecasts.length ? (
            <ul className="rp-list">
              {c.forecasts.slice(0, 3).map((p) => (
                <li key={p.metric}>{forecastText(p)}</li>
              ))}
            </ul>
          ) : (
            <Empty>No metric projected to leave its normal range.</Empty>
          )}
        </div>
      </div>
      <h4 className="rp-h4">Alerts</h4>
      {c.alerts.length ? (
        <table className="rp-table">
          <tbody>
            {c.alerts.slice(0, 8).map((a) => (
              <tr key={a.id}>
                <td className="rp-time tabular">{formatUtcTime(a.createdAt, false)}</td>
                <td className="rp-sev">
                  <StatusIcon status={a.severity} size={11} /> {STATUS_META[a.severity].label}
                </td>
                <td>
                  {a.title}
                  {alertWhere(a) && <span className="rp-muted"> · {alertWhere(a)}</span>}
                </td>
                <td className="rp-muted">{alertState(a, at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty>No alerts in the last 24 h.</Empty>
      )}
      {c.alerts.length > 8 && <p className="rp-note">and {c.alerts.length - 8} more.</p>}
      <div className="rp-grid">
        <div>
          <h4 className="rp-h4">Actions logged</h4>
          {c.interventions.length ? (
            <ul className="rp-list">
              {c.interventions.map((i) => (
                <li key={i.id}>
                  <span className="tabular rp-muted">{formatUtcTime(i.loggedAt, false)}</span> {INTERVENTION_LABEL[i.kind]} by {i.actor}
                  {i.note ? `: ${i.note}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>None in the last 24 h.</Empty>
          )}
        </div>
        <div>
          <h4 className="rp-h4">Check-ins</h4>
          {c.checkIns.length ? (
            <ul className="rp-list">
              {c.checkIns.map((k) => (
                <li key={k.id}>
                  <span className="tabular rp-muted">{formatUtcTime(k.at, false)}</span> {checkInText(k)} <span className="rp-muted">({k.data_origin === 'MANUAL' ? 'typed by crew' : 'simulated'})</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No check-in in the last 24 h.</Empty>
          )}
        </div>
      </div>
      <h4 className="rp-h4">Pending recommendations</h4>
      {c.pending.length ? (
        <ul className="rp-list">
          {c.pending.map((r) => (
            <li key={r.id}>
              <strong>{r.title}</strong>{' '}
              <span className="rp-muted">
                ({PRIORITY_LABEL[r.priority]} priority, {AUDIENCE_LABEL[r.audience]}
                {r.requiresHumanReview ? ', needs flight surgeon review' : ''}
                {r.autonomy === 'GROUND_REVIEW' ? ', ground review' : r.autonomy === 'ONBOARD' ? ', on board' : ''})
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No pending recommendations.</Empty>
      )}
    </section>
  )
}

const REPORT_CSS = `
.ahi-report { --rp-fg:#e8eefc; --rp-soft:#a9b6cf; --rp-muted:#7d8ba6; --rp-line:rgba(255,255,255,0.08); --rp-card:rgba(255,255,255,0.03); color:var(--rp-fg); font-size:13px; line-height:1.5; }
.ahi-report .rp-h1 { font-size:20px; font-weight:700; letter-spacing:0.01em; margin:0; }
.ahi-report .rp-h2 { font-size:11px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:var(--rp-muted); margin:22px 0 8px; }
.ahi-report .rp-h3 { font-size:15px; font-weight:600; margin:0; display:flex; align-items:center; gap:8px; }
.ahi-report .rp-h4 { font-size:10.5px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--rp-muted); margin:12px 0 4px; }
.ahi-report .rp-muted { color:var(--rp-muted); font-weight:400; }
.ahi-report .rp-dot { width:9px; height:9px; border-radius:999px; display:inline-block; }
.ahi-report .rp-meta { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px 18px; margin-top:12px; padding:12px 14px; border-radius:12px; background:var(--rp-card); border:1px solid var(--rp-line); }
.ahi-report .rp-meta dt { font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--rp-muted); }
.ahi-report .rp-meta dd { margin:2px 0 0; color:var(--rp-fg); font-variant-numeric:tabular-nums; }
.ahi-report .rp-sim { display:inline-block; font-size:10px; font-weight:700; letter-spacing:0.08em; padding:1px 6px; border-radius:6px; color:#ddd6fe; background:rgba(167,139,250,0.12); border:1px solid rgba(196,181,253,0.35); }
.ahi-report .rp-section { margin-top:12px; padding:14px 16px; border-radius:12px; background:var(--rp-card); border:1px solid var(--rp-line); }
.ahi-report .rp-crew-head { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
.ahi-report .rp-headline { margin:6px 0 0; color:var(--rp-soft); }
.ahi-report .rp-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 24px; }
.ahi-report .rp-list { margin:0; padding-left:16px; color:var(--rp-soft); list-style:disc; }
.ahi-report .rp-list li::marker { color:var(--rp-muted); }
.ahi-report .rp-list li { margin:2px 0; }
.ahi-report .rp-list strong { color:var(--rp-fg); font-weight:600; }
.ahi-report .rp-empty { margin:0; color:var(--rp-muted); font-size:12px; }
.ahi-report .rp-note { margin:4px 0 0; color:var(--rp-muted); font-size:11.5px; }
.ahi-report .rp-status { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; padding:2px 10px; border-radius:999px; border:1px solid var(--rp-line); background:rgba(255,255,255,0.04); white-space:nowrap; }
.ahi-report .rp-table { width:100%; border-collapse:collapse; font-size:12px; }
.ahi-report .rp-table td, .ahi-report .rp-table th { padding:5px 8px 5px 0; border-bottom:1px solid var(--rp-line); vertical-align:top; text-align:left; }
.ahi-report .rp-table th { font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--rp-muted); }
.ahi-report .rp-table tr:last-child td { border-bottom:0; }
.ahi-report .rp-time { width:48px; color:var(--rp-muted); white-space:nowrap; }
.ahi-report .rp-sev { width:84px; white-space:nowrap; }
.ahi-report svg { display:inline-block; vertical-align:-2px; }
.ahi-report .rp-disclaimer { margin-top:20px; padding:12px 14px; border-radius:12px; border:1px dashed var(--rp-line); color:var(--rp-muted); font-size:11.5px; }
.ahi-report .rp-disclaimer p { margin:2px 0; }
@media (max-width: 640px) { .ahi-report .rp-grid { grid-template-columns:1fr; } }
@media print {
  @page { margin: 14mm; }
  html:has(.ahi-print-host), html:has(.ahi-print-host) body, html:has(.ahi-print-host) #root { height:auto !important; overflow:visible !important; background:#fff !important; }
  body:has(.ahi-print-host) > *:not(.ahi-print-host) { display:none !important; }
  .ahi-print-host { position:static !important; display:block !important; padding:0 !important; }
  .ahi-print-host .ahi-modal-scrim, .ahi-print-host .ahi-no-print { display:none !important; }
  .ahi-print-host .ahi-modal-panel { position:static !important; max-width:none !important; max-height:none !important; border:0 !important; box-shadow:none !important; background:#fff !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important; animation:none !important; border-radius:0 !important; }
  .ahi-print-host .ahi-modal-body { overflow:visible !important; padding:0 !important; }
  .ahi-report { --rp-fg:#0f172a; --rp-soft:#1f2937; --rp-muted:#4b5563; --rp-line:#d1d5db; --rp-card:#fff; font-size:11.5px; }
  .ahi-report .rp-section { break-inside:avoid; page-break-inside:avoid; }
  .ahi-report .rp-sim { color:#4c1d95; background:#fff; border-color:#7c3aed; }
  .ahi-report .rp-status { background:#fff; color:#0f172a; }
  .ahi-report * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}
`

function ReportDocument({ snap }: { snap: Snapshot }) {
  const s = snap.state
  const p = snap.profile
  return (
    <article className="ahi-report" aria-label="Shift handover report">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="rp-h1">Shift handover report</h1>
            <div className="rp-muted">
              {s.mission.name} · {s.mission.vehicle} · {PHASE_LABEL[s.mission.phase]}
            </div>
          </div>
          <span className="rp-sim">SIMULATED DATA</span>
        </div>
        <dl className="rp-meta">
          <div>
            <dt>Period (sim)</dt>
            <dd>
              {formatUtcDate(snap.from).replace(/ \d{4}$/, '')} {formatUtcTime(snap.from, false)} to {formatUtcDate(snap.at).replace(/ \d{4}$/, '')} {formatUtcTime(snap.at, false)} UTC
            </dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>
              {stamp(snap.at)} · MET {formatMET(s.mission.startedAt, snap.at)}
            </dd>
          </div>
          <div>
            <dt>Earth link</dt>
            <dd>{p ? `${p.label}, ${formatDelay(p.oneWayDelaySec)} one way` : 'Unknown'}</dd>
          </div>
          <div>
            <dt>Scenario</dt>
            <dd>{s.scenarios.find((x) => x.id === s.clock.scenarioId)?.name ?? s.clock.scenarioId}</dd>
          </div>
        </dl>
      </header>

      <h2 className="rp-h2">Crew at a glance</h2>
      <table className="rp-table">
        <thead>
          <tr>
            <th>Crew</th>
            <th>Status</th>
            <th>Summary</th>
            <th style={{ textAlign: 'right' }}>Open alerts</th>
            <th style={{ textAlign: 'right' }}>To do</th>
          </tr>
        </thead>
        <tbody>
          {snap.crew.map((c) => (
            <tr key={c.astronaut.id}>
              <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                {c.astronaut.callsign} <span className="rp-muted">{c.astronaut.roleShort}</span>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <StatusIcon status={c.status} size={12} /> {STATUS_META[c.status].label}
              </td>
              <td className="rp-muted">{c.headline}</td>
              <td className="tabular" style={{ textAlign: 'right' }}>
                {c.alerts.filter((a) => a.acknowledgedAt == null && a.resolvedAt == null).length}
              </td>
              <td className="tabular" style={{ textAlign: 'right' }}>
                {c.pending.length}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ fontWeight: 600 }}>Cabin</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              <StatusIcon status={snap.cabin.status} size={12} /> {STATUS_META[snap.cabin.status].label}
            </td>
            <td className="rp-muted">{snap.cabin.headline}</td>
            <td className="tabular" style={{ textAlign: 'right' }}>
              {snap.cabin.alerts.filter((a) => a.acknowledgedAt == null && a.resolvedAt == null).length}
            </td>
            <td className="tabular" style={{ textAlign: 'right' }}>
              {snap.cabin.pending.length}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 className="rp-h2">Crew details (last 24 h)</h2>
      {snap.crew.map((c) => (
        <CrewBlock key={c.astronaut.id} c={c} at={snap.at} />
      ))}

      <h2 className="rp-h2">Cabin environment</h2>
      <section className="rp-section">
        <div className="rp-crew-head">
          <h3 className="rp-h3">Cabin</h3>
          <StatusChip status={snap.cabin.status} />
        </div>
        <p className="rp-headline">{snap.cabin.headline}</p>
        <h4 className="rp-h4">Alerts</h4>
        {snap.cabin.alerts.length ? (
          <ul className="rp-list">
            {snap.cabin.alerts.slice(0, 8).map((a) => (
              <li key={a.id}>
                <span className="tabular rp-muted">{formatUtcTime(a.createdAt, false)}</span> {STATUS_META[a.severity].label}: {a.title} <span className="rp-muted">({alertState(a, snap.at)})</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No cabin alerts in the last 24 h.</Empty>
        )}
        {snap.cabin.forecasts.length > 0 && (
          <>
            <h4 className="rp-h4">Notable forecasts</h4>
            <ul className="rp-list">
              {snap.cabin.forecasts.map((f) => (
                <li key={f.metric}>{forecastText(f)}</li>
              ))}
            </ul>
          </>
        )}
        {snap.cabin.pending.length > 0 && (
          <>
            <h4 className="rp-h4">Pending recommendations</h4>
            <ul className="rp-list">
              {snap.cabin.pending.map((r) => (
                <li key={r.id}>
                  <strong>{r.title}</strong> <span className="rp-muted">({PRIORITY_LABEL[r.priority]} priority)</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <h2 className="rp-h2">Earth link (last 24 h)</h2>
      {snap.comms.length ? (
        <table className="rp-table">
          <tbody>
            {snap.comms.slice(0, 12).map((m) => (
              <tr key={m.id}>
                <td className="rp-time tabular">{formatUtcTime(m.sentAt, false)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{m.direction === 'UPLINK' ? 'From Earth' : 'To Earth'}</td>
                <td>
                  {m.title} <span className="rp-muted">· {COMM_KIND_LABEL[m.kind]}</span>
                </td>
                <td className="rp-muted" style={{ whiteSpace: 'nowrap' }}>
                  {m.arrivesAt > snap.at ? `arrives ${formatUtcTime(m.arrivesAt, false)}` : `delivered ${formatUtcTime(m.arrivesAt, false)}`}
                  {m.data_origin === 'SIMULATED' ? ', simulated' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty>No messages exchanged with Earth in the last 24 h.</Empty>
      )}

      <div className="rp-disclaimer">
        <p>
          <strong>Decision support only. Not a diagnosis and not a medical device.</strong> Status comes from each person's own baseline (personal normal range), not from official limits.
        </p>
        <p>All device data in this report is simulated. Fixed thresholds and budgets are demo configuration, not official NASA limits. Review with the crew medical officer and the flight surgeon.</p>
        <p>Model: {s.health[s.crew[0]?.id ?? '']?.risk.model_version ?? 'n/a'}. Crew ids are pseudonymized.</p>
      </div>
    </article>
  )
}

function HandoverModal({ onClose }: { onClose: () => void }) {
  const [snap, setSnap] = useState(() => buildSnapshot(useAppStore.getState()))
  const [notice, setNotice] = useState<string | null>(null)

  const exportFhir = () => {
    const s = snap.state
    const bundle = buildFhirBundle({ mission: s.mission, crew: s.crew, devices: s.devices, health: s.health, environment: s.environment, simNow: snap.at })
    const iso = new Date(snap.at).toISOString().replace(/[:]/g, '').replace(/\.\d+Z$/, 'Z')
    downloadJson(`ahi-fhir-r4-bundle-${iso}.json`, bundle)
    setNotice(`FHIR R4 Bundle downloaded: ${bundle.entry.length} resources (Patient, Device, Observation). Simulated data.`)
  }
  const send = () => {
    const s = useAppStore.getState()
    const id = s.sendToGround({ astronautId: null, kind: 'HANDOVER_REPORT', title: `Shift handover report, ${stamp(snap.at)}`, body: reportText(snap) })
    const p = s.commProfiles.find((x) => x.id === s.commProfileId)
    setNotice(id ? `Report queued for Earth. Arrives in about ${formatDelay(p?.oneWayDelaySec ?? 0)} (sim time).` : 'The Earth link did not accept the report in this build.')
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Shift handover"
      hostClassName="ahi-print-host"
      icon={<FileText size={17} className="text-accent" aria-hidden />}
      subtitle={`Last ${WINDOW_H} sim hours · snapshot at ${formatUtcTime(snap.at, false)} UTC`}
      headerExtra={
        <Button
          variant="subtle"
          onClick={() => {
            setSnap(buildSnapshot(useAppStore.getState()))
            setNotice(null)
          }}
          title="Regenerate the report from the current state"
        >
          <RefreshCw size={13} aria-hidden /> Refresh
        </Button>
      }
      footer={
        <div className="flex flex-col gap-2">
          {notice && (
            <div role="status" className="animate-fade-in flex items-start gap-2 rounded-lg bg-accent/[0.07] px-3 py-2 text-xs text-ink-100 ring-1 ring-accent/25">
              <Check size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {notice}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => window.print()}>
              <Printer size={13} aria-hidden /> Print
            </Button>
            <Button variant="ghost" onClick={exportFhir} title="Download a FHIR R4 Bundle (collection) with Patient, Device and Observation resources">
              <FileJson size={13} aria-hidden /> Export FHIR R4 Bundle (JSON)
            </Button>
            <Button variant="primary" onClick={send}>
              <Send size={13} aria-hidden /> Send to ground
            </Button>
          </div>
        </div>
      }
    >
      <style>{REPORT_CSS}</style>
      <ReportDocument snap={snap} />
    </Modal>
  )
}

/** Opens the shift handover report (print view + FHIR R4 export). */
/** Opens the shift handover report. variant="menuitem" renders it as a row of the top bar Tools menu. */
export function HandoverReportButton({ variant = 'toolbar' }: { variant?: 'toolbar' | 'menuitem' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {variant === 'menuitem' ? (
        <button type="button" role="menuitem" tabIndex={-1} data-tour="report" aria-haspopup="dialog" onClick={() => setOpen(true)} className={MENU_ITEM}>
          <MenuRow icon={<FileText size={16} />} label="Shift handover" hint="Report for the next shift: print, FHIR export, send to ground" />
        </button>
      ) : (
        <button type="button" data-tour="report" aria-haspopup="dialog" onClick={() => setOpen(true)} className={TOPBAR_BUTTON} title="Shift handover report: print, export FHIR, send to ground">
          <FileText size={14} className="text-accent" aria-hidden />
          <span>Handover</span>
        </button>
      )}
      {open && <HandoverModal onClose={() => setOpen(false)} />}
    </>
  )
}
