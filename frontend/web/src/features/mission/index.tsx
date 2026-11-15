import clsx from 'clsx'
import { CalendarRange, Dumbbell, HeartPulse, Info, Moon, Radiation, ShieldCheck } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../state/store'
import { STATUS_META } from '../../lib/status'
import type { Astronaut, MissionDaySummary, MissionPlan, Status, TimePoint } from '../../types/domain'
import { Badge, SectionLabel } from '../../components/ui'
import { StatusIcon } from '../../components/Status'
import { Sparkline } from '../../components/Sparkline'
import { fmtNum } from '../../components/format'
import { Modal, TOPBAR_BUTTON } from './Modal'
import { MENU_ITEM, MenuRow } from '../topbar/menu'

const ACCENT = '#5eead4'
const GRID = 'rgba(255,255,255,0.05)'
const NO_DATA_BG = 'repeating-linear-gradient(135deg, rgba(148,163,184,0.55) 0 2px, rgba(148,163,184,0.12) 2px 5px)'

interface WeekStat {
  week: number
  label: string
  adherencePct: number | null
  sleepAvg: number | null
  days: number
  partial: boolean
}

interface Summary {
  days: MissionDaySummary[]
  lastDay: number
  cumulative: number
  avgDaily: number
  projectedEnd: number
  budgetPct: number
  projectedPct: number
  weeks: WeekStat[]
  adherence7: number | null
  sleep7: number | null
  hr: TimePoint[]
  hrv: TimePoint[]
  hrNow: number | null
  hrvNow: number | null
}

/** Round axis maximum and ticks (0, step, 2 step...). */
function niceAxis(max: number): { max: number; ticks: number[] } {
  const target = Math.max(1, max * 1.08)
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
  const step = steps.find((s) => target / s <= 6) ?? 1000
  const top = Math.ceil(target / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v)
  return { max: top, ticks }
}

/** Day ticks: day 1, then every 30 (or 14) days, and the last day. */
function dayTicks(last: number): number[] {
  const step = last > 120 ? 30 : last > 45 ? 14 : 7
  const out = [1]
  for (let d = step; d < last - step / 3; d += step) out.push(d)
  out.push(last)
  return out
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

function summarize(days: MissionDaySummary[], plan: MissionPlan): Summary | null {
  if (days.length === 0) return null
  const last = days[days.length - 1]!
  const recent = days.slice(-14)
  const avgDaily = mean(recent.map((d) => d.radiationDoseMgy)) ?? 0
  const remaining = Math.max(0, plan.plannedDurationDays - last.missionDay)
  const projectedEnd = last.cumulativeDoseMgy + avgDaily * remaining
  const budget = plan.radiationBudgetMgy > 0 ? plan.radiationBudgetMgy : 1

  const byWeek = new Map<number, MissionDaySummary[]>()
  for (const d of days) {
    const w = Math.ceil(d.missionDay / 7)
    const arr = byWeek.get(w) ?? []
    arr.push(d)
    byWeek.set(w, arr)
  }
  const adherence = (list: MissionDaySummary[]) => {
    // Days without exercise data are left out (missing is never counted as zero or as done).
    const known = list.filter((d) => d.exerciseMinutes != null)
    const planned = known.reduce((a, d) => a + d.exercisePlannedMinutes, 0)
    return planned > 0 ? (known.reduce((a, d) => a + (d.exerciseMinutes ?? 0), 0) / planned) * 100 : null
  }
  const sleepAvg = (list: MissionDaySummary[]) => mean(list.filter((d) => d.sleepHours != null).map((d) => d.sleepHours!))
  const weeks: WeekStat[] = [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, list]) => ({ week, label: `W${week}`, adherencePct: adherence(list), sleepAvg: sleepAvg(list), days: list.length, partial: list.length < 7 }))
  const last7 = days.slice(-7)
  const lastKnown = (key: 'restingHr' | 'hrv') => {
    for (let i = days.length - 1; i >= 0; i--) if (days[i]![key] != null) return days[i]![key]
    return null
  }
  return {
    days,
    lastDay: last.missionDay,
    cumulative: last.cumulativeDoseMgy,
    avgDaily,
    projectedEnd,
    budgetPct: (last.cumulativeDoseMgy / budget) * 100,
    projectedPct: (projectedEnd / budget) * 100,
    weeks,
    adherence7: adherence(last7),
    sleep7: sleepAvg(last7),
    hr: days.map((d) => ({ t: d.missionDay, v: d.restingHr })),
    hrv: days.map((d) => ({ t: d.missionDay, v: d.hrv })),
    hrNow: lastKnown('restingHr'),
    hrvNow: lastKnown('hrv'),
  }
}

function ChartTip({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="glass-strong rounded-lg px-2.5 py-1.5 text-[11px] leading-tight">
      <div className="text-ink-500">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="tabular mt-0.5 flex items-center gap-1.5 text-ink-100">
          {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} aria-hidden />}
          <span className="text-ink-300">{r.label}</span>
          <span className="font-semibold">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function Card({ title, icon, right, children, className }: { title: string; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06]', className)}>
      <SectionLabel right={right}>
        <span className="flex items-center gap-1.5">
          {icon}
          {title}
        </span>
      </SectionLabel>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

/** Progress vs budget with a projected marker. Not a status: neutral accent, words carry the meaning. */
function BudgetBar({ pct, projectedPct, height = 8 }: { pct: number; projectedPct: number; height?: number }) {
  const cur = Math.min(100, Math.max(0, pct))
  const proj = Math.min(100, Math.max(cur, projectedPct))
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-white/[0.06]" style={{ height }} aria-hidden>
      <div className="absolute inset-y-0 left-0 rounded-full border border-dashed border-accent/60 bg-accent/[0.08]" style={{ width: `${proj}%` }} />
      <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${cur}%` }} />
    </div>
  )
}

function RiskRibbon({ days, compact = false }: { days: MissionDaySummary[]; compact?: boolean }) {
  if (days.length === 0) return null
  return (
    <div className={clsx('flex w-full gap-px', compact ? 'h-3' : 'h-5')} role="img" aria-label={`Daily risk level for ${days.length} mission days`}>
      {days.map((d) => {
        const s: Status = d.riskLevel
        return (
          <span
            key={d.missionDay}
            title={`Day ${d.missionDay} · ${STATUS_META[s].label}${d.synthesized ? ' · summary' : ''}`}
            className="min-w-[2px] flex-1 first:rounded-l last:rounded-r"
            style={{ background: s === 'NO_DATA' ? NO_DATA_BG : STATUS_META[s].color, opacity: s === 'LOW' ? 0.45 : 1 }}
          />
        )
      })}
    </div>
  )
}

function RibbonLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
      {(['LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'NO_DATA'] as Status[]).map((s) => (
        <span key={s} className="flex items-center gap-1">
          <StatusIcon status={s} size={11} />
          {STATUS_META[s].label}
        </span>
      ))}
    </div>
  )
}

function Kpi({ icon, label, value, unit, sub, children }: { icon: ReactNode; label: string; value: string; unit?: string; sub: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06]">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="tabular text-2xl font-semibold text-ink-100">{value}</span>
        {unit && <span className="text-xs text-ink-500">{unit}</span>}
      </div>
      {children && <div className="mt-2">{children}</div>}
      <div className="mt-1.5 text-[11px] leading-snug text-ink-300">{sub}</div>
    </div>
  )
}

function AstronautView({ astronaut, sum, plan }: { astronaut: Astronaut; sum: Summary; plan: MissionPlan }) {
  const doseRows = useMemo(() => {
    const rows: { day: number; cum?: number; proj?: number }[] = sum.days.map((d) => ({ day: d.missionDay, cum: d.cumulativeDoseMgy }))
    const lastRow = rows[rows.length - 1]
    if (lastRow && plan.plannedDurationDays > sum.lastDay) {
      lastRow.proj = sum.cumulative
      rows.push({ day: plan.plannedDurationDays, proj: sum.projectedEnd })
    }
    return rows
  }, [sum, plan])
  const doseAxis = niceAxis(Math.max(plan.radiationBudgetMgy, sum.projectedEnd))
  const color = astronaut.color
  const over = sum.projectedPct > 100

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Radiation size={12} aria-hidden />}
          label="Radiation dose"
          value={fmtNum(sum.cumulative, 1)}
          unit={`of ${plan.radiationBudgetMgy} mGy demo budget`}
          sub={
            <>
              {Math.round(sum.budgetPct)}% used. At the current pace, about <span className="tabular font-semibold text-ink-100">{fmtNum(sum.projectedEnd, 0)} mGy</span> by day {plan.plannedDurationDays} (
              {Math.round(sum.projectedPct)}%).
              {over && (
                <Badge tone="warn" className="mt-1">
                  Projected above demo budget
                </Badge>
              )}
            </>
          }
        >
          <BudgetBar pct={sum.budgetPct} projectedPct={sum.projectedPct} />
        </Kpi>
        <Kpi
          icon={<Dumbbell size={12} aria-hidden />}
          label="Exercise, last 7 days"
          value={sum.adherence7 == null ? '--' : `${Math.round(sum.adherence7)}%`}
          unit="of plan"
          sub={`Plan: ${plan.exercisePlanMinutesPerDay} min per day. Days without data are left out.`}
        >
          <BudgetBar pct={sum.adherence7 ?? 0} projectedPct={0} height={6} />
        </Kpi>
        <Kpi
          icon={<Moon size={12} aria-hidden />}
          label="Sleep, last 7 days"
          value={fmtNum(sum.sleep7, 1)}
          unit="h per night"
          sub={sum.sleep7 == null ? 'No sleep data this week.' : `Target ${plan.sleepTargetHours} h. ${sum.sleep7 >= plan.sleepTargetHours ? 'On target.' : `${fmtNum(plan.sleepTargetHours - sum.sleep7, 1)} h short per night on average.`}`}
        />
        <Kpi
          icon={<HeartPulse size={12} aria-hidden />}
          label="Resting HR · HRV"
          value={`${fmtNum(sum.hrNow, 0)} · ${fmtNum(sum.hrvNow, 0)}`}
          unit="bpm · ms"
          sub="Latest daily values. Compare with the trend below, not with fixed limits."
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="Cumulative radiation dose" icon={<Radiation size={12} aria-hidden />} right={<span className="text-[11px] text-ink-500">dashed = linear projection</span>}>
          <div className="h-[190px]" role="img" aria-label={`Cumulative dose ${fmtNum(sum.cumulative, 1)} mGy, projected ${fmtNum(sum.projectedEnd, 0)} mGy at day ${plan.plannedDurationDays}`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={doseRows} margin={{ top: 14, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="day" type="number" domain={[1, Math.max(plan.plannedDurationDays, sum.lastDay)]} ticks={dayTicks(Math.max(plan.plannedDurationDays, sum.lastDay))} tickFormatter={(d: number) => `D${d}`} axisLine={false} tickLine={false} tickMargin={6} />
                <YAxis domain={[0, doseAxis.max]} ticks={doseAxis.ticks} tickFormatter={(v: number) => v.toFixed(0)} axisLine={false} tickLine={false} width={34} />
                <ReferenceLine
                  y={plan.radiationBudgetMgy}
                  stroke="rgba(232,238,252,0.55)"
                  strokeDasharray="4 4"
                  label={{ value: `Demo budget ${plan.radiationBudgetMgy} mGy`, position: 'insideTopLeft', fill: '#a9b6cf', fontSize: 10 }}
                />
                <ReferenceLine x={sum.lastDay} stroke="rgba(232,238,252,0.3)" strokeDasharray="2 3" label={{ value: 'Today', position: 'top', fill: '#a9b6cf', fontSize: 10 }} />
                <Line dataKey="cum" stroke={ACCENT} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
                <Line dataKey="proj" stroke={ACCENT} strokeOpacity={0.7} strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} connectNulls />
                <Tooltip
                  cursor={{ stroke: 'rgba(232,238,252,0.25)' }}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const r = payload[0]!.payload as { day: number; cum?: number; proj?: number }
                    const v = r.cum ?? r.proj
                    return <ChartTip title={`Mission day ${r.day}${r.cum == null ? ' (projection)' : ''}`} rows={[{ label: 'Dose', value: `${fmtNum(v, 1)} mGy` }]} />
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Exercise adherence by week" icon={<Dumbbell size={12} aria-hidden />} right={<span className="text-[11px] text-ink-500">% of planned minutes</span>}>
          <div className="h-[190px]" role="img" aria-label="Weekly exercise adherence versus plan">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sum.weeks} margin={{ top: 14, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={6} interval="preserveStartEnd" />
                <YAxis domain={[0, (max: number) => Math.max(120, Math.ceil(max / 10) * 10)]} tickFormatter={(v: number) => `${v}%`} axisLine={false} tickLine={false} width={40} tickCount={4} />
                <ReferenceLine y={100} stroke="rgba(232,238,252,0.45)" strokeDasharray="4 4" label={{ value: 'Plan', position: 'insideTopRight', fill: '#a9b6cf', fontSize: 10 }} />
                <Bar dataKey="adherencePct" fill={ACCENT} fillOpacity={0.75} radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={22} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const w = payload[0]!.payload as WeekStat
                    return <ChartTip title={`Week ${w.week}${w.partial ? ` (${w.days} days)` : ''}`} rows={[{ label: 'Adherence', value: w.adherencePct == null ? 'no data' : `${Math.round(w.adherencePct)}%` }]} />
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Sleep by week" icon={<Moon size={12} aria-hidden />} right={<span className="text-[11px] text-ink-500">average hours per night</span>}>
          <div className="h-[170px]" role="img" aria-label={`Weekly sleep average versus a ${plan.sleepTargetHours} hour target`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sum.weeks} margin={{ top: 14, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={6} interval="preserveStartEnd" />
                <YAxis domain={[0, 10]} axisLine={false} tickLine={false} width={34} tickCount={6} tickFormatter={(v: number) => `${v} h`} />
                <ReferenceLine y={plan.sleepTargetHours} stroke="rgba(232,238,252,0.45)" strokeDasharray="4 4" label={{ value: `Target ${plan.sleepTargetHours} h`, position: 'insideTopRight', fill: '#a9b6cf', fontSize: 10 }} />
                <Bar dataKey="sleepAvg" fill="#7dd3fc" fillOpacity={0.7} radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={22} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const w = payload[0]!.payload as WeekStat
                    return <ChartTip title={`Week ${w.week}`} rows={[{ label: 'Sleep', value: w.sleepAvg == null ? 'no data' : `${fmtNum(w.sleepAvg, 1)} h` }]} />
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Resting heart rate and HRV" icon={<HeartPulse size={12} aria-hidden />} right={<span className="text-[11px] text-ink-500">per mission day</span>}>
          <div className="grid h-[170px] grid-rows-2 gap-1">
            {(
              [
                { key: 'restingHr', label: 'Resting HR', unit: 'bpm', dash: undefined },
                { key: 'hrv', label: 'HRV', unit: 'ms', dash: '4 3' },
              ] as const
            ).map((s) => (
              <div key={s.key} className="relative min-h-0" role="img" aria-label={`${s.label} over mission days`}>
                <span className="absolute top-0 left-10 z-10 text-[10px] font-semibold text-ink-500">
                  {s.label} <span className="font-normal">({s.unit})</span>
                </span>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sum.days} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="missionDay" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(d: number) => `D${d}`} axisLine={false} tickLine={false} tickMargin={4} hide={s.key === 'restingHr'} />
                    <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} width={34} tickCount={3} />
                    <Line dataKey={s.key} stroke={color} strokeWidth={1.8} strokeDasharray={s.dash} dot={false} isAnimationActive={false} connectNulls={false} />
                    <Tooltip
                      cursor={{ stroke: 'rgba(232,238,252,0.25)' }}
                      isAnimationActive={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0]!.payload as MissionDaySummary
                        const v = d[s.key]
                        return <ChartTip title={`Mission day ${d.missionDay}`} rows={[{ label: s.label, value: v == null ? 'no data' : `${fmtNum(v, 0)} ${s.unit}`, color }]} />
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Daily risk level" icon={<ShieldCheck size={12} aria-hidden />} right={<RibbonLegend />}>
        <RiskRibbon days={sum.days} />
        <div className="tabular mt-1 flex justify-between text-[10px] text-ink-500">
          <span>Day {sum.days[0]!.missionDay}</span>
          <span>Day {sum.lastDay}</span>
        </div>
      </Card>
    </div>
  )
}

function CrewView({ crew, sums, plan, onPick }: { crew: Astronaut[]; sums: Record<string, Summary | null>; plan: MissionPlan; onPick: (id: string) => void }) {
  const doseRows = useMemo(() => {
    const byDay = new Map<number, Record<string, number>>()
    for (const c of crew) {
      for (const d of sums[c.id]?.days ?? []) {
        const row = byDay.get(d.missionDay) ?? { day: d.missionDay }
        row[c.id] = d.cumulativeDoseMgy
        byDay.set(d.missionDay, row)
      }
    }
    const rows = [...byDay.values()].sort((a, b) => a.day! - b.day!)
    // Linear projection to the planned end, drawn dashed per crew member.
    const end: Record<string, number> = { day: plan.plannedDurationDays }
    let any = false
    for (const c of crew) {
      const sm = sums[c.id]
      if (!sm || plan.plannedDurationDays <= sm.lastDay) continue
      const row = byDay.get(sm.lastDay)
      if (row) row[`${c.id}_p`] = sm.cumulative
      end[`${c.id}_p`] = sm.projectedEnd
      any = true
    }
    if (any) rows.push(end)
    return rows
  }, [crew, sums, plan.plannedDurationDays])
  const doseAxis = niceAxis(Math.max(plan.radiationBudgetMgy, ...crew.map((c) => sums[c.id]?.projectedEnd ?? 0)))
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl ring-1 ring-white/[0.06]">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
              <th className="px-3 py-2 font-semibold">Crew</th>
              <th className="px-3 py-2 font-semibold">Radiation vs demo budget</th>
              <th className="px-3 py-2 font-semibold">Exercise 7 d</th>
              <th className="px-3 py-2 font-semibold">Sleep 7 d</th>
              <th className="px-3 py-2 font-semibold">Resting HR</th>
              <th className="px-3 py-2 font-semibold">HRV</th>
              <th className="w-[22%] px-3 py-2 font-semibold">Daily risk</th>
            </tr>
          </thead>
          <tbody>
            {crew.map((c) => {
              const s = sums[c.id]
              return (
                <tr key={c.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025]">
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => onPick(c.id)} className="focus-ring flex items-center gap-2 rounded text-left" title={`Open ${c.callsign}`}>
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
                      <span>
                        <span className="block text-[13px] font-semibold text-ink-100 hover:text-accent">{c.callsign}</span>
                        <span className="block text-[10px] text-ink-500">{c.roleShort}</span>
                      </span>
                    </button>
                  </td>
                  {s ? (
                    <>
                      <td className="px-3 py-2.5">
                        <div className="tabular flex items-baseline justify-between gap-2 text-ink-300">
                          <span>
                            <span className="font-semibold text-ink-100">{fmtNum(s.cumulative, 1)}</span> mGy
                          </span>
                          <span className="text-[10px] text-ink-500">proj. {fmtNum(s.projectedEnd, 0)}</span>
                        </div>
                        <div className="mt-1">
                          <BudgetBar pct={s.budgetPct} projectedPct={s.projectedPct} height={5} />
                        </div>
                      </td>
                      <td className="tabular px-3 py-2.5 text-[13px] font-semibold text-ink-100">{s.adherence7 == null ? '--' : `${Math.round(s.adherence7)}%`}</td>
                      <td className="tabular px-3 py-2.5 text-ink-300">
                        <span className="text-[13px] font-semibold text-ink-100">{fmtNum(s.sleep7, 1)}</span> h
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Sparkline points={s.hr} color={c.color} height={22} className="w-16" fill={false} />
                          <span className="tabular text-ink-300">{fmtNum(s.hrNow, 0)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Sparkline points={s.hrv} color={c.color} height={22} className="w-16" fill={false} />
                          <span className="tabular text-ink-300">{fmtNum(s.hrvNow, 0)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <RiskRibbon days={s.days.slice(-42)} compact />
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className="px-3 py-2.5 text-ink-500">
                      No mission history yet.
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Card
        title="Cumulative radiation dose, whole crew (dashed = projection)"
        icon={<Radiation size={12} aria-hidden />}
        right={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-300">
            {crew.map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <span className="h-0.5 w-3 rounded" style={{ background: c.color }} aria-hidden />
                {c.callsign}
              </span>
            ))}
          </span>
        }
      >
        <div className="h-[220px]" role="img" aria-label="Cumulative radiation dose per crew member versus the demo budget">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={doseRows} margin={{ top: 14, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="day" type="number" domain={[1, 'dataMax']} ticks={dayTicks(doseRows[doseRows.length - 1]?.day ?? 1)} tickFormatter={(d: number) => `D${d}`} axisLine={false} tickLine={false} tickMargin={6} />
              <YAxis domain={[0, doseAxis.max]} ticks={doseAxis.ticks} tickFormatter={(v: number) => v.toFixed(0)} axisLine={false} tickLine={false} width={34} />
              <ReferenceLine y={plan.radiationBudgetMgy} stroke="rgba(232,238,252,0.55)" strokeDasharray="4 4" label={{ value: `Demo budget ${plan.radiationBudgetMgy} mGy`, position: 'insideTopLeft', fill: '#a9b6cf', fontSize: 10 }} />
              {crew.map((c) => (
                <Line key={c.id} dataKey={c.id} name={c.callsign} stroke={c.color} strokeWidth={1.8} dot={false} isAnimationActive={false} />
              ))}
              {crew.map((c) => (
                <Line key={`${c.id}_p`} dataKey={`${c.id}_p`} stroke={c.color} strokeOpacity={0.6} strokeWidth={1.4} strokeDasharray="4 4" dot={false} isAnimationActive={false} connectNulls />
              ))}
              <Tooltip
                cursor={{ stroke: 'rgba(232,238,252,0.25)' }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const r = payload[0]!.payload as Record<string, number>
                  const proj = crew.every((c) => r[c.id] == null)
                  return (
                    <ChartTip
                      title={`Mission day ${r.day}${proj ? ' (projection)' : ''}`}
                      rows={crew.filter((c) => (r[c.id] ?? r[`${c.id}_p`]) != null).map((c) => ({ label: c.callsign, value: `${fmtNum(r[c.id] ?? r[`${c.id}_p`], 1)} mGy`, color: c.color }))}
                    />
                  )
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

function MissionOverview({ onClose }: { onClose: () => void }) {
  const { crew, missionDays, plan, mission, selectedId } = useAppStore(
    useShallow((s) => ({ crew: s.crew, missionDays: s.missionDays, plan: s.missionPlan, mission: s.mission, selectedId: s.selectedAstronautId })),
  )
  const [view, setView] = useState<string>(selectedId)
  const sums = useMemo(() => {
    const out: Record<string, Summary | null> = {}
    for (const c of crew) out[c.id] = summarize(missionDays[c.id] ?? [], plan)
    return out
  }, [crew, missionDays, plan])
  const anyData = crew.some((c) => sums[c.id])
  const lastDay = Math.max(0, ...crew.map((c) => sums[c.id]?.lastDay ?? 0))
  const astronaut = crew.find((c) => c.id === view)
  const sum = astronaut ? sums[astronaut.id] : null
  const tabs = [{ id: 'CREW', label: 'Whole crew', color: null as string | null }, ...crew.map((c) => ({ id: c.id, label: c.callsign, color: c.color }))]

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Mission overview"
      icon={<CalendarRange size={17} className="text-accent" aria-hidden />}
      subtitle={
        <span className="tabular">
          {mission.name} · {lastDay > 0 ? `Day ${lastDay} of ${plan.plannedDurationDays} planned` : `${plan.plannedDurationDays} days planned`}
        </span>
      }
      headerExtra={<Badge tone="sim">Simulated</Badge>}
      footer={
        <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-500">
          <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold text-ink-300">Demo configuration, not official limits. Simulated data.</strong> Budgets and targets come from the mission plan for this demo. Projections are simple linear extrapolations for discussion.{plan.note && !/not official/i.test(plan.note) ? ` ${plan.note}` : ''}
          </span>
        </div>
      }
    >
      {lastDay > 0 && (
        <div className="mb-4">
          <div className="tabular flex items-center justify-between text-[11px] text-ink-500">
            <span>Mission progress</span>
            <span>{Math.round((lastDay / plan.plannedDurationDays) * 100)}%</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
            <div className="h-full rounded-full bg-ink-300/60" style={{ width: `${Math.min(100, (lastDay / plan.plannedDurationDays) * 100)}%` }} />
          </div>
        </div>
      )}
      <div role="tablist" aria-label="Choose crew member" className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const on = view === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setView(t.id)}
              className={clsx(
                'focus-ring flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                on ? 'bg-accent/12 text-accent ring-1 ring-accent/40' : 'text-ink-300 ring-1 ring-white/[0.07] hover:bg-white/[0.05] hover:text-ink-100',
              )}
            >
              {t.color && <span className="h-2 w-2 rounded-full" style={{ background: t.color }} aria-hidden />}
              {t.label}
            </button>
          )
        })}
      </div>
      {!anyData ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 px-6 py-14 text-center">
          <CalendarRange size={26} className="text-ink-500" aria-hidden />
          <div className="text-sm font-semibold text-ink-100">Mission history is being prepared</div>
          <p className="max-w-md text-xs leading-relaxed text-ink-500">Daily summaries (radiation, exercise, sleep, resting heart rate and HRV) appear here once the simulator has produced mission days.</p>
        </div>
      ) : view === 'CREW' || !astronaut ? (
        <CrewView crew={crew} sums={sums} plan={plan} onPick={setView} />
      ) : sum ? (
        <AstronautView astronaut={astronaut} sum={sum} plan={plan} />
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 px-6 py-10 text-center text-xs text-ink-500">No mission history for {astronaut.callsign} yet.</div>
      )}
    </Modal>
  )
}

/** Opens the long-term mission view (radiation budget, exercise adherence, sleep trend). */
/** Opens the long-term mission overview. variant="menuitem" renders it as a row of the top bar Tools menu. */
export function MissionOverviewButton({ variant = 'toolbar' }: { variant?: 'toolbar' | 'menuitem' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {variant === 'menuitem' ? (
        <button type="button" role="menuitem" tabIndex={-1} data-tour="mission" aria-haspopup="dialog" onClick={() => setOpen(true)} className={MENU_ITEM}>
          <MenuRow icon={<CalendarRange size={16} />} label="Mission overview" hint="Radiation, exercise and sleep over the mission" />
        </button>
      ) : (
        <button type="button" data-tour="mission" aria-haspopup="dialog" onClick={() => setOpen(true)} className={TOPBAR_BUTTON} title="Long-term mission view: radiation, exercise, sleep">
          <CalendarRange size={14} className="text-accent" aria-hidden />
          <span>Mission</span>
        </button>
      )}
      {open && <MissionOverview onClose={() => setOpen(false)} />}
    </>
  )
}
