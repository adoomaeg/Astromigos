/**
 * Dev-only lab page for the anatomy viewer (served at /anatomy-lab.html by `vite`).
 * Fakes region statuses and vitals through useAppStore.setState so every visual state can be
 * checked: atlas layers, structure selection, region statuses, the procedural fallback, and a
 * live readout of renderer statistics.
 */
import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import type { BodyRegionId, MetricCode, Status } from '../../types/domain'
import { useAppStore } from '../../state/store'
import { STATUS_META } from '../../lib/status'
import { REGION_LABELS } from '../../engine/catalog'
import { AnatomyViewer } from './index'
import { REGIONS } from './regions'
import type { AtlasManifest } from './atlas/types'
import { regionOfStructure } from './atlas/health'
import { loadStats } from './viewer/atlasLoader'
import { useAnatomyDebug, viewerStats } from './viewer/atlasStore'
import type { AtlasStore, ViewPreset } from './viewer/atlasStore'
import type { LayerModel } from './viewer/layers'
import { PRESETS, effectiveLayers, presetChoice } from './viewer/layers'
import { parseStatusKey, statusKey } from './regions'

const CYCLE: Status[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'NO_DATA']

function setRegion(region: BodyRegionId, status: Status) {
  useAppStore.setState((s) => {
    const id = s.selectedAstronautId
    const h = s.health[id]
    if (!h) return {}
    return { health: { ...s.health, [id]: { ...h, regions: { ...h.regions, [region]: { ...h.regions[region], status } } } } }
  })
}

function setMetric(code: MetricCode, value: number | null) {
  useAppStore.setState((s) => {
    const id = s.selectedAstronautId
    const h = s.health[id]
    const m = h?.metrics[code]
    if (!h || !m) return {}
    return { health: { ...s.health, [id]: { ...h, metrics: { ...h.metrics, [code]: { ...m, current: value } } } } }
  })
}

function preset(map: Partial<Record<BodyRegionId, Status>>) {
  for (const r of REGIONS) setRegion(r, map[r] ?? 'LOW')
}

interface ViewerHandle {
  store: AtlasStore
  manifest: AtlasManifest
  model: LayerModel
}

/** Dev handle published by the atlas viewer (null while the fallback model is shown). */
function useViewerHandle(): ViewerHandle | null {
  const [handle, setHandle] = useState<ViewerHandle | null>(null)
  useEffect(() => {
    const id = window.setInterval(() => {
      const h = (window as unknown as { __ahiViewer?: ViewerHandle }).__ahiViewer ?? null
      setHandle((cur) => (cur === h ? cur : h))
    }, 300)
    return () => window.clearInterval(id)
  }, [])
  return handle
}

/** Renderer statistics of the atlas viewer (frames per second, draw calls, triangles, pick time, downloads). */
function Stats() {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  const bytes = loadStats.reduce((n, s) => n + s.bytes, 0)
  const ms = loadStats.reduce((n, s) => n + s.ms, 0)
  return (
    <div data-lab="stats" className="grid grid-cols-2 gap-x-3 font-mono text-[11px] tabular text-slate-300">
      <span>{viewerStats.fps} fps</span>
      <span>{viewerStats.calls} draw calls</span>
      <span>{(viewerStats.triangles / 1000).toFixed(0)}k triangles</span>
      <span>{viewerStats.structures} structures</span>
      <span>pick {viewerStats.pickMs.toFixed(1)} ms</span>
      <span>
        {(bytes / 1048576).toFixed(1)} MB in {(ms / 1000).toFixed(1)} s
      </span>
    </div>
  )
}

export interface LabView {
  size: string
  labelScale: number
  compact: boolean
  legend: boolean
  bloom: boolean
}

const SIZES = ['fill', '700x560', '1000x800', '420x520']
const VIEWS: ViewPreset[] = ['front', 'back', 'left', 'right']
const chip = (on: boolean) => `rounded-md px-2 py-1 ${on ? 'bg-cyan-400/20 text-cyan-50' : 'bg-white/5 text-slate-400'}`

function AtlasPanel({ handle }: { handle: ViewerHandle }) {
  const { store, manifest, model } = handle
  const choice = store((s) => s.layers)
  const skinOpacity = store((s) => s.skinOpacity)
  const selectedRegion = useAppStore((s) => s.selectedRegion)
  const selectedStructureId = useAppStore((s) => s.selectedStructureId)
  const key = useAppStore(statusKey)
  const visible = useMemo(
    () => effectiveLayers(model, choice, { statuses: parseStatusKey(key), selectedRegion, selectedStructureId }),
    [model, choice, key, selectedRegion, selectedStructureId],
  )
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return manifest.structures.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 8)
  }, [manifest, query])
  return (
    <>
      <div className="flex flex-wrap gap-1">
        {model.layers.filter((l) => !l.follows).map((l) => (
          <button key={l.id} type="button" onClick={() => store.getState().setLayer(l.id, !visible[l.id])} className={chip(!!visible[l.id])}>
            {l.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => store.getState().setLayers(presetChoice(model, p), p.skinOpacity)} className="rounded-md bg-white/5 px-2 py-1">
            {p.label}
          </button>
        ))}
      </div>
      <label className="block">
        Skin opacity {Math.round(skinOpacity * 100)}%
        <input type="range" min={0} max={100} value={Math.round(skinOpacity * 100)} onChange={(e) => store.getState().setSkinOpacity(+e.target.value / 100)} className="w-full" />
      </label>
      <div className="flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <button key={v} type="button" onClick={() => store.getState().setView(v)} className="rounded-md bg-white/5 px-2 py-1 capitalize">
            {v}
          </button>
        ))}
        <button type="button" onClick={() => store.getState().resetView()} className="rounded-md bg-white/5 px-2 py-1">
          Reset
        </button>
      </div>
      <div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Find a structure (${manifest.structures.length})`}
          aria-label="Find a structure"
          className="w-full rounded-md border border-white/10 bg-slate-900/70 px-2 py-1 text-slate-100 placeholder:text-slate-500"
        />
        <div className="mt-1 flex flex-wrap gap-1">
          {matches.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => useAppStore.getState().selectStructure(s.id, regionOfStructure(s))}
              className={chip(selectedStructureId === s.id)}
              title={`${s.id} (${s.system}, ${s.tissue}, ${s.triangles} triangles)`}
            >
              {s.name}
            </button>
          ))}
          {selectedStructureId && (
            <button type="button" onClick={() => useAppStore.getState().selectStructure(null)} className="rounded-md bg-white/5 px-2 py-1 text-slate-400">
              Clear ({selectedStructureId})
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function Panel({ view, setView }: { view: LabView; setView: (v: LabView) => void }) {
  const crew = useAppStore((s) => s.crew)
  const selectedId = useAppStore((s) => s.selectedAstronautId)
  const selectAstronaut = useAppStore((s) => s.selectAstronaut)
  const selected = useAppStore((s) => s.selectedRegion)
  const selectRegion = useAppStore((s) => s.selectRegion)
  const regions = useAppStore((s) => s.health[s.selectedAstronautId]?.regions)
  const hr = useAppStore((s) => s.health[s.selectedAstronautId]?.metrics.HEART_RATE?.current ?? 0)
  const rr = useAppStore((s) => s.health[s.selectedAstronautId]?.metrics.RESPIRATORY_RATE?.current ?? 0)
  const forceFallback = useAnatomyDebug((s) => s.forceFallback)
  const setForceFallback = useAnatomyDebug((s) => s.setForceFallback)
  const handle = useViewerHandle()
  return (
    <div className="absolute left-3 top-3 z-20 max-h-[calc(100%-24px)] w-72 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-[12px] text-slate-200 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-semibold tracking-wide text-cyan-100">Anatomy lab</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-300">{handle && !forceFallback ? 'atlas' : 'fallback'}</span>
      </div>
      <Stats />
      <div className="flex flex-wrap gap-1">
        {SIZES.map((sz) => (
          <button key={sz} type="button" onClick={() => setView({ ...view, size: sz })} className={chip(view.size === sz)}>
            {sz}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={() => setView({ ...view, labelScale: view.labelScale === 1 ? 1.3 : 1 })} className="rounded-md bg-white/5 px-2 py-1">
          labels x{view.labelScale}
        </button>
        <button type="button" onClick={() => setView({ ...view, compact: !view.compact })} className="rounded-md bg-white/5 px-2 py-1">
          compact {view.compact ? 'on' : 'off'}
        </button>
        <button type="button" onClick={() => setView({ ...view, legend: !view.legend })} className="rounded-md bg-white/5 px-2 py-1">
          legend {view.legend ? 'on' : 'off'}
        </button>
        <button type="button" onClick={() => setView({ ...view, bloom: !view.bloom })} className="rounded-md bg-white/5 px-2 py-1">
          bloom {view.bloom ? 'on' : 'off'}
        </button>
        <button type="button" onClick={() => setForceFallback(!forceFallback)} className={chip(forceFallback)} title="Force the simplified procedural model (what users see when the atlas cannot load)">
          force fallback {forceFallback ? 'on' : 'off'}
        </button>
      </div>
      {handle && !forceFallback && <AtlasPanel handle={handle} />}
      <div className="flex flex-wrap gap-1">
        {crew.map((c) => (
          <button key={c.id} type="button" onClick={() => selectAstronaut(c.id)} className={chip(c.id === selectedId)}>
            {c.callsign} ({c.sex})
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {REGIONS.map((r) => {
          const st = regions?.[r]?.status ?? 'NO_DATA'
          return (
            <div key={r} className="flex items-center gap-2">
              <button type="button" onClick={() => selectRegion(selected === r ? null : r)} className={`w-20 text-left ${selected === r ? 'text-cyan-200' : ''}`}>
                {REGION_LABELS[r].label}
              </button>
              <button
                type="button"
                onClick={() => setRegion(r, CYCLE[(CYCLE.indexOf(st) + 1) % CYCLE.length]!)}
                className="flex-1 rounded-md px-2 py-0.5 text-left"
                style={{ background: `${STATUS_META[st].color}22`, color: STATUS_META[st].color }}
              >
                {STATUS_META[st].label}
              </button>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" className="rounded-md bg-white/5 px-2 py-1" onClick={() => preset({})}>All nominal</button>
        <button type="button" className="rounded-md bg-white/5 px-2 py-1" onClick={() => preset({ heart: 'CRITICAL', lungs: 'HIGH', brain: 'MODERATE' })}>Cardio event</button>
        <button type="button" className="rounded-md bg-white/5 px-2 py-1" onClick={() => preset({ muscles: 'MODERATE', bones: 'HIGH', kidneys: 'MODERATE', skin: 'HIGH' })}>Mixed</button>
        <button type="button" className="rounded-md bg-white/5 px-2 py-1" onClick={() => preset(Object.fromEntries(REGIONS.map((r) => [r, 'NO_DATA'])))}>Signal lost</button>
      </div>
      <label className="block">
        HR {hr.toFixed(0)} bpm
        <input type="range" min={0} max={180} value={hr} onChange={(e) => setMetric('HEART_RATE', +e.target.value)} className="w-full" />
      </label>
      <label className="block">
        RR {rr.toFixed(0)} br/min
        <input type="range" min={0} max={40} value={rr} onChange={(e) => setMetric('RESPIRATORY_RATE', +e.target.value)} className="w-full" />
      </label>
    </div>
  )
}

function Lab() {
  const [view, setView] = useState<LabView>({ size: '700x560', labelScale: 1, compact: false, legend: true, bloom: true })
  const [w, h] = view.size === 'fill' ? [0, 0] : view.size.split('x').map(Number)
  // dev handles for scripted checks (same names as the main app)
  useEffect(() => {
    const win = window as unknown as { __ahi?: unknown; __ahiLab?: unknown }
    win.__ahi = useAppStore
    win.__ahiLab = { setView: (patch: Partial<LabView>) => setView((v) => ({ ...v, ...patch })), setRegion, setMetric, preset, debug: useAnatomyDebug, stats: viewerStats, loads: loadStats }
  }, [])
  return (
    <div className="relative h-full w-full">
      <div
        data-lab="viewer"
        className={view.size === 'fill' ? 'absolute inset-y-0 left-[312px] right-0' : 'absolute left-[312px] top-3 rounded-2xl ring-1 ring-white/10'}
        style={view.size === 'fill' ? undefined : { width: w, height: h }}
      >
        <AnatomyViewer key={view.bloom ? 'bloom' : 'plain'} labelScale={view.labelScale} compact={view.compact} legend={view.legend} bloom={view.bloom} />
      </div>
      <Panel view={view} setView={setView} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
