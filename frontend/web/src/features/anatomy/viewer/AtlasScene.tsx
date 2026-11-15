/**
 * 3D content of the atlas viewer: lazy loading of the visible systems, picking (hover and click),
 * the per frame driver (live vitals, status states) and the label projector.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Bvh } from '@react-three/drei'
import { Raycaster, Vector2 } from 'three'
import type { BodyRegionId, Status } from '../../../types/domain'
import { useAppStore } from '../../../state/store'
import { STATUS_META } from '../../../lib/status'
import type { AtlasManifest, Vec3 } from '../atlas/types'
import { REQUIRED_STRUCTURE_IDS } from '../atlas/types'
import { regionOfStructure } from '../atlas/health'
import { REGIONS } from '../regions'
import type { LabelRegistry } from '../Labels'
import { LabelProjector } from '../Labels'
import { loadSystem } from './atlasLoader'
import type { AtlasStore } from './atlasStore'
import { viewerStats } from './atlasStore'
import type { LayerModel } from './layers'
import { AtlasRuntime } from './runtime'
import { Studio } from './Studio'

export interface AtlasSceneProps {
  manifest: AtlasManifest
  model: LayerModel
  store: AtlasStore
  labels: LabelRegistry
  /** Effective visibility per layer id. */
  visible: Record<string, boolean>
  statuses: Record<BodyRegionId, Status>
  anchors: Record<BodyRegionId, Vec3 | null>
  /** Astronaut id: status changes only trigger a scan pulse within the same astronaut. */
  subject: string
  shadows: boolean
  /** A system the application relies on could not be loaded: the caller falls back to the simple model. */
  onFatal: (reason: string) => void
  /** Called once the first system is on screen. */
  onReady: () => void
}

/** Hover picks are throttled: at most one raycast every PICK_MS while the pointer moves. */
const PICK_MS = 45
const CLICK_SLOP_PX = 6
/** Split strategy "center" of the bounds trees: the fastest to build (value from three-mesh-bvh). */
const BVH_CENTER = 0 as NonNullable<React.ComponentProps<typeof Bvh>['strategy']>

export function AtlasScene(props: AtlasSceneProps) {
  const { manifest, model } = props
  // created and disposed by the same effect, so a remount (StrictMode) always gets a fresh runtime
  const [runtime, setRuntime] = useState<AtlasRuntime | null>(null)
  useEffect(() => {
    const r = new AtlasRuntime(manifest, model)
    setRuntime(r)
    return () => {
      setRuntime(null)
      r.dispose()
    }
  }, [manifest, model])
  return runtime ? <SceneBody {...props} runtime={runtime} /> : null
}

function SceneBody({ manifest, model, store, labels, visible, statuses, anchors, subject, shadows, onFatal, onReady, runtime }: AtlasSceneProps & { runtime: AtlasRuntime }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const selectedRegion = useAppStore((s) => s.selectedRegion)
  const selectedStructureId = useAppStore((s) => s.selectedStructureId)
  const hoverId = store((s) => s.hover?.id ?? null)
  const byId = useMemo(() => new Map(manifest.structures.map((s) => [s.id, s])), [manifest])
  const live = useRef({ statuses, anchors, onFatal, onReady })
  live.current = { statuses, anchors, onFatal, onReady }

  // systems the application cannot work without (they hold the monitored organs)
  const requiredSystems = useMemo(() => {
    const ids = new Set<string>(REQUIRED_STRUCTURE_IDS)
    return new Set(manifest.structures.filter((s) => ids.has(s.id)).map((s) => s.system))
  }, [manifest])

  // systems on screen: each one is mounted when its file is loaded (its bounds trees are built then)
  const [loaded, setLoaded] = useState<string[]>([])

  // lazy loading: only the systems of visible layers
  const needed = useMemo(
    () => [...new Set(model.layers.filter((l) => visible[l.id]).map((l) => l.system))].sort().join(','),
    [model, visible],
  )
  useEffect(() => {
    let alive = true
    for (const system of needed.split(',').filter(Boolean)) {
      if (runtime.hasSystem(system)) continue
      const file = manifest.systems.find((f) => f.id === system)
      if (!file) continue
      loadSystem(manifest, file)
        .then((asset) => {
          if (!alive) return
          runtime.addSystem(asset)
          setLoaded((list) => (list.includes(asset.system) ? list : [...list, asset.system]))
          live.current.onReady()
        })
        .catch((err: unknown) => {
          if (!alive) return
          if (import.meta.env.DEV) console.warn('[anatomy] system failed to load', system, err)
          if (requiredSystems.has(file.id)) live.current.onFatal(`${file.file} could not be loaded`)
        })
    }
    return () => {
      alive = false
    }
  }, [needed, manifest, runtime, requiredSystems])

  // dev only: scripted checks read the scene objects (heart and lung motion)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __ahiRuntime?: unknown }
    w.__ahiRuntime = runtime
    return () => {
      if (w.__ahiRuntime === runtime) delete w.__ahiRuntime
    }
  }, [runtime])

  useEffect(() => runtime.setVisible(visible), [runtime, visible])
  useEffect(() => runtime.setSelection(selectedRegion, selectedStructureId), [runtime, selectedRegion, selectedStructureId])
  useEffect(() => runtime.setStatuses(statuses), [runtime, statuses])
  useEffect(() => {
    runtime.setHover(hoverId)
    gl.domElement.style.cursor = hoverId ? 'pointer' : ''
  }, [runtime, hoverId, gl])

  // scan pulse: draw the eye to a region whose status just changed (not on first load or crew switch)
  const prev = useRef<{ subject: string; statuses: Record<BodyRegionId, Status> } | null>(null)
  useEffect(() => {
    const last = prev.current
    prev.current = { subject, statuses }
    if (!last || last.subject !== subject) return
    let pick: BodyRegionId | null = null
    let bestRank = -9
    for (const r of REGIONS) {
      if (last.statuses[r] === statuses[r]) continue
      const rank = STATUS_META[statuses[r]].rank
      if (rank > bestRank) {
        bestRank = rank
        pick = r
      }
    }
    if (!pick) return
    const worse = STATUS_META[statuses[pick]].rank > STATUS_META[last.statuses[pick]].rank
    runtime.startPulse(pick, statuses[pick], worse, live.current.anchors[pick])
  }, [statuses, subject, runtime])

  // pointer: hover is resolved in the frame loop (throttled), click on pointer up without drag
  const pickRef = useRef<(() => void) | null>(null)
  const pointer = useRef({ x: 0, y: 0, inside: false, dirty: false, down: false, downX: 0, downY: 0, lastPick: 0 })
  const ray = useMemo(() => new Raycaster(), [])
  const ndc = useMemo(() => new Vector2(), [])
  useEffect(() => {
    const el = gl.domElement
    const p = pointer.current
    const pickAt = (x: number, y: number) => {
      const rect = el.getBoundingClientRect()
      ndc.set(((x - rect.left) / Math.max(1, rect.width)) * 2 - 1, -((y - rect.top) / Math.max(1, rect.height)) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return runtime.pick(ray)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      p.x = e.clientX
      p.y = e.clientY
      p.inside = true
      p.dirty = true
    }
    const onLeave = () => {
      p.inside = false
      p.dirty = false
      store.getState().setHover(null)
    }
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      p.down = true
      p.downX = e.clientX
      p.downY = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      if (!p.down || e.button !== 0) return
      p.down = false
      if (Math.hypot(e.clientX - p.downX, e.clientY - p.downY) > CLICK_SLOP_PX) return
      const hit = pickAt(e.clientX, e.clientY)
      const app = useAppStore.getState()
      if (!hit) {
        if (app.selectedStructureId || app.selectedRegion) app.selectStructure(null)
        return
      }
      const s = byId.get(hit.id)
      if (!s) return
      if (app.selectedStructureId === hit.id) app.selectStructure(null)
      else app.selectStructure(hit.id, regionOfStructure(s))
    }
    const onCancel = () => {
      p.down = false
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    p.lastPick = 0
    const hoverPick = () => {
      const t0 = performance.now()
      store.getState().setHover(pickAt(p.x, p.y))
      viewerStats.pickMs = performance.now() - t0
    }
    pickRef.current = hoverPick
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.style.cursor = ''
      pickRef.current = null
    }
  }, [gl, camera, runtime, store, byId, ray, ndc])
  const stats = useRef({ frames: 0, last: 0 })
  useEffect(() => {
    // renderer.info is read once per frame across every pass (post processing renders several times)
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])

  useFrame((state, dt) => {
    // statistics of the previous frame, then reset for this one
    const st = stats.current
    st.frames++
    const now = performance.now()
    if (now - st.last >= 1000) {
      viewerStats.fps = Math.round((st.frames * 1000) / (now - st.last))
      viewerStats.calls = gl.info.render.calls
      viewerStats.triangles = gl.info.render.triangles
      viewerStats.structures = runtime.structureCount
      st.frames = 0
      st.last = now
    }
    gl.info.reset()

    // live vitals (read without subscribing to avoid re-render storms)
    const s = useAppStore.getState()
    const h = s.health[s.selectedAstronautId]
    runtime.update({
      dt,
      t: state.clock.elapsedTime,
      statuses: live.current.statuses,
      hr: h?.metrics?.HEART_RATE?.current ?? null,
      rr: h?.metrics?.RESPIRATORY_RATE?.current ?? null,
      skinOpacity: store.getState().skinOpacity,
    })

    // hover: one raycast at most every PICK_MS, never while dragging; refreshed slowly while the camera moves
    const p = pointer.current
    if (p.inside && !p.down && pickRef.current) {
      const since = now - p.lastPick
      if ((p.dirty && since >= PICK_MS) || since >= 400) {
        p.dirty = false
        p.lastPick = now
        pickRef.current()
      }
    }
  })

  const anchor = (r: BodyRegionId) => live.current.anchors[r]
  const hoverPoint = () => store.getState().hover?.point ?? null

  return (
    <>
      <Studio body={manifest.bounds} runtime={runtime} shadows={shadows} />
      <primitive object={runtime.root} />
      {loaded.map((system) => {
        const group = runtime.systemGroup(system)
        // bounding volume hierarchies make hover picking a sub millisecond raycast
        return group ? (
          <Bvh key={system} strategy={BVH_CENTER} maxLeafTris={12}>
            <primitive object={group} />
          </Bvh>
        ) : null
      })}
      <LabelProjector registry={labels} anchor={anchor} hoverPoint={hoverPoint} />
    </>
  )
}
