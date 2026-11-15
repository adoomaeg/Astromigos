import clsx from 'clsx'
import { ChevronUp, Info } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../state/store'
import { STATUS_META } from '../../lib/status'
import { METRIC_CATALOG, REGION_LABELS } from '../../engine/catalog'
import type { Alert, BodyRegionId, CheckIn, CommMessage, Intervention, MetricCode, StatusFrame, Status } from '../../types/domain'
import { StatusDot, StatusIcon } from '../../components/Status'
import { Popover } from '../../components/ui'
import { formatUtcDate, formatUtcTime, relTime } from '../../components/format'
import { focusTarget } from '../shared/hooks'
import { COMM_KIND_LABEL, useCommsUi } from '../comms/delay'
import { INTERVENTION_LABEL, INTERVENTION_REGION } from './labels'

export interface TimelineStripProps {
  className?: string
}

type RangeKey = '24h' | '72h' | 'all'
const RANGES: { key: RangeKey; label: string; hours: number | null; title: string }[] = [
  { key: '24h', label: '24 h', hours: 24, title: 'Last 24 hours' },
  { key: '72h', label: '72 h', hours: 72, title: 'Last 72 hours' },
  { key: 'all', label: 'All', hours: null, title: 'All available history' },
]

const H = 3600000
const CABIN = 'CABIN'
const PAD_R = 10
const ACCENT = '#5eead4'
const SPACE = '#0a1120'

/** Fill opacity per status: nominal stays quiet so deviations stand out. */
const STATUS_OPACITY: Record<Status, number> = { LOW: 0.34, MODERATE: 0.85, HIGH: 0.92, CRITICAL: 1, NO_DATA: 1 }

interface Lane {
  id: string
  label: string
  color: string
  cabin: boolean
  y: number
  h: number
}

type MarkerKind = 'alert' | 'intervention' | 'checkin' | 'comm'
interface Marker {
  key: string
  kind: MarkerKind
  t: number
  t2?: number
  laneId: string
  title: string
  meta: string
  status?: Status
  inTransit?: boolean
  uplink?: boolean
  manual?: boolean
  acked?: boolean
  target: { astronautId?: string | null; region?: BodyRegionId | 'environment' | null; metric?: MetricCode | null } | 'comms'
}

interface Segment {
  laneId: string
  t0: number
  t1: number
  status: Status
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

/** Index of the last frame with t <= x (or -1). */
function frameAt(frames: StatusFrame[], t: number): number {
  let lo = 0
  let hi = frames.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (frames[mid]!.t <= t) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

/** Typical spacing between frames (median of recent gaps), used to tell gaps from steps. */
function typicalStep(frames: StatusFrame[]): number {
  const n = frames.length
  if (n < 2) return 15 * 60000
  const diffs: number[] = []
  for (let i = Math.max(1, n - 60); i < n; i++) diffs.push(frames[i]!.t - frames[i - 1]!.t)
  diffs.sort((a, b) => a - b)
  return Math.max(60000, diffs[diffs.length >> 1]!)
}

function buildSegments(frames: StatusFrame[], laneIds: string[], from: number, to: number): Segment[] {
  if (frames.length === 0) return []
  const step = typicalStep(frames)
  const maxGap = Math.max(step * 3, 30 * 60000)
  const start = Math.max(0, frameAt(frames, from))
  const out: Segment[] = []
  for (const id of laneIds) {
    let cur: Segment | null = null
    for (let i = start; i < frames.length; i++) {
      const f = frames[i]!
      if (f.t > to) break
      const next = frames[i + 1]
      // A frame lasts until the next one; across a long gap (or after the last frame) it fades out.
      const end = Math.min(to, next ? (next.t - f.t > maxGap ? f.t + step : next.t) : f.t + maxGap)
      const st = f.levels[id]
      if (!st || end <= from) {
        if (cur) out.push(cur)
        cur = null
        continue
      }
      const t0 = Math.max(from, f.t)
      if (cur && cur.status === st && Math.abs(cur.t1 - t0) < 1) cur.t1 = end
      else {
        if (cur) out.push(cur)
        cur = { laneId: id, t0, t1: end, status: st }
      }
    }
    if (cur) out.push(cur)
  }
  return out
}

function alertWhere(a: Alert): string {
  if (a.metric) return METRIC_CATALOG[a.metric].label
  if (a.region === 'environment') return 'Cabin environment'
  if (a.region) return REGION_LABELS[a.region].label
  return ''
}

function buildMarkers(
  alerts: Alert[],
  interventions: Intervention[],
  checkIns: CheckIn[],
  comms: CommMessage[],
  laneIds: Set<string>,
  callsign: (id: string | null) => string,
  from: number,
  to: number,
): Marker[] {
  const out: Marker[] = []
  const lane = (id: string | null) => (id && laneIds.has(id) ? id : CABIN)
  for (const a of alerts) {
    if (a.createdAt < from || a.createdAt > to) continue
    const where = alertWhere(a)
    const acked = a.acknowledgedAt != null
    out.push({
      key: `a-${a.id}`,
      kind: 'alert',
      t: a.createdAt,
      laneId: lane(a.astronautId),
      title: a.title,
      meta: `${callsign(a.astronautId)}${where ? ` · ${where}` : ''}${acked ? ` · Acknowledged by ${a.acknowledgedBy ?? 'crew'}` : a.resolvedAt != null ? ' · Resolved' : ' · Open'}`,
      status: a.severity,
      acked: acked || a.resolvedAt != null,
      target: { astronautId: a.astronautId, region: a.region, metric: a.metric },
    })
  }
  for (const iv of interventions) {
    if (iv.loggedAt < from || iv.loggedAt > to) continue
    out.push({
      key: `i-${iv.id}`,
      kind: 'intervention',
      t: iv.loggedAt,
      laneId: lane(iv.astronautId),
      title: `${INTERVENTION_LABEL[iv.kind]} logged`,
      meta: `${callsign(laneIds.has(iv.astronautId) && iv.astronautId !== CABIN ? iv.astronautId : null)} · by ${iv.actor}${iv.note ? ` · ${iv.note}` : ''}`,
      target: { astronautId: iv.astronautId, region: INTERVENTION_REGION[iv.kind] },
    })
  }
  for (const c of checkIns) {
    if (c.at < from || c.at > to) continue
    const manual = c.data_origin === 'MANUAL'
    out.push({
      key: `c-${c.id}`,
      kind: 'checkin',
      t: c.at,
      laneId: lane(c.astronautId),
      title: 'Daily check-in',
      meta: `${callsign(c.astronautId)} · mood ${c.mood}/5, fatigue ${c.fatigue}/5, stress ${c.stress}/5 · ${manual ? 'typed by crew' : 'simulated'}`,
      manual,
      target: { astronautId: c.astronautId, region: 'brain' },
    })
  }
  for (const m of comms) {
    if (m.arrivesAt < from || m.sentAt > to) continue
    const inTransit = m.status === 'IN_TRANSIT' && to < m.arrivesAt
    const uplink = m.direction === 'UPLINK'
    out.push({
      key: `m-${m.id}`,
      kind: 'comm',
      t: Math.max(from, m.sentAt),
      t2: m.arrivesAt,
      laneId: lane(m.astronautId),
      title: m.title || COMM_KIND_LABEL[m.kind],
      meta: `${uplink ? 'From Earth' : 'To Earth'} · ${COMM_KIND_LABEL[m.kind]} · ${inTransit ? 'in transit' : 'delivered'}${m.data_origin === 'SIMULATED' ? ' · simulated' : ''}`,
      inTransit,
      uplink,
      target: 'comms',
    })
  }
  // Draw order: comms below, then check-ins, actions, alerts on top.
  const order: Record<MarkerKind, number> = { comm: 0, checkin: 1, intervention: 2, alert: 3 }
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.t - b.t)
}

function bucketFor(range: RangeKey): number {
  return range === '24h' ? 60000 : range === '72h' ? 3 * 60000 : 10 * 60000
}

function tickStep(spanMs: number, w: number): number {
  const candidates = [H, 2 * H, 3 * H, 6 * H, 12 * H, 24 * H, 48 * H, 96 * H]
  const minPx = 64
  for (const c of candidates) if ((c / spanMs) * w >= minPx) return c
  return candidates[candidates.length - 1]!
}

/** Marker glyph drawn at (x, y). Shape encodes the kind; color encodes status only for alerts. */
function Glyph({ m, x, y, s, x2, active }: { m: Marker; x: number; y: number; s: number; x2?: number; active?: boolean }) {
  const strokeW = active ? 2 : 1.25
  const stroke = active ? '#e8eefc' : SPACE
  switch (m.kind) {
    case 'alert': {
      const c = STATUS_META[m.status ?? 'MODERATE'].color
      const r = s * 0.62
      return <path d={`M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`} fill={c} fillOpacity={m.acked && !active ? 0.6 : 1} stroke={stroke} strokeWidth={strokeW} />
    }
    case 'intervention':
      return <circle cx={x} cy={y} r={s * 0.42} fill={ACCENT} stroke={stroke} strokeWidth={strokeW} />
    case 'checkin': {
      const r = s * 0.38
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={1.5} fill={m.manual ? '#e8eefc' : '#a9b6cf'} stroke={stroke} strokeWidth={strokeW} />
    }
    case 'comm': {
      const c = m.uplink ? ACCENT : '#a9b6cf'
      const end = x2 ?? x
      const r = Math.max(2, s * 0.26)
      return (
        <g>
          {end - x > 1.5 && <line x1={x} x2={end} y1={y} y2={y} stroke={c} strokeOpacity={0.85} strokeWidth={active ? 2 : 1.4} strokeDasharray={m.inTransit ? '2 2' : undefined} />}
          <circle cx={x} cy={y} r={r} fill={SPACE} stroke={c} strokeWidth={1.3} />
          {!m.inTransit && end - x > 1.5 && <circle cx={end} cy={y} r={r} fill={c} stroke={SPACE} strokeWidth={1} />}
          {active && <circle cx={x} cy={y} r={r + 2} fill="none" stroke="#e8eefc" strokeWidth={1} />}
        </g>
      )
    }
  }
}

function MarkerSwatch({ kind, status, manual, uplink }: { kind: MarkerKind; status?: Status; manual?: boolean; uplink?: boolean }) {
  const m: Marker = { key: 'x', kind, t: 0, laneId: '', title: '', meta: '', status, manual, uplink, target: 'comms' }
  return (
    <svg width={kind === 'comm' ? 26 : 14} height={14} aria-hidden className="shrink-0">
      <Glyph m={m} x={kind === 'comm' ? 4 : 7} x2={kind === 'comm' ? 22 : undefined} y={7} s={12} />
    </svg>
  )
}

function HatchDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" fill="rgba(148,163,184,0.16)" />
        <line x1="0" y1="0" x2="0" y2="5" stroke="#94a3b8" strokeOpacity="0.75" strokeWidth="1.6" />
      </pattern>
    </defs>
  )
}

function Legend() {
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<'top' | 'bottom'>('top')
  const btn = useRef<HTMLButtonElement>(null)
  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Timeline legend"
        title="Timeline legend"
        onClick={() => {
          // Open toward the side with more room (the strip may sit at the top or the bottom of the layout).
          const r = btn.current?.getBoundingClientRect()
          if (r) setSide(r.top > window.innerHeight - r.bottom ? 'top' : 'bottom')
          setOpen((o) => !o)
        }}
        className="focus-ring flex h-5 w-5 items-center justify-center rounded-md text-ink-500 hover:bg-white/[0.06] hover:text-ink-100"
      >
        <Info size={12} aria-hidden />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} label="Timeline legend" side={side} align="right" className="w-[300px] p-4">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Lane color = status at that time</h3>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-ink-300">
          {(['LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'NO_DATA'] as Status[]).map((s) => (
            <li key={s} className="flex items-center gap-2">
              <svg width="22" height="8" aria-hidden className="shrink-0 rounded-sm">
                <HatchDefs id={`lg-hatch-${s}`} />
                <rect width="22" height="8" rx="2" fill={s === 'NO_DATA' ? `url(#lg-hatch-${s})` : STATUS_META[s].color} fillOpacity={STATUS_OPACITY[s]} />
              </svg>
              <StatusIcon status={s} size={11} />
              {STATUS_META[s].label}
            </li>
          ))}
        </ul>
        <h3 className="mt-3.5 text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Markers</h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-xs text-ink-300">
          <li className="flex items-center gap-2">
            <MarkerSwatch kind="alert" status="HIGH" /> Alert (color = severity)
          </li>
          <li className="flex items-center gap-2">
            <MarkerSwatch kind="intervention" /> Action logged by the crew
          </li>
          <li className="flex items-center gap-2">
            <MarkerSwatch kind="checkin" manual /> Daily check-in (grey if simulated)
          </li>
          <li className="flex items-center gap-2">
            <MarkerSwatch kind="comm" /> Message to Earth, sent to arrival
          </li>
          <li className="flex items-center gap-2">
            <MarkerSwatch kind="comm" uplink /> Reply from Earth (simulated)
          </li>
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-500">Click a marker to jump to the related crew member and body system. With the timeline focused, use the arrow keys to step through markers and Enter to open one.</p>
      </Popover>
    </div>
  )
}

interface Hover {
  x: number
  t: number
  laneId: string | null
  marker: Marker | null
  clientX: number
}

/**
 * Slim full width status timeline: a lane per crew member plus the cabin, colored by the
 * status history, with markers for alerts, logged actions, check-ins and Earth messages.
 */
export function TimelineStrip({ className }: TimelineStripProps) {
  const [range, setRange] = useState<RangeKey>('24h')
  const bucket = bucketFor(range)
  const now = useAppStore((s) => Math.floor(s.clock.simNow / bucket) * bucket)
  const { crew, frames, alerts, interventions, checkIns, comms, selectedId } = useAppStore(
    useShallow((s) => ({
      crew: s.crew,
      frames: s.statusTimeline,
      alerts: s.alerts,
      interventions: s.interventions,
      checkIns: s.checkIns,
      comms: s.comms,
      selectedId: s.selectedAstronautId,
    })),
  )
  const [trackRef, size] = useSize<HTMLDivElement>()
  const rootRef = useRef<HTMLElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [kbIndex, setKbIndex] = useState<number | null>(null)
  const hatchId = 'tl-hatch'

  const callsign = useMemo(() => {
    const map = new Map(crew.map((c) => [c.id, c.callsign]))
    return (id: string | null) => (id ? (map.get(id) ?? (id === CABIN ? 'Cabin' : id)) : 'Cabin')
  }, [crew])

  // Time domain
  const from = useMemo(() => {
    const hours = RANGES.find((r) => r.key === range)!.hours
    if (hours != null) return now - hours * H
    let earliest = frames[0]?.t ?? Infinity
    for (const a of alerts) earliest = Math.min(earliest, a.createdAt)
    if (!Number.isFinite(earliest)) earliest = now - 24 * H
    return Math.min(earliest, now - H)
  }, [range, now, frames, alerts])
  const to = now

  // Vertical layout. Under 34 px (short screens, collapsed) it becomes a ribbon: thin colored lanes
  // and the now marker only, no labels or controls. The strip expands on hover or focus (index.css).
  const { w, h } = size
  const ribbon = h > 0 && h < 34
  const layout = useMemo(() => {
    // The hour axis only shows on tall strips (72 px on big screens). On medium strips (about 60 px)
    // its 12 px go to the lanes so callsigns stay readable; the hover tooltip still gives exact times.
    const axisH = h >= 66 ? 12 : 0
    const padTop = ribbon ? 3 : h >= 50 ? 4 : 2
    const usable = Math.max(6, h - padTop - axisH - (ribbon ? 1 : h >= 50 ? 3 : 2))
    const n = crew.length
    const gap = ribbon ? 1 : Math.min(4, Math.max(1.25, usable * 0.04))
    const unit = (usable - gap * n) / (n + 0.6)
    const lanes: Lane[] = []
    let y = padTop
    for (const c of crew) {
      lanes.push({ id: c.id, label: c.callsign, color: c.color, cabin: false, y, h: unit })
      y += unit + gap
    }
    lanes.push({ id: CABIN, label: 'Cabin', color: '#94a3b8', cabin: true, y, h: unit * 0.6 })
    const pitch = unit + gap
    const markerSize = Math.min(13, Math.max(ribbon ? 5 : 8, unit + 3))
    // Labels are uppercase callsigns: the glyphs fit a lane pitch slightly smaller than the font size.
    // Never below 11 px outside the ribbon (readability floor for the callsign labels).
    const fontSize = Math.min(12, Math.max(ribbon ? 9 : 11, pitch * 1.15))
    const labelW = ribbon ? 78 : fontSize >= 11 ? 76 : 64
    return { lanes, axisH, markerSize, fontSize, pitch, labelW, laneBottom: y + unit * 0.6 }
  }, [h, crew, ribbon])
  const LABEL_W = layout.labelW

  const plotW = Math.max(1, w - LABEL_W - PAD_R)
  const x = (t: number) => LABEL_W + ((t - from) / (to - from)) * plotW
  const tOf = (px: number) => from + ((px - LABEL_W) / plotW) * (to - from)

  const laneIds = useMemo(() => layout.lanes.map((l) => l.id), [layout.lanes])
  const segments = useMemo(() => buildSegments(frames, laneIds, from, to), [frames, laneIds, from, to])
  const markers = useMemo(
    () => buildMarkers(alerts, interventions, checkIns, comms, new Set(laneIds), callsign, from, to),
    [alerts, interventions, checkIns, comms, laneIds, callsign, from, to],
  )
  const laneById = useMemo(() => new Map(layout.lanes.map((l) => [l.id, l])), [layout.lanes])
  const byTime = useMemo(() => [...markers].sort((a, b) => a.t - b.t), [markers])

  // Static layer (memoized JSX so hover updates do not re-render hundreds of shapes)
  const staticLayer = useMemo(() => {
    if (w <= 0 || h <= 0) return null
    const xs = (t: number) => LABEL_W + ((t - from) / (to - from)) * plotW
    const step = tickStep(to - from, plotW)
    const ticks: number[] = []
    for (let t = Math.ceil(from / step) * step; t <= to; t += step) ticks.push(t)
    const tickLabel = (t: number) => {
      const d = new Date(t)
      return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? formatUtcDate(t).replace(/ \d{4}$/, '') : formatUtcTime(t, false)
    }
    return (
      <g>
        {layout.lanes.map((l) => (
          <rect key={`bg-${l.id}`} x={LABEL_W} y={l.y} width={plotW} height={l.h} rx={Math.min(3, l.h / 2)} fill="rgba(255,255,255,0.035)" />
        ))}
        {ticks.map((t) => (
          <line key={`tk-${t}`} x1={xs(t)} x2={xs(t)} y1={layout.lanes[0]!.y - 1} y2={layout.laneBottom + 1} stroke="rgba(255,255,255,0.07)" />
        ))}
        {segments.map((s) => {
          const l = laneById.get(s.laneId)
          if (!l) return null
          const x0 = xs(s.t0)
          const wd = Math.max(1, xs(s.t1) - x0)
          return (
            <rect
              key={`${s.laneId}-${s.t0}`}
              x={x0}
              y={l.y}
              width={wd}
              height={l.h}
              fill={s.status === 'NO_DATA' ? `url(#${hatchId})` : STATUS_META[s.status].color}
              fillOpacity={STATUS_OPACITY[s.status]}
            />
          )
        })}
        {layout.axisH > 0 &&
          ticks.map((t) => {
            const px = xs(t)
            if (px > LABEL_W + plotW - 34 || px < LABEL_W + 14) return null
            return (
              <text key={`tl-${t}`} x={px} y={h - 2} textAnchor="middle" fontSize={10} fill="#7d8ba6" className="tabular">
                {tickLabel(t)}
              </text>
            )
          })}
        {markers.map((m) => {
          const l = laneById.get(m.laneId)
          if (!l) return null
          const cx = xs(m.t)
          const x2 = m.t2 != null ? Math.min(LABEL_W + plotW + PAD_R - 2, xs(m.t2)) : undefined
          return <Glyph key={m.key} m={m} x={cx} x2={x2} y={l.y + l.h / 2} s={layout.markerSize} />
        })}
        <line x1={xs(to)} x2={xs(to)} y1={1} y2={layout.laneBottom + 2} stroke={ACCENT} strokeWidth={1.5} />
        <path d={`M${xs(to) - 3.5} 0L${xs(to) + 3.5} 0L${xs(to)} 4Z`} fill={ACCENT} />
        {layout.axisH > 0 && (
          <text x={xs(to)} y={h - 2} textAnchor="end" fontSize={10} fontWeight={600} fill={ACCENT}>
            Now
          </text>
        )}
      </g>
    )
  }, [w, h, from, to, plotW, layout, segments, markers, laneById])

  const statusAt = (t: number): Record<string, Status> | null => {
    const i = frameAt(frames, t)
    if (i < 0) return null
    const f = frames[i]!
    const next = frames[i + 1]
    const step = typicalStep(frames)
    const limit = Math.max(step * 3, 30 * 60000)
    const reach = next ? (next.t - f.t > limit ? step : Infinity) : limit
    if (t - f.t > reach) return null
    return f.levels
  }

  const laneAtY = (py: number): string | null => {
    for (const l of layout.lanes) if (py >= l.y - 2 && py <= l.y + l.h + 2) return l.id
    return null
  }

  const nearestMarker = (px: number, py: number): Marker | null => {
    let best: Marker | null = null
    let bestD = Infinity
    const reach = Math.max(6, layout.markerSize * 0.75)
    for (const m of markers) {
      const l = laneById.get(m.laneId)
      if (!l) continue
      const my = l.y + l.h / 2
      const dy = Math.abs(py - my)
      if (dy > Math.max(reach, l.h / 2 + 2)) continue
      const mx = x(m.t)
      let dx = Math.abs(px - mx)
      if (m.kind === 'comm' && m.t2 != null) {
        const mx2 = Math.min(LABEL_W + plotW, x(m.t2))
        if (px >= mx && px <= mx2) dx = 0
      }
      if (dx > reach) continue
      const d = dx + dy * 0.5 + (m.kind === 'comm' ? 2 : 0)
      if (d < bestD) {
        bestD = d
        best = m
      }
    }
    return best
  }

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    if (px < LABEL_W - 2 || px > LABEL_W + plotW + PAD_R) {
      setHover(null)
      return
    }
    const cx = Math.min(LABEL_W + plotW, Math.max(LABEL_W, px))
    setKbIndex(null)
    setHover({ x: cx, t: tOf(cx), laneId: laneAtY(py), marker: nearestMarker(px, py), clientX: e.clientX })
  }

  const activate = (m: Marker | null, laneId: string | null) => {
    if (m) {
      if (m.target === 'comms') useCommsUi.getState().setOpen(true)
      else focusTarget(m.target)
      return
    }
    if (laneId && laneId !== CABIN) focusTarget({ astronautId: laneId })
  }

  const kbMarker = kbIndex != null ? (byTime[kbIndex] ?? null) : null
  const onKey = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    if (byTime.length === 0) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setHover(null)
      setKbIndex((i) => {
        if (i == null) return e.key === 'ArrowLeft' ? byTime.length - 1 : 0
        return Math.min(byTime.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))
      })
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setKbIndex(e.key === 'Home' ? 0 : byTime.length - 1)
    } else if ((e.key === 'Enter' || e.key === ' ') && kbMarker) {
      e.preventDefault()
      activate(kbMarker, null)
    } else if (e.key === 'Escape') setKbIndex(null)
  }

  // Tooltip content
  const active: Hover | null = kbMarker
    ? (() => {
        const rect = trackRef.current?.getBoundingClientRect()
        const mx = x(kbMarker.t)
        return { x: mx, t: kbMarker.t, laneId: kbMarker.laneId, marker: kbMarker, clientX: (rect?.left ?? 0) + mx }
      })()
    : hover
  const tooltipMarker = active?.marker ?? null
  const levels = active && !tooltipMarker ? statusAt(active.t) : null

  const rangeLabel = RANGES.find((r) => r.key === range)!.title
  const empty = frames.length === 0

  return (
    <div className={clsx('relative', className)}>
    <section
      ref={rootRef}
      data-tour="timeline"
      aria-label="Status timeline"
      className="tl-float glass relative flex h-full w-full items-stretch gap-2 rounded-2xl py-[3px] pr-2 pl-1 has-[[aria-expanded=true]]:z-30"
    >
      <div ref={trackRef} className="relative min-w-0 flex-1 self-stretch">
        {w > 0 && h > 0 && (
          <>
            <svg
              width={w}
              height={h}
              role="group"
              tabIndex={0}
              aria-label={`Status timeline, ${rangeLabel.toLowerCase()}. ${markers.length} markers. Use arrow keys to step through markers and Enter to open one.`}
              className="focus-ring block cursor-crosshair rounded-xl"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              onClick={() => !ribbon && hover && activate(hover.marker, hover.laneId)}
              onKeyDown={onKey}
              onBlur={() => setKbIndex(null)}
            >
              <HatchDefs id={hatchId} />
              {staticLayer}
              {active && (
                <g pointerEvents="none">
                  <line x1={active.x} x2={active.x} y1={0} y2={layout.laneBottom + 2} stroke="#e8eefc" strokeOpacity={0.5} strokeDasharray="2 2" />
                  {tooltipMarker && laneById.get(tooltipMarker.laneId) && (
                    <Glyph
                      m={tooltipMarker}
                      x={x(tooltipMarker.t)}
                      x2={tooltipMarker.t2 != null ? Math.min(LABEL_W + plotW + PAD_R - 2, x(tooltipMarker.t2)) : undefined}
                      y={laneById.get(tooltipMarker.laneId)!.y + laneById.get(tooltipMarker.laneId)!.h / 2}
                      s={layout.markerSize + 2}
                      active
                    />
                  )}
                </g>
              )}
            </svg>
            {ribbon && (
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-1 pl-2 text-[10px] font-semibold tracking-[0.12em] text-ink-500 uppercase" style={{ width: LABEL_W - 4 }}>
                Timeline <ChevronUp size={11} className="shrink-0 present:hidden" aria-hidden />
              </div>
            )}
            {/* Callsign labels (buttons) */}
            <div className={clsx('pointer-events-none absolute inset-y-0 left-0', ribbon && 'hidden')} style={{ width: LABEL_W - 6 }}>
              {layout.lanes.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  disabled={l.cabin}
                  onClick={() => focusTarget({ astronautId: l.id })}
                  title={l.cabin ? 'Cabin environment' : `Show ${l.label}`}
                  className={clsx(
                    'focus-ring pointer-events-auto absolute right-0 left-0 flex items-center gap-1.5 rounded px-1 text-left leading-none font-semibold tracking-wide transition-colors',
                    l.cabin ? 'cursor-default text-ink-500' : l.id === selectedId ? 'text-ink-100' : 'text-ink-500 hover:text-ink-100',
                  )}
                  style={{ top: l.y + l.h / 2 - layout.pitch / 2, height: layout.pitch, fontSize: l.cabin ? layout.fontSize - 1 : layout.fontSize }}
                >
                  <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: l.color, opacity: l.cabin ? 0.6 : 1 }} />
                  {/* The cabin lane is thinner: on medium strips its text would touch the last crew label, so it keeps only the dot (name in the title and legend). */}
                  {!(l.cabin && layout.pitch < 13) && <span className="truncate">{l.label}</span>}
                </button>
              ))}
            </div>
            {empty && (
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-ink-500" style={{ left: LABEL_W }}>
                <span className="mx-auto rounded-md bg-space-900/80 px-2 py-0.5">Status history builds up as the simulation runs.</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className={clsx('flex shrink-0 flex-col items-end justify-center gap-1', ribbon && 'hidden')}>
        <div role="radiogroup" aria-label="Timeline range" className="flex rounded-md bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={range === r.key}
              title={r.title}
              onClick={() => setRange(r.key)}
              className={clsx(
                'focus-ring tabular rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
                range === r.key ? 'bg-accent/15 text-accent' : 'text-ink-500 hover:text-ink-100',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {h >= 44 && (
          <div className="flex items-center gap-1">
            <span className="tabular font-mono text-[10px] text-ink-500" title="Simulated UTC time">
              {formatUtcTime(to, false)} UTC
            </span>
            <Legend />
          </div>
        )}
      </div>

      {active && <Tooltip anchor={rootRef.current} clientX={active.clientX} marker={tooltipMarker} t={active.t} now={to} levels={levels} lanes={layout.lanes} />}
    </section>
    </div>
  )
}

const KIND_LABEL: Record<MarkerKind, string> = { alert: 'Alert', intervention: 'Action logged', checkin: 'Check-in', comm: 'Earth link' }

function Tooltip({
  anchor,
  clientX,
  marker,
  t,
  now,
  levels,
  lanes,
}: {
  anchor: HTMLElement | null
  clientX: number
  marker: Marker | null
  t: number
  now: number
  levels: Record<string, Status> | null
  lanes: Lane[]
}) {
  if (!anchor) return null
  const rect = anchor.getBoundingClientRect()
  const above = rect.top > 220
  const left = Math.min(window.innerWidth - 150, Math.max(150, clientX))
  const style = above ? { left, top: rect.top - 8, transform: 'translate(-50%, -100%)' } : { left, top: rect.bottom + 8, transform: 'translate(-50%, 0)' }
  const timeText = `${formatUtcTime(t, false)} UTC · ${formatUtcDate(t).replace(/ \d{4}$/, '')} · ${relTime(t, now)}`
  return createPortal(
    <div role="tooltip" className="glass-strong pointer-events-none fixed z-[80] w-[260px] rounded-xl px-3 py-2.5 text-xs" style={style}>
      {marker ? (
        <>
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-ink-500 uppercase">
            {marker.kind === 'alert' && marker.status ? (
              <span className="inline-flex items-center gap-1" style={{ color: STATUS_META[marker.status].color }}>
                <StatusIcon status={marker.status} size={11} />
                {STATUS_META[marker.status].label} alert
              </span>
            ) : (
              <>
                <MarkerSwatch kind={marker.kind} manual={marker.manual} uplink={marker.uplink} />
                {KIND_LABEL[marker.kind]}
              </>
            )}
          </div>
          <div className="mt-1 text-[13px] leading-snug font-semibold text-ink-100">{marker.title}</div>
          <div className="mt-0.5 leading-snug text-ink-300">{marker.meta}</div>
          <div className="tabular mt-1.5 text-[11px] text-ink-500">{timeText}</div>
          <div className="mt-1 text-[11px] font-semibold text-accent">{marker.target === 'comms' ? 'Click to open the Earth link' : 'Click to view'}</div>
        </>
      ) : (
        <>
          <div className="tabular text-[11px] font-semibold text-ink-300">{timeText}</div>
          {levels ? (
            <ul className="mt-1.5 flex flex-col gap-1">
              {lanes.map((l) => {
                const s = levels[l.id]
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <span className={clsx('font-semibold tracking-wide', l.cabin ? 'text-ink-500' : 'text-ink-300')}>{l.label}</span>
                    {s ? (
                      <span className="flex items-center gap-1.5" style={{ color: STATUS_META[s].color }}>
                        <StatusDot status={s} size={7} />
                        {STATUS_META[s].label}
                      </span>
                    ) : (
                      <span className="text-ink-500">Not recorded</span>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="mt-1 text-ink-500">No status recorded at this time.</div>
          )}
        </>
      )}
    </div>,
    document.body,
  )
}
