/** Small collapsible status legend for the anatomy viewer (shape + color + words). */
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { Status } from '../../types/domain'
import { STATUS_META } from '../../lib/status'
import { STATUS_SHAPE } from './Labels'
import type { LabelRegistry } from './Labels'

const ORDER: Status[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'NO_DATA']

/**
 * `defaultOpen` undefined: open when the viewer is roomy (wider than 820 px), else a small chip.
 * Registers itself with the label registry so floating labels stack clear of it.
 */
export function StatusLegend({ labelScale = 1, defaultOpen, bottom, registry }: { labelScale?: number; defaultOpen?: boolean; bottom: number; registry: LabelRegistry }) {
  const [open, setOpen] = useState<boolean | null>(defaultOpen ?? null)
  const ref = useRef<HTMLDivElement>(null)
  const ls = labelScale
  useEffect(() => {
    if (open !== null) return
    const w = ref.current?.parentElement?.clientWidth ?? 0
    setOpen(w >= 820)
  }, [open])
  useEffect(() => {
    registry.legend = ref.current
    return () => {
      registry.legend = null
    }
  }, [registry])
  return (
    <div ref={ref} className="pointer-events-none absolute left-3 z-10" style={{ bottom, visibility: open === null ? 'hidden' : undefined }}>
      <div className="pointer-events-auto rounded-xl border border-white/10 bg-slate-950/75 text-slate-300 shadow-[0_0_24px_rgba(56,214,245,0.06)] backdrop-blur-md">
        <button
          type="button"
          aria-expanded={!!open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center rounded-xl font-semibold uppercase tracking-[0.14em] text-slate-400 transition-colors hover:text-slate-200"
          style={{ gap: 6 * ls, padding: `${5 * ls}px ${9 * ls}px`, fontSize: 9.5 * ls }}
        >
          <span className="flex" aria-hidden style={{ gap: 2 * ls }}>
            {ORDER.slice(0, 4).map((s) => (
              <span key={s} className="block rounded-full" style={{ width: 4 * ls, height: 4 * ls, background: STATUS_META[s].color }} />
            ))}
          </span>
          Status
          <svg aria-hidden viewBox="0 0 10 10" width={8 * ls} height={8 * ls} className={clsx('ml-auto transition-transform', open ? 'rotate-180' : '')}>
            <path d="M2 6.5 5 3.5 8 6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <ul className="border-t border-white/5" style={{ padding: `${4 * ls}px ${9 * ls}px ${7 * ls}px`, fontSize: 11 * ls }} aria-label="Status legend">
            {ORDER.map((s) => {
              const Icon = STATUS_SHAPE[s]
              const meta = STATUS_META[s]
              return (
                <li key={s} className="flex items-center whitespace-nowrap" style={{ gap: 7 * ls, paddingBlock: 2 * ls }}>
                  <Icon aria-hidden size={Math.round(12 * ls)} strokeWidth={2.4} style={{ color: meta.color }} className="shrink-0" />
                  <span className="font-medium text-slate-200">{meta.label}</span>
                  <span className="ml-auto pl-2 text-slate-500" style={{ fontSize: 10 * ls }}>
                    {meta.crewLabel}
                  </span>
                </li>
              )
            })}
            <li className="mt-1 border-t border-white/5 text-slate-500" style={{ paddingTop: 4 * ls, fontSize: 9.5 * ls }}>
              Vs personal baseline. Simulated data.
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}
