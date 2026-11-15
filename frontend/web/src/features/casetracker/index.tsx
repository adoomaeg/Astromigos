import { ArrowRight, Check, ClipboardCheck, ListTodo, MessageSquarePlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../state/store'
import { STATUS_META } from '../../lib/status'
import { METRIC_CATALOG } from '../../engine/catalog'
import { AstronautPortrait } from '../../components/AstronautPortrait'
import { Badge, Button } from '../../components/ui'
import { formatUtcDate, formatUtcTime } from '../../components/format'
import { Modal } from '../mission/Modal'
import { MedicalEscalation, RecommendationSteps } from '../attention/MedicalGuidance'
import { issueCases, type FollowUp, type IssueCase } from './model'
import { useCaseTrackerStore } from './store'
import { useMedicalHistoryStore } from '../medicalhistory/store'

const EMPTY_REVIEWS: Record<string, FollowUp[]> = {}
export function useIssueCases(astronautId: string) {
  const snapshot = useAppStore(useShallow((s) => ({ alerts: s.alerts, recommendations: s.recommendations, interventions: s.interventions, health: s.health, environment: s.environment, history: s.history })))
  const runId = useAppStore((s) => s.simulationRunId)
  const reviews = useCaseTrackerStore((s) => s.reviews[runId]) ?? EMPTY_REVIEWS
  return useMemo(() => issueCases(astronautId, snapshot, reviews), [astronautId, snapshot, reviews])
}
const stamp = (at: number) => `${formatUtcDate(at)} · ${formatUtcTime(at, false)} UTC`

export function CaseTrackerButton({ astronautId, ruleId, compact = false }: { astronautId: string; ruleId?: string; compact?: boolean }) {
  const open = useCaseTrackerStore((s) => s.open)
  const selectedId = useAppStore((s) => s.selectedAstronautId)
  const target = astronautId === 'CABIN' ? selectedId : astronautId
  return <Button onClick={() => open(target, ruleId)} aria-haspopup="dialog" className={compact ? 'text-[11px]' : 'w-full'}><ClipboardCheck size={14} />{compact ? 'Track follow-up' : 'Problem & follow-up tracker'}</Button>
}

export function CaseTrackerSummary() {
  const astronaut = useAppStore((s) => s.crew.find((c) => c.id === s.selectedAstronautId))
  const id = astronaut?.id ?? ''
  const cases = useIssueCases(id)
  const open = useCaseTrackerStore((s) => s.open)
  if (!astronaut) return null
  const unresolved = cases.filter((c) => c.status !== 'Resolved')
  return (
    <section aria-label="Problem and follow-up tracker" className="glass p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><div className="workspace-kicker">Problem → action → follow-up</div><h2 className="mt-2 text-xl font-semibold tracking-tight">Close the loop.</h2><p className="mt-1 text-xs text-ink-300">{astronaut.callsign} · {unresolved.length} unresolved · {cases.filter((c) => c.status === 'Awaiting follow-up').length} awaiting review</p></div>
        <CaseTrackerButton astronautId={id} />
      </div>
      {cases.length ? <ul className="mt-4 grid gap-3 md:grid-cols-3">{cases.slice(0, 3).map((c) => <li key={c.id}><button type="button" onClick={() => open(id, c.ruleId)} className="focus-ring flex h-full w-full items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left hover:bg-white/[0.05]"><span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_META[c.priority].color }} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{c.title}</span><span className="mt-2 block text-xs text-ink-300">{c.status} · {c.interventions.length} actions logged</span></span><ArrowRight size={14} className="mt-1 shrink-0 text-ink-500" /></button></li>)}</ul> : <p className="mt-4 rounded-lg border border-dashed border-white/15 p-4 text-sm text-ink-300">No cases recorded for this astronaut in the current run. Detected alerts and recommendations will create cases automatically.</p>}
    </section>
  )
}

function CaseDetail({ issue, astronautId, runId }: { issue: IssueCase; astronautId: string; runId: string }) {
  const logIntervention = useAppStore((s) => s.logIntervention)
  const recordFollowUp = useCaseTrackerStore((s) => s.recordFollowUp)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const save = (reviewed: boolean) => {
    if (!note.trim()) { setMessage('Add a follow-up note before saving or resolving this case.'); return }
    const state = useAppStore.getState()
    if (state.simulationRunId !== runId) { setMessage('The simulation run changed. Open the current case again.'); return }
    const current = issueCases(astronautId, state, useCaseTrackerStore.getState().reviews[runId]).find((c) => c.id === issue.id)
    if (!current || (reviewed && current.active)) { setMessage('This case still has active or unknown signals. Record a note and continue medical review.'); return }
    if (recordFollowUp(runId, issue.id, { note, at: state.clock.simNow, reviewed })) {
      if (issue.subjectId !== 'CABIN') useMedicalHistoryStore.getState().addRecord({ astronautId: issue.subjectId, category: 'Note', title: `Demo ${reviewed ? 'resolution review' : 'case follow-up'}: ${issue.title}`, details: note.trim(), at: state.clock.simNow, status: reviewed ? 'Resolved' : 'Recorded' })
      setNote('')
      setMessage(reviewed ? 'Follow-up review recorded. This case is resolved in the simulation.' : 'Follow-up note saved. The case status still depends on the readings and review.')
    }
  }
  return (
    <article className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2"><Badge tone={issue.status === 'Resolved' ? 'accent' : 'warn'}>{issue.status}</Badge><span className="text-xs font-semibold" style={{ color: STATUS_META[issue.priority].color }}>{STATUS_META[issue.priority].label} when detected</span>{issue.subjectId === 'CABIN' && <Badge>Shared cabin issue</Badge>}</div>
      <h3 className="text-xl font-semibold leading-snug">{issue.title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-ink-300">{issue.detail}</p>
      <p className="mt-2 text-[11px] text-ink-500">Detected {stamp(issue.detectedAt)}</p>
      <div className="mt-4"><MedicalEscalation astronautId={astronautId} /></div>
      <ol aria-label="Case progress" className="mb-5 grid grid-cols-3 gap-2 text-xs">
        <li className="rounded-lg border border-accent/30 bg-accent/5 p-3"><span className="block font-semibold text-accent">1. Problem</span><span className="mt-1 block text-ink-300">Recorded</span></li>
        <li className="rounded-lg border border-white/10 p-3"><span className="block font-semibold">2. Action</span><span className="mt-1 block text-ink-300">{issue.interventions.length ? `${issue.interventions.length} logged` : 'Review suggested steps'}</span></li>
        <li className="rounded-lg border border-white/10 p-3"><span className="block font-semibold">3. Follow-up</span><span className="mt-1 block text-ink-300">{issue.status === 'Resolved' ? 'Review recorded' : issue.active ? 'Issue still active' : 'Review required'}</span></li>
      </ol>
      <section className="mb-5 rounded-lg border border-white/10 p-4"><h4 className="font-semibold text-sm">Are the readings improving?</h4><p className="mt-1 text-xs leading-relaxed text-ink-300">{issue.active ? 'The issue remains open while alerts, recommendations, or affected readings remain active or unknown.' : 'The monitored signals have cleared. A follow-up note and explicit review are still required to resolve this case.'}</p>
        {issue.measurements.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-white/10 text-ink-500"><tr><th className="py-2 pr-3 font-medium">Signal</th><th className="py-2 pr-3 font-medium">At detection</th><th className="py-2 pr-3 font-medium">Latest</th><th className="py-2 font-medium">Compared with personal range</th></tr></thead><tbody>{issue.measurements.map((m) => { const def = METRIC_CATALOG[m.metric]; const value = (v: number | null) => v == null ? 'Unavailable' : `${v.toFixed(def.decimals)} ${def.unit}`; return <tr key={m.metric} className="border-b border-white/5"><th className="py-3 pr-3 font-medium">{def.label}</th><td className="py-3 pr-3 tabular">{value(m.detected)}</td><td className="py-3 pr-3 tabular">{value(m.current)}</td><td className="py-3"><span>{m.trend}</span>{m.low != null && m.high != null && <span className="mt-1 block text-[10px] text-ink-500">Personal range {m.low.toFixed(def.decimals)}–{m.high.toFixed(def.decimals)} {def.unit}</span>}</td></tr> })}</tbody></table></div> : <p className="mt-3 text-xs text-ink-500">No single monitored metric is attached to this case. Review the triggering issue and crew observations.</p>}
        <p className="mt-3 text-[10px] leading-relaxed text-ink-500">Detection readings use retained samples from the preceding 15 minutes. Missing samples stay unavailable. Changes in readings do not establish a treatment effect.</p>
      </section>
      <section className="mb-5"><h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ListTodo size={15} className="text-accent" /> Suggested actions</h4>{issue.recommendations.length ? <ul className="space-y-3">{issue.recommendations.map((rec) => <li key={rec.id} className="rounded-lg border border-white/10 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h5 className="text-sm font-semibold">{rec.title}</h5><Badge>{rec.status === 'DONE' ? 'Action logged' : rec.status === 'DISMISSED' ? 'Dismissed' : rec.active === false ? 'No longer active' : 'To do'}</Badge></div><RecommendationSteps rec={rec} />{rec.interventionKind && rec.status === 'PENDING' && rec.active !== false && <Button className="mt-3" variant="primary" onClick={() => logIntervention({ astronautId: rec.astronautId, kind: rec.interventionKind!, recommendationId: rec.id })}><Check size={14} /> Log action taken</Button>}</li>)}</ul> : <p className="rounded-lg border border-white/10 p-4 text-xs leading-relaxed text-ink-300">No automated action is linked to this issue. Request crew medical officer review. Critical issues require immediate medical attention.</p>}</section>
      <section className="mb-5 rounded-lg border border-white/10 p-4"><h4 className="mb-3 text-sm font-semibold">Actions taken</h4>{issue.interventions.length ? <ol className="space-y-3">{issue.interventions.map((i) => <li key={i.id} className="text-xs"><span className="block font-semibold capitalize">{i.kind.replaceAll('_', ' ').toLowerCase()}</span><span className="mt-1 block text-ink-500">{stamp(i.loggedAt)} · {i.actor}</span>{i.note && <p className="mt-1 text-ink-300">{i.note}</p>}</li>)}</ol> : <p className="text-xs text-ink-500">No actions logged for this case yet.</p>}</section>
      <section className="rounded-lg border border-accent/25 p-4"><h4 className="flex items-center gap-2 text-sm font-semibold"><MessageSquarePlus size={16} className="text-accent" /> Follow-up review</h4><label className="mt-3 block text-xs text-ink-300" htmlFor="case-followup">Observations and next steps</label><textarea id="case-followup" value={note} maxLength={2000} rows={3} onChange={(e) => setNote(e.target.value)} placeholder="Record symptoms, repeat measurements, or the reviewer’s observations (simulation only)." className="focus-ring mt-2 w-full rounded-lg border border-white/15 bg-space-950 px-3 py-2 text-sm" /><div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => save(false)}>Save follow-up note</Button><Button variant="primary" onClick={() => save(true)} disabled={issue.active || issue.status === 'Resolved'}>Review & resolve case</Button></div><p className="mt-3 text-[11px] leading-relaxed text-ink-500">Resolution requires cleared signals and a written review. Logging an action, acknowledging an alert, or dismissing a recommendation does not resolve the case.</p>{message && <p role="status" className="mt-3 text-xs text-accent">{message}</p>}
        {issue.followUps.length > 0 && <ol className="mt-4 space-y-3 border-t border-white/10 pt-3">{issue.followUps.map((f, i) => <li key={`${f.at}-${i}`} className="text-xs"><span className="font-semibold">{f.reviewed ? 'Resolution review' : 'Follow-up note'}</span><span className="ml-2 text-ink-500">{stamp(f.at)}</span><p className="mt-1 whitespace-pre-wrap leading-relaxed text-ink-300">{f.note}</p></li>)}</ol>}
      </section>
    </article>
  )
}

function CaseWorkspace({ astronautId, runId, focusRule }: { astronautId: string; runId: string; focusRule: string | null }) {
  const cases = useIssueCases(astronautId)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('All cases')
  const shown = cases.filter((c) => filter === 'All cases' || c.status === filter)
  const active = shown.find((c) => c.id === selected) ?? shown.find((c) => c.ruleId === focusRule) ?? shown[0]
  return <><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink-300">{cases.length} cases · {cases.filter((c) => c.status === 'Open').length} open · {cases.filter((c) => c.status === 'Awaiting follow-up').length} awaiting follow-up</p><label className="text-xs text-ink-300">Status<select value={filter} onChange={(e) => { setFilter(e.target.value); setSelected(null) }} className="focus-ring ml-2 rounded-lg border border-white/15 bg-space-950 px-3 py-2">{['All cases', 'Open', 'Awaiting follow-up', 'Resolved'].map((f) => <option key={f}>{f}</option>)}</select></label></div>{shown.length ? <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]"><nav aria-label="Health cases" className="flex flex-col gap-2 lg:max-h-[65vh] lg:overflow-y-auto">{shown.map((c) => <button key={c.id} onClick={() => setSelected(c.id)} type="button" aria-current={active?.id === c.id ? 'true' : undefined} className={`focus-ring rounded-lg border p-3 text-left ${active?.id === c.id ? 'border-accent/50 bg-accent/10' : 'border-white/10 hover:bg-white/5'}`}><span className="text-[10px] font-semibold" style={{ color: STATUS_META[c.priority].color }}>{c.status}</span><span className="mt-1 block text-xs font-semibold leading-relaxed">{c.title}</span><span className="mt-2 block text-[10px] text-ink-500">{stamp(c.detectedAt)}</span></button>)}</nav>{active && <CaseDetail key={active.id} issue={active} astronautId={astronautId} runId={runId} />}</div> : <p className="rounded-lg border border-dashed border-white/15 p-6 text-sm text-ink-300">No {filter === 'All cases' ? '' : filter.toLowerCase()} cases for this astronaut in the current run. Cases appear automatically when an alert or recommendation is generated.</p>}</>
}

export function CaseTrackerDialog() {
  const astronautId = useCaseTrackerStore((s) => s.astronautId)
  const focusRule = useCaseTrackerStore((s) => s.focusRule)
  const open = useCaseTrackerStore((s) => s.open)
  const close = useCaseTrackerStore((s) => s.close)
  const crew = useAppStore((s) => s.crew)
  const runId = useAppStore((s) => s.simulationRunId)
  return <Modal open={astronautId !== null} onClose={close} title="Problem & follow-up tracker" subtitle="Trace each problem through suggested actions, readings, and review" icon={<ClipboardCheck size={19} className="text-accent" />} size="xl" footer={<p className="text-[11px] leading-relaxed text-ink-500">Simulated decision support, not a clinical record. Cases and notes apply to the current simulation run; restarting or changing scenarios starts a new tracker.</p>}><div role="group" aria-label="Choose an astronaut’s cases" className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{crew.map((a) => <button type="button" key={a.id} aria-pressed={a.id === astronautId} onClick={() => open(a.id)} className={`focus-ring flex items-center gap-2 rounded-lg border p-2 text-left text-xs ${a.id === astronautId ? 'border-accent/50 bg-accent/10' : 'border-white/10 hover:bg-white/5'}`}><AstronautPortrait astronaut={a} className="h-9 w-9 shrink-0 rounded-full" /><span className="font-semibold">{a.callsign}</span></button>)}</div>{astronautId && <CaseWorkspace key={`${runId}-${astronautId}-${focusRule}`} astronautId={astronautId} runId={runId} focusRule={focusRule} />}</Modal>
}
