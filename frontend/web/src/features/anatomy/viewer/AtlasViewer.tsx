/**
 * Atlas anatomy viewer: the Z-Anatomy reference body (one GLB per anatomical system) with studio
 * lighting, tissue materials, layers, structure picking and the platform's health states.
 * Reads selection, region status and live vitals from useAppStore. Fills its parent.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { ACESFilmicToneMapping, HalfFloatType } from 'three'
import clsx from 'clsx'
import type { BodyRegionId, Status } from '../../../types/domain'
import { useAppStore } from '../../../state/store'
import { STATUS_META } from '../../../lib/status'
import { REGION_LABELS } from '../../../engine/catalog'
import type { AnatomyViewerProps } from '../AnatomyViewer'
import type { AtlasManifest, AtlasStructure } from '../atlas/types'
import { regionOfStructure } from '../atlas/health'
import { usePresentationMode, useWidth } from '../hooks'
import { LabelOverlay, StatusMark, TooltipShell, ValueText, createLabelRegistry } from '../Labels'
import type { LabelRegistry } from '../Labels'
import { StatusLegend } from '../Legend'
import type { FrameInsets } from '../procedural/CameraRig'
import { parseStatusKey, statusKey } from '../regions'
import { AtlasCamera } from './AtlasCamera'
import { loadSystem, useAtlasProgress } from './atlasLoader'
import { AtlasScene } from './AtlasScene'
import { createAtlasStore, useAnatomyDebug, viewerStats } from './atlasStore'
import type { AtlasStore } from './atlasStore'
import { Attribution } from './Attribution'
import { buildLayers, effectiveLayers, regionAnchors, regionFocus, structureFocus } from './layers'
import type { LayerModel } from './layers'
import { SystemControls } from './SystemControls'

export interface AtlasViewerProps extends AnatomyViewerProps {
  manifest: AtlasManifest
  /** The atlas cannot be shown (a required file failed): the caller switches to the simple model. */
  onFatal: (reason: string) => void
}

function StructureTooltip({ structure, systemLabel, statuses, registry, selected }: { structure: AtlasStructure; systemLabel: string; statuses: Record<BodyRegionId, Status>; registry: LabelRegistry; selected: boolean }) {
  const ls = registry.labelScale
  const region = regionOfStructure(structure)
  const status = region ? statuses[region] : null
  const meta = status ? STATUS_META[status] : null
  return (
    <TooltipShell registry={registry} glow={meta && status !== 'LOW' ? meta.glow : 'rgba(94,231,245,0.18)'}>
      <div className="flex items-center" style={{ gap: 8 * ls }}>
        {status && <StatusMark status={status} size={Math.round(13 * ls)} />}
        <span className="font-semibold text-slate-50" style={{ fontSize: 12 * ls }}>
          {structure.name}
        </span>
        {meta && (
          <span className="ml-auto pl-2 font-medium uppercase tracking-wider" style={{ color: meta.color, fontSize: 10 * ls }}>
            {meta.label}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between" style={{ gap: 12 * ls }}>
        <span className="text-slate-400" style={{ fontSize: 10 * ls }}>
          {systemLabel}
          {region ? ` · ${REGION_LABELS[region].label}` : ''}
        </span>
        {region && status ? (
          <ValueText region={region} status={status} ls={ls} />
        ) : (
          <span className="whitespace-nowrap text-slate-400" style={{ fontSize: 10 * ls }}>
            Not monitored
          </span>
        )}
      </div>
      {!selected && (
        <div className="mt-1 uppercase tracking-[0.14em] text-slate-500" style={{ fontSize: 9 * ls }}>
          Click to select
        </div>
      )}
    </TooltipShell>
  )
}

function HoverTooltip({ store, manifest, statuses, registry }: { store: AtlasStore; manifest: AtlasManifest; statuses: Record<BodyRegionId, Status>; registry: LabelRegistry }) {
  const id = store((s) => s.hover?.id ?? null)
  const selectedId = useAppStore((s) => s.selectedStructureId)
  const structure = useMemo(() => (id ? (manifest.structures.find((s) => s.id === id) ?? null) : null), [manifest, id])
  if (!structure) return null
  const systemLabel = manifest.systems.find((f) => f.id === structure.system)?.label ?? structure.system
  return <StructureTooltip structure={structure} systemLabel={systemLabel} statuses={statuses} registry={registry} selected={selectedId === structure.id} />
}

/** Download progress of the systems that should be on screen (bytes, from the manifest sizes). */
function useLoadProgress(manifest: AtlasManifest, model: LayerModel, visible: Record<string, boolean>) {
  const files = useAtlasProgress((s) => s.files)
  return useMemo(() => {
    const systems = new Set(model.layers.filter((l) => visible[l.id]).map((l) => l.system))
    let loaded = 0
    let total = 0
    let pending = 0
    const names: string[] = []
    for (const f of manifest.systems) {
      if (!systems.has(f.id)) continue
      const p = files[f.id]
      if (p?.status === 'error') continue
      total += f.bytes
      if (p?.status === 'ready') loaded += f.bytes
      else {
        pending++
        loaded += Math.min(f.bytes, p?.loaded ?? 0)
        names.push(f.label)
      }
    }
    return { loaded, total, pending, names, fraction: total > 0 ? loaded / total : 1 }
  }, [manifest, model, visible, files])
}

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`

export function AtlasViewer({ manifest, onFatal, className, showControls = true, autoRotate = true, bloom = true, labelScale, compact: compactProp = false, legend = true }: AtlasViewerProps) {
  const [store] = useState(createAtlasStore)
  const rootRef = useRef<HTMLDivElement>(null)
  const width = useWidth(rootRef)
  const [labels] = useState(createLabelRegistry)
  const present = usePresentationMode()
  const ls = labelScale ?? (present ? 1.3 : 1)
  // the full control pill needs about 400 px at scale 1: narrower containers get the compact controls
  const compact = compactProp || (width > 0 && width < 430 * ls)
  const subject = useAppStore((s) => s.selectedAstronautId)
  const selectedRegion = useAppStore((s) => s.selectedRegion)
  const selectedStructureId = useAppStore((s) => s.selectedStructureId)
  const selectRegion = useAppStore((s) => s.selectRegion)
  const key = useAppStore(statusKey)
  const statuses = useMemo(() => parseStatusKey(key), [key])
  const choice = store((s) => s.layers)
  const resetNonce = store((s) => s.resetNonce)
  const view = store((s) => s.view)
  const hovering = store((s) => s.hover !== null)

  const model = useMemo(() => buildLayers(manifest), [manifest])
  const anchors = useMemo(() => regionAnchors(manifest), [manifest])
  const visible = useMemo(() => effectiveLayers(model, choice, { statuses, selectedRegion, selectedStructureId }), [model, choice, statuses, selectedRegion, selectedStructureId])
  const focus = useMemo(() => {
    const s = selectedStructureId ? manifest.structures.find((x) => x.id === selectedStructureId) : null
    if (s) return structureFocus(manifest, s)
    return selectedRegion ? regionFocus(manifest, selectedRegion) : null
  }, [manifest, selectedRegion, selectedStructureId])

  // preload the default systems as soon as the manifest is known (before the canvas mounts)
  useEffect(() => {
    const on = effectiveLayers(model, {}, { statuses: parseStatusKey(''), selectedRegion: null, selectedStructureId: null })
    const systems = new Set(model.layers.filter((l) => on[l.id]).map((l) => l.system))
    for (const f of manifest.systems) if (systems.has(f.id)) void loadSystem(manifest, f).catch(() => undefined)
  }, [manifest, model])

  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  const progress = useLoadProgress(manifest, model, visible)
  const [quality, setQuality] = useState<'high' | 'low'>('high')
  const overrides = useAnatomyDebug((s) => s.overrides)
  const shadows = overrides.shadows ?? quality === 'high'
  const msaa = overrides.msaa ?? (quality === 'high' ? 4 : 2)
  const post = overrides.bloom ?? bloom

  // dev only: the lab page and the screenshot scripts drive the viewer through this handle
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __ahiViewer?: unknown }
    const handle = { store, manifest, model, stats: viewerStats }
    w.__ahiViewer = handle
    return () => {
      if (w.__ahiViewer === handle) delete w.__ahiViewer
    }
  }, [store, manifest, model])

  // screen space kept clear of the body: source caption, bottom controls and legend chip, small top margin
  const captionBand = Math.round(17 * ls)
  const pillBand = showControls || legend ? Math.round((compact ? 28 : 36) * ls) + 8 : 6
  const insets = useMemo<FrameInsets>(() => ({ top: 10, bottom: captionBand + pillBand }), [captionBand, pillBand])
  labels.insets = insets
  labels.labelScale = ls

  return (
    <div ref={rootRef} className={clsx('relative h-full w-full overflow-hidden [container-type:size]', className)}>
      {/* backdrop: a soft pool of light on deep navy, blending into the dashboard panel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(62% 58% at 50% 44%, rgba(46,84,138,0.26) 0%, rgba(20,40,74,0.12) 48%, transparent 76%), radial-gradient(120% 110% at 50% 50%, transparent 58%, rgba(2,6,14,0.5) 100%)',
        }}
      />
      <Canvas
        className="!absolute inset-0 transition-opacity duration-700"
        style={{ opacity: ready ? 1 : 0 }}
        shadows="percentage"
        dpr={overrides.dpr ?? (quality === 'high' ? [1, 1.75] : 1)}
        gl={{ alpha: true, antialias: !bloom, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 30, near: 0.03, far: 40, position: [0, 1.05, 4.2] }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1
        }}
      >
        <PerformanceMonitor onDecline={() => setQuality('low')} flipflops={2} onFallback={() => setQuality('low')} />
        <Suspense fallback={null}>
          <AtlasScene
            manifest={manifest}
            model={model}
            store={store}
            labels={labels}
            visible={visible}
            statuses={statuses}
            anchors={anchors}
            subject={subject}
            shadows={shadows}
            onFatal={onFatal}
            onReady={onReady}
          />
        </Suspense>
        <AtlasCamera body={manifest.bounds} focus={focus} resetNonce={resetNonce} view={view} hovering={hovering} autoRotate={autoRotate} insets={insets} />
        {post && (
          <EffectComposer multisampling={msaa} enableNormalPass={false} frameBufferType={HalfFloatType}>
            <Bloom mipmapBlur intensity={0.42} luminanceThreshold={1.0} luminanceSmoothing={0.18} radius={0.62} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        )}
      </Canvas>
      <LabelOverlay
        registry={labels}
        statuses={statuses}
        selected={selectedRegion}
        visible={ready}
        onSelect={selectRegion}
        tooltip={<HoverTooltip store={store} manifest={manifest} statuses={statuses} registry={labels} />}
      />
      {progress.pending > 0 &&
        (ready ? (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-3">
            <div role="status" className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/55 px-3 py-1 text-cyan-100/85 backdrop-blur-md" style={{ fontSize: 10.5 * ls }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
              Loading {progress.names.join(', ').toLowerCase()} {Math.round(progress.fraction * 100)}%
            </div>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4">
            <div role="status" aria-live="polite" className="rounded-2xl border border-white/10 bg-slate-950/50 text-center text-cyan-50/90 backdrop-blur-md" style={{ width: 220 * ls, maxWidth: '100%', padding: `${12 * ls}px ${14 * ls}px` }}>
              <div className="font-medium tracking-wide" style={{ fontSize: 11.5 * ls }}>
                Loading reference anatomy
              </div>
              <div className="overflow-hidden rounded-full bg-white/10" style={{ height: 3 * ls, marginTop: 9 * ls }}>
                <div className="h-full rounded-full bg-cyan-300 transition-[width] duration-150" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
              </div>
              <div className="flex justify-between font-mono tabular text-slate-400" style={{ fontSize: 9.5 * ls, marginTop: 6 * ls }}>
                <span>
                  {mb(progress.loaded)} of {mb(progress.total)}
                </span>
                <span>{Math.round(progress.fraction * 100)}%</span>
              </div>
            </div>
          </div>
        ))}
      {legend && <StatusLegend registry={labels} labelScale={ls} defaultOpen={compact ? false : undefined} bottom={captionBand + (showControls && !compact ? pillBand : 6)} />}
      {showControls && <SystemControls store={store} model={model} visible={visible} compact={compact} ls={ls} bottom={captionBand + 6} />}
      <Attribution manifest={manifest} ls={ls} compact={compact} />
    </div>
  )
}
