import { BookHeart, FilePlus2, History, Info } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../state/store'
import { AstronautPortrait } from '../../components/AstronautPortrait'
import { Badge, Button } from '../../components/ui'
import { formatUtcDate, formatUtcTime } from '../../components/format'
import { Modal } from '../mission/Modal'
import { MENU_ITEM, MenuRow } from '../topbar/menu'
import { MedicalEscalation } from '../attention/MedicalGuidance'
import { medicalTimeline, RECORD_CATEGORIES, type MedicalRecord, type RecordCategory } from './model'
import { useMedicalHistoryStore } from './store'

export function MedicalHistoryButton({ astronautId, menuitem = false }: { astronautId: string; menuitem?: boolean }) {
  const open = useMedicalHistoryStore((s) => s.open)
  const name = useAppStore((s) => s.crew.find((c) => c.id === astronautId)?.callsign ?? 'astronaut')
  return menuitem ? (
    <button type="button" role="menuitem" tabIndex={-1} aria-haspopup="dialog" onClick={() => open(astronautId)} className={MENU_ITEM}>
      <MenuRow icon={<BookHeart size={15} />} label="Medical history" hint="Individual crew records and health timeline" />
    </button>
  ) : (
    <button type="button" onClick={() => open(astronautId)} aria-haspopup="dialog" aria-label={`Medical history for ${name}`} className="medical-history-trigger focus-ring flex w-full items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/10">
      <BookHeart size={14} aria-hidden /> Medical history
    </button>
  )
}

const FIELD = 'focus-ring mt-1 w-full rounded-lg border border-white/15 bg-space-950 px-3 py-2 text-sm text-ink-100'
function AddRecord({ astronautId, onClose }: { astronautId: string; onClose: () => void }) {
  const addRecord = useMedicalHistoryStore((s) => s.addRecord)
  const simNow = useAppStore((s) => Math.floor(s.clock.simNow / 60000) * 60000)
  const [category, setCategory] = useState<RecordCategory>('Note')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [date, setDate] = useState(new Date(simNow).toISOString().slice(0, 16))
  const [status, setStatus] = useState<MedicalRecord['status']>('Recorded')
  const [error, setError] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (addRecord({ astronautId, category, title, details, at: Date.parse(`${date}:00Z`), status })) onClose()
    else setError('Enter a title and a valid date to save this record.')
  }
  return (
    <form onSubmit={submit} className="mb-5 rounded-xl border border-accent/30 bg-accent/5 p-4">
      <h3 className="font-semibold text-ink-100">Add a demonstration record</h3>
      <p className="mt-1 text-xs text-ink-300">Stored in this browser for this astronaut. Use fictional information only.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-ink-300">Category<select className={FIELD} value={category} onChange={(e) => setCategory(e.target.value as RecordCategory)}>{RECORD_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-xs text-ink-300">Status<select className={FIELD} value={status} onChange={(e) => setStatus(e.target.value as MedicalRecord['status'])}>{['Recorded', 'Active', 'Resolved'].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="text-xs text-ink-300 sm:col-span-2">Record title<input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="e.g. Follow-up review (fictional)" /></label>
        <label className="text-xs text-ink-300 sm:col-span-2">Date and time (UTC)<input className={FIELD} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label className="text-xs text-ink-300 sm:col-span-2">Details<textarea className={FIELD} rows={3} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} placeholder="Context, observations and follow-up notes" /></label>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-warning">{error}</p>}
      <div className="mt-4 flex gap-2"><Button type="submit" variant="primary">Save record</Button><Button onClick={onClose}>Cancel</Button></div>
    </form>
  )
}

function HistoryProfile({ astronautId }: { astronautId: string }) {
  const { astronaut, alerts, interventions, checkIns } = useAppStore(useShallow((s) => ({ astronaut: s.crew.find((c) => c.id === astronautId), alerts: s.alerts, interventions: s.interventions, checkIns: s.checkIns })))
  const records = useMedicalHistoryStore((s) => s.records)
  const storageAvailable = useMedicalHistoryStore((s) => s.storageAvailable)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('All')
  const [limit, setLimit] = useState(20)
  const own = useMemo(() => records.filter((r) => r.astronautId === astronautId), [records, astronautId])
  const timeline = useMemo(() => medicalTimeline(astronautId, records, alerts, interventions, checkIns), [astronautId, records, alerts, interventions, checkIns])
  const filtered = useMemo(() => filter === 'Profile records' ? timeline.filter((e) => e.id.startsWith('record-')) : filter === 'Mission events' ? timeline.filter((e) => !e.id.startsWith('record-')) : timeline, [timeline, filter])
  if (!astronaut) return null
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <AstronautPortrait astronaut={astronaut} className="h-20 w-20 rounded-xl" />
        <div className="min-w-0 flex-1"><div className="workspace-kicker">Individual medical profile</div><h3 className="mt-1 text-2xl font-semibold tracking-tight">{astronaut.callsign}</h3><p className="mt-1 text-sm text-ink-300">{astronaut.role} · {astronaut.agency}</p></div>
        <Button variant="primary" onClick={() => setAdding((v) => !v)} aria-expanded={adding}><FilePlus2 size={15} /> Add record</Button>
      </div>
      <div className="mb-5 flex items-start gap-2 rounded-lg border border-watch/30 bg-watch/5 p-3 text-xs leading-relaxed text-ink-300"><Info size={16} className="shrink-0 text-watch" /><span>Fictional demonstration records, not the astronaut’s real medical history. No verified personal medical information has been provided. Added records stay in this browser; mission events reflect the current simulation.</span></div>
      <MedicalEscalation astronautId={astronautId} />
      {!storageAvailable && <p role="status" className="mb-4 text-xs text-warning">Browser storage is unavailable. New records will last only for this session.</p>}
      {adding && <AddRecord astronautId={astronautId} onClose={() => setAdding(false)} />}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(['Condition', 'Allergy', 'Medication'] as const).map((category) => {
          const entries = own.filter((r) => r.category === category && r.status !== 'Resolved')
          return <section key={category} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{category === 'Condition' ? 'Conditions' : category === 'Allergy' ? 'Allergies' : 'Medications'}</h4>{entries.length ? <ul className="mt-2 space-y-2 text-sm">{entries.map((r) => <li key={r.id}><span className="font-semibold">{r.title}</span><span className="mt-0.5 block text-xs text-ink-300">{r.details || 'User-entered demonstration record'}</span></li>)}</ul> : <p className="mt-2 text-sm text-ink-300">No records provided</p>}</section>
        })}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><History size={17} className="text-accent" /> Health history <span className="text-xs font-normal text-ink-500">{filtered.length} entries</span></h3><label className="text-xs text-ink-300">Show<select className="focus-ring ml-2 rounded-lg border border-white/15 bg-space-950 px-2 py-1.5 text-xs" value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(20) }}>{['All', 'Profile records', 'Mission events'].map((f) => <option key={f}>{f}</option>)}</select></label></div>
      {filtered.length ? <ol className="space-y-3">{filtered.slice(0, limit).map((event) => <li key={event.id} className="rounded-xl border border-white/10 border-l-2 border-l-accent/50 bg-white/[0.02] p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={event.origin === 'User entry' ? 'accent' : 'sim'}>{event.origin}</Badge><span className="text-[11px] text-ink-500">{event.category} · {event.status}</span><time dateTime={new Date(event.at).toISOString()} className="ml-auto text-[11px] text-ink-500">{formatUtcDate(event.at)} · {formatUtcTime(event.at, false)} UTC</time></div><h4 className="mt-2 text-sm font-semibold first-letter:uppercase">{event.title}</h4><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-300">{event.details}</p></li>)}</ol> : <p className="rounded-lg border border-white/10 p-4 text-sm text-ink-300">No entries in this category for this astronaut.</p>}
      {filtered.length > limit && <Button className="mt-4" onClick={() => setLimit((n) => n + 20)}>Show 20 more entries</Button>}
    </>
  )
}

export function MedicalHistoryDialog() {
  const id = useMedicalHistoryStore((s) => s.astronautId)
  const close = useMedicalHistoryStore((s) => s.close)
  const open = useMedicalHistoryStore((s) => s.open)
  const crew = useAppStore((s) => s.crew)
  return (
    <Modal open={id !== null} onClose={close} title="Medical history" subtitle="Separate records for every crew member" icon={<BookHeart size={20} className="text-accent" />} size="xl">
      <div className="medical-history-layout grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Choose a medical history" className="flex flex-col gap-2">{crew.map((a) => <button key={a.id} type="button" aria-current={a.id === id ? 'true' : undefined} onClick={() => open(a.id)} className={`focus-ring flex items-center gap-3 rounded-lg border p-3 text-left ${a.id === id ? 'border-accent/50 bg-accent/10' : 'border-white/10 hover:bg-white/5'}`}><AstronautPortrait astronaut={a} className="h-10 w-10 shrink-0 rounded-full" /><span><span className="block text-xs font-semibold">{a.callsign}</span><span className="mt-1 block text-[10px] text-ink-500">{a.role}</span></span></button>)}</nav>
        <div className="min-w-0">{id && <HistoryProfile key={id} astronautId={id} />}</div>
      </div>
    </Modal>
  )
}
