import { FlaskConical, GitCompareArrows, ListChecks, RefreshCw, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAppStore } from '../../state/store'
import type { InterventionComparison, Recommendation, TimePoint } from '../../types/domain'
import { METRIC_CATALOG } from '../../engine/catalog'
import { Badge, Button, SectionLabel } from '../../components/ui'
import { downsample, fmtMetric, formatUtcTime } from '../../components/format'
import { Modal } from '../mission/Modal'
import { INTERVENTION_LABEL } from '../timeline/labels'

export interface WhatIfButtonProps {
  recommendation: Recommendation
}

const H = 3600000
const ACCENT = '#5eead4'
const WITHOUT = '#a9b6cf'
const CONTEXT_HOURS = 6

interface Row {
  t: number
  hist?: number | null
  without?: number | null
  with?: number | null
}

function relLabel(t: number, now: number): string {
  const h = Math.round((t - now) / H)
  if (h === 0) return 'Now'
  return h < 0 ? `${-h} h ago` : `+${h} h`
}

function lastValue(points: TimePoint[]): number | null {
  for (let i = points.length - 1; i >= 0; i--) if (points[i]!.v != null) return points[i]!.v
  return null
}

function ComparisonChart({ cmp, history }: { cmp: InterventionComparison; history: TimePoint[] | undefined }) {
  const def = METRIC_CATALOG[cmp.metric]
  const model = useMemo(() => {
    const now = cmp.without[0]?.t ?? cmp.with[0]?.t ?? 0
    const map = new Map<number, Row>()
    const row = (t: number) => {
      let r = map.get(t)
      if (!r) {
        r = { t }
        map.set(t, r)
      }
      return r
    }
    const hist = downsample(
      (history ?? []).filter((p) => p.t >= now - CONTEXT_HOURS * H && p.t <= now),
      120,
    )
    for (const p of hist) row(p.t).hist = p.v
    for (const p of cmp.without) row(p.t).without = p.v
    for (const p of cmp.with) row(p.t).with = p.v
    const rows = [...map.values()].sort((a, b) => a.t - b.t)
    const vals: number[] = []
    for (const r of rows) for (const v of [r.hist, r.without, r.with]) if (v != null) vals.push(v)
    if (cmp.band) vals.push(cmp.band.low, cmp.band.high)
    if (!vals.length) vals.push(def.displayRange[0], def.displayRange[1])
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.15
    lo -= pad
    hi += pad
    const from = hist.length ? hist[0]!.t : now
    const end = rows.length ? rows[rows.length - 1]!.t : now + cmp.horizonHours * H
    const step = cmp.horizonHours + CONTEXT_HOURS > 24 ? 6 * H : cmp.horizonHours + CONTEXT_HOURS > 12 ? 3 * H : 2 * H
    const ticks: number[] = []
    for (let t = now; t >= from; t -= step) ticks.unshift(t)
    for (let t = now + step; t <= end; t += step) ticks.push(t)
    return { rows, now, from, end, lo, hi, ticks }
  }, [cmp, history, def])
  const d = def.decimals
  return (
    <div className="h-[260px] w-full" role="img" aria-label={`${def.label}: projected trajectory with and without the action over the next ${cmp.horizonHours} hours`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={model.rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
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
          <YAxis domain={[model.lo, model.hi]} tickFormatter={(v: number) => v.toFixed(d)} axisLine={false} tickLine={false} width={40} tickCount={5} allowDataOverflow />
          {cmp.band && (
            <ReferenceArea
              y1={cmp.band.low}
              y2={cmp.band.high}
              fill={ACCENT}
              fillOpacity={0.08}
              stroke={ACCENT}
              strokeOpacity={0.22}
              strokeDasharray="3 4"
              ifOverflow="extendDomain"
              label={{ value: 'Personal normal', position: 'insideTopLeft', fill: ACCENT, fontSize: 10, opacity: 0.8 }}
            />
          )}
          <ReferenceArea x1={model.now} x2={model.end} fill="rgba(255,255,255,0.025)" />
          <ReferenceLine x={model.now} stroke="rgba(232,238,252,0.45)" strokeDasharray="2 3" label={{ value: 'Now', position: 'top', fill: '#e8eefc', fontSize: 10 }} />
          <Line dataKey="hist" stroke="#7d8ba6" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls={false} name="Recent" />
          <Line dataKey="without" stroke={WITHOUT} strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={false} connectNulls name="Without action" />
          <Line dataKey="with" stroke={ACCENT} strokeWidth={2.4} dot={false} isAnimationActive={false} connectNulls name="With action" activeDot={{ r: 4, strokeWidth: 2, stroke: '#0a1120' }} />
          <Tooltip
            cursor={{ stroke: 'rgba(232,238,252,0.25)' }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const r = payload[0]!.payload as Row
              return (
                <div className="glass-strong rounded-lg px-2.5 py-1.5 text-[11px] leading-tight">
                  <div className="text-ink-500">
                    {relLabel(r.t, model.now)} · {formatUtcTime(r.t, false)} UTC
                  </div>
                  {r.hist != null && <div className="tabular mt-0.5 text-ink-300">Recorded {fmtMetric(cmp.metric, r.hist)} {def.unit}</div>}
                  {r.without != null && (
                    <div className="tabular mt-0.5 text-ink-300">
                      Without action <span className="font-semibold text-ink-100">{fmtMetric(cmp.metric, r.without)}</span> {def.unit}
                    </div>
                  )}
                  {r.with != null && (
                    <div className="tabular mt-0.5 text-accent">
                      With action <span className="font-semibold">{fmtMetric(cmp.metric, r.with)}</span> {def.unit}
                    </div>
                  )}
                </div>
              )
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function LegendRow() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-300">
      <span className="flex items-center gap-1.5">
        <svg width="22" height="6" aria-hidden>
          <line x1="0" x2="22" y1="3" y2="3" stroke={WITHOUT} strokeWidth="2" strokeDasharray="5 4" />
        </svg>
        Without action
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="22" height="6" aria-hidden>
          <line x1="0" x2="22" y1="3" y2="3" stroke={ACCENT} strokeWidth="2.4" />
        </svg>
        With action
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-sm bg-accent/15 ring-1 ring-accent/30" aria-hidden />
        Personal normal
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="22" height="6" aria-hidden>
          <line x1="0" x2="22" y1="3" y2="3" stroke="#7d8ba6" strokeWidth="1.5" />
        </svg>
        Recent readings
      </span>
    </div>
  )
}

function WhatIfModal({ rec, onClose }: { rec: Recommendation; onClose: () => void }) {
  const callsign = useAppStore((s) => s.crew.find((c) => c.id === rec.astronautId)?.callsign ?? (rec.astronautId === 'CABIN' ? 'Cabin' : rec.astronautId))
  const [version, setVersion] = useState(0)
  // Snapshot on open (and on refresh): a projection is a point-in-time discussion aid.
  const cmp = useMemo<InterventionComparison | null>(() => {
    void version
    try {
      return useAppStore.getState().compareIntervention({ astronautId: rec.astronautId, kind: rec.interventionKind! })
    } catch {
      return null
    }
  }, [rec.astronautId, rec.interventionKind, version])
  const history = useAppStore((s) => (cmp ? s.history[cmp.astronautId]?.[cmp.metric] : undefined))
  const def = cmp ? METRIC_CATALOG[cmp.metric] : null
  const endWithout = cmp ? lastValue(cmp.without) : null
  const endWith = cmp ? lastValue(cmp.with) : null
  const kindLabel = INTERVENTION_LABEL[rec.interventionKind!]

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`What if: ${kindLabel.toLowerCase()}`}
      icon={<GitCompareArrows size={17} className="text-accent" aria-hidden />}
      subtitle={
        <span>
          {callsign} · {rec.title}
          {cmp && def ? ` · ${def.label}, next ${cmp.horizonHours} h` : ''}
        </span>
      }
      headerExtra={<Badge tone="sim">Simulated</Badge>}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-ink-500">Decision support only. Not a diagnosis. Discuss with the crew medical officer.</span>
          <Button variant="subtle" onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw size={13} aria-hidden /> Recompute from now
          </Button>
        </div>
      }
    >
      <div role="note" className="flex items-start gap-2.5 rounded-xl bg-amber-400/[0.08] px-3.5 py-3 ring-1 ring-amber-300/30">
        <FlaskConical size={17} className="mt-0.5 shrink-0 text-amber-200" aria-hidden />
        <div>
          <p className="text-[13.5px] leading-snug font-semibold text-amber-100">Simulation for discussion only. Not evidence of clinical efficacy.</p>
          {cmp?.disclaimer && cmp.disclaimer.trim() !== 'Simulation for discussion only. Not evidence of clinical efficacy.' && <p className="mt-0.5 text-xs leading-relaxed text-amber-100/75">{cmp.disclaimer}</p>}
        </div>
      </div>

      {!cmp || !def ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 px-6 py-12 text-center">
          <TriangleAlert size={22} className="text-ink-500" aria-hidden />
          <div className="text-sm font-semibold text-ink-100">No comparison available for this action</div>
          <p className="max-w-md text-xs leading-relaxed text-ink-500">
            The simulator could not project a with and without trajectory for {callsign} right now. This happens when recent data is missing or the action has no modeled effect. The recommendation itself still stands.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>{def.label}</SectionLabel>
            <LegendRow />
          </div>
          <div className="mt-2">
            <ComparisonChart cmp={cmp} history={history} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06]">
              <SectionLabel>In {cmp.horizonHours} hours</SectionLabel>
              <dl className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11px] text-ink-500">Without action</dt>
                  <dd className="tabular mt-0.5 text-xl font-semibold text-ink-100">
                    {fmtMetric(cmp.metric, endWithout)} <span className="text-xs font-normal text-ink-500">{def.unit}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-accent">With action</dt>
                  <dd className="tabular mt-0.5 text-xl font-semibold text-accent">
                    {fmtMetric(cmp.metric, endWith)} <span className="text-xs font-normal text-ink-500">{def.unit}</span>
                  </dd>
                </div>
              </dl>
              {cmp.band && (
                <p className="mt-2 text-xs leading-relaxed text-ink-300">
                  Personal normal range: {fmtMetric(cmp.metric, cmp.band.low)} to {fmtMetric(cmp.metric, cmp.band.high)} {def.unit}.
                </p>
              )}
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06]">
              <SectionLabel>
                <span className="flex items-center gap-1.5">
                  <ListChecks size={12} aria-hidden /> Assumptions
                </span>
              </SectionLabel>
              {cmp.assumptions.length ? (
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-ink-300 marker:text-ink-500">
                  {cmp.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-ink-500">No assumptions listed by the simulator.</p>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

/** Small button for an action card: opens the with vs without intervention comparison. */
export function WhatIfButton({ recommendation }: WhatIfButtonProps) {
  const [open, setOpen] = useState(false)
  if (recommendation.interventionKind == null || recommendation.interventionKind === 'SENSOR_CHECK') return null
  return (
    <>
      <Button
        variant="ghost"
        data-tour="whatif"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        aria-label={`Compare with and without: ${recommendation.title}`}
        title="Compare the projected trajectory with and without this action (simulation)"
      >
        <GitCompareArrows size={13} aria-hidden /> Compare
      </Button>
      {open && <WhatIfModal rec={recommendation} onClose={() => setOpen(false)} />}
    </>
  )
}
