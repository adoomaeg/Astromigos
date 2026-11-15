/** Scanner environment: holographic floor disc, sweeping scan plane, drifting particles. */
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, CircleGeometry, Color, CustomBlending, DoubleSide, OneFactor, ShaderMaterial, ZeroFactor } from 'three'
import type { Globals } from './materials'

function additive(m: ShaderMaterial) {
  m.blending = CustomBlending
  m.blendSrc = OneFactor
  m.blendDst = OneFactor
  m.blendSrcAlpha = ZeroFactor
  m.blendDstAlpha = OneFactor
  m.transparent = true
  m.depthWrite = false
  return m
}

const VERT_UV = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export function ScannerFloor({ globals, accent }: { globals: Globals; accent: string }) {
  const [geo, mat] = useMemo(() => {
    const g = new CircleGeometry(0.95, 96)
    const m = additive(
      new ShaderMaterial({
        uniforms: { uTime: globals.uTime, uColor: { value: new Color(accent) } },
        vertexShader: VERT_UV,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uColor;
          varying vec2 vUv;
          float ring(float r, float c, float w) { return exp(-pow((r - c) / w, 2.0)); }
          void main() {
            vec2 p = (vUv - 0.5) * 2.0 * 0.95;
            float r = length(p);
            float a = atan(p.y, p.x);
            float glow = exp(-r * r * 9.0) * 0.55;
            float rings = ring(r, 0.34, 0.004) * 0.55 + ring(r, 0.5, 0.003) * 0.35 + ring(r, 0.72, 0.0035) * 0.5 + ring(r, 0.9, 0.002) * 0.3;
            float ticks = step(0.86, fract(a / 6.28318 * 120.0)) * smoothstep(0.84, 0.845, r) * (1.0 - smoothstep(0.875, 0.88, r)) * 0.45;
            float seg = step(0.5, fract(a / 6.28318 * 6.0 + uTime * 0.04)) * ring(r, 0.62, 0.006) * 0.6;
            float seg2 = step(0.7, fract(-a / 6.28318 * 3.0 + uTime * 0.07)) * ring(r, 0.42, 0.005) * 0.5;
            float wave = ring(r, fract(uTime * 0.22) * 0.95, 0.02) * (1.0 - fract(uTime * 0.22)) * 0.35;
            float grid = (step(0.97, fract(p.x * 18.0)) + step(0.97, fract(p.y * 18.0))) * 0.05 * (1.0 - smoothstep(0.3, 0.9, r));
            float fade = 1.0 - smoothstep(0.82, 0.95, r);
            vec3 col = uColor * (glow + rings + ticks + seg + seg2 + wave + grid) * fade;
            gl_FragColor = vec4(col, 0.0);
          }`,
        side: DoubleSide,
      }),
    )
    return [g, m] as const
  }, [globals, accent])
  return <mesh geometry={geo} material={mat} rotation-x={-Math.PI / 2} position-y={0.001} renderOrder={0} />
}

export function ScanPlane({ globals, accent }: { globals: Globals; accent: string }) {
  const [geo, mat] = useMemo(() => {
    const g = new CircleGeometry(0.5, 72)
    const m = additive(
      new ShaderMaterial({
        uniforms: { uScanY: globals.uScanY, uColor: { value: new Color(accent) } },
        vertexShader: /* glsl */ `
          uniform float uScanY;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            wp.y += uScanY;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uScanY;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p);
            float edge = exp(-pow((r - 0.96) / 0.02, 2.0)) * 0.55;
            float fill = (1.0 - smoothstep(0.2, 1.0, r)) * 0.05;
            float life = smoothstep(-0.02, 0.1, uScanY) * (1.0 - smoothstep(1.7, 1.85, uScanY));
            gl_FragColor = vec4(uColor * (edge + fill) * life, 0.0);
          }`,
        side: DoubleSide,
      }),
    )
    return [g, m] as const
  }, [globals, accent])
  return <mesh name="scan-plane" geometry={geo} material={mat} rotation-x={-Math.PI / 2} renderOrder={9} />
}

export function Particles({ globals, accent, count = 220 }: { globals: Globals; accent: string; count?: number }) {
  const [geo, mat] = useMemo(() => {
    const g = new BufferGeometry()
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    let s = 7
    const rnd = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2
      const r = 0.25 + Math.sqrt(rnd()) * 0.8
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = rnd() * 2.1
      pos[i * 3 + 2] = Math.sin(a) * r
      seed[i] = rnd()
    }
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 1))
    const m = additive(
      new ShaderMaterial({
        uniforms: { uTime: globals.uTime, uColor: { value: new Color(accent) } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          attribute float aSeed;
          varying float vA;
          void main() {
            vec3 p = position;
            p.y = mod(p.y + uTime * (0.02 + aSeed * 0.03), 2.1);
            p.x += sin(uTime * 0.3 + aSeed * 20.0) * 0.02;
            vA = smoothstep(0.0, 0.25, p.y) * (1.0 - smoothstep(1.6, 2.1, p.y)) * (0.4 + 0.6 * aSeed);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (1.5 + aSeed * 2.0) * (3.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(uColor * a * vA * 0.5, 0.0);
          }`,
      }),
    )
    return [g, m] as const
  }, [globals, accent, count])
  return <points geometry={geo} material={mat} renderOrder={10} />
}
