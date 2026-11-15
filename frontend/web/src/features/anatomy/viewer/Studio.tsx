/**
 * Studio of the atlas viewer: key, fill and rim lights, a procedural environment map built from
 * light panels (no remote HDR), a soft floor disc and contact shadows.
 *
 * The whole rig turns with the camera around the body (like a photographer walking around a
 * subject with the lights attached), so every preset view is lit the same way. Shadows are not
 * rendered per frame: the shadow map is refreshed when the rig has turned a little or the scene
 * content changed, and the contact shadow only when the content changed.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { CircleGeometry, Color, ShaderMaterial } from 'three'
import type { DirectionalLight, Group, Vector3 } from 'three'
import type { Box } from './layers'
import type { AtlasRuntime } from './runtime'
import { ACCENT } from './tissueMaterials'

function Floor({ y, radius }: { y: number; radius: number }) {
  const [geo, mat] = useMemo(() => {
    const g = new CircleGeometry(radius, 96)
    const m = new ShaderMaterial({
      uniforms: { uAccent: { value: new Color(ACCENT) }, uBase: { value: new Color('#2a4468') } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uAccent;
        uniform vec3 uBase;
        varying vec2 vUv;
        float ring(float r, float c, float w) { return exp(-pow((r - c) / w, 2.0)); }
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float a = atan(p.y, p.x);
          // soft pool of light under the body, fading to nothing at the edge
          float pool = pow(1.0 - smoothstep(0.0, 1.0, r), 1.6);
          // thin accent rings and tick marks (measurement platform)
          float rings = ring(r, 0.8, 0.004) * 0.75 + ring(r, 0.56, 0.003) * 0.3;
          float ticks = ring(r, 0.845, 0.012) * step(0.82, abs(sin(a * 36.0))) * 0.45;
          vec3 col = uBase * pool * 0.55 + uAccent * (rings + ticks) * 0.5;
          float alpha = clamp(pool * 0.34 + (rings + ticks) * 0.5, 0.0, 1.0);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
    })
    return [g, m]
  }, [radius])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <mesh geometry={geo} material={mat} rotation-x={-Math.PI / 2} position-y={y} renderOrder={-1} />
}

export interface StudioProps {
  body: Box
  runtime: AtlasRuntime
  /** Self shadows from the key light (off on low end GPUs). */
  shadows: boolean
}

/** The shadow map is rendered again after the light rig turned this much (radians). */
const SHADOW_STEP = 0.03

export function Studio({ body, runtime, shadows }: StudioProps) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const key = useRef<DirectionalLight>(null)
  const rig = useRef<Group>(null)
  const [, bump] = useState(0)
  const floorY = body.min[1]
  const mid = (body.min[1] + body.max[1]) / 2
  const half = (body.max[1] - body.min[1]) / 2 + 0.1

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
  }, [gl, shadows])

  useEffect(() => {
    const l = key.current
    if (!l) return
    l.target.position.set(0, mid, 0)
    l.target.updateMatrixWorld()
  }, [mid])

  useEffect(
    () => () => {
      scene.environmentRotation.y = 0
    },
    [scene],
  )

  const state = useRef({ settle: 0, shadowAz: 0 })
  useFrame(({ camera, controls }, dt) => {
    const st = state.current
    // lights and environment follow the camera azimuth around the body
    const target = (controls as unknown as { target?: Vector3 } | null)?.target
    const az = Math.atan2(camera.position.x - (target?.x ?? 0), camera.position.z - (target?.z ?? 0))
    if (rig.current) rig.current.rotation.y = az
    scene.environmentRotation.y = az
    let dAz = az - st.shadowAz
    if (dAz > Math.PI) dAz -= Math.PI * 2
    if (dAz < -Math.PI) dAz += Math.PI * 2
    if (Math.abs(dAz) > SHADOW_STEP) {
      st.shadowAz = az
      gl.shadowMap.needsUpdate = true
    }
    if (runtime.shadowsDirty) {
      runtime.shadowsDirty = false
      gl.shadowMap.needsUpdate = true
      st.settle = 0.001
    }
    // the contact shadow is rendered a few frames after a content change (materials and matrices settled)
    if (st.settle > 0) {
      st.settle += dt
      if (st.settle > 0.12) {
        st.settle = 0
        bump((n) => n + 1)
      }
    }
  })

  return (
    <>
      <Environment resolution={256} frames={1} environmentIntensity={0.85}>
        <color attach="background" args={['#0a1526']} />
        {/* key: large warm panel, front right and above */}
        <Lightformer form="rect" intensity={2.6} color="#fff0df" position={[3, 3.6, 4]} scale={[4.5, 5, 1]} target={[0, 1, 0]} />
        {/* fill: cool panel on the left */}
        <Lightformer form="rect" intensity={1.0} color="#b9d4ff" position={[-5, 1.6, 2.5]} scale={[3, 5, 1]} target={[0, 1, 0]} />
        {/* rims: narrow cyan white strips behind, left and right */}
        <Lightformer form="rect" intensity={3.2} color="#a8ecff" position={[-3.6, 2, -4.5]} scale={[1.2, 6, 1]} target={[0, 1, 0]} />
        <Lightformer form="rect" intensity={2.4} color="#cfe6ff" position={[3.8, 2.2, -4.2]} scale={[1.0, 6, 1]} target={[0, 1, 0]} />
        {/* top and a faint floor bounce */}
        <Lightformer form="rect" intensity={1.1} color="#ffffff" position={[0, 6, 0.5]} scale={[5, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.25} color="#3d6fa8" position={[0, -3, 0]} scale={[8, 8, 1]} target={[0, 0, 0]} />
      </Environment>
      <hemisphereLight args={['#c9dcff', '#0b1220', 0.28]} />
      <group ref={rig}>
        <directionalLight
          ref={key}
          position={[1.7, mid + 2.1, 3.1]}
          intensity={1.85}
          color="#fff3e6"
          castShadow={shadows}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.012}
          shadow-camera-left={-0.95}
          shadow-camera-right={0.95}
          shadow-camera-top={half}
          shadow-camera-bottom={-half}
          shadow-camera-near={0.5}
          shadow-camera-far={8}
        />
        <directionalLight position={[-3, mid + 0.4, 1.6]} intensity={0.4} color="#b6d0ff" />
        <directionalLight position={[-1.6, mid + 1.4, -3.2]} intensity={1.25} color="#9fe4ff" />
        <directionalLight position={[2.2, mid + 0.8, -2.8]} intensity={0.7} color="#d6e8ff" />
      </group>
      <Floor y={floorY - 0.003} radius={0.92} />
      <ContactShadows position={[0, floorY - 0.001, 0]} scale={2.2} far={1.1} blur={2.6} opacity={0.62} resolution={512} frames={2} color="#01060f" />
    </>
  )
}
