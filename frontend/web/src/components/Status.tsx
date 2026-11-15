import clsx from 'clsx'
import { CircleCheck, Eye, OctagonAlert, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Status } from '../types/domain'
import { STATUS_META } from '../lib/status'

export const STATUS_ICON: Record<Status, LucideIcon> = {
  LOW: CircleCheck,
  MODERATE: Eye,
  HIGH: TriangleAlert,
  CRITICAL: OctagonAlert,
  NO_DATA: WifiOff,
}

export function isUrgent(s: Status): boolean {
  return s === 'HIGH' || s === 'CRITICAL'
}

export function StatusIcon({ status, className, size = 14 }: { status: Status; className?: string; size?: number }) {
  const Icon = STATUS_ICON[status]
  return <Icon aria-hidden size={size} strokeWidth={2.2} className={className} style={{ color: STATUS_META[status].color }} />
}

/** Small dot. NO_DATA renders hollow and dashed so it never reads as normal. */
export function StatusDot({ status, size = 8, pulse = false, className }: { status: Status; size?: number; pulse?: boolean; className?: string }) {
  const meta = STATUS_META[status]
  const style: CSSProperties =
    status === 'NO_DATA'
      ? { width: size, height: size, border: `1.5px dashed ${meta.color}` }
      : { width: size, height: size, background: meta.color, boxShadow: `0 0 8px ${meta.glow}`, ['--ring-color' as string]: meta.glow }
  return (
    <span
      aria-hidden
      className={clsx('inline-block shrink-0 rounded-full', pulse && status === 'CRITICAL' && 'animate-pulse-ring-fast', pulse && status === 'HIGH' && 'animate-pulse-ring', className)}
      style={style}
    />
  )
}

/** Status pill: icon + words + color, never color alone. */
export function StatusPill({
  status,
  variant = 'crew',
  size = 'md',
  className,
}: {
  status: Status
  variant?: 'crew' | 'technical' | 'both'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const meta = STATUS_META[status]
  const text = variant === 'crew' ? meta.crewLabel : variant === 'technical' ? meta.label : `${meta.crewLabel} · ${meta.label}`
  const noData = status === 'NO_DATA'
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
        size === 'lg' && 'px-3 py-1.5 text-sm',
        noData && 'border border-dashed',
        className,
      )}
      style={{
        color: meta.color,
        background: noData ? 'rgba(148,163,184,0.08)' : `color-mix(in srgb, ${meta.color} 14%, transparent)`,
        borderColor: noData ? 'rgba(148,163,184,0.5)' : undefined,
        boxShadow: noData ? undefined : `inset 0 0 0 1px color-mix(in srgb, ${meta.color} 30%, transparent)`,
      }}
    >
      <StatusIcon status={status} size={size === 'lg' ? 15 : size === 'sm' ? 12 : 13} />
      {text}
    </span>
  )
}
