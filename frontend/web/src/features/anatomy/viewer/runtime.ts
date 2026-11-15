/**
 * Imperative three.js side of the atlas viewer: builds one mesh per anatomical structure from
 * the cached system geometry, shares tissue materials, and applies the viewer states.
 *
 * React only tells it what changed (visible layers, selection, hover). Material assignment
 * happens on those events; per frame work is limited to a few uniform writes and the heart
 * and lung matrices.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Group, Matrix4, Mesh, Vector3 } from 'three'
import type { Material, Raycaster } from 'three'
import type { BodyRegionId, Status } from '../../../types/domain'
import { STATUS_META } from '../../../lib/status'
import type { AtlasManifest, AtlasStructure, Vec3 } from '../atlas/types'
import { REQUIRED_STRUCTURE_IDS } from '../atlas/types'
import { regionOfStructure } from '../atlas/health'
import { HAS_METRICS, REGIONS } from '../regions'
import type { SystemAsset } from './atlasLoader'
import type { Box, LayerModel } from './layers'
import { primaryStructures, unionBox } from './layers'
import { ACCENT, TissueBank } from './tissueMaterials'
import type { RegionKey, TissueMaterial } from './tissueMaterials'

interface Entry {
  s: AtlasStructure
  region: RegionKey
  layer: string
  skin: boolean
  meshes: Mesh[]
  base: Matrix4[]
  /** Depth pre pass meshes (skin only) and alert halo meshes (monitored organs only). */
  depth: Mesh[]
  halo: Mesh[]
  /** 0 static, 1 beats with the heart, 2 breathes with the lungs. */
  anim: 0 | 1 | 2
  /** Organ regions this structure covers (rib cage over heart and lungs, skull over the brain). */
  covers: BodyRegionId[]
  dim: boolean
}

/** Tissues of the body wall: they open up (ghost) over a monitored organ in alert. */
const COVER_TISSUES = new Set<string>(['bone', 'cartilage', 'muscle', 'tendon'])
const ALERT: Record<Status, boolean> = { LOW: false, NO_DATA: false, MODERATE: true, HIGH: true, CRITICAL: true }

/** Share of box `o` (front projection, X and Y) that box `s` overlaps. */
function coverRatio(s: Box, o: Box): number {
  const w = Math.min(s.max[0], o.max[0]) - Math.max(s.min[0], o.min[0])
  const h = Math.min(s.max[1], o.max[1]) - Math.max(s.min[1], o.min[1])
  if (w <= 0 || h <= 0) return 0
  return (w * h) / Math.max(1e-9, (o.max[0] - o.min[0]) * (o.max[1] - o.min[1]))
}

export interface PickHit {
  id: string
  point: [number, number, number]
}

export interface FrameInput {
  dt: number
  t: number
  statuses: Record<BodyRegionId, Status>
  /** Live heart rate (bpm) and respiratory rate (breaths per minute), null when unknown. */
  hr: number | null
  rr: number | null
  skinOpacity: number
}

/** Rim strength, pulse amplitude and pulse rate of the status highlight. Nominal and no data: none. */
const STATUS_RIM: Record<Status, { rim: number; pulse: number; rate: number }> = {
  LOW: { rim: 0, pulse: 0, rate: 0 },
  NO_DATA: { rim: 0, pulse: 0, rate: 0 },
  MODERATE: { rim: 0.34, pulse: 0.16, rate: 1.8 },
  HIGH: { rim: 0.52, pulse: 0.3, rate: 3.0 },
  CRITICAL: { rim: 0.78, pulse: 0.55, rate: 5.2 },
}
/** Whole body systems glow less: hundreds of structures light up at once. */
const SYSTEMIC = new Set<BodyRegionId>(['skin', 'muscles', 'bones'])
const GHOST_ALPHA = 0.5

const HEART_ID: string = REQUIRED_STRUCTURE_IDS[1]
const LUNG_IDS = new Set<string>([REQUIRED_STRUCTURE_IDS[2], REQUIRED_STRUCTURE_IDS[3]])
const SKIN_ID: string = REQUIRED_STRUCTURE_IDS[0]

/** Cardiac cycle: lub (S1) then dub (S2) at about 30 percent of the period. Returns 0..1 pump amount. */
function lubDub(p: number): number {
  const g = (c: number, w: number) => Math.exp(-(((p - c) / w) ** 2))
  return g(0.06, 0.045) + 0.55 * g(0.3, 0.04)
}

/** Respiratory cycle: about 40 percent inhale, 60 percent exhale. Returns 0..1 lung inflation. */
function breathCurve(p: number): number {
  const sm = (t: number) => t * t * (3 - 2 * t)
  return p < 0.4 ? sm(p / 0.4) : 1 - sm((p - 0.4) / 0.6)
}

const tmpM = new Matrix4()

/** out = scale about a pivot, applied after `base`. */
function pivotScale(out: Matrix4, base: Matrix4, p: Vector3, sx: number, sy: number, sz: number) {
  tmpM.makeScale(sx, sy, sz).setPosition(p.x * (1 - sx), p.y * (1 - sy), p.z * (1 - sz))
  out.multiplyMatrices(tmpM, base)
}

interface Pulse {
  start: number
  center: Vector3
  max: number
  color: Color
  waves: number
}

export class AtlasRuntime {
  readonly root = new Group()
  readonly bank = new TissueBank()
  /** Set whenever shadows have to be rendered again (layers, selection, new geometry). */
  shadowsDirty = true
  structureCount = 0

  private readonly manifest: AtlasManifest
  private readonly model: LayerModel
  private readonly byId = new Map<string, AtlasStructure>()
  private readonly entries = new Map<string, Entry>()
  private readonly groups = new Map<string, Group>()
  /** One group per system file (mounted by React once the file is loaded), holding its layer groups. */
  private readonly systemGroups = new Map<string, Group>()
  private readonly systems = new Set<string>()
  private readonly skinMats = new Set<TissueMaterial>()
  private readonly animated: Entry[] = []
  private pickables: Mesh[] = []
  private visible: Record<string, boolean> = {}
  private selRegion: BodyRegionId | null = null
  private selStructure: string | null = null
  private hoverId: string | null = null
  private readonly heartPivot = new Vector3()
  private readonly lungPivot = new Vector3()
  private readonly rim = Object.fromEntries(REGIONS.map((r) => [r, { rim: 0, grey: 0, sel: 0 }])) as Record<BodyRegionId, { rim: number; grey: number; sel: number }>
  private beat = 0
  private breath = 0
  private lastPump = -1
  private lastBreath = -1
  private skinAlpha = 0
  private skinDim = 0
  private revealStart = -1
  private pulse: Pulse | null = null
  private skinDepthMat: Material | null = null
  private readonly warmGeo = new BufferGeometry()
  /** Boxes of the monitored organs per region (brain, heart, lungs, kidneys). */
  private readonly organBoxes: { region: BodyRegionId; box: Box }[] = []
  private alertKey = ''
  private readonly alert = new Set<BodyRegionId>()

  constructor(manifest: AtlasManifest, model: LayerModel) {
    this.manifest = manifest
    this.model = model
    for (const s of manifest.structures) this.byId.set(s.id, s)
    for (const r of REGIONS) for (const s of primaryStructures(manifest, r)) this.organBoxes.push({ region: r, box: { min: s.min, max: s.max } })
    // warm up: the ghost and halo shaders are compiled with the first frame (while loading),
    // not at the first selection or alert, where a compile stall would be visible
    this.warmGeo.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1e-5, 0, 0, 0, 1e-5, 0], 3))
    this.warmGeo.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3))
    for (const m of [this.bank.get('bone', 'none', { ghost: true }), this.bank.halo('none')]) {
      const mesh = new Mesh(this.warmGeo, m)
      mesh.frustumCulled = false
      mesh.position.set(0, (manifest.bounds.min[1] + manifest.bounds.max[1]) / 2, 0)
      this.root.add(mesh)
    }
    for (const l of model.layers) {
      const g = new Group()
      g.name = `layer:${l.id}`
      g.visible = false
      this.groups.set(l.id, g)
      let sys = this.systemGroups.get(l.system)
      if (!sys) {
        sys = new Group()
        sys.name = `system:${l.system}`
        this.systemGroups.set(l.system, sys)
      }
      sys.add(g)
    }
    const heart = this.byId.get(HEART_ID)
    if (heart) this.heartPivot.fromArray(heart.center)
    const lungs = unionBox(manifest.structures.filter((s) => LUNG_IDS.has(s.id)))
    if (lungs) this.lungPivot.set((lungs.min[0] + lungs.max[0]) / 2, lungs.min[1] + 0.62 * (lungs.max[1] - lungs.min[1]), (lungs.min[2] + lungs.max[2]) / 2)
  }

  hasSystem(system: string): boolean {
    return this.systems.has(system)
  }

  /** Scene group of one system file (empty until addSystem ran for it). */
  systemGroup(system: string): Group | null {
    return this.systemGroups.get(system) ?? null
  }

  /** Builds the meshes of one loaded system file. */
  addSystem(asset: SystemAsset) {
    if (this.systems.has(asset.system)) return
    this.systems.add(asset.system)
    for (const [id, parts] of asset.parts) {
      const s = this.byId.get(id)
      const layer = this.model.layerOf.get(id)
      const group = layer ? this.groups.get(layer) : undefined
      if (!s || !layer || !group || this.entries.has(id)) continue
      const region: RegionKey = regionOfStructure(s) ?? 'none'
      const skin = s.tissue === 'skin'
      const anim: Entry['anim'] = id === HEART_ID || s.parent === HEART_ID ? 1 : LUNG_IDS.has(id) || (s.parent !== undefined && LUNG_IDS.has(s.parent)) ? 2 : 0
      const covers: BodyRegionId[] = []
      if (COVER_TISSUES.has(s.tissue)) {
        for (const o of this.organBoxes) if (o.region !== region && !covers.includes(o.region) && coverRatio(s, o.box) >= 0.3) covers.push(o.region)
      }
      const e: Entry = { s, region, layer, skin, meshes: [], base: [], depth: [], halo: [], anim, covers, dim: false }
      const monitoredOrgan = !skin && region !== 'none' && (REQUIRED_STRUCTURE_IDS as readonly string[]).includes(id)
      for (const part of parts) {
        const mesh = new Mesh(part.geometry)
        mesh.name = id
        mesh.matrixAutoUpdate = false
        mesh.matrix.copy(part.matrix)
        mesh.userData.entry = e
        mesh.castShadow = !skin
        mesh.receiveShadow = !skin
        if (skin) mesh.renderOrder = 11
        group.add(mesh)
        e.meshes.push(mesh)
        e.base.push(part.matrix)
        if (skin) {
          this.skinDepthMat ??= this.bank.skinDepth()
          const d = new Mesh(part.geometry, this.skinDepthMat)
          d.matrixAutoUpdate = false
          d.matrix.copy(part.matrix)
          d.renderOrder = 10
          group.add(d)
          e.depth.push(d)
        }
        if (monitoredOrgan) {
          const h = new Mesh(part.geometry, this.bank.halo(region))
          h.matrixAutoUpdate = false
          h.matrix.copy(part.matrix)
          h.renderOrder = 30
          h.visible = false
          group.add(h)
          e.halo.push(h)
        }
      }
      this.entries.set(id, e)
      if (anim) this.animated.push(e)
      this.applyEntry(e)
    }
    this.structureCount = this.entries.size
    this.lastPump = -1
    this.lastBreath = -1
    this.rebuildPickables()
    this.shadowsDirty = true
  }

  setVisible(visible: Record<string, boolean>) {
    this.visible = visible
    for (const [id, g] of this.groups) g.visible = !!visible[id]
    this.rebuildPickables()
    this.shadowsDirty = true
  }

  setSelection(region: BodyRegionId | null, structureId: string | null) {
    if (region === this.selRegion && structureId === this.selStructure) return
    this.selRegion = region
    this.selStructure = structureId
    for (const e of this.entries.values()) this.applyEntry(e)
    this.shadowsDirty = true
  }

  setHover(id: string | null) {
    if (id === this.hoverId) return
    const prev = this.hoverId ? this.entries.get(this.hoverId) : undefined
    this.hoverId = id
    if (prev) this.applyEntry(prev)
    const next = id ? this.entries.get(id) : undefined
    if (next) this.applyEntry(next)
  }

  /** true when the structure is the selection or belongs to the selected region. */
  private isSelected(e: Entry): boolean {
    if (this.selStructure) return e.s.id === this.selStructure
    return this.selRegion !== null && e.region === this.selRegion
  }

  /**
   * Region statuses changed: the body wall over a monitored organ in alert turns see-through,
   * so the organ and its status highlight are readable without any click.
   */
  setStatuses(statuses: Record<BodyRegionId, Status>) {
    const key = REGIONS.filter((r) => ALERT[statuses[r]]).join(',')
    if (key === this.alertKey) return
    this.alertKey = key
    this.alert.clear()
    for (const r of REGIONS) if (ALERT[statuses[r]]) this.alert.add(r)
    for (const e of this.entries.values()) if (e.covers.length) this.applyEntry(e)
    this.shadowsDirty = true
  }

  /** Picks the material variant of one structure from the current selection, alerts and hover. */
  private applyEntry(e: Entry) {
    const any = this.selStructure !== null || this.selRegion !== null
    const selected = any && this.isSelected(e)
    e.dim = any ? !selected : e.covers.some((r) => this.alert.has(r))
    const hover = this.hoverId === e.s.id
    const mat = this.bank.get(e.s.tissue, e.region, { ghost: e.dim, hover, selected: selected && this.selStructure !== null })
    if (e.skin) {
      this.skinMats.add(mat)
      mat.userData.own.uAlpha.value = this.skinAlpha
    } else if (e.dim) {
      mat.userData.own.uAlpha.value = GHOST_ALPHA
    }
    for (const m of e.meshes) {
      m.material = mat
      if (!e.skin) {
        m.renderOrder = e.dim ? 2 : 0
        m.castShadow = !e.dim
      }
    }
  }

  private rebuildPickables() {
    const list: Mesh[] = []
    for (const e of this.entries.values()) if (this.visible[e.layer]) for (const m of e.meshes) list.push(m)
    this.pickables = list
  }

  /**
   * Structure under the ray. Solid structures win over ghosted ones, and the translucent skin
   * only counts when nothing else is hit, so inner anatomy stays reachable through it.
   */
  pick(raycaster: Raycaster): PickHit | null {
    if (!this.pickables.length) return null
    const hits = raycaster.intersectObjects(this.pickables, false)
    let ghost: PickHit | null = null
    let skin: PickHit | null = null
    const skinSolid = this.skinAlpha >= 0.75
    for (const h of hits) {
      const e = h.object.userData.entry as Entry
      const hit: PickHit = { id: e.s.id, point: [h.point.x, h.point.y, h.point.z] }
      if (e.skin) {
        if (this.skinAlpha < 0.02) continue
        if (skinSolid) return ghost ?? hit
        skin ??= hit
      } else if (e.dim) {
        ghost ??= hit
      } else {
        return hit
      }
    }
    return ghost ?? skin
  }

  /** Scan pulse: an expanding wavefront from a region whose status just changed. */
  startPulse(region: BodyRegionId, status: Status, worse: boolean, anchor: Vec3 | null) {
    const b = this.manifest.bounds
    const h = b.max[1] - b.min[1]
    const systemic = SYSTEMIC.has(region) || !anchor
    const center = systemic ? new Vector3(0, b.min[1] + 0.53 * h, 0) : new Vector3().fromArray(anchor!)
    this.pulse = {
      start: -1,
      center,
      max: systemic ? 0.6 * h : 0.24 * h,
      color: new Color(status === 'LOW' ? ACCENT : STATUS_META[status].color),
      waves: worse && (status === 'HIGH' || status === 'CRITICAL') ? 2 : 1,
    }
  }

  update(f: FrameInput) {
    const dt = Math.min(f.dt, 0.1)
    const g = this.bank.globals
    g.uTime.value = f.t

    // intro scan band once the first geometry is in
    if (this.entries.size) {
      if (this.revealStart < 0) this.revealStart = f.t
      const top = this.manifest.bounds.max[1]
      g.uReveal.value = Math.min(top + 5, this.manifest.bounds.min[1] - 0.05 + (f.t - this.revealStart) * (top / 1.25))
    }

    // scan pulse wavefront(s)
    const pl = this.pulse
    if (pl) {
      if (pl.start < 0) pl.start = f.t
      const age = f.t - pl.start
      const dur = 1.5
      const spacing = 0.55
      let amp = 0
      let radius = 0
      for (let i = 0; i < pl.waves; i++) {
        const p = (age - i * spacing) / dur
        if (p <= 0 || p >= 1) continue
        radius = pl.max * (1 - (1 - p) * (1 - p))
        amp = 1.1 * (1 - p) * Math.min(1, p * 8)
      }
      if (age > (pl.waves - 1) * spacing + dur) {
        this.pulse = null
        amp = 0
      }
      g.uPulseCenter.value.copy(pl.center)
      g.uPulseRadius.value = radius
      g.uPulseAmp.value = amp
      g.uPulseColor.value.copy(pl.color)
    }

    // region state: status rim, no data grey, region selection
    const k = 1 - Math.exp(-dt * 5)
    for (const r of REGIONS) {
      const st = f.statuses[r]
      const def = STATUS_RIM[st]
      const a = this.rim[r]
      const u = this.bank.regions[r]
      const gain = SYSTEMIC.has(r) ? 0.55 : 1
      a.rim += (def.rim * gain - a.rim) * k
      a.grey += ((st === 'NO_DATA' && HAS_METRICS[r] ? 1 : 0) - a.grey) * k
      a.sel += ((this.selRegion === r && !this.selStructure ? 1 : 0) - a.sel) * k
      if (def.rim > 0) u.uTint.value.set(STATUS_META[st].color)
      u.uRim.value = a.rim < 0.004 ? 0 : a.rim * (1 + def.pulse * Math.sin(f.t * def.rate))
      u.uGrey.value = a.grey
      u.uRegionSel.value = a.sel
    }

    // live physiology: heart beats at the live heart rate, lungs breathe at the live respiratory rate
    const beating = f.statuses.heart !== 'NO_DATA' && f.hr !== null && f.hr > 0
    const breathing = f.statuses.lungs !== 'NO_DATA' && f.rr !== null && f.rr > 0
    if (beating) this.beat = (this.beat + (dt * f.hr!) / 60) % 1
    if (breathing) this.breath = (this.breath + (dt * f.rr!) / 60) % 1
    const pump = beating ? lubDub(this.beat) : 0
    const b = breathing ? breathCurve(this.breath) : 0
    const pumpMoved = Math.abs(pump - this.lastPump) > 1e-4
    const breathMoved = Math.abs(b - this.lastBreath) > 1e-4
    if (pumpMoved || breathMoved) {
      for (const e of this.animated) {
        if (e.anim === 1 ? !pumpMoved : !breathMoved) continue
        for (let i = 0; i < e.meshes.length; i++) {
          const m = e.meshes[i]!
          if (e.anim === 1) {
            const s = 1 + 0.05 * pump
            pivotScale(m.matrix, e.base[i]!, this.heartPivot, s, s, s)
          } else {
            pivotScale(m.matrix, e.base[i]!, this.lungPivot, 1 + 0.028 * b, 1 + 0.034 * b, 1 + 0.04 * b)
          }
          m.matrixWorldNeedsUpdate = true
          const h = e.halo[i]
          if (h) {
            h.matrix.copy(m.matrix)
            h.matrixWorldNeedsUpdate = true
          }
        }
      }
      this.lastPump = pump
      this.lastBreath = b
    }

    // alert halo of the monitored organs
    for (const e of this.entries.values()) {
      if (!e.halo.length) continue
      const on = e.region !== 'none' && this.rim[e.region].rim > 0.02
      for (const h of e.halo) h.visible = on
    }

    // skin: user opacity, faded while something else is selected, raised while the skin itself is
    const skinEntry = this.entries.get(SKIN_ID)
    const skinSelected = this.selStructure ? this.byId.get(this.selStructure)?.tissue === 'skin' : this.selRegion === 'skin'
    const anySel = this.selStructure !== null || this.selRegion !== null
    const target = skinSelected ? Math.max(0.8, f.skinOpacity) : anySel ? f.skinOpacity * 0.3 : f.skinOpacity
    this.skinAlpha += (target - this.skinAlpha) * (1 - Math.exp(-dt * 6))
    this.skinDim += ((anySel && !skinSelected ? 1 : 0) - this.skinDim) * (1 - Math.exp(-dt * 6))
    for (const m of this.skinMats) {
      m.userData.own.uAlpha.value = this.skinAlpha
      m.userData.own.uDim.value = this.skinDim
    }
    if (skinEntry || this.skinMats.size) {
      const show = this.skinAlpha > 0.004
      for (const e of this.entries.values()) {
        if (!e.skin) continue
        for (const m of e.meshes) m.visible = show
        for (const d of e.depth) d.visible = show
      }
    }
  }

  dispose() {
    this.bank.dispose()
    this.root.clear()
    for (const g of this.systemGroups.values()) g.clear()
    this.warmGeo.dispose()
    for (const g of this.groups.values()) g.clear()
    this.entries.clear()
    this.pickables = []
  }
}
