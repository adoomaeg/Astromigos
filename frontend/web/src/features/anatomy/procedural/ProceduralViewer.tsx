/**
 * Procedural anatomy viewer: simplified holographic body built from signed distance fields.
 * It is the automatic fallback of AnatomyViewer when the reference atlas cannot load.
 * Reads selection, region status and live vitals from useAppStore. Fills its parent.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import clsx from 'clsx'
import { useAppStore } from '../../../state/store'
import { AnatomyScene } from './AnatomyScene'
import { CameraRig } from './CameraRig'
import type { FrameInsets } from './CameraRig'
import { loadAnatomy, prefetchAnatomy } from './loader'
import type { AnatomyGeometries } from './loader'
import type { Sex } from './geometry/rig'
import { LAYERS, parseStatusKey, statusKey } from '../regions'
import { createViewerStore, effectiveLayers } from './viewerStore'
import type { ViewerStore } from './viewerStore'
import { LabelOverlay, RegionTooltip, createLabelRegistry } from '../Labels'
import { StatusLegend } from '../Legend'
import type { AnatomyViewerProps } from '../AnatomyViewer'
import { usePresentationMode, useWidth } from '../hooks'

/** Female variant is rendered slightly smaller (population average height ratio). */
const SCALE: Record<Sex, number> = { M: 1, F: 0.94 }

function useAnatomy(sex: Sex) {
  const [geos, setGeos] = useState<{ sex: Sex; g: AnatomyGeometries } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    loadAnatomy(sex)
      .then((g) => alive && setGeos({ sex, g }))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [sex])
  return { geos: geos?.sex === sex ? geos.g : null, error }
}

function ResetIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )
}

function ControlsPill({ store, compact, ls }: { store: ViewerStore; compact: boolean; ls: number }) {
  const layersRaw = store((s) => s.layers)
  const toggle = store((s) => s.toggleLayer)
  const resetView = store((s) => s.resetView)
  const selectRegion = useAppStore((s) => s.selectRegion)
  const selected = useAppStore((s) => s.selectedRegion)
  const muscleStatus = useAppStore((s) => s.health[s.selectedAstronautId]?.regions?.muscles?.status ?? 'NO_DATA')
  const eff = effectiveLayers(layersRaw, muscleStatus, selected)
  const [open, setOpen] = useState(false)
  const reset = (
    <button
      type="button"
      title="Reset view"
      aria-label="Reset view"
      onClick={() => {
        selectRegion(null)
        resetView()
      }}
      className="flex shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
      style={{ width: 24 * ls, height: 24 * ls }}
    >
      <ResetIcon size={Math.round(13 * ls)} />
    </button>
  )
  const chips = LAYERS.map((l) => {
    const on = eff[l.id]
    return (
      <button
        key={l.id}
        type="button"
        aria-pressed={on}
        onClick={() => toggle(l.id, on)}
        className={clsx(
          'shrink-0 rounded-full font-medium tracking-wide transition-colors',
          on ? 'bg-cyan-300/12 text-cyan-50 ring-1 ring-cyan-300/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
        )}
        style={{ fontSize: (compact ? 10.5 : 11) * ls, padding: `${(compact ? 3 : 4) * ls}px ${(compact ? 8 : 10) * ls}px` }}
      >
        {l.label}
      </button>
    )
  })
  const shell = 'pointer-events-auto flex max-w-full items-center gap-0.5 rounded-full border border-white/10 bg-slate-950/45 p-1 shadow-[0_0_30px_rgba(56,214,245,0.08)] backdrop-blur-md'
  if (compact) {
    // compact: a single "Layers" toggle that unfolds the chips, plus reset
    return (
      <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex flex-col items-end gap-1.5">
        {open && <div className={clsx(shell, 'flex-wrap justify-end rounded-2xl')}>{chips}</div>}
        <div className={shell}>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="rounded-full font-medium tracking-wide text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            style={{ fontSize: 11 * ls, padding: `${3 * ls}px ${9 * ls}px` }}
          >
            Layers
          </button>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-white/10" />
          {reset}
        </div>
      </div>
    )
  }
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
      <div className={clsx(shell, 'overflow-x-auto')}>
        {chips}
        <span className="mx-1 h-4 w-px shrink-0 bg-white/10" />
        {reset}
      </div>
    </div>
  )
}

export function ProceduralViewer({ className, showControls = true, autoRotate = true, bloom = true, labelScale, compact: compactProp = false, legend = true, notice }: AnatomyViewerProps & { notice?: string }) {
  const [store] = useState(createViewerStore)
  const rootRef = useRef<HTMLDivElement>(null)
  const width = useWidth(rootRef)
  const [labels] = useState(createLabelRegistry)
  const present = usePresentationMode()
  const ls = labelScale ?? (present ? 1.3 : 1)
  // the full layer pill needs ~440 px at scale 1: narrower containers get the compact controls
  const compact = compactProp || (width > 0 && width < 450 * ls)
  const subject = useAppStore((s) => s.selectedAstronautId)
  const sex = useAppStore((s) => s.crew.find((c) => c.id === s.selectedAstronautId)?.sex ?? 'M')
  const selected = useAppStore((s) => s.selectedRegion)
  const selectRegion = useAppStore((s) => s.selectRegion)
  const key = useAppStore(statusKey)
  const statuses = useMemo(() => parseStatusKey(key), [key])
  const resetNonce = store((s) => s.resetNonce)
  const hoverRegion = store((s) => s.hover?.region ?? null)
  const hovering = hoverRegion !== null
  const { geos, error } = useAnatomy(sex)
  const sexes = useAppStore((s) => [...new Set(s.crew.map((c) => c.sex))].sort().join(''))
  useEffect(() => {
    if (!geos) return
    const id = window.setTimeout(() => sexes.split('').forEach((x) => prefetchAnatomy(x as Sex)), 2000)
    return () => window.clearTimeout(id)
  }, [geos, sexes])
  const [dpr, setDpr] = useState<number | [number, number]>([1, 2])
  const scale = SCALE[sex]

  // screen space kept clear of the body: bottom control pill (full width variant only) and a small top margin
  const pillBand = showControls && !compact ? Math.round(44 * ls) + 8 : 10
  const insets = useMemo<FrameInsets>(() => ({ top: 10, bottom: pillBand }), [pillBand])
  labels.insets = insets
  labels.labelScale = ls

  return (
    <div ref={rootRef} className={clsx('relative h-full w-full overflow-hidden', className)}>
      <Canvas
        className="!absolute inset-0"
        dpr={dpr}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 32, near: 0.02, far: 40, position: [0, 1.1, 3.75] }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 0)
          // dev only: the lab page reads the scene to report drawn triangles
          if (import.meta.env.DEV) (window as unknown as { __ahiScene?: unknown }).__ahiScene = scene
        }}
        onPointerMissed={() => {
          if (useAppStore.getState().selectedRegion) selectRegion(null)
        }}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr([1, 2])} flipflops={3} onFallback={() => setDpr(1)} />
        <Suspense fallback={null}>
          <AnatomyScene geos={geos} scale={scale} store={store} labels={labels} subject={subject} />
        </Suspense>
        <CameraRig selected={selected} resetNonce={resetNonce} scale={scale} hovering={hovering} autoRotate={autoRotate} insets={insets} />
        {bloom && (
          <EffectComposer multisampling={4} enableNormalPass={false}>
            <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.28} luminanceSmoothing={0.3} radius={0.7} />
          </EffectComposer>
        )}
      </Canvas>
      <LabelOverlay
        registry={labels}
        statuses={statuses}
        selected={selected}
        visible={!!geos}
        onSelect={selectRegion}
        tooltip={hoverRegion ? <RegionTooltip region={hoverRegion} status={statuses[hoverRegion]} selected={selected} registry={labels} /> : null}
      />
      {!geos && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5 text-[11px] tracking-wide text-cyan-100/80 backdrop-blur-md">
            <span className={clsx('h-1.5 w-1.5 rounded-full', error ? 'bg-rose-400' : 'animate-pulse bg-cyan-300')} />
            {error ? 'Body model unavailable' : 'Calibrating body scan'}
          </div>
        </div>
      )}
      {notice && geos && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-3">
          <div role="status" className="rounded-full border border-amber-300/25 bg-slate-950/60 px-3 py-1 text-center text-amber-100/90 backdrop-blur-md" style={{ fontSize: 10.5 * ls }}>
            {notice}
          </div>
        </div>
      )}
      {legend && <StatusLegend registry={labels} labelScale={ls} defaultOpen={compact ? false : undefined} bottom={showControls && !compact ? pillBand + 4 : 8} />}
      {showControls && <ControlsPill store={store} compact={compact} ls={ls} />}
    </div>
  )
}
