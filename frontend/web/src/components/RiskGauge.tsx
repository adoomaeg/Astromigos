import type { Status } from '../types/domain'
import { STATUS_META } from '../lib/status'
import { MetricValue } from './MetricValue'

/** Semi circular 0..100 gauge for the prototype risk score. */
export function RiskGauge({ score, status, size = 132 }: { score: number; status: Status; size?: number }) {
  const r = 52
  const cx = 60
  const cy = 58
  const len = Math.PI * r
  const k = Math.max(0, Math.min(100, score)) / 100
  const color = STATUS_META[status].color
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  return (
    <div className="relative" style={{ width: size, height: size * 0.6 }} role="img" aria-label={`Risk score ${Math.round(score)} out of 100`}>
      <svg viewBox="0 0 120 66" width={size} height={size * 0.55} className="overflow-visible">
        <path d={arc} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${len} ${len}`}
          strokeDashoffset={len * (1 - k)}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1), stroke 400ms', filter: `drop-shadow(0 0 6px ${STATUS_META[status].glow})` }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center leading-none">
        <MetricValue value={score} decimals={0} className="text-[26px] font-semibold text-ink-100" />
        <span className="mt-1 text-[9px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Risk score</span>
      </div>
    </div>
  )
}
