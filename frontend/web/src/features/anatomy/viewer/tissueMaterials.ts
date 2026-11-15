/**
 * Anatomical materials: one physically based material per tissue class, shared by every
 * structure of that tissue and body region. A small shader patch adds the viewer states on top
 * of the standard lighting, driven by uniforms (no per frame material churn):
 *
 * - status rim: discreet status colored fresnel glow for regions that are not nominal
 * - no data: desaturated, greyed tissue
 * - selection and hover: cyan rim and a soft lift
 * - ghost: see through x-ray look for everything that is not the current selection
 * - scan pulse: a spherical wavefront when a region status changes
 * - intro scan: a band of light sweeps up the body once at load
 *
 * Uniforms are shared by reference: one write per region per frame updates every material.
 */
import { Color, CustomBlending, FrontSide, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, OneFactor, ShaderMaterial, Vector3, ZeroFactor } from 'three'
import type { IUniform, Material } from 'three'
import type { BodyRegionId } from '../../../types/domain'
import type { TissueClass } from '../atlas/types'

/** Cyan accent of the viewer (selection, hover, tech elements). */
export const ACCENT = '#5ee7f5'

interface TissueSpec {
  color: string
  roughness: number
  /**
   * Vessels and nerves are thin tubes (down to about 1 mm): their surface is pushed outward in
   * proportion to the view distance (meters per meter), so they stay readable in a full body shot
   * and keep their true caliber in a close up.
   */
  inflate?: number
  metalness?: number
  /** Soft fiber or velvet like reflection at grazing angles (muscle, tendon, lung). */
  sheen?: number
  sheenColor?: string
  sheenRoughness?: number
  /** Thin wet layer on top (heart, liver, kidney, eye). */
  clearcoat?: number
  clearcoatRoughness?: number
  envMapIntensity?: number
}

const THIN_TUBE_INFLATE = 0.00042

/** Natural tissue colors (sRGB). Reference anatomy look, not a status encoding. */
export const TISSUE: Record<TissueClass, TissueSpec> = {
  skin: { color: '#d7a98c', roughness: 0.62 },
  bone: { color: '#e9dfc8', roughness: 0.58 },
  cartilage: { color: '#cfe0ea', roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.4 },
  tooth: { color: '#f3efe4', roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.2 },
  muscle: { color: '#93302c', roughness: 0.52, sheen: 0.7, sheenColor: '#e8907f', sheenRoughness: 0.42 },
  tendon: { color: '#ddd0b8', roughness: 0.48, sheen: 0.4, sheenColor: '#fff4dc', sheenRoughness: 0.4 },
  heart: { color: '#a8262b', roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.3 },
  artery: { color: '#c5302f', roughness: 0.42, inflate: THIN_TUBE_INFLATE },
  vein: { color: '#2f62b8', roughness: 0.42, inflate: THIN_TUBE_INFLATE },
  lung: { color: '#dc949b', roughness: 0.62, sheen: 0.35, sheenColor: '#ffd9dc', sheenRoughness: 0.6 },
  airway: { color: '#dcc6ba', roughness: 0.5 },
  brain: { color: '#d4aeaa', roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.35 },
  nerve: { color: '#e8d47c', roughness: 0.55, inflate: THIN_TUBE_INFLATE },
  liver: { color: '#74352a', roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.28 },
  kidney: { color: '#84402f', roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.3 },
  gut: { color: '#d9a892', roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.4 },
  gland: { color: '#c99a6c', roughness: 0.5 },
  eye: { color: '#f2f1ec', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 },
  organ: { color: '#b97a70', roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.4 },
}

export type RegionKey = BodyRegionId | 'none'
export const REGION_KEYS: RegionKey[] = ['brain', 'heart', 'lungs', 'kidneys', 'muscles', 'bones', 'skin', 'none']

export interface GlobalUniforms {
  uTime: IUniform<number>
  uReveal: IUniform<number>
  uAccent: IUniform<Color>
  uPulseCenter: IUniform<Vector3>
  uPulseRadius: IUniform<number>
  uPulseAmp: IUniform<number>
  uPulseColor: IUniform<Color>
}

/** State shared by every material of one body region. */
export interface RegionUniforms {
  /** Status color and rim strength (0 when nominal). */
  uTint: IUniform<Color>
  uRim: IUniform<number>
  /** 1 = no data: desaturated tissue. */
  uGrey: IUniform<number>
  /** 1 while the whole region is the current selection. */
  uRegionSel: IUniform<number>
}

interface OwnUniforms {
  /** 1 on the material of a selected structure. */
  uSel: IUniform<number>
  /** 1 on the material of the hovered structure. */
  uLift: IUniform<number>
  /** Ghost alpha, or skin opacity for the skin material. */
  uAlpha: IUniform<number>
  /** Outward push per meter of view distance (thin tubes only, else 0). */
  uInflate: IUniform<number>
  /** Skin only: 1 while something else is selected (the skin joins the x-ray look). */
  uDim: IUniform<number>
}

export type TissueMaterial = (MeshStandardMaterial | MeshPhysicalMaterial | ShaderMaterial) & { userData: { own: OwnUniforms } }

/**
 * Ghost (x-ray) look: unlit, fresnel driven, blended. Dozens of ghost layers overlap in a close
 * up, so this shader is kept far cheaper than the lit tissue materials.
 */
const GHOST_VERT = /* glsl */ `
uniform float uInflate;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalMatrix * normal;
  mv.xyz += normalize(vN) * (uInflate * -mv.z);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`
const GHOST_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uAccent;
uniform vec3 uTint;
uniform float uRim;
uniform float uGrey;
uniform float uLift;
uniform float uAlpha;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec3 n = normalize(vN);
  float ndv = abs(dot(normalize(vV), n));
  float fres = pow(1.0 - ndv, 2.4);
  // one fixed view space light keeps a hint of volume
  float lit = 0.3 + 0.5 * abs(dot(n, vec3(0.37, 0.56, 0.74)));
  vec3 tissue = mix(uColor, vec3(dot(uColor, vec3(0.2126, 0.7152, 0.0722))), uGrey);
  vec3 col = mix(vec3(0.34, 0.58, 0.86), tissue, 0.22) * lit;
  col += uTint * uRim * (0.1 + 1.7 * fres) + uAccent * uLift * (0.1 + 0.7 * fres);
  gl_FragColor = vec4(col, uAlpha * (0.1 + 0.9 * fres) + uLift * 0.12);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export interface Variant {
  ghost?: boolean
  hover?: boolean
  selected?: boolean
}

const VERT_DECL = /* glsl */ `
varying vec3 vAhiWorld;
uniform float uInflate;
`
const VERT_BODY = /* glsl */ `
vAhiWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
mvPosition.xyz += normalize(transformedNormal) * (uInflate * -mvPosition.z);
gl_Position = projectionMatrix * mvPosition;
`
const FRAG_DECL = /* glsl */ `
varying vec3 vAhiWorld;
uniform float uReveal;
uniform vec3 uAccent;
uniform vec3 uPulseCenter;
uniform float uPulseRadius;
uniform float uPulseAmp;
uniform vec3 uPulseColor;
uniform vec3 uTint;
uniform float uRim;
uniform float uGrey;
uniform float uRegionSel;
uniform float uSel;
uniform float uLift;
uniform float uAlpha;
uniform float uDim;
`
const FRAG_BODY = /* glsl */ `
{
  float ahiNdv = saturate(abs(dot(normalize(vViewPosition), normal)));
  float ahiFres = pow(1.0 - ahiNdv, 2.4);
  float ahiLum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  // no data: grey, slightly cool, a bit darker
  outgoingLight = mix(outgoingLight, vec3(ahiLum) * vec3(0.74, 0.8, 0.92), uGrey);
  #ifdef AHI_SKIN
    outgoingLight = mix(outgoingLight, vec3(0.34, 0.58, 0.86) * (0.2 + 0.5 * ahiLum), uDim);
    diffuseColor.a = clamp(uAlpha + (1.0 - uAlpha) * ahiFres * 0.55 * smoothstep(0.0, 0.08, uAlpha), 0.0, 1.0);
  #endif
  // status rim (regions that are not nominal)
  outgoingLight += uTint * uRim * (0.1 + 1.7 * ahiFres);
  // selection and hover (cyan accent)
  float ahiSel = max(uSel, uRegionSel);
  outgoingLight += uAccent * (ahiSel * (0.05 + 1.25 * ahiFres));
  // hover: tint toward the accent (an additive lift would vanish on bright bone)
  outgoingLight = mix(outgoingLight, uAccent * (0.3 + 0.9 * ahiLum), uLift * (0.24 + 0.6 * ahiFres));
  // scan pulse wavefront
  float ahiBand = exp(-pow((distance(vAhiWorld, uPulseCenter) - uPulseRadius) / 0.03, 2.0));
  outgoingLight += uPulseColor * (ahiBand * uPulseAmp);
  // intro scan: a thin band of light sweeps up the body once (no discard: it would defeat early depth rejection)
  outgoingLight += uAccent * (1.3 * exp(-pow((uReveal - vAhiWorld.y) / 0.012, 2.0)));
}
`

function patch(m: MeshStandardMaterial | MeshPhysicalMaterial, uniforms: Record<string, IUniform>, key: string) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_BODY}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <opaque_fragment>', `${FRAG_BODY}\n#include <opaque_fragment>`)
  }
  m.customProgramCacheKey = () => key
}

function createGlobals(): GlobalUniforms {
  return {
    uTime: { value: 0 },
    uReveal: { value: -1 },
    uAccent: { value: new Color(ACCENT) },
    uPulseCenter: { value: new Vector3() },
    uPulseRadius: { value: 0 },
    uPulseAmp: { value: 0 },
    uPulseColor: { value: new Color('#ffffff') },
  }
}

/** Creates and caches the tissue materials of one viewer instance. */
export class TissueBank {
  readonly globals: GlobalUniforms = createGlobals()
  readonly regions: Record<RegionKey, RegionUniforms>
  private readonly cache = new Map<string, TissueMaterial>()
  private readonly extras: Material[] = []

  constructor() {
    this.regions = Object.fromEntries(
      REGION_KEYS.map((r) => [r, { uTint: { value: new Color('#000000') }, uRim: { value: 0 }, uGrey: { value: 0 }, uRegionSel: { value: 0 } }]),
    ) as Record<RegionKey, RegionUniforms>
  }

  /** Material for a tissue in a region. Variants (ghost, hover, selected) are separate cached instances. */
  get(tissue: TissueClass, region: RegionKey, v: Variant = {}): TissueMaterial {
    const skin = tissue === 'skin'
    const ghost = !!v.ghost && !skin
    const key = `${tissue}|${region}|${ghost ? 'g' : 's'}${v.hover ? 'h' : ''}${v.selected ? 'x' : ''}`
    const hit = this.cache.get(key)
    if (hit) return hit
    const spec = TISSUE[tissue] ?? TISSUE.organ
    if (ghost) {
      const own: OwnUniforms = { uSel: { value: 0 }, uLift: { value: v.hover ? 1 : 0 }, uAlpha: { value: 0.5 }, uDim: { value: 0 }, uInflate: { value: spec.inflate ?? 0 } }
      const r = this.regions[region]
      const g = new ShaderMaterial({
        uniforms: { uColor: { value: new Color(spec.color) }, uAccent: this.globals.uAccent, uTint: r.uTint, uRim: r.uRim, uGrey: r.uGrey, ...own },
        vertexShader: GHOST_VERT,
        fragmentShader: GHOST_FRAG,
        transparent: true,
        depthWrite: false,
      }) as TissueMaterial
      g.userData.own = own
      this.cache.set(key, g)
      return g
    }
    const physical = (spec.sheen ?? 0) > 0 || (spec.clearcoat ?? 0) > 0
    const base = { color: spec.color, roughness: spec.roughness, metalness: spec.metalness ?? 0, envMapIntensity: spec.envMapIntensity ?? 1, side: FrontSide }
    const m = (
      physical
        ? new MeshPhysicalMaterial({
            ...base,
            sheen: spec.sheen ?? 0,
            sheenColor: spec.sheenColor ?? '#ffffff',
            sheenRoughness: spec.sheenRoughness ?? 0.5,
            clearcoat: spec.clearcoat ?? 0,
            clearcoatRoughness: spec.clearcoatRoughness ?? 0.3,
          })
        : new MeshStandardMaterial(base)
    ) as TissueMaterial
    const own: OwnUniforms = { uSel: { value: v.selected ? 1 : 0 }, uLift: { value: v.hover ? 1 : 0 }, uAlpha: { value: skin ? 0.3 : 0.5 }, uDim: { value: 0 }, uInflate: { value: spec.inflate ?? 0 } }
    m.userData.own = own
    if (skin) {
      m.defines = { ...m.defines, AHI_SKIN: '' }
      m.transparent = true
      m.depthWrite = false
    }
    patch(m as MeshStandardMaterial, { ...this.globals, ...this.regions[region], ...own }, `ahi-tissue-${skin ? 'k' : 's'}`)
    this.cache.set(key, m)
    return m
  }

  /** Depth only material: lays down the nearest skin surface so the translucent skin never blends with itself. */
  skinDepth(): MeshBasicMaterial {
    const m = new MeshBasicMaterial({ colorWrite: false, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    this.extras.push(m)
    return m
  }

  /** Additive fresnel shell drawn over everything: makes a monitored organ in alert readable through the rib cage. */
  halo(region: RegionKey): ShaderMaterial {
    const r = this.regions[region]
    const m = new ShaderMaterial({
      uniforms: { uTint: r.uTint, uRim: r.uRim },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTint;
        uniform float uRim;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float f = pow(1.0 - abs(dot(normalize(vV), normalize(vN))), 2.2);
          gl_FragColor = vec4(uTint * (uRim * (0.06 + 0.9 * f)), 1.0);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // additive color, untouched alpha: the canvas is transparent and must stay so around the body
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: OneFactor,
    })
    this.extras.push(m)
    return m
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose()
    for (const m of this.extras) m.dispose()
    this.cache.clear()
    this.extras.length = 0
  }
}
