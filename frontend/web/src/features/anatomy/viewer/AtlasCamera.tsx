/**
 * Camera of the atlas viewer: damped orbit controls (rotate, zoom, bounded pan), smooth fly-to
 * for the selection, preset views and idle auto rotate.
 *
 * Whole body shots are fitted to the viewport: the body fills about 88 percent of the free
 * height (between the top reserve and the bottom controls) and is fitted again whenever the
 * container resizes. Close ups frame the bounding box of the selected structure or region.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { PerspectiveCamera, Spherical, Vector3 } from 'three'
import type { FrameInsets } from '../procedural/CameraRig'
import type { Box, Focus } from './layers'
import type { ViewPreset } from './atlasStore'

type Controls = React.ComponentRef<typeof OrbitControls>

interface Props {
  /** Whole body bounds in the atlas frame. */
  body: Box
  /** Current selection to frame, null for the whole body. */
  focus: Focus | null
  resetNonce: number
  view: { preset: ViewPreset; nonce: number } | null
  /** true while a structure is hovered (pauses auto rotate). */
  hovering: boolean
  autoRotate?: boolean
  insets: FrameInsets
}

const IDLE_MS = 5000
/** Fraction of the free height the full body occupies. */
const FILL = 0.92
const DEFAULT_DIR = new Vector3(0, 0.06, 1)

/** Azimuth of the preset views. The body faces +Z, so its left side is on +X. */
const PRESET_THETA: Record<ViewPreset, number> = { front: 0, back: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }

interface View {
  w: number
  h: number
  fov: number
  insets: FrameInsets
}

interface Goal {
  target: Vector3
  sph: Spherical
}

/** Camera distance and target height that fit the whole body inside the free area of the view. */
function fitBody(body: Box, v: View) {
  const t = Math.tan((v.fov * Math.PI) / 360)
  const bottom = body.min[1] - 0.015
  const top = body.max[1]
  const width = Math.max(0.5, body.max[0] - body.min[0])
  const availH = Math.max(60, v.h - v.insets.top - v.insets.bottom)
  const dH = ((top - bottom) * v.h) / (2 * t * FILL * availH)
  const dW = (width * v.h) / (2 * t * 0.94 * Math.max(1, v.w))
  const dist = Math.max(dH, dW)
  // shift the target so the body centers in the free area rather than in the canvas
  const worldPerPx = (2 * dist * t) / Math.max(1, v.h)
  const cy = (top + bottom) / 2 + ((v.insets.top - v.insets.bottom) / 2) * worldPerPx
  return { dist, cy }
}

function goalFor(body: Box, focus: Focus | null, v: View): Goal {
  const dir = focus ? new Vector3(...focus.dir).normalize() : DEFAULT_DIR.clone().normalize()
  const full = fitBody(body, v)
  if (!focus || focus.full) {
    const cx = focus ? (focus.box.min[0] + focus.box.max[0]) / 2 : 0
    const cz = focus ? (focus.box.min[2] + focus.box.max[2]) / 2 : 0
    const target = new Vector3(focus ? cx * 0.5 : 0, full.cy, focus ? cz * 0.5 : 0)
    return { target, sph: new Spherical().setFromVector3(dir.multiplyScalar(full.dist)) }
  }
  const { min, max } = focus.box
  const target = new Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2)
  const radius = 0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2])
  const aspect = v.w / Math.max(1, v.h)
  const half = (v.fov * Math.PI) / 360
  // the tighter of the vertical and horizontal half angles decides the distance
  const halfMin = Math.min(half, Math.atan(Math.tan(half) * aspect))
  const dist = Math.min(full.dist, Math.max(0.32, (radius * (focus.pad ?? 1.5)) / Math.sin(halfMin)))
  // center the box in the free area (above the controls) rather than in the canvas
  target.y += ((v.insets.top - v.insets.bottom) / 2) * ((2 * dist * Math.tan(half)) / Math.max(1, v.h))
  return { target, sph: new Spherical().setFromVector3(dir.multiplyScalar(dist)) }
}

export function AtlasCamera({ body, focus, resetNonce, view, hovering, autoRotate = true, insets }: Props) {
  const controls = useRef<Controls>(null)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const fly = useRef<Goal | null>(null)
  const lastInteraction = useRef(-Infinity)
  const tmp = useRef({ off: new Vector3(), sph: new Spherical() })
  const fov = camera instanceof PerspectiveCamera ? camera.fov : 30
  const cur: View = { w: size.width, h: size.height, fov, insets }
  const viewRef = useRef(cur)
  viewRef.current = cur
  const focusRef = useRef(focus)
  focusRef.current = focus
  const placed = useRef(false)
  const fitDist = fitBody(body, cur).dist
  const limits = useMemo(
    () => ({ min: new Vector3(body.min[0] - 0.1, body.min[1], body.min[2] - 0.1), max: new Vector3(body.max[0] + 0.1, body.max[1] + 0.05, body.max[2] + 0.1) }),
    [body],
  )

  // initial placement, then fit again on resize (keeps the current orbit angle, so auto rotate is not disturbed)
  useEffect(() => {
    if (size.width < 2 || size.height < 2) return
    const g = goalFor(body, focusRef.current, viewRef.current)
    if (!placed.current) {
      placed.current = true
      camera.position.copy(g.target).add(new Vector3().setFromSpherical(g.sph))
      controls.current?.target.copy(g.target)
      camera.lookAt(g.target)
      return
    }
    const c = controls.current
    if (c) {
      const now = new Spherical().setFromVector3(new Vector3().copy(camera.position).sub(c.target))
      g.sph.theta = now.theta
      if (!focusRef.current) g.sph.phi = now.phi
    }
    fly.current = g
  }, [size.width, size.height, insets.top, insets.bottom])

  // fly to the selection (or back to the whole body)
  const focusKey = focus?.key ?? ''
  useEffect(() => {
    if (!placed.current) return
    fly.current = goalFor(body, focusRef.current, viewRef.current)
  }, [focusKey, resetNonce, body])

  // preset views: same target and distance, new orbit angle (whole body: fitted distance)
  const viewNonce = view?.nonce ?? 0
  useEffect(() => {
    const c = controls.current
    if (!placed.current || !view || !c) return
    const g = goalFor(body, focusRef.current, viewRef.current)
    g.sph.theta = PRESET_THETA[view.preset]
    g.sph.phi = Math.PI / 2 - 0.06
    fly.current = g
    lastInteraction.current = performance.now()
  }, [viewNonce])

  useFrame((_, dt) => {
    const c = controls.current
    if (!c) return
    const now = performance.now()
    const g = fly.current
    if (g) {
      const k = 1 - Math.exp(-Math.min(dt, 0.05) * 3.6)
      c.target.lerp(g.target, k)
      const { off, sph } = tmp.current
      off.copy(camera.position).sub(c.target)
      sph.setFromVector3(off)
      let dTheta = g.sph.theta - sph.theta
      while (dTheta > Math.PI) dTheta -= Math.PI * 2
      while (dTheta < -Math.PI) dTheta += Math.PI * 2
      sph.theta += dTheta * k
      sph.phi += (g.sph.phi - sph.phi) * k
      sph.radius += (g.sph.radius - sph.radius) * k
      camera.position.copy(c.target).add(off.setFromSpherical(sph))
      camera.lookAt(c.target)
      if (Math.abs(dTheta) < 0.002 && Math.abs(g.sph.phi - sph.phi) < 0.002 && Math.abs(g.sph.radius - sph.radius) < 0.002 && c.target.distanceTo(g.target) < 0.002) {
        fly.current = null
      }
    } else {
      // pan limit: the orbit target never leaves the body
      c.target.clamp(limits.min, limits.max)
    }
    c.autoRotate = autoRotate && !g && !focusRef.current && !hovering && now - lastInteraction.current > IDLE_MS
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
      panSpeed={0.7}
      minDistance={0.18}
      maxDistance={Math.max(5.5, fitDist * 1.4)}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI * 0.78}
      autoRotateSpeed={0.55}
      onStart={() => {
        fly.current = null
        lastInteraction.current = Infinity
      }}
      onEnd={() => {
        lastInteraction.current = performance.now()
      }}
    />
  )
}
