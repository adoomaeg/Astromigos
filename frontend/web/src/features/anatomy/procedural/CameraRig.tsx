/**
 * Orbit controls with smooth fly-to framing per region and idle auto-rotate.
 * Full body shots are fitted to the viewport: the body fills ~88% of the free height (between
 * the top reserve and the bottom control pill) and is re-fitted whenever the container resizes.
 */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { PerspectiveCamera, Spherical, Vector3 } from 'three'
import type { BodyRegionId } from '../../../types/domain'
import { BODY_FRAME, DEFAULT_FRAMING, FRAMING } from '../regions'
import type { Framing } from '../regions'

type Controls = React.ComponentRef<typeof OrbitControls>

/** Screen space kept free of the body (CSS px), e.g. for the control pill and a headline. */
export interface FrameInsets {
  top: number
  bottom: number
}

interface Props {
  selected: BodyRegionId | null
  resetNonce: number
  scale: number
  /** true while a region is hovered (pauses auto-rotate) */
  hovering: boolean
  autoRotate?: boolean
  insets: FrameInsets
}

const IDLE_MS = 5000
/** Fraction of the free height the full body occupies. */
const FILL = 0.88

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
function fitBody(scale: number, v: View) {
  const t = Math.tan((v.fov * Math.PI) / 360)
  const heightW = (BODY_FRAME.top - BODY_FRAME.bottom) * scale
  const availH = Math.max(60, v.h - v.insets.top - v.insets.bottom)
  const dH = (heightW * v.h) / (2 * t * FILL * availH)
  const dW = (BODY_FRAME.width * scale * v.h) / (2 * t * 0.92 * Math.max(1, v.w))
  const dist = Math.max(dH, dW)
  // shift the target so the body centers in the free area rather than in the canvas
  const worldPerPx = (2 * dist * t) / Math.max(1, v.h)
  const cy = ((BODY_FRAME.top + BODY_FRAME.bottom) / 2) * scale + ((v.insets.top - v.insets.bottom) / 2) * worldPerPx
  return { dist, cy }
}

function goalFor(f: Framing, scale: number, v: View): Goal {
  const dir = new Vector3(...f.dir).normalize()
  if (f.full) {
    const { dist, cy } = fitBody(scale, v)
    const target = new Vector3(f.target[0] * scale, cy, f.target[2] * scale)
    return { target, sph: new Spherical().setFromVector3(dir.multiplyScalar(dist)) }
  }
  const aspect = v.w / Math.max(1, v.h)
  const target = new Vector3(...f.target).multiplyScalar(scale)
  // keep close ups framed in narrow panels
  const dist = f.dist * scale * Math.max(1, 0.72 / Math.max(aspect, 0.3))
  return { target, sph: new Spherical().setFromVector3(dir.multiplyScalar(dist)) }
}

export function CameraRig({ selected, resetNonce, scale, hovering, autoRotate = true, insets }: Props) {
  const controls = useRef<Controls>(null)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const fly = useRef<Goal | null>(null)
  const lastInteraction = useRef(-Infinity)
  const tmp = useRef({ off: new Vector3(), sph: new Spherical() })
  const fov = camera instanceof PerspectiveCamera ? camera.fov : 32
  const view: View = { w: size.width, h: size.height, fov, insets }
  const viewRef = useRef(view)
  viewRef.current = view
  const placed = useRef(false)
  const fitDist = fitBody(scale, view).dist

  // initial placement, then re-fit on resize (keeps the current orbit angle, so auto-rotate is not disturbed)
  useEffect(() => {
    if (size.width < 2 || size.height < 2) return
    const g = goalFor(selected ? FRAMING[selected] : DEFAULT_FRAMING, scale, viewRef.current)
    if (!placed.current) {
      placed.current = true
      camera.position.copy(g.target).add(new Vector3().setFromSpherical(g.sph))
      controls.current?.target.copy(g.target)
      camera.lookAt(g.target)
      return
    }
    const c = controls.current
    if (c) {
      const cur = new Spherical().setFromVector3(new Vector3().copy(camera.position).sub(c.target))
      g.sph.theta = cur.theta
      if (!selected) g.sph.phi = cur.phi
    }
    fly.current = g
  }, [size.width, size.height, insets.top, insets.bottom])

  // dev only: window.__ahiFly(target, dir, dist) frames an arbitrary point (used by the lab page)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __ahiFly?: (t: Framing['target'], d: Framing['dir'], dist: number) => void }
    w.__ahiFly = (target, dir, dist) => {
      fly.current = goalFor({ target, dir, dist }, scale, viewRef.current)
    }
    return () => {
      delete w.__ahiFly
    }
  }, [scale])

  useEffect(() => {
    if (!placed.current) return
    const f = selected ? FRAMING[selected] : DEFAULT_FRAMING
    fly.current = goalFor(f, scale, viewRef.current)
  }, [selected, resetNonce, scale])

  useFrame((_, dt) => {
    const c = controls.current
    if (!c) return
    const now = performance.now()
    const g = fly.current
    if (g) {
      const k = 1 - Math.exp(-Math.min(dt, 0.05) * 3.4)
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
    }
    c.autoRotate = autoRotate && !g && !selected && !hovering && now - lastInteraction.current > IDLE_MS
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
      minDistance={0.3 * scale}
      maxDistance={Math.max(5.5, fitDist * 1.4)}
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI * 0.62}
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
