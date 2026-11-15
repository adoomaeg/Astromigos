/**
 * Viewer controls: anatomical layers (one per system of the atlas), skin opacity, layer presets,
 * preset views (front, back, left, right) and reset. One compact pill plus a popover, sized by
 * labelScale so it stays usable in presentation mode and in small containers.
 */
import { useCallback, useRef, useState } from 'react'
import { Layers, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '../../../state/store'
import { useDismiss } from '../hooks'
import { useAtlasProgress } from './atlasLoader'
import type { AtlasStore, ViewPreset } from './atlasStore'
import type { LayerModel } from './layers'
import { PRESETS, presetChoice } from './layers'

const VIEWS: { id: ViewPreset; label: string; title: string }[] = [
  { id: 'front', label: 'Front', title: 'Front view' },
  { id: 'back', label: 'Back', title: 'Back view' },
  { id: 'left', label: 'Left', title: "Left side view (the body's left)" },
  { id: 'right', label: 'Right', title: "Right side view (the body's right)" },
]

const SHELL = 'pointer-events-auto rounded-full border border-white/10 bg-slate-950/80 shadow-[0_0_30px_rgba(56,214,245,0.08)] backdrop-blur-md'

export interface SystemControlsProps {
  store: AtlasStore
  model: LayerModel
  /** Effective visibility per layer (after automatic and forced layers). */
  visible: Record<string, boolean>
  compact: boolean
  ls: number
  /** Distance of the pill from the bottom edge (px). */
  bottom: number
}

export function SystemControls({ store, model, visible, compact, ls, bottom }: SystemControlsProps) {
  const choice = store((s) => s.layers)
  const skinOpacity = store((s) => s.skinOpacity)
  const setLayer = store((s) => s.setLayer)
  const setLayers = store((s) => s.setLayers)
  const setSkinOpacity = store((s) => s.setSkinOpacity)
  const setView = store((s) => s.setView)
  const resetView = store((s) => s.resetView)
  const files = useAtlasProgress((s) => s.files)
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(wrap, open, close)

  const skinLayer = model.layers.find((l) => l.system === 'integumentary')
  const skinOn = skinLayer ? visible[skinLayer.id] : false
  const toggles = model.layers.filter((l) => !l.follows)
  const count = toggles.filter((l) => visible[l.id] && files[l.system]?.status !== 'error').length
  const fs = (compact ? 10.5 : 11) * ls
  const btn = 'shrink-0 rounded-full font-medium tracking-wide transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan-300/60'
  const idle = 'text-slate-300 hover:bg-white/8 hover:text-white'

  const viewButtons = VIEWS.map((v) => (
    <button
      key={v.id}
      type="button"
      title={v.title}
      aria-label={v.title}
      onClick={() => setView(v.id)}
      className={clsx(btn, idle)}
      style={{ fontSize: fs, padding: `${4 * ls}px ${8 * ls}px` }}
    >
      {v.label}
    </button>
  ))

  const reset = (
    <button
      type="button"
      title="Reset view and clear the selection"
      aria-label="Reset view"
      onClick={() => {
        useAppStore.getState().selectStructure(null)
        useAppStore.getState().selectRegion(null)
        resetView()
      }}
      className={clsx(btn, idle, 'flex items-center justify-center')}
      style={{ width: 24 * ls, height: 24 * ls }}
    >
      <RotateCcw size={Math.round(13 * ls)} aria-hidden />
    </button>
  )

  const panel = open && (
    <div
      role="dialog"
      aria-label="Anatomical layers"
      className="pointer-events-auto absolute bottom-full mb-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/85 text-slate-200 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      style={{ width: 252 * ls, maxWidth: 'calc(100cqw - 16px)', maxHeight: 'calc(100cqh - 70px)', padding: 10 * ls, fontSize: 11 * ls, ...(compact ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' }) }}
    >
      <div className="font-semibold uppercase tracking-[0.14em] text-slate-400" style={{ fontSize: 9.5 * ls, marginBottom: 6 * ls }}>
        Anatomical systems
      </div>
      <ul className="grid grid-cols-2" style={{ gap: 4 * ls }}>
        {toggles.map((l) => {
          const on = !!visible[l.id]
          const file = files[l.system]
          const loading = on && file?.status === 'loading'
          const failed = file?.status === 'error'
          const auto = l.defaultOn === null && typeof choice[l.id] !== 'boolean'
          return (
            <li key={l.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={failed}
                title={failed ? `${l.label}: not available` : `${on ? 'Hide' : 'Show'} ${l.label.toLowerCase()} (${l.structures.length} structures)`}
                onClick={() => setLayer(l.id, !on)}
                className={clsx(
                  'flex w-full items-center rounded-lg text-left transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan-300/60',
                  on ? 'bg-cyan-300/10 text-slate-50 ring-1 ring-cyan-300/25' : 'text-slate-400 ring-1 ring-white/5 hover:bg-white/5 hover:text-slate-200',
                  failed && 'cursor-not-allowed opacity-50',
                )}
                style={{ gap: 6 * ls, padding: `${5 * ls}px ${7 * ls}px` }}
              >
                <span className="shrink-0 rounded-full ring-1 ring-black/30" style={{ width: 9 * ls, height: 9 * ls, background: l.swatch, opacity: on ? 1 : 0.45 }} aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{l.label}</span>
                {loading ? (
                  <span className="font-mono tabular text-cyan-200/80" style={{ fontSize: 9 * ls }}>
                    {Math.round((100 * file.loaded) / Math.max(1, file.total))}%
                  </span>
                ) : failed ? (
                  <span className="text-slate-500" style={{ fontSize: 9 * ls }}>
                    n/a
                  </span>
                ) : auto ? (
                  <span className="uppercase tracking-wider text-slate-500" style={{ fontSize: 8.5 * ls }} title="Shown automatically when selected or in alert">
                    auto
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      <label className={clsx('mt-2 flex items-center', !skinOn && 'opacity-45')} style={{ gap: 8 * ls, marginTop: 9 * ls }}>
        <span className="shrink-0 text-slate-400">Skin opacity</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(skinOpacity * 100)}
          disabled={!skinOn}
          onChange={(e) => setSkinOpacity(Number(e.target.value) / 100)}
          aria-label="Skin opacity"
          className="h-1 min-w-0 flex-1 cursor-pointer accent-cyan-300"
        />
        <span className="w-8 shrink-0 text-right font-mono tabular text-slate-300" style={{ fontSize: 10 * ls }}>
          {Math.round(skinOpacity * 100)}%
        </span>
      </label>
      <div className="flex flex-wrap items-center border-t border-white/8" style={{ gap: 4 * ls, marginTop: 9 * ls, paddingTop: 8 * ls }}>
        <span className="mr-1 text-slate-500" style={{ fontSize: 9.5 * ls }}>
          Presets
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.title}
            onClick={() => setLayers(presetChoice(model, p), p.skinOpacity)}
            className="rounded-md bg-white/5 font-medium text-slate-300 ring-1 ring-white/8 transition-colors hover:bg-white/10 hover:text-white"
            style={{ fontSize: 10 * ls, padding: `${3 * ls}px ${7 * ls}px` }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {compact && (
        <div className="flex flex-wrap items-center border-t border-white/8" style={{ gap: 2 * ls, marginTop: 8 * ls, paddingTop: 7 * ls }}>
          <span className="mr-1 text-slate-500" style={{ fontSize: 9.5 * ls }}>
            View
          </span>
          {viewButtons}
        </div>
      )}
    </div>
  )

  const layersButton = (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="dialog"
      title="Anatomical layers and skin opacity"
      onClick={() => setOpen((o) => !o)}
      className={clsx(btn, 'flex items-center', open ? 'bg-cyan-300/12 text-cyan-50 ring-1 ring-cyan-300/30' : idle)}
      style={{ fontSize: fs, gap: 5 * ls, padding: `${4 * ls}px ${9 * ls}px` }}
    >
      <Layers size={Math.round(12 * ls)} aria-hidden />
      Layers
      <span className="rounded-full bg-white/10 font-mono tabular text-slate-300" style={{ fontSize: 9 * ls, padding: `0 ${5 * ls}px` }}>
        {count}
      </span>
    </button>
  )
  const sep = <span className="mx-0.5 h-4 w-px shrink-0 bg-white/10" aria-hidden />

  return (
    <div className={clsx('pointer-events-none absolute z-20 flex px-2', compact ? 'right-0 justify-end' : 'inset-x-0 justify-center')} style={{ bottom }}>
      <div ref={wrap} className="relative">
        {panel}
        <div className={clsx(SHELL, 'flex items-center gap-0.5 p-1')}>
          {layersButton}
          {!compact && (
            <>
              {sep}
              {viewButtons}
            </>
          )}
          {sep}
          {reset}
        </div>
      </div>
    </div>
  )
}
