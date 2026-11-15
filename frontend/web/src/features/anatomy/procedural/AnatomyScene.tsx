/** 3D content of the anatomy viewer: layered body, live animation driver, picking, labels. */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Color, MeshBasicMaterial, PerspectiveCamera } from 'three'
import type { Group, Intersection, Mesh, Vector3 } from 'three'
import type { BodyRegionId, Status } from '../../../types/domain'
import { useAppStore } from '../../../state/store'
import type { AnatomyGeometries } from './loader'
import { HEART_CENTER, LUNG_PIVOT } from './geometry/organs'
import type { Globals, HoloMaterial } from './materials'
import { createBoneMaterial, createGlobals, createMuscleMaterial, createOrganMaterial, createSkinMaterial, createVesselMaterial } from './materials'
import { ANCHORS, BODY_FRAME, LOW_COLORS, REGIONS, REGION_LAYER, parseStatusKey, statusKey, statusVisual } from '../regions'
import { effectiveLayers } from './viewerStore'
import type { ViewerStore } from './viewerStore'
import type { LabelRegistry } from '../Labels'
import { LabelProjector } from '../Labels'
import { Particles, ScanPlane, ScannerFloor } from './Environment'
import { STATUS_META } from '../../../lib/status'

const VESSEL_LOW = new Color('#38bdf8')
const tmpColor = new Color()

const neg = (v: readonly [number, number, number]): [number, number, number] => [-v[0], -v[1], -v[2]]

/** Cardiac cycle: lub (S1) then dub (S2) at ~30% of the period. Returns 0..1 pump amount. */
function lubDub(p: number): number {
  const g = (c: number, w: number) => Math.exp(-(((p - c) / w) ** 2))
  return g(0.06, 0.045) + 0.55 * g(0.3, 0.04)
}

/** Respiratory cycle: ~40% inhale, ~60% exhale. Returns 0..1 lung inflation. */
function breathCurve(p: number): number {
  const sm = (t: number) => t * t * (3 - 2 * t)
  return p < 0.4 ? sm(p / 0.4) : 1 - sm((p - 0.4) / 0.6)
}

interface Mats {
  skin: ReturnType<typeof createSkinMaterial>
  muscles: HoloMaterial
  bones: HoloMaterial
  brain: HoloMaterial
  heart: HoloMaterial
  lungs: HoloMaterial
  bronchi: HoloMaterial
  kidneys: HoloMaterial
  context: HoloMaterial
  vessels: ReturnType<typeof createVesselMaterial>
}

function lungMaterial(g: Globals): HoloMaterial {
  const m = createOrganMaterial(g, '#7dd3fc', 0.6, 330)
  m.depthWrite = false
  m.uniforms.uAlphaFres!.value = 1
  return m
}

function createMats(g: Globals): Mats {
  return {
    skin: createSkinMaterial(g, '#3fd3f2'),
    muscles: createMuscleMaterial(g, '#2dd4bf'),
    bones: createBoneMaterial(g, '#dbe7ff'),
    brain: createOrganMaterial(g, '#a5b4fc', 0.35, 160),
    heart: createOrganMaterial(g, '#5eead4', 0.45, 260),
    lungs: lungMaterial(g),
    bronchi: createVesselMaterial(g, '#7dd3fc'),
    kidneys: createOrganMaterial(g, '#67e8f9', 0.4, 300),
    context: createOrganMaterial(g, '#6b8fb3', 0.5, 180),
    vessels: createVesselMaterial(g, '#38bdf8'),
  }
}

/** Per region: which materials it tints, base opacity, and intensity multiplier for warnings. */
function regionMats(m: Mats): Record<BodyRegionId, { mats: HoloMaterial[]; opacity: number; warnGain: number; dim: number }> {
  return {
    skin: { mats: [m.skin], opacity: 1, warnGain: 0.55, dim: 0.35 },
    muscles: { mats: [m.muscles], opacity: 1, warnGain: 0.8, dim: 0.25 },
    bones: { mats: [m.bones], opacity: 1, warnGain: 0.85, dim: 0.3 },
    brain: { mats: [m.brain], opacity: 0.92, warnGain: 1, dim: 0.12 },
    heart: { mats: [m.heart], opacity: 0.95, warnGain: 1, dim: 0.12 },
    lungs: { mats: [m.lungs, m.bronchi], opacity: 0.85, warnGain: 0.85, dim: 0.1 },
    kidneys: { mats: [m.kidneys], opacity: 0.92, warnGain: 1, dim: 0.12 },
  }
}

interface RegionAnim {
  color: Color
  target: Color
  intensity: number
  focus: number
  layer: number
  hover: number
}

export interface AnatomySceneProps {
  geos: AnatomyGeometries | null
  scale: number
  store: ViewerStore
  labels: LabelRegistry
  /** Astronaut id: status changes only trigger a scan pulse within the same astronaut. */
  subject: string
  accent?: string
}

/** Below this projected body height (device px) the lighter skin mesh is used. */
const SKIN_LOD_PX = 620
/** Skin alarm strength per status (silhouette glow instead of a full body tint). */
const SKIN_ALARM: Record<Status, number> = { LOW: 0, NO_DATA: 0, MODERATE: 0.5, HIGH: 0.85, CRITICAL: 1 }
/** Whole body regions pulse from the body center; organs from their own anchor. */
const SYSTEMIC = new Set<BodyRegionId>(['skin', 'muscles', 'bones'])

interface Pulse {
  start: number
  x: number
  y: number
  z: number
  max: number
  color: Color
  waves: number
}

export function AnatomyScene({ geos, scale, store, labels, subject, accent = '#38d6f5' }: AnatomySceneProps) {
  const globals = useMemo<Globals>(() => createGlobals(), [])
  const mats = useMemo(() => createMats(globals), [globals])
  const rmats = useMemo(() => regionMats(mats), [mats])
  const pickMat = useMemo(() => new MeshBasicMaterial({ visible: false }), [])
  const solid = useMemo(() => new Set<HoloMaterial>([mats.brain, mats.heart, mats.kidneys]), [mats])

  const key = useAppStore(statusKey)
  const statuses = useMemo(() => parseStatusKey(key), [key])
  const selected = useAppStore((s) => s.selectedRegion)
  const selectRegion = useAppStore((s) => s.selectRegion)
  const layersRaw = store((s) => s.layers)
  const hoverRegion = store((s) => s.hover?.region ?? null)
  const setHover = store((s) => s.setHover)
  const layers = useMemo(() => effectiveLayers(layersRaw, statuses.muscles, selected), [layersRaw, statuses.muscles, selected])
  const gl = useThree((s) => s.gl)

  const heartRef = useRef<Group>(null)
  const lungsRef = useRef<Group>(null)
  const skinRef = useRef<Mesh>(null)
  const pulse = useRef<Pulse | null>(null)
  const prev = useRef<{ subject: string; statuses: Record<BodyRegionId, Status> } | null>(null)

  // scan pulse: draw the eye to a region whose status just changed (not on first load or crew switch)
  useEffect(() => {
    const last = prev.current
    prev.current = { subject, statuses }
    if (!geos || !last || last.subject !== subject) return
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
    const st = statuses[pick]
    const worse = STATUS_META[st].rank > STATUS_META[last.statuses[pick]].rank
    const a = SYSTEMIC.has(pick) ? ([0, 0.95, 0] as const) : ANCHORS[pick]
    pulse.current = {
      start: -1,
      x: a[0] * scale,
      y: a[1] * scale,
      z: a[2] * scale,
      max: (SYSTEMIC.has(pick) ? 1.05 : 0.42) * scale,
      color: new Color(st === 'LOW' ? LOW_COLORS[pick] : STATUS_META[st].color),
      waves: worse && (st === 'HIGH' || st === 'CRITICAL') ? 2 : 1,
    }
  }, [statuses, subject, geos, scale])
  const anim = useRef<Record<BodyRegionId, RegionAnim> | null>(null)
  if (!anim.current) {
    anim.current = Object.fromEntries(
      REGIONS.map((r) => {
        const c = new Color(statusVisual(r, 'LOW').color)
        return [r, { color: c.clone(), target: c.clone(), intensity: 1, focus: 1, layer: 1, hover: 0 }]
      }),
    ) as Record<BodyRegionId, RegionAnim>
  }
  const extra = useRef({
    ctxFocus: 1,
    ctxLayer: 1,
    vesFocus: 1,
    vesLayer: 1,
    beat: 0,
    beatAge: 9,
    breath: 0,
    reveal: -0.1,
    revealStart: -1,
    skinAlarm: 0,
    skinAlarmColor: new Color('#fb923c'),
  })
  const live = useRef({ statuses, selected, layers, hoverRegion })
  live.current = { statuses, selected, layers, hoverRegion }

  useEffect(() => () => {
    Object.values(mats).forEach((m) => m.dispose())
    pickMat.dispose()
  }, [mats, pickMat])

  useEffect(() => {
    gl.domElement.style.cursor = hoverRegion ? 'pointer' : ''
  }, [hoverRegion, gl])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = state.clock.elapsedTime
    const { statuses: st, selected: sel, layers: lay, hoverRegion: hov } = live.current
    const ex = extra.current
    globals.uTime.value = t

    // scan pulse wavefront(s)
    const pl = pulse.current
    if (pl) {
      if (pl.start < 0) pl.start = t
      const age = t - pl.start
      const dur = 1.5
      const spacing = 0.55
      let amp = 0
      let radius = 0
      for (let i = 0; i < pl.waves; i++) {
        const p = (age - i * spacing) / dur
        if (p <= 0 || p >= 1) continue
        // the newest live wave drives the shared uniforms
        radius = pl.max * (1 - (1 - p) * (1 - p))
        amp = 1.6 * (1 - p) * Math.min(1, p * 8)
      }
      if (age > (pl.waves - 1) * spacing + dur) {
        pulse.current = null
        amp = 0
      }
      globals.uPulseCenter.value.set(pl.x, pl.y, pl.z)
      globals.uPulseRadius.value = radius
      globals.uPulseAmp.value = amp
      globals.uPulseColor.value.copy(pl.color)
    }

    // skin level of detail from the projected body height
    const skin = skinRef.current
    if (skin && geos) {
      const cam = state.camera
      const fov = cam instanceof PerspectiveCamera ? cam.fov : 32
      const ctl = state.controls as unknown as { target?: Vector3 } | null
      const dist = ctl?.target ? cam.position.distanceTo(ctl.target) : cam.position.length()
      const px = ((BODY_FRAME.top * scale) / (2 * Math.max(0.1, dist) * Math.tan((fov * Math.PI) / 360))) * state.size.height * state.viewport.dpr
      const want = px < SKIN_LOD_PX ? geos.skinLo : geos.skin
      if (skin.geometry !== want) skin.geometry = want
    }

    // scan sweep: up the body over ~5s, short pause
    const cycle = 6.8
    const ph = (t % cycle) / cycle
    globals.uScanY.value = ph < 0.78 ? (ph / 0.78) * 1.86 * scale - 0.03 : -1

    // materialize from the floor once geometry is ready
    if (geos) {
      if (ex.revealStart < 0) ex.revealStart = t
      ex.reveal = Math.min(4, (t - ex.revealStart) * 1.5 - 0.05)
    }
    globals.uReveal.value = ex.reveal

    // live vitals (read without subscribing to avoid re-render storms)
    const s = useAppStore.getState()
    const h = s.health[s.selectedAstronautId]
    const hr = h?.metrics?.HEART_RATE?.current ?? null
    const rr = h?.metrics?.RESPIRATORY_RATE?.current ?? null
    const beating = st.heart !== 'NO_DATA' && hr !== null && hr > 0
    const breathing = st.lungs !== 'NO_DATA' && rr !== null && rr > 0
    let pump = 0
    if (beating) {
      ex.beat += (dt * hr) / 60
      if (ex.beat >= 1) {
        ex.beat -= 1
        ex.beatAge = 0
      }
      ex.beatAge += dt
      pump = lubDub(ex.beat)
    } else {
      ex.beatAge = 9
    }
    if (breathing) ex.breath = (ex.breath + (dt * rr) / 60) % 1
    const b = breathing ? breathCurve(ex.breath) : 0
    if (heartRef.current) heartRef.current.scale.setScalar(1 + 0.065 * pump)
    if (lungsRef.current) lungsRef.current.scale.set(1 + 0.03 * b, 1 + 0.045 * b, 1 + 0.035 * b)
    mats.skin.uniforms.uBreath!.value = b
    mats.muscles.uniforms.uBreath!.value = b
    const period = beating ? 60 / hr : 1
    const speed = 2.6
    mats.vessels.uniforms.uFront.value = beating ? ex.beatAge * speed : -10
    mats.vessels.uniforms.uFront2.value = beating ? (ex.beatAge - 0.3 * period) * speed : -10
    mats.vessels.uniforms.uFlow!.value = beating ? 1 : 0
    mats.bronchi.uniforms.uFront.value = breathing ? (ex.breath < 0.4 ? ex.breath * 0.6 : -10) : -10
    mats.bronchi.uniforms.uFront2.value = -10
    mats.bronchi.uniforms.uFlow!.value = breathing ? 0.4 : 0

    const k = 1 - Math.exp(-dt * 4)
    const kf = 1 - Math.exp(-dt * 5)
    const a = anim.current!
    // skin: alarm moves to the silhouette (rim glow, pulsing edge, hatch) so organs stay visible
    {
      const st0 = st.skin
      const target = SKIN_ALARM[st0]
      ex.skinAlarm += (target - ex.skinAlarm) * k
      if (target > 0) ex.skinAlarmColor.set(STATUS_META[st0].color)
      const rate = st0 === 'CRITICAL' ? 5.2 : st0 === 'HIGH' ? 3.0 : 1.8
      const su = mats.skin.uniforms
      su.uAlarm.value = ex.skinAlarm
      su.uAlarmColor.value.copy(ex.skinAlarmColor)
      su.uAlarmPulse.value = 0.5 + 0.5 * Math.sin(t * rate)
    }
    for (const r of REGIONS) {
      const ra = a[r]
      const status = st[r]
      const vis = statusVisual(r, status)
      const isSkinAlarm = r === 'skin' && SKIN_ALARM[status] > 0
      if (isSkinAlarm) {
        // keep the shell itself cool and calm; only a hint of the status color
        ra.target.set(LOW_COLORS.skin).lerp(tmpColor.set(vis.color), 0.3)
        ra.color.lerp(ra.target, k)
        ra.intensity += (0.8 - ra.intensity) * k
      } else {
        ra.target.set(vis.color)
        ra.color.lerp(ra.target, k)
        ra.intensity += (vis.intensity - ra.intensity) * k
      }
      const focusTarget = !sel || sel === r ? 1 : status !== 'LOW' ? Math.max(0.35, rmats[r].dim) : rmats[r].dim
      ra.focus += (focusTarget - ra.focus) * kf
      const layerOn = lay[REGION_LAYER[r]] || sel === r
      ra.layer += ((layerOn ? 1 : 0) - ra.layer) * kf
      ra.hover += ((hov === r ? 1 : 0) - ra.hover) * (1 - Math.exp(-dt * 10))
      const pulseRate = status === 'CRITICAL' ? 5.2 : 3.0
      const pulse = isSkinAlarm ? 0 : vis.pulse * (0.5 + 0.5 * Math.sin(t * pulseRate))
      const warn = status === 'LOW' || status === 'NO_DATA' || isSkinAlarm ? 1 : rmats[r].warnGain
      let intensity = ra.intensity * warn * (1 + pulse)
      if (r === 'heart') intensity *= 1 + 0.5 * pump
      if (sel === r) intensity *= r === 'skin' || r === 'muscles' || r === 'bones' ? 1.35 : 1.15
      const opacity = rmats[r].opacity * ra.focus * ra.layer
      for (const m of rmats[r].mats) {
        m.uniforms.uColor.value.copy(ra.color)
        m.uniforms.uIntensity.value = m === mats.bronchi ? intensity * 0.55 : intensity
        m.uniforms.uOpacity.value = m === mats.bronchi ? Math.min(1, opacity * 1.3) : opacity
        m.uniforms.uHover.value = ra.hover
        m.visible = opacity > 0.004
        if (solid.has(m)) m.depthWrite = opacity > 0.5
      }
    }
    // vessels follow heart status; context organs follow organ layer
    const ha = a.heart
    const vesFocus = !sel || sel === 'heart' ? 1 : 0.22
    ex.vesFocus += (vesFocus - ex.vesFocus) * kf
    ex.vesLayer += ((lay.vessels || sel === 'heart' ? 1 : 0) - ex.vesLayer) * kf
    const vm = mats.vessels
    vm.uniforms.uColor.value.copy(st.heart === 'LOW' ? VESSEL_LOW : ha.color)
    vm.uniforms.uIntensity.value = st.heart === 'LOW' ? 0.7 : Math.min(2, ha.intensity * 0.85)
    vm.uniforms.uOpacity.value = ex.vesFocus * ex.vesLayer
    vm.uniforms.uHover.value = ha.hover
    vm.visible = vm.uniforms.uOpacity.value > 0.004
    const ctxFocus = sel ? 0.12 : 1
    ex.ctxFocus += (ctxFocus - ex.ctxFocus) * kf
    ex.ctxLayer += ((lay.organs ? 1 : 0) - ex.ctxLayer) * kf
    const cm = mats.context
    cm.uniforms.uOpacity.value = 0.32 * ex.ctxFocus * ex.ctxLayer
    cm.uniforms.uIntensity.value = 0.6
    cm.visible = cm.uniforms.uOpacity.value > 0.004
    cm.depthWrite = false
  })

  const resolve = (hits: Intersection[]): { region: BodyRegionId; point: [number, number, number] } | null => {
    const lay = live.current.layers
    if (lay.organs) {
      for (const hit of hits) {
        const r = hit.object.userData.pick as BodyRegionId | 'body' | undefined
        if (r && r !== 'body') return { region: r, point: [hit.point.x, hit.point.y, hit.point.z] }
      }
    }
    const body = hits.find((hh) => hh.object.userData.pick === 'body')
    if (!body) return null
    const region: BodyRegionId | null = lay.skin ? 'skin' : lay.muscles ? 'muscles' : lay.skeleton ? 'bones' : null
    return region ? { region, point: [body.point.x, body.point.y, body.point.z] } : null
  }

  const anchor = useMemo(() => {
    const scaled = Object.fromEntries(REGIONS.map((r) => [r, ANCHORS[r].map((v) => v * scale)])) as unknown as Record<BodyRegionId, [number, number, number]>
    return (r: BodyRegionId) => scaled[r]
  }, [scale])
  const hoverPoint = () => store.getState().hover?.point ?? null

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover(resolve(e.intersections))
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const hit = resolve(e.intersections)
    if (hit) selectRegion(hit.region === live.current.selected ? null : hit.region)
  }

  return (
    <>
      <ScannerFloor globals={globals} accent={accent} />
      <ScanPlane globals={globals} accent={accent} />
      <Particles globals={globals} accent={accent} />
      {geos && (
        <group scale={scale}>
          <mesh geometry={geos.context} material={mats.context} renderOrder={1} />
          <mesh geometry={geos.brain} material={mats.brain} renderOrder={1} />
          {/* Eyes are passive anatomy (no eye monitoring device in this MVP): drawn like the other context organs, not pickable. */}
          <mesh geometry={geos.eyes} material={mats.context} renderOrder={1} />
          <group ref={heartRef} position={HEART_CENTER}>
            <mesh geometry={geos.heart} material={mats.heart} position={neg(HEART_CENTER)} renderOrder={1} />
          </group>
          <group ref={lungsRef} position={LUNG_PIVOT}>
            <group position={neg(LUNG_PIVOT)}>
              <mesh geometry={geos.lungL} material={mats.lungs} renderOrder={0.9} />
              <mesh geometry={geos.lungR} material={mats.lungs} renderOrder={0.9} />
              <mesh geometry={geos.bronchi} material={mats.bronchi} renderOrder={1.5} />
            </group>
          </group>
          <mesh geometry={geos.kidneys} material={mats.kidneys} renderOrder={1} />
          <mesh geometry={geos.skeleton} material={mats.bones} renderOrder={2} />
          <mesh geometry={geos.vessels} material={mats.vessels} renderOrder={3} />
          <mesh geometry={geos.muscles} material={mats.muscles} renderOrder={4} />
          <mesh ref={skinRef} geometry={geos.skin} material={mats.skin} renderOrder={5} />

          <group onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={onClick}>
            <mesh geometry={geos.pickBody} material={pickMat} userData={{ pick: 'body' }} />
            <mesh geometry={geos.pickBrain} material={pickMat} userData={{ pick: 'brain' }} />
            <mesh geometry={geos.pickHeart} material={pickMat} userData={{ pick: 'heart' }} />
            <mesh geometry={geos.pickLungs} material={pickMat} userData={{ pick: 'lungs' }} />
            <mesh geometry={geos.pickKidneys} material={pickMat} userData={{ pick: 'kidneys' }} />
          </group>
        </group>
      )}
      <LabelProjector registry={labels} anchor={anchor} hoverPoint={hoverPoint} />
    </>
  )
}

