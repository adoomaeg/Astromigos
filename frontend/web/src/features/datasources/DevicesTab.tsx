import clsx from 'clsx'
import { ArrowRight, Cpu } from 'lucide-react'
import { useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { METRIC_CATALOG } from '../../engine/catalog'
import type { Device, DeviceKind, DeviceState } from '../../types/domain'
import { DEVICE_KIND_LABEL } from '../topbar/ProvenancePopover'
import { OriginBadge } from './shared'

/** Real world counterpart and the honest path to a real feed. No public live API is assumed. */
const REAL_PATH: Record<DeviceKind, { counterpart: string; path: string }> = {
  BIO_MONITOR: {
    counterpart: 'Bio-Monitor (Canadian Space Agency) smart shirt, based on Astroskin, used on the ISS.',
    path: 'No public live feed. An import adapter for exported recordings would map ECG derived heart rate, breathing and skin temperature to HealthObservation.',
  },
  ACTIGRAPHY: {
    counterpart: 'Actiwatch style wrist actigraphy used in NASA sleep and circadian studies.',
    path: 'Raw data is not public for all astronauts. Sleep and activity summaries from a study file could enter through the same adapter contract.',
  },
  BP_MONITOR: {
    counterpart: 'Point blood pressure measurements taken by the crew.',
    path: 'Manual entry (MANUAL) or file import. Not a continuous signal.',
  },
  EXERCISE_CEVIS: {
    counterpart: 'CEVIS cycle ergometer on the ISS.',
    path: 'Exercise equipment, not a medical monitor. Session summaries only, if the instrumentation exports them.',
  },
  EXERCISE_ARED: {
    counterpart: 'ARED resistive exercise device on the ISS.',
    path: 'Exercise equipment, not a medical monitor. Load and volume per session, if exported.',
  },
  EXERCISE_T2: {
    counterpart: 'T2 (COLBERT) treadmill on the ISS.',
    path: 'Exercise equipment, not a medical monitor. Duration, speed and harness load per session, if exported.',
  },
  ENV_SENSOR: {
    counterpart: 'ISS cabin CO2, temperature and humidity telemetry.',
    path: 'NASA OSDR Environmental Data Application (EDA) offers historical files; availability per mission still to be validated.',
  },
  DOSIMETER: {
    counterpart: 'Radiation dosimeters on board.',
    path: 'NASA RadLab lists historical dosimetry by instrument; coverage still to be validated.',
  },
}

const STATE_LABEL: Record<DeviceState, string> = { ONLINE: 'Online', DEGRADED: 'Degraded', DATA_STALE: 'Data stale', OFFLINE: 'Offline' }

export function DevicesTab() {
  const devices = useAppStore((s) => s.devices)
  const crew = useAppStore((s) => s.crew)
  const groups = useMemo(() => {
    const m = new Map<DeviceKind, Device[]>()
    for (const d of devices) m.set(d.kind, [...(m.get(d.kind) ?? []), d])
    return [...m.entries()]
  }, [devices])
  const who = (id: string | null) => {
    if (!id) return 'Cabin'
    const a = crew.find((c) => c.id === id)
    return a ? `${a.callsign} (${a.id})` : id
  }

  return (
    <div className="space-y-4">
      <div role="note" className="flex gap-3 rounded-xl bg-violet-400/[0.06] px-4 py-3 ring-1 ring-violet-300/20">
        <Cpu size={18} className="mt-0.5 shrink-0 text-violet-200" aria-hidden />
        <div className="text-xs leading-relaxed text-ink-300">
          <p className="font-semibold text-ink-100">Every crew reading on the dashboard is simulated today.</p>
          <p className="mt-1">
            Each device is a software adapter that produces the same canonical record a real feed would: value, unit, timestamp, quality, context and{' '}
            <span className="font-mono text-[11px]">data_origin</span>. Replacing a simulator with a real source means writing a new adapter. The baseline, anomaly, risk
            and forecast engine does not change. Owning an adapter does not mean a public API exists for that equipment.
          </p>
        </div>
      </div>

      <ol className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-300" aria-label="Data path">
        {['Device or file', 'Adapter (connect, read, normalize, status)', 'HealthObservation with data_origin', 'Baseline, anomaly, risk, forecast', 'Dashboard'].map((s, i, arr) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="rounded-lg bg-white/[0.04] px-2 py-1 ring-1 ring-white/[0.07]">{s}</span>
            {i < arr.length - 1 && <ArrowRight size={12} className="text-ink-500" aria-hidden />}
          </li>
        ))}
      </ol>

      <ul className="grid gap-3 md:grid-cols-2">
        {groups.map(([kind, list]) => {
          const metrics = [...new Set(list.flatMap((d) => d.metrics))]
          const path = REAL_PATH[kind]
          return (
            <li key={kind} className="rounded-2xl bg-white/[0.025] p-4 ring-1 ring-white/[0.08]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink-100">{DEVICE_KIND_LABEL[kind]}</h3>
                <div className="flex shrink-0 items-center gap-1.5">
                  {[...new Set(list.map((d) => d.data_origin))].map((o) => (
                    <OriginBadge key={o} origin={o} />
                  ))}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-ink-500">
                {metrics.map((m) => METRIC_CATALOG[m]?.label ?? m).join(', ') || 'No metrics'}
              </p>
              <ul className="mt-2 space-y-1">
                {list.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs">
                    <span className="min-w-0 truncate text-ink-300" title={d.name}>
                      {who(d.assignedTo)}
                    </span>
                    <span className={clsx('tabular shrink-0 text-[11px]', d.state === 'ONLINE' ? 'text-ink-500' : 'text-ink-100')}>
                      {STATE_LABEL[d.state]}
                      {d.batteryPct != null && <span className="text-ink-500"> · {Math.round(d.batteryPct)}% battery</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {path && (
                <dl className="mt-3 space-y-1 text-[11px] leading-relaxed">
                  <div>
                    <dt className="inline font-semibold text-ink-300">Real counterpart: </dt>
                    <dd className="inline text-ink-500">{path.counterpart}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-ink-300">Path to real data: </dt>
                    <dd className="inline text-ink-500">{path.path}</dd>
                  </div>
                </dl>
              )}
            </li>
          )
        })}
      </ul>
      {groups.length === 0 && <p className="text-xs text-ink-500">No devices registered in the simulation.</p>}
    </div>
  )
}
