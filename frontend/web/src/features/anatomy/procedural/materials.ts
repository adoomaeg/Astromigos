/**
 * Holographic shader materials. All share a few global uniforms (time, scan line height,
 * reveal height) by reference so one write per frame updates every material.
 */
import { Color, CustomBlending, DoubleSide, FrontSide, NormalBlending, OneFactor, ShaderMaterial, Vector3, ZeroFactor } from 'three'
import type { IUniform } from 'three'

export interface Globals {
  uTime: IUniform<number>
  uScanY: IUniform<number>
  uReveal: IUniform<number>
  /** Status change "scan pulse": a spherical wavefront expanding from a region (world space). */
  uPulseCenter: IUniform<Vector3>
  uPulseRadius: IUniform<number>
  uPulseAmp: IUniform<number>
  uPulseColor: IUniform<Color>
}

export function createGlobals(): Globals {
  return {
    uTime: { value: 0 },
    uScanY: { value: -1 },
    uReveal: { value: -0.1 },
    uPulseCenter: { value: new Vector3() },
    uPulseRadius: { value: 0 },
    uPulseAmp: { value: 0 },
    uPulseColor: { value: new Color('#ffffff') },
  }
}

export interface HoloUniforms {
  [k: string]: IUniform
  uColor: IUniform<Color>
  uIntensity: IUniform<number>
  uOpacity: IUniform<number>
  uHover: IUniform<number>
}

export type HoloMaterial = ShaderMaterial & { uniforms: HoloUniforms }

const VERT_COMMON = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vV;
  varying vec3 vL;
`

const VERT_BODY = /* glsl */ `
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  vL = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
`

const FRAG_COMMON = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uHover;
  uniform float uTime;
  uniform float uScanY;
  uniform float uReveal;
  uniform vec3 uPulseCenter;
  uniform float uPulseRadius;
  uniform float uPulseAmp;
  uniform vec3 uPulseColor;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vV;
  varying vec3 vL;

  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float scanBand(float w) { return exp(-pow((vW.y - uScanY) / w, 2.0)); }
  float revealEdge() { return exp(-pow((vW.y - uReveal) / 0.012, 2.0)); }
  /** Thin bright shell at the current pulse radius plus a faint trailing glow inside it. */
  vec3 scanPulse() {
    if (uPulseAmp <= 0.001) return vec3(0.0);
    float d = distance(vW, uPulseCenter) - uPulseRadius;
    float ring = exp(-pow(d / 0.012, 2.0)) + 0.25 * exp(-pow(d / 0.05, 2.0)) * step(d, 0.0);
    return uPulseColor * ring * uPulseAmp;
  }
`

function base(globals: Globals, color: string, extra: Record<string, IUniform> = {}): HoloUniforms {
  return {
    ...globals,
    uColor: { value: new Color(color) },
    uIntensity: { value: 1 },
    uOpacity: { value: 1 },
    uHover: { value: 0 },
    ...extra,
  } as HoloUniforms
}

/** Additive blending that leaves destination alpha untouched (pure emission over a transparent canvas). */
function emissive(m: ShaderMaterial) {
  m.blending = CustomBlending
  m.blendSrc = OneFactor
  m.blendDst = OneFactor
  m.blendSrcAlpha = ZeroFactor
  m.blendDstAlpha = OneFactor
  m.transparent = true
  m.depthWrite = false
  return m
}

// ---------------------------------------------------------------------------

/**
 * Skin: fresnel rim shell with fine scanlines, breathing chest expansion and scan sweep.
 * Alarm (Watch, Warning, Critical) lives on the silhouette: a status colored, pulsing edge and a
 * faint drifting hatch, so the front of the shell stays clear and organs remain readable.
 */
export function createSkinMaterial(g: Globals, color: string): HoloMaterial & { uniforms: { uAlarm: IUniform<number>; uAlarmColor: IUniform<Color>; uAlarmPulse: IUniform<number> } } {
  const m = new ShaderMaterial({
    uniforms: base(g, color, { uBreath: { value: 0 }, uAlarm: { value: 0 }, uAlarmColor: { value: new Color('#fb923c') }, uAlarmPulse: { value: 0 } }),
    vertexShader: /* glsl */ `
      uniform float uBreath;
      ${VERT_COMMON}
      void main() {
        float chest = smoothstep(1.04, 1.18, position.y) * (1.0 - smoothstep(1.36, 1.46, position.y)) * (1.0 - smoothstep(0.16, 0.2, abs(position.x)));
        vec3 p = position + normal * uBreath * 0.0075 * chest;
        ${VERT_BODY}
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlarm;
      uniform vec3 uAlarmColor;
      uniform float uAlarmPulse;
      ${FRAG_COMMON}
      void main() {
        if (vW.y > uReveal) discard;
        vec3 N = normalize(vN);
        vec3 V = normalize(vV);
        float ndv = abs(dot(N, V));
        float fres = pow(1.0 - ndv, 2.6);
        float lines = smoothstep(0.6, 1.0, sin(vW.y * 560.0 - uTime * 1.6)) * 0.5;
        float shimmer = 0.82 + 0.18 * sin(vW.y * 37.0 + vW.x * 23.0 - uTime * 0.9) * sin(vW.z * 29.0 + uTime * 0.6);
        float scan = scanBand(0.014);
        vec3 col = uColor * (0.012 + fres * 0.85 * shimmer + lines * (0.03 + fres * 0.25)) * uIntensity;
        col += uColor * scan * (0.12 + fres * 0.9) + vec3(0.75, 0.95, 1.0) * scan * fres * 0.25;
        // alarm: hot rim that breathes with the pulse, plus a faint diagonal hatch drifting upward
        float rim = pow(1.0 - ndv, 3.2);
        float edge = rim * (1.0 + 1.5 * uAlarmPulse);
        float hatch = smoothstep(0.8, 1.0, sin((vW.y * 0.8 + vW.x * 0.45 + vW.z * 0.3) * 150.0 - uTime * 2.2));
        // the alarm replaces (not adds to) the cool rim so it reads as its own hue, not white
        col *= 1.0 - 0.8 * uAlarm * pow(1.0 - ndv, 1.4);
        col += uAlarmColor * uAlarm * (edge * 1.7 + hatch * (0.03 + 0.3 * fres) + fres * 0.15 * uAlarmPulse);
        col += uColor * uHover * (0.05 + fres * 0.55);
        col += vec3(0.7, 0.95, 1.0) * revealEdge() * 1.2;
        col += scanPulse() * (0.35 + fres);
        gl_FragColor = vec4(col * uOpacity, 0.0);
      }`,
    side: FrontSide,
  })
  return emissive(m) as HoloMaterial & { uniforms: { uAlarm: IUniform<number>; uAlarmColor: IUniform<Color>; uAlarmPulse: IUniform<number> } }
}

/** Muscles: translucent striated layer with soft lighting. */
export function createMuscleMaterial(g: Globals, color: string): HoloMaterial {
  const m = new ShaderMaterial({
    uniforms: base(g, color, { uBreath: { value: 0 } }),
    vertexShader: /* glsl */ `
      uniform float uBreath;
      ${VERT_COMMON}
      void main() {
        float chest = smoothstep(1.04, 1.18, position.y) * (1.0 - smoothstep(1.36, 1.46, position.y)) * (1.0 - smoothstep(0.15, 0.19, abs(position.x)));
        vec3 p = position + normal * uBreath * 0.006 * chest;
        ${VERT_BODY}
      }`,
    fragmentShader: /* glsl */ `
      ${FRAG_COMMON}
      void main() {
        if (vW.y > uReveal) discard;
        vec3 N = normalize(vN);
        vec3 V = normalize(vV);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 2.0);
        vec3 L = normalize(vec3(-0.35, 0.75, 0.6));
        float dif = 0.55 + 0.45 * dot(N, L);
        float fib = 0.5 + 0.5 * sin(dot(vL, vec3(0.18, 1.0, 0.12)) * 1100.0 + vnoise(vL * 90.0) * 7.0);
        vec3 col = uColor * (0.09 + 0.32 * dif) * (0.78 + 0.32 * fib) + uColor * fres * 0.75;
        col *= uIntensity;
        col += uColor * scanBand(0.012) * 0.6;
        col += uColor * uHover * (0.15 + fres * 0.6);
        col += vec3(0.7, 0.95, 1.0) * revealEdge();
        vec3 sp = scanPulse();
        col += sp;
        float a = uOpacity * (0.16 + 0.5 * fres + 0.12 * uHover + 0.4 * length(sp));
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    blending: NormalBlending,
  })
  return m as HoloMaterial
}

/** Bones: additive X-ray look, edges brighter than faces. */
export function createBoneMaterial(g: Globals, color: string): HoloMaterial {
  const m = new ShaderMaterial({
    uniforms: base(g, color),
    vertexShader: /* glsl */ `
      ${VERT_COMMON}
      void main() {
        vec3 p = position;
        ${VERT_BODY}
      }`,
    fragmentShader: /* glsl */ `
      ${FRAG_COMMON}
      void main() {
        if (vW.y > uReveal) discard;
        vec3 N = normalize(vN);
        vec3 V = normalize(vV);
        float ndv = abs(dot(N, V));
        float fres = pow(1.0 - ndv, 1.7);
        vec3 L = normalize(vec3(-0.35, 0.75, 0.6));
        float dif = 0.5 + 0.5 * dot(N, L);
        float grain = 0.9 + 0.1 * sin(vL.y * 900.0) * sin(vL.x * 700.0 + vL.z * 800.0);
        vec3 col = uColor * (0.03 + 0.1 * dif * grain + 0.3 * fres) * uIntensity;
        col += uColor * scanBand(0.012) * 0.5;
        col += uColor * uHover * (0.08 + fres * 0.35);
        col += vec3(0.8, 0.95, 1.0) * revealEdge() * 0.8;
        col += scanPulse() * (0.3 + fres) * 0.8;
        gl_FragColor = vec4(col * uOpacity, 0.0);
      }`,
    side: FrontSide,
  })
  return emissive(m) as HoloMaterial
}

/** Organs: lit translucent volume with fresnel rim, micro texture and specular glint. */
export function createOrganMaterial(g: Globals, color: string, detail = 0.4, detailScale = 220): HoloMaterial {
  const m = new ShaderMaterial({
    uniforms: base(g, color, { uDetail: { value: detail }, uDetailScale: { value: detailScale }, uAlphaFres: { value: 0 } }),
    vertexShader: /* glsl */ `
      ${VERT_COMMON}
      void main() {
        vec3 p = position;
        ${VERT_BODY}
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDetail;
      uniform float uDetailScale;
      uniform float uAlphaFres;
      ${FRAG_COMMON}
      void main() {
        if (vW.y > uReveal) discard;
        vec3 N = normalize(vN);
        vec3 V = normalize(vV);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 2.0);
        vec3 L1 = normalize(vec3(-0.4, 0.7, 0.6));
        vec3 L2 = normalize(vec3(0.6, 0.15, -0.5));
        float dif = max(dot(N, L1), 0.0) * 0.8 + max(dot(N, L2), 0.0) * 0.3;
        float spec = pow(max(dot(reflect(-L1, N), V), 0.0), 26.0);
        float det = mix(1.0, 0.7 + 0.55 * vnoise(vL * uDetailScale), uDetail);
        vec3 col = uColor * (0.12 + 0.6 * dif) * det + uColor * fres * 1.05 + vec3(spec) * 0.22;
        col *= uIntensity;
        col += (uColor * 0.6 + 0.3) * scanBand(0.01) * 0.6;
        col += uColor * uHover * (0.25 + fres * 0.8);
        col += vec3(0.7, 0.95, 1.0) * revealEdge();
        col += scanPulse() * 0.8;
        float a = uOpacity * mix(0.8 + 0.2 * fres, 0.4 + 0.6 * fres, uAlphaFres);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: true,
    side: FrontSide,
    blending: NormalBlending,
  })
  return m as HoloMaterial
}

/** Arteries: additive glow with a pressure pulse traveling outward from the heart. */
export function createVesselMaterial(g: Globals, color: string): HoloMaterial & { uniforms: { uFront: IUniform<number>; uFront2: IUniform<number> } } {
  const m = new ShaderMaterial({
    uniforms: base(g, color, { uFront: { value: -10 }, uFront2: { value: -10 }, uFlow: { value: 1 } }),
    vertexShader: /* glsl */ `
      attribute float aDist;
      varying float vDist;
      ${VERT_COMMON}
      void main() {
        vec3 p = position;
        vDist = aDist;
        ${VERT_BODY}
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFront;
      uniform float uFront2;
      uniform float uFlow;
      varying float vDist;
      ${FRAG_COMMON}
      void main() {
        if (vW.y > uReveal) discard;
        vec3 N = normalize(vN);
        vec3 V = normalize(vV);
        float ndv = abs(dot(N, V));
        float fres = pow(1.0 - ndv, 1.5);
        float pulse = exp(-pow((vDist - uFront) / 0.055, 2.0)) + 0.55 * exp(-pow((vDist - uFront2) / 0.045, 2.0));
        float flow = smoothstep(0.75, 1.0, sin(vDist * 140.0 - uTime * 7.0)) * 0.25 * uFlow;
        vec3 col = uColor * (0.16 + 0.5 * fres + flow) * uIntensity;
        col += mix(uColor, vec3(1.0), 0.45) * pulse * 1.5 * uFlow;
        col += uColor * scanBand(0.012) * 0.6;
        col += uColor * uHover * 0.4;
        gl_FragColor = vec4(col * uOpacity, 0.0);
      }`,
    side: DoubleSide,
  })
  return emissive(m) as HoloMaterial & { uniforms: { uFront: IUniform<number>; uFront2: IUniform<number> } }
}

