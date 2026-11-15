import clsx from 'clsx'
import { Info, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Baseline, MetricCode } from '../types/domain'
import { METRIC_CATALOG } from '../engine/catalog'
import { FloatingPopover } from './ui'
import { fmtMetric } from './format'

/**
 * "Why is this my normal?" affordance: a small info button that explains the personal
 * baseline band in plain words (window, number of readings, median and MAD, version).
 */
export function BaselineInfo({ metric, baseline, className, prefer = 'bottom' }: { metric: MetricCode; baseline: Baseline | null | undefined; className?: string; prefer?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const def = METRIC_CATALOG[metric]
  const ready = baseline?.status === 'READY'
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Why is this my normal? ${def.label}`}
        title="Why is this my normal?"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={clsx(
          'focus-ring inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-white/[0.08] hover:text-accent',
          open && 'bg-white/[0.08] text-accent',
          className,
        )}
      >
        <Info size={12} aria-hidden />
      </button>
      <FloatingPopover open={open} onClose={() => setOpen(false)} anchorRef={btn} label={`Why is this my normal? ${def.label}`} width={320} prefer={prefer} className="p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
          <UserRound size={15} className="text-accent" aria-hidden /> Why is this my normal?
        </h3>
        {ready && baseline ? (
          <>
            <div className="mt-2.5 rounded-xl bg-accent/[0.07] px-3 py-2 ring-1 ring-accent/20">
              <div className="text-[11px] text-ink-500">Your normal {def.label.toLowerCase()}</div>
              <div className="tabular text-[17px] font-semibold text-ink-100">
                {fmtMetric(metric, baseline.low)} to {fmtMetric(metric, baseline.high)} <span className="text-xs font-normal text-ink-500">{def.unit}</span>
              </div>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-ink-300">
              Learned from <span className="tabular font-semibold text-ink-100">{baseline.n}</span> of your own readings: {baseline.windowLabel.charAt(0).toLowerCase() + baseline.windowLabel.slice(1)}.
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-300">
              The middle is your typical value (median <span className="tabular text-ink-100">{fmtMetric(metric, baseline.median)}</span>). The width comes from how much you usually vary (MAD{' '}
              <span className="tabular text-ink-100">{baseline.mad.toFixed(Math.max(1, def.decimals))}</span>), a robust spread that ignores one-off spikes.
            </p>
          </>
        ) : (
          <p className="mt-2.5 text-xs leading-relaxed text-ink-300">
            Still learning your normal{baseline ? ` (${baseline.n} readings so far)` : ''}. Until there is enough of your own data, status for this signal stays cautious.
          </p>
        )}
        <p className="mt-2.5 rounded-lg bg-white/[0.04] px-2.5 py-2 text-xs leading-relaxed font-medium text-ink-100">Status compares you with yourself, not with a population average.</p>
        {baseline?.version && <p className="mt-2 text-[10px] text-ink-500 present:hidden">Baseline method: {baseline.version}</p>}
      </FloatingPopover>
    </>
  )
}
