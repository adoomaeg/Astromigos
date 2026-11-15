import clsx from 'clsx'
import { Check, MessageCircleHeart, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Baseline, MetricCode, Prediction, RiskLevel, TimePoint } from '../types/domain'
import { METRIC_CATALOG } from '../engine/catalog'
import { STATUS_META } from '../lib/status'
import { downsample, fmtMetric, formatUtcTime, relTime } from './format'

/** Something that happened on the time axis (drawn as a marker over the chart). */
export interface ChartEvent {
  id: string
  t: number
  kind: 'alert' | 'intervention' | 'checkin'
  label: string
  detail?: string
  severity?: RiskLevel
}

const EVENT_KIND_LABEL: Record<ChartEvent['kind'], string> = { alert: 'Alert', intervention: 'Action logged', checkin: 'Check-in' }
const CHECKIN_COLOR = '#a5b4fc'

export function eventColor(e: ChartEvent): string {
  if (e.kind === 'alert') return STATUS_META[e.severity ?? 'MODERATE'].color
  if (e.kind === 'intervention') return '#5eead4'
  return CHECKIN_COLOR
}

function EventGlyph({ e, size = 11 }: { e: ChartEvent; size?: number }) {
  const c = eventColor(e)
  if (e.kind === 'alert') return <TriangleAlert size={size} strokeWidth={2.4} style={{ color: c }} aria-hidden />
  if (e.kind === 'intervention') return <Check size={size} strokeWidth={3} style={{ color: c }} aria-hidden />
  return <MessageCircleHeart size={size} strokeWidth={2.2} style={{ color: c }} aria-hidden />
}

/** Legend entries for the event kinds present in a chart. */
export function EventLegend({ events }: { events: ChartEvent[] }) {
  const kinds = [...new Set(events.map((e) => e.kind))]
  if (!kinds.length) return null
  return (
    <>
      {kinds.map((k) => (
        <span key={k} className="flex items-center gap-1">
          <EventGlyph e={{ id: k, t: 0, kind: k, label: '', severity: 'HIGH' }} size={10} /> {EVENT_KIND_LABEL[k]}
        </span>
      ))}
    </>
  )
}

interface Row {
  t: number
  v?: number | null
  fc?: number
  range?: [number, number]
}

const H = 3600000

function relLabel(t: number, now: number): string {
  const h = Math.round((t - now) / H)
  if (h === 0) return 'Now'
  return h < 0 ? `${-h} h ago` : `+${h} h`
}

/**
 * Metric trend: personal normal band (shaded), history line (nulls break it),
 * and the forecast cone after "now".
 */
export function TrendChart({
  metric,
  history,
  baseline,
  prediction,
  color,
  windowHours = 12,
  height = 180,
  events,
}: {
  metric: MetricCode
  history: TimePoint[]
  baseline: Baseline | null
  prediction: Prediction | null
  color: string
  windowHours?: number
  height?: number
  /** Optional event markers (alerts, logged actions, check-ins) on the time axis. */
  events?: ChartEvent[]
}) {
  const def = METRIC_CATALOG[metric]
  const [hoverEvent, setHoverEvent] = useState<string | null>(null)
  const model = useMemo(() => {
    if (history.length === 0) return null
    const now = history[history.length - 1]!.t
    const from = now - windowHours * H
    const hist = downsample(
      history.filter((p) => p.t >= from),
      240,
    )
    const rows: Row[] = hist.map((p) => ({ t: p.t, v: p.v }))
    const fcPts = prediction?.eligible ? prediction.points.filter((p) => p.t > now) : []
    const lastVal = [...hist].reverse().find((p) => p.v != null)
    if (fcPts.length) {
      const anchor = lastVal?.v ?? fcPts[0]!.v
      const lastRow = rows[rows.length - 1]
      if (lastRow) {
        lastRow.fc = anchor
        lastRow.range = [anchor, anchor]
      }
      for (const p of fcPts) rows.push({ t: p.t, fc: p.v, range: [p.lo, p.hi] })
    }
    const vals: number[] = []
    for (const r of rows) {
      if (r.v != null) vals.push(r.v)
      if (r.range) vals.push(r.range[0], r.range[1])
    }
    if (baseline?.status === 'READY') vals.push(baseline.low, baseline.high)
    if (!vals.length) vals.push(def.displayRange[0], def.displayRange[1])
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.15
    lo -= pad
    hi += pad
    const end = rows[rows.length - 1]!.t
    const ticks: number[] = []
    const step = windowHours <= 6 ? 2 * H : windowHours <= 24 ? 6 * H : 24 * H
    for (let t = now; t >= from; t -= step) ticks.unshift(t)
    for (let t = now + step; t <= end; t += step) ticks.push(t)
    return { rows, now, from, end, lo, hi, ticks, hasFc: fcPts.length > 0 }
  }, [history, prediction, baseline, windowHours, def])

  if (!model) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-white/15 text-xs text-ink-500" style={{ height }}>
        No history yet
      </div>
    )
  }

  const d = def.decimals
  const shownEvents = (events ?? []).filter((e) => e.t >= model.from && e.t <= model.end).sort((a, b) => a.t - b.t)
  const span = model.end - model.from || 1
  return (
    <div style={{ height }} className="relative w-full">
      <div className="h-full w-full" role="img" aria-label={`${def.label} trend over the last ${windowHours} hours${model.hasFc ? ' with forecast' : ''}${shownEvents.length ? `, ${shownEvents.length} events marked` : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={model.rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[model.from, model.end]}
            ticks={model.ticks}
            tickFormatter={(t: number) => relLabel(t, model.now)}
            axisLine={false}
            tickLine={false}
            tickMargin={6}
            allowDataOverflow
          />
          <YAxis
            domain={[model.lo, model.hi]}
            tickFormatter={(v: number) => v.toFixed(d)}
            axisLine={false}
            tickLine={false}
            width={36}
            tickCount={4}
            allowDataOverflow
          />
          {baseline?.status === 'READY' && (
            <ReferenceArea
              y1={baseline.low}
              y2={baseline.high}
              fill="#5eead4"
              fillOpacity={0.08}
              stroke="#5eead4"
              strokeOpacity={0.22}
              strokeDasharray="3 4"
              ifOverflow="extendDomain"
              label={{ value: 'Your normal', position: 'insideTopLeft', fill: '#5eead4', fontSize: 10, opacity: 0.8 }}
            />
          )}
          {model.hasFc && <ReferenceArea x1={model.now} x2={model.end} fill="rgba(255,255,255,0.025)" />}
          <ReferenceLine x={model.now} stroke="rgba(232,238,252,0.35)" strokeDasharray="2 3" />
          {shownEvents.map((e) => (
            <ReferenceLine
              key={e.id}
              x={e.t}
              stroke={eventColor(e)}
              strokeOpacity={hoverEvent === e.id ? 0.9 : 0.4}
              strokeWidth={hoverEvent === e.id ? 1.5 : 1}
              strokeDasharray={e.kind === 'alert' ? undefined : '2 3'}
              ifOverflow="hidden"
            />
          ))}
          {model.hasFc && <Area type="monotone" dataKey="range" stroke="none" fill={color} fillOpacity={0.14} isAnimationActive={false} connectNulls />}
          {model.hasFc && (
            <Line type="monotone" dataKey="fc" stroke={color} strokeOpacity={0.75} strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} connectNulls />
          )}
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#0a1120' }} />
          <Tooltip
            cursor={{ stroke: 'rgba(232,238,252,0.25)', strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0]!.payload as Row
              const isFc = row.t > model.now
              return (
                <div className="glass-strong rounded-lg px-2.5 py-1.5 text-[11px] leading-tight">
                  <div className="text-ink-500">
                    {relLabel(row.t, model.now)} · {formatUtcTime(row.t, false)} UTC
                  </div>
                  {isFc && row.range ? (
                    <div className="tabular mt-0.5 text-ink-100">
                      Forecast {fmtMetric(metric, row.fc)} {def.unit}
                      <span className="text-ink-500">
                        {' '}
                        ({fmtMetric(metric, row.range[0])} to {fmtMetric(metric, row.range[1])})
                      </span>
                    </div>
                  ) : (
                    <div className="tabular mt-0.5 font-semibold text-ink-100">{row.v == null ? 'No data' : `${fmtMetric(metric, row.v)} ${def.unit}`}</div>
                  )}
                </div>
              )
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      {shownEvents.length > 0 && (
        // Plot area: YAxis width 36 on the left, chart margin 8 on the right.
        <ul className="pointer-events-none absolute top-0 right-2 left-9 h-4" aria-label="Events on this chart">
          {shownEvents.map((e) => {
            const x = ((e.t - model.from) / span) * 100
            const active = hoverEvent === e.id
            return (
              <li key={e.id} className="absolute top-0 -translate-x-1/2" style={{ left: `${x}%`, zIndex: active ? 2 : 1 }}>
                <button
                  type="button"
                  className="focus-ring pointer-events-auto flex h-4 w-4 items-center justify-center rounded-full bg-space-900/90 ring-1"
                  style={{ ['--tw-ring-color' as string]: `color-mix(in srgb, ${eventColor(e)} 55%, transparent)` }}
                  aria-label={`${EVENT_KIND_LABEL[e.kind]} at ${formatUtcTime(e.t, false)} UTC: ${e.label}`}
                  onMouseEnter={() => setHoverEvent(e.id)}
                  onMouseLeave={() => setHoverEvent((h) => (h === e.id ? null : h))}
                  onFocus={() => setHoverEvent(e.id)}
                  onBlur={() => setHoverEvent((h) => (h === e.id ? null : h))}
                >
                  <EventGlyph e={e} size={10} />
                </button>
                {active && (
                  <div
                    role="tooltip"
                    className={clsx('glass-strong pointer-events-none absolute top-5 z-10 w-max max-w-[220px] rounded-lg px-2.5 py-1.5 text-[11px] leading-snug', x > 60 ? 'right-0' : x < 40 ? 'left-0' : 'left-1/2 -translate-x-1/2')}
                  >
                    <div className="flex items-center gap-1.5 font-semibold" style={{ color: eventColor(e) }}>
                      <EventGlyph e={e} size={11} />
                      {EVENT_KIND_LABEL[e.kind]}
                      <span className="tabular font-normal text-ink-500">
                        {relTime(e.t, model.now)} · {formatUtcTime(e.t, false)} UTC
                      </span>
                    </div>
                    <div className="mt-0.5 text-ink-100">{e.label}</div>
                    {e.detail && <div className="mt-0.5 text-ink-500">{e.detail}</div>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
