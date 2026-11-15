import clsx from 'clsx'
import { Activity, Cpu, WifiOff, Wind } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { STATUS_META } from '../../lib/status'
import type { MetricCode, Status } from '../../types/domain'
import { ENV_METRICS, METRIC_CATALOG, VITAL_METRICS } from '../../engine/catalog'
import { MetricValue } from '../../components/MetricValue'
import { Sparkline } from '../../components/Sparkline'
import { StatusIcon } from '../../components/Status'
import { deltaVsNormal, lastHours } from '../../components/format'
import { focusTarget } from '../shared/hooks'
import { BaselineInfo } from '../../components/BaselineInfo'
import { DevicesIndicator } from './DevicesIndicator'

const TILE_LABEL: Partial<Record<MetricCode, string>> = { SYSTOLIC_BP: 'Blood pressure', HRV_RMSSD: 'Heart variability' }
/** Short tile labels used below 1440 px wide and on short screens (see .vl-short in index.css). */
const TILE_SHORT: Partial<Record<MetricCode, string>> = { SYSTOLIC_BP: 'BP' }

function VitalTile({ astronautId, metric }: { astronautId: string; metric: MetricCode }) {
  const ms = useAppStore((s) => s.health[astronautId]?.metrics[metric])
  const hist = useAppStore((s) => s.history[astronautId]?.[metric])
  const selected = useAppStore((s) => s.selectedMetric === metric)
  const def = METRIC_CATALOG[metric]
  const status: Status = !ms || ms.current == null ? 'NO_DATA' : ms.status
  const meta = STATUS_META[status]
  const noData = status === 'NO_DATA'
  const delta = deltaVsNormal(ms, status)
  const band = ms?.baseline?.status === 'READY' ? { low: ms.baseline.low, high: ms.baseline.high } : null
  const lineColor = noData ? '#94a3b8' : status === 'LOW' ? '#5eead4' : meta.color
  return (
    <div className="relative flex min-w-0">
    <button
      type="button"
      onClick={() => focusTarget({ astronautId, metric })}
      aria-label={`${def.label}: ${noData ? 'signal lost' : `${ms?.current?.toFixed(def.decimals)} ${def.unit}, ${delta.text}`}. Status ${meta.crewLabel}. Open details.`}
      className={clsx(
        'focus-ring group relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl px-3 pt-2.5 pb-2 text-left transition-colors short:justify-center short:pt-2',
        noData ? 'border border-dashed border-nodata/45 bg-white/[0.015]' : 'bg-white/[0.03] ring-1 ring-white/[0.06] hover:bg-white/[0.06]',
        selected && 'ring-1 ring-accent/50',
      )}
    >
      {!noData && <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: meta.color, opacity: status === 'LOW' ? 0.55 : 1 }} aria-hidden />}
      <span className="flex items-center justify-between gap-1 short:pr-5">
        <span className="truncate text-[11px] font-semibold text-ink-300" title={`${def.label}. ${def.plainLanguage}`}>
          <span className="vl-full">{TILE_LABEL[metric] ?? def.label}</span>
          <span className="vl-short">{TILE_SHORT[metric] ?? def.shortLabel}</span>
        </span>
        <StatusIcon status={status} size={12} className={clsx('shrink-0', status === 'CRITICAL' && 'animate-breathe')} />
      </span>
      <span className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap">
        {noData ? (
          <span className="flex items-center gap-1.5 text-[15px] leading-[32px] font-semibold text-nodata xl:text-[17px] short:text-[14px] short:leading-[28px]">
            <WifiOff size={16} aria-hidden className="shrink-0" /> Signal lost
          </span>
        ) : (
          <>
            <MetricValue value={ms?.current} decimals={def.decimals} className="text-[25px] leading-[32px] font-semibold tracking-tight text-ink-100 short:leading-[28px]" />
            <span className="text-[11px] text-ink-500">{def.unit}</span>
          </>
        )}
      </span>
      <Sparkline points={lastHours(hist, 6)} color={lineColor} band={band} height={18} className="mt-0.5 w-full short:hidden" maxPoints={72} />
      <span className={clsx('mt-1 truncate pr-5 text-[10.5px] font-medium short:hidden', noData ? 'text-nodata' : delta.tone === 'in' ? 'text-ink-500' : '')} style={!noData && delta.tone !== 'in' ? { color: meta.color } : undefined}>
        {noData ? 'Check the sensor' : delta.tone === 'in' ? 'Normal for you' : delta.text}
      </span>
    </button>
    {/* Outside the tile button (no nested buttons). Short screens: top right, next to the status icon. */}
    <BaselineInfo metric={metric} baseline={ms?.baseline} prefer="top" className="absolute right-1.5 bottom-1.5 short:top-[7px] short:right-[26px] short:bottom-auto" />
    </div>
  )
}

function EnvTile({ metric }: { metric: MetricCode }) {
  const ms = useAppStore((s) => s.environment.metrics[metric])
  const def = METRIC_CATALOG[metric]
  const status: Status = !ms || ms.current == null ? 'NO_DATA' : ms.status
  const meta = STATUS_META[status]
  const noData = status === 'NO_DATA'
  return (
    <div
      className={clsx('flex min-w-0 flex-col justify-center rounded-lg px-2.5 py-1.5 short:py-[3px]', noData ? 'border border-dashed border-nodata/45' : 'bg-white/[0.03] ring-1 ring-white/[0.05]')}
      title={`${def.label}. ${def.plainLanguage} Status: ${meta.crewLabel}.`}
      role="group"
      aria-label={`${def.label}: ${noData ? 'signal lost' : `${ms?.current?.toFixed(def.decimals)} ${def.unit}`}, ${meta.crewLabel}`}
    >
      <span className="flex items-center justify-between gap-1 leading-tight">
        <span className="truncate text-[10px] text-ink-500">{def.shortLabel}</span>
        <StatusIcon status={status} size={11} className="shrink-0" />
      </span>
      <span className="flex items-baseline gap-0.5 leading-tight whitespace-nowrap">
        {noData ? <span className="text-[13px] font-semibold text-nodata">--</span> : <MetricValue value={ms?.current} decimals={def.decimals} className="text-[14px] font-semibold text-ink-100" />}
        <span className="text-[9.5px] text-ink-500">{def.unit}</span>
      </span>
    </div>
  )
}

const SECTION = 'glass flex min-w-0 flex-col rounded-2xl px-3 pt-2.5 pb-3 short:pt-2 short:pb-2'
const SECTION_TITLE = 'mb-1.5 flex shrink-0 items-center gap-2 px-1 text-[11px] leading-4 font-semibold tracking-[0.14em] whitespace-nowrap text-ink-500 uppercase short:mb-1'

export function VitalsStrip({ className }: { className?: string }) {
  const astronautId = useAppStore((s) => s.selectedAstronautId)
  const callsign = useAppStore((s) => s.crew.find((c) => c.id === s.selectedAstronautId)?.callsign)
  const envStatus = useAppStore((s) => s.environment.status)
  return (
    <div className={clsx('flex min-h-0 gap-3', className)}>
      <section data-tour="vitals" aria-label={`Live vitals for ${callsign}`} className={clsx(SECTION, 'flex-1')}>
        <h2 className={SECTION_TITLE}>
          <Activity size={12} aria-hidden /> Live vitals <span className="tracking-wide text-ink-300 normal-case">{callsign}</span>
          <span className="ml-auto font-normal tracking-normal normal-case present:hidden">last 6 h</span>
        </h2>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {VITAL_METRICS.map((m) => (
            <VitalTile key={m} astronautId={astronautId} metric={m} />
          ))}
        </div>
      </section>
      <section aria-label="Cabin environment" className={clsx(SECTION, 'hidden w-[220px] shrink-0 lg:flex xl:w-[276px]')}>
        <h2 className={SECTION_TITLE}>
          <Wind size={12} aria-hidden /> Cabin
          <span className="ml-auto flex items-center gap-1 tracking-normal normal-case">
            <StatusIcon status={envStatus} size={11} />
            <span style={{ color: STATUS_META[envStatus].color }}>{STATUS_META[envStatus].crewLabel}</span>
          </span>
        </h2>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 short:gap-1">
          {ENV_METRICS.map((m) => (
            <EnvTile key={m} metric={m} />
          ))}
        </div>
      </section>
      <section aria-label="Devices" className={clsx(SECTION, 'hidden w-[132px] shrink-0 lg:flex xl:w-[150px]')}>
        <h2 className={SECTION_TITLE}>
          <Cpu size={12} aria-hidden /> Devices
        </h2>
        <DevicesIndicator astronautId={astronautId} />
      </section>
    </div>
  )
}
