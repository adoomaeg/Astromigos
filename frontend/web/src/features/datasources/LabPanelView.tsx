import clsx from 'clsx'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ANALYTE_HINT, DEFAULT_ANALYTE, describeTimepoint, type LabAnalyte, type LabCell, type LabPanelDataset } from '../../data/osdr'
import { OriginBadge } from './shared'

const ACCENT = '#5eead4'
const CONTEXT = '#7d8ba6'
const MEAN = '#c7d2e8'
const FLIGHT = 'Flight'

function decimalsOf(a: LabAnalyte): number {
  let d = 0
  for (const cells of Object.values(a.values))
    for (const c of cells) {
      if (c?.v == null) continue
      const s = String(c.v)
      const i = s.indexOf('.')
      if (i >= 0) d = Math.max(d, s.length - i - 1)
    }
  return Math.min(d, 2)
}

function fmt(v: number | null | undefined, d: number): string {
  return v == null || !Number.isFinite(v) ? '--' : v.toFixed(d)
}

/** Reference range of a subject when it is the same at every time point, else null. */
function stableRange(cells: Array<LabCell | null>): { lo: number; hi: number } | null {
  let r: { lo: number; hi: number } | null = null
  for (const c of cells) {
    if (!c || c.lo == null || c.hi == null) continue
    if (!r) r = { lo: c.lo, hi: c.hi }
    else if (r.lo !== c.lo || r.hi !== c.hi) return null
  }
  return r
}

function rangeText(c: LabCell | null): string {
  if (!c) return ''
  if (c.lo != null && c.hi != null) return `${c.lo} to ${c.hi}`
  if (c.lo != null) return `at least ${c.lo}`
  if (c.hi != null) return `up to ${c.hi}`
  return 'not reported'
}

type Row = { x: string; sel: number | null; mean: number | null; meanN: number | null; tp: number | null } & Record<string, number | string | null>

export function LabPanelView({ ds }: { ds: LabPanelDataset }) {
  const uid = useId()
  const [analyteKey, setAnalyteKey] = useState(() => {
    const k = DEFAULT_ANALYTE[ds.panel.test_type]
    return ds.analytes.some((a) => a.key === k) ? k! : ds.analytes[0]!.key
  })
  const [subject, setSubject] = useState(ds.subjects[0]!.id)
  const a = ds.analytes.find((x) => x.key === analyteKey) ?? ds.analytes[0]!
  const d = decimalsOf(a)
  const others = ds.subjects.filter((s) => s.id !== subject)
  const selCells = a.values[subject] ?? []
  const band = stableRange(selCells)

  const rows = useMemo(() => {
    const out: Row[] = []
    ds.timepoints.forEach((tp, i) => {
      const prev = ds.timepoints[i - 1]
      if (prev && prev.phase === 'PRE_FLIGHT' && tp.phase === 'POST_FLIGHT') {
        out.push({ x: FLIGHT, sel: null, mean: null, meanN: null, tp: null })
      }
      const r: Row = { x: tp.label, sel: a.values[subject]?.[i]?.v ?? null, mean: a.mean[i] ?? null, meanN: a.mean_n[i] ?? null, tp: i }
      for (const s of ds.subjects) r[`s_${s.id}`] = a.values[s.id]?.[i]?.v ?? null
      out.push(r)
    })
    return out
  }, [ds, a, subject])

  const gapIdx = rows.findIndex((r) => r.x === FLIGHT)
  const gapFrom = gapIdx > 0 ? rows[gapIdx - 1]!.x : null
  const gapTo = gapIdx >= 0 && gapIdx < rows.length - 1 ? rows[gapIdx + 1]!.x : null
  const selSex = ds.subjects.find((s) => s.id === subject)?.sex
  const hint = ANALYTE_HINT[a.key]

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1" htmlFor={`${uid}-analyte`}>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Measurement</span>
          <select
            id={`${uid}-analyte`}
            value={a.key}
            onChange={(e) => setAnalyteKey(e.target.value)}
            className="focus-ring h-8 rounded-lg bg-space-850 px-2 text-xs text-ink-100 ring-1 ring-white/10"
          >
            {ds.analytes.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label} ({x.unit ?? 'unit not stated'})
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span id={`${uid}-subj`} className="text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
            Highlight subject
          </span>
          <div role="radiogroup" aria-labelledby={`${uid}-subj`} className="flex h-8 items-center rounded-lg bg-white/[0.035] p-[3px] ring-1 ring-white/[0.08]">
            {ds.subjects.map((s) => {
              const on = s.id === subject
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSubject(s.id)}
                  title={`Subject ${s.id} (sex in source: ${s.sex ?? 'not stated'})`}
                  className={clsx(
                    'focus-ring tabular flex h-full items-center rounded-md px-2 font-mono text-[11px] font-semibold transition-colors',
                    on ? 'bg-accent/[0.14] text-accent shadow-[inset_0_0_0_1px_rgba(94,234,212,0.35)]' : 'text-ink-500 hover:text-ink-100',
                  )}
                >
                  {s.id}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-ink-300">
        <span className="font-semibold text-ink-100">{a.label}</span>
        <span className="text-ink-500"> · {a.unit ?? 'unit not stated'}</span>
        {hint && <span className="text-ink-500"> · {hint}</span>}
      </p>

      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-300" aria-label="Chart legend">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: ACCENT }} aria-hidden />
          {subject} ({selSex ?? 'sex not stated'})
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded opacity-60" style={{ background: CONTEXT }} aria-hidden />
          Other subjects
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed" style={{ borderColor: MEAN }} aria-hidden />
          Group mean <OriginBadge origin="DERIVED" />
        </li>
        {band && (
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm ring-1 ring-white/20" style={{ background: 'rgba(232,238,252,0.1)' }} aria-hidden />
            Lab reference range for {subject} (source file)
          </li>
        )}
      </ul>

      <div
        className="mt-2 h-[220px] w-full"
        role="img"
        aria-label={`${a.label} in ${a.unit ?? 'unit not stated'} for subjects ${ds.subjects.map((s) => s.id).join(', ')} at time points ${ds.timepoints.map((t) => t.label).join(', ')}. ${subject} highlighted. Values are listed in the table below.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 10, right: 22, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            {gapFrom && gapTo && (
              <ReferenceArea
                x1={gapFrom}
                x2={gapTo}
                fill="rgba(255,255,255,0.03)"
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="2 3"
                label={{ value: 'No in-flight samples', position: 'insideTop', fill: '#7d8ba6', fontSize: 9 }}
              />
            )}
            {band && (
              <ReferenceArea y1={band.lo} y2={band.hi} fill="rgba(232,238,252,0.075)" stroke="rgba(232,238,252,0.3)" strokeDasharray="3 4" ifOverflow="extendDomain" />
            )}
            <XAxis dataKey="x" axisLine={false} tickLine={false} tickMargin={6} interval={0} tick={{ fontSize: 10, fill: '#7d8ba6' }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={44}
              tickCount={5}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => v.toFixed(d)}
              tick={{ fontSize: 10, fill: '#7d8ba6' }}
            />
            {others.map((s) => (
              <Line
                key={s.id}
                dataKey={`s_${s.id}`}
                stroke={CONTEXT}
                strokeOpacity={0.45}
                strokeWidth={1.25}
                dot={{ r: 2, fill: CONTEXT, strokeWidth: 0, fillOpacity: 0.6 }}
                activeDot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            ))}
            <Line dataKey="mean" stroke={MEAN} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />
            <Line
              dataKey="sel"
              stroke={ACCENT}
              strokeWidth={2}
              dot={{ r: 4, fill: ACCENT, stroke: '#0a1120', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: ACCENT, stroke: '#0a1120', strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(232,238,252,0.25)', strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0]!.payload as Row
                if (row.tp == null)
                  return <div className="glass-strong rounded-lg px-2.5 py-1.5 text-[11px] text-ink-300">Inspiration4 flight (3 days). No samples in this file.</div>
                const tp = ds.timepoints[row.tp]!
                return (
                  <div className="glass-strong min-w-[180px] rounded-lg px-2.5 py-2 text-[11px] leading-snug">
                    <div className="text-ink-500">{describeTimepoint(tp)}</div>
                    <ul className="tabular mt-1 space-y-0.5">
                      {ds.subjects.map((s) => {
                        const c = a.values[s.id]?.[row.tp!]
                        return (
                          <li key={s.id} className={clsx('flex justify-between gap-3', s.id === subject ? 'font-semibold text-ink-100' : 'text-ink-300')}>
                            <span className="font-mono">{s.id}</span>
                            <span>{c?.v != null ? `${fmt(c.v, d)} ${a.unit ?? ''}` : c?.raw ? `"${c.raw}" in source` : 'No value'}</span>
                          </li>
                        )
                      })}
                      <li className="flex justify-between gap-3 border-t border-white/[0.07] pt-0.5 text-ink-300">
                        <span>Mean (n={row.meanN ?? 0})</span>
                        <span>{row.mean != null ? `${fmt(row.mean, d)} ${a.unit ?? ''}` : '--'}</span>
                      </li>
                    </ul>
                  </div>
                )
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-white/[0.07]">
        <table className="tabular w-full min-w-[520px] border-collapse text-right text-[11px]">
          <caption className="sr-only">
            {a.label} values in {a.unit ?? 'unit not stated'} per subject and time point, as reported in {ds.file.file_name}
          </caption>
          <thead>
            <tr className="bg-white/[0.03] text-ink-500">
              <th scope="col" className="px-2.5 py-1.5 text-left font-semibold">
                Subject
              </th>
              {ds.timepoints.map((t) => (
                <th key={t.label} scope="col" className="px-2 py-1.5 font-mono font-semibold" title={describeTimepoint(t)}>
                  {t.label}
                </th>
              ))}
              <th scope="col" className="px-2.5 py-1.5 text-left font-semibold">
                Lab range
              </th>
            </tr>
          </thead>
          <tbody>
            {ds.subjects.map((s) => {
              const cells = a.values[s.id] ?? []
              const r = stableRange(cells)
              const on = s.id === subject
              return (
                <tr key={s.id} className={clsx('border-t border-white/[0.05]', on && 'bg-accent/[0.06]')}>
                  <th scope="row" className="px-2.5 py-1.5 text-left font-normal">
                    <button
                      type="button"
                      onClick={() => setSubject(s.id)}
                      aria-pressed={on}
                      className={clsx('focus-ring rounded font-mono font-semibold', on ? 'text-accent' : 'text-ink-300 hover:text-ink-100')}
                    >
                      {s.id}
                    </button>
                    <span className="ml-1.5 text-ink-500">{s.sex ?? '?'}</span>
                  </th>
                  {cells.map((c, i) => {
                    const above = c?.v != null && c.hi != null && c.v > c.hi
                    const below = c?.v != null && c.lo != null && c.v < c.lo
                    return (
                      <td key={i} className="px-2 py-1.5 text-ink-100" title={c ? `Lab range ${rangeText(c)}` : 'No row in the source file'}>
                        {c?.v != null ? (
                          <span className="inline-flex items-center justify-end gap-0.5">
                            {above && <ArrowUp size={10} className="text-ink-300" aria-hidden />}
                            {below && <ArrowDown size={10} className="text-ink-300" aria-hidden />}
                            {fmt(c.v, d)}
                            {(above || below) && <span className="sr-only">{above ? ' (above lab range)' : ' (below lab range)'}</span>}
                          </span>
                        ) : c?.raw ? (
                          <span className="text-ink-500 italic">{c.raw}</span>
                        ) : (
                          <span className="text-ink-500">--</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-2.5 py-1.5 text-left whitespace-nowrap text-ink-500">{r ? `${r.lo} to ${r.hi}` : 'varies'}</td>
                </tr>
              )
            })}
            <tr className="border-t border-white/[0.07] bg-white/[0.02]">
              <th scope="row" className="px-2.5 py-1.5 text-left font-normal text-ink-300">
                <span className="inline-flex items-center gap-1.5">
                  Mean <OriginBadge origin="DERIVED" />
                </span>
              </th>
              {a.mean.map((m, i) => (
                <td key={i} className="px-2 py-1.5 text-ink-300" title={`Mean of ${a.mean_n[i]} subjects with a value`}>
                  {fmt(m, Math.min(d + 1, 2))}
                </td>
              ))}
              <td className="px-2.5 py-1.5 text-left text-ink-500">sexes pooled</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
        Values exactly as reported in <span className="font-mono">{ds.file.file_name}</span>. Arrows mark values outside the testing lab&apos;s reference range printed in the
        file; those ranges are not NASA limits and are not used by Astromigos alerts. &quot;--&quot; means no row in the source file.
        {a.source_names.length > 1 && <> Source names merged: {a.source_names.join(', ')}.</>}
      </p>
    </div>
  )
}
