import clsx from 'clsx'
import { Battery, BatteryLow, ChevronUp, CircleCheck, CircleDashed, Signal, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../state/store'
import type { Device, DeviceState } from '../../types/domain'
import { Popover } from '../../components/ui'
import { ORIGIN_LABEL, relTime } from '../../components/format'
import { DEVICE_KIND_LABEL } from '../topbar/ProvenancePopover'

const STATE_META: Record<DeviceState, { label: string; color: string; icon: LucideIcon; rank: number }> = {
  ONLINE: { label: 'Online', color: '#34d399', icon: CircleCheck, rank: 0 },
  DEGRADED: { label: 'Degraded', color: '#fbbf24', icon: TriangleAlert, rank: 1 },
  DATA_STALE: { label: 'Data stale', color: '#94a3b8', icon: CircleDashed, rank: 2 },
  OFFLINE: { label: 'Offline', color: '#94a3b8', icon: WifiOff, rank: 3 },
}

function DeviceRow({ d, now }: { d: Device; now: number }) {
  const m = STATE_META[d.state]
  const Icon = m.icon
  const bad = d.state === 'OFFLINE' || d.state === 'DATA_STALE'
  const lowBattery = d.batteryPct != null && d.batteryPct < 20
  return (
    <li className={clsx('rounded-xl px-3 py-2.5', bad ? 'border border-dashed border-nodata/45' : 'bg-white/[0.03] ring-1 ring-white/[0.05]')}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-ink-100">{d.name}</span>
          <span className="block truncate text-[11px] text-ink-500">
            {DEVICE_KIND_LABEL[d.kind]} {d.assignedTo ? '' : '· cabin'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold" style={{ color: m.color }}>
          <Icon size={13} aria-hidden /> {m.label}
        </span>
      </div>
      <div className="tabular mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
        <span className={clsx('flex items-center gap-1', lowBattery && 'text-watch')}>
          {lowBattery ? <BatteryLow size={12} aria-hidden /> : <Battery size={12} aria-hidden />}
          {d.batteryPct == null ? 'n/a' : `${Math.round(d.batteryPct)}%`}
        </span>
        <span className="flex items-center gap-1">
          <Signal size={12} aria-hidden />
          {d.signalPct == null ? 'n/a' : `${Math.round(d.signalPct)}%`}
        </span>
        <span>Seen {relTime(d.lastSeenAt, now)}</span>
        <span className="rounded bg-violet-400/10 px-1 text-[9.5px] font-bold text-violet-200 uppercase">{ORIGIN_LABEL[d.data_origin]}</span>
      </div>
    </li>
  )
}

export function DevicesIndicator({ astronautId }: { astronautId: string }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const devices = useAppStore((s) => s.devices)
  const now = useAppStore((s) => Math.floor(s.clock.simNow / 30000) * 30000)
  const mine = useMemo(() => devices.filter((d) => d.assignedTo === astronautId || d.assignedTo == null), [devices, astronautId])
  const online = mine.filter((d) => d.state === 'ONLINE').length
  const worst = mine.reduce<DeviceState>((w, d) => (STATE_META[d.state].rank > STATE_META[w].rank ? d.state : w), 'ONLINE')
  const wm = STATE_META[worst]
  const WIcon = wm.icon
  const minBattery = mine.reduce<number | null>((m, d) => (d.batteryPct == null ? m : m == null ? d.batteryPct : Math.min(m, d.batteryPct)), null)
  const problem = worst !== 'ONLINE'
  return (
    <div className="relative flex flex-1">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Devices: ${online} of ${mine.length} online. ${problem ? `Worst: ${wm.label}.` : ''} Open device list.`}
        className={clsx(
          'focus-ring flex flex-1 flex-col justify-between rounded-xl px-2.5 py-2 text-left transition-colors short:py-1.5',
          problem && worst !== 'DEGRADED' ? 'border border-dashed border-nodata/50 bg-white/[0.015]' : 'bg-white/[0.03] ring-1 ring-white/[0.06] hover:bg-white/[0.06]',
        )}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: wm.color }}>
          <WIcon size={13} aria-hidden /> {problem ? wm.label : 'All online'}
        </span>
        <span className="tabular text-[22px] leading-none font-semibold text-ink-100">
          {online}
          <span className="text-sm text-ink-500">/{mine.length}</span>
        </span>
        <span className="flex items-center justify-between text-[10.5px] text-ink-500">
          <span className="tabular flex items-center gap-1">
            <Battery size={11} aria-hidden /> {minBattery == null ? 'n/a' : `min ${Math.round(minBattery)}%`}
          </span>
          <ChevronUp size={12} aria-hidden />
        </span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} label="Devices" side="top" align="right" className="w-[340px] p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Devices</span>
          <span className="text-[11px] text-ink-500">Simulated adapters</span>
        </div>
        <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
          {[...mine]
            .sort((a, b) => STATE_META[b.state].rank - STATE_META[a.state].rank)
            .map((d) => (
              <DeviceRow key={d.id} d={d} now={now} />
            ))}
        </ul>
      </Popover>
    </div>
  )
}
