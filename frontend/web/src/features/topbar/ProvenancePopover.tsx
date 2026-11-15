import { Database, FlaskConical } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../state/store'
import type { DeviceKind } from '../../types/domain'
import { Popover } from '../../components/ui'

export const DEVICE_KIND_LABEL: Record<DeviceKind, string> = {
  BIO_MONITOR: 'Bio-Monitor smart shirt',
  ACTIGRAPHY: 'Actigraphy wrist device',
  BP_MONITOR: 'Blood pressure cuff',
  EXERCISE_CEVIS: 'CEVIS cycle ergometer',
  EXERCISE_ARED: 'ARED resistive exercise',
  EXERCISE_T2: 'T2 treadmill',
  ENV_SENSOR: 'Cabin environment sensor',
  DOSIMETER: 'Radiation dosimeter',
}

/** Always visible, quiet SIMULATED chip next to the logo; opens a short explanation of where the data comes from. */
export function ProvenanceBadge() {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const devices = useAppStore((s) => s.devices)
  const kinds = useMemo(() => {
    const m = new Map<DeviceKind, number>()
    for (const d of devices) m.set(d.kind, (m.get(d.kind) ?? 0) + 1)
    return [...m.entries()]
  }, [devices])
  return (
    <div className="relative shrink-0">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        aria-label="Simulated data. All data on this screen is simulated. Show where it comes from"
        className="focus-ring flex h-6 items-center gap-1 rounded-md bg-violet-400/[0.08] px-1.5 text-[10px] font-semibold tracking-[0.1em] whitespace-nowrap text-violet-200/90 uppercase ring-1 ring-violet-300/25 transition-colors hover:bg-violet-400/15 hover:text-violet-100"
        title="All data on this screen is simulated. Click for details."
      >
        <FlaskConical size={11} aria-hidden />
        Simulated
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} label="Data provenance" className="w-[360px] p-4" align="left">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
          <Database size={15} className="text-accent" aria-hidden /> Where this data comes from
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-ink-300">
          Every reading here is <strong className="text-violet-200">simulated</strong> by device adapters that mimic the equipment astronauts wear and use. Nothing comes from a real person.
        </p>
        <ul className="mt-3 space-y-2 text-xs">
          <li className="flex gap-2">
            <span className="mt-0.5 rounded bg-violet-400/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-200">SIMULATED</span>
            <span className="text-ink-300">Active now. Wearables, exercise devices, cabin sensors and dosimeters.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-ink-500">REAL_PUBLIC</span>
            <span className="text-ink-500">Reference only. Public NASA OSDR blood panels (Inspiration4) in Data and model. They never feed the crew, baselines or alerts.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-ink-500">DERIVED</span>
            <span className="text-ink-500">Values computed from other readings (baselines, risk, forecasts).</span>
          </li>
        </ul>
        <div className="mt-4 text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Device adapters</div>
        <ul className="mt-1.5 grid grid-cols-1 gap-1">
          {kinds.map(([k, n]) => (
            <li key={k} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs text-ink-300">
              {DEVICE_KIND_LABEL[k]}
              <span className="tabular text-ink-500">x{n}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-500">Decision support only. Not a diagnosis. Not a medical device.</p>
      </Popover>
    </div>
  )
}
