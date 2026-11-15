/**
 * Persistent source caption of the atlas viewer with an info popover: credits (Z-Anatomy,
 * BodyParts3D), license, and the plain statement that this is one reference model shown for
 * every crew member, not the astronaut's own scan.
 */
import { useCallback, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import clsx from 'clsx'
import type { AtlasManifest } from '../atlas/types'
import { useDismiss } from '../hooks'

export function Attribution({ manifest, ls, compact }: { manifest: AtlasManifest; ls: number; compact: boolean }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(wrap, open, close)
  const src = manifest.source
  const own = manifest.structures.filter((s) => s.origin === 'ahi-procedural')
  return (
    <div ref={wrap} className={clsx('pointer-events-none absolute bottom-0.5 z-20 flex max-w-full px-2', compact ? 'left-0 justify-start' : 'inset-x-0 justify-center')}>
      <div className="relative flex min-w-0 items-center rounded-full bg-slate-950/80 text-slate-400" style={{ gap: 4 * ls, fontSize: 9.5 * ls, lineHeight: 1.3, padding: `${1 * ls}px ${3 * ls}px ${1 * ls}px ${7 * ls}px` }}>
        <span className="truncate">Reference anatomy: Z-Anatomy atlas (CC BY-SA 4.0)</span>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="About the reference anatomy"
          title="About the reference anatomy"
          onClick={() => setOpen((o) => !o)}
          className="pointer-events-auto flex shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-cyan-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan-300/60"
          style={{ width: 16 * ls, height: 16 * ls }}
        >
          <Info size={Math.round(11 * ls)} aria-hidden />
        </button>
        {open && (
          <div
            role="dialog"
            aria-label="About the reference anatomy"
            className={clsx(
              'pointer-events-auto absolute bottom-full mb-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/90 text-left text-slate-300 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl',
              compact ? 'left-0' : 'left-1/2 -translate-x-1/2',
            )}
            style={{ width: 300 * ls, maxWidth: 'calc(100cqw - 16px)', maxHeight: 'calc(100cqh - 40px)', padding: 12 * ls, fontSize: 10.5 * ls, lineHeight: 1.45 }}
          >
            <div className="font-semibold text-slate-100" style={{ fontSize: 12 * ls }}>
              Reference anatomy
            </div>
            <p style={{ marginTop: 6 * ls }}>
              This is a single reference body (adult male source model with a neutral groin), shown for every crew member. It is not the astronaut's own scan and it does not show individual
              anatomy. Status colors come from the simulated health data, not from the model.
            </p>
            <div className="font-semibold uppercase tracking-[0.14em] text-slate-400" style={{ fontSize: 9 * ls, marginTop: 9 * ls }}>
              Credits
            </div>
            <ul style={{ marginTop: 3 * ls }} className="space-y-0.5">
              <li>Z-Anatomy, the libre 3D atlas of anatomy (CC BY-SA 4.0)</li>
              <li>BodyParts3D, The Database Center for Life Science (CC BY-SA 2.1 Japan)</li>
              {own.length > 0 && (
                <li>
                  Rebuilt by AHI as procedural geometry (upstream models with a non commercial license are left out):{' '}
                  {own
                    .slice(0, 4)
                    .map((s) => s.name)
                    .join(', ')}
                  {own.length > 4 ? ' and more' : ''}
                </li>
              )}
            </ul>
            <p className="text-slate-400" style={{ marginTop: 7 * ls }}>
              Derived 3D files are shared under {src?.license || 'CC BY-SA 4.0'}. Source:{' '}
              <a href={src?.url || 'https://www.z-anatomy.com/'} target="_blank" rel="noreferrer" className="text-cyan-200/90 underline decoration-cyan-200/30 underline-offset-2 hover:text-cyan-100">
                {src?.name || 'Z-Anatomy'}
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
