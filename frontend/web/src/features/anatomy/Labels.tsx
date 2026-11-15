/**
 * Floating region labels and the hover tooltip.
 *
 * The labels are plain DOM in an overlay above the canvas (crisp text at any labelScale, no
 * per-label portals). A tiny component inside the canvas (LabelProjector) projects the anchors
 * every frame, stacks labels per side so they never overlap, and writes the positions straight
 * to the elements (no React renders per frame).
 *
 * Shared by the atlas viewer and the procedural fallback: each one supplies its own anchor
 * points (world space) and its own tooltip content.
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleCheck, Eye, OctagonAlert, TriangleAlert, WifiOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Vector3 } from 'three'
import type { BodyRegionId, Status } from '../../types/domain'
import { STATUS_META } from '../../lib/status'
import { REGION_LABELS } from '../../engine/catalog'
import { useAppStore } from '../../state/store'
import { HAS_METRICS, regionValueText } from './regions'

/** Same status icons as the rest of the app: shape plus color plus words, never color alone. */
export const STATUS_SHAPE: Record<Status, LucideIcon> = {
  LOW: CircleCheck,
  MODERATE: Eye,
  HIGH: TriangleAlert,
  CRITICAL: OctagonAlert,
  NO_DATA: WifiOff,
}

// ---------------------------------------------------------------------------
// Shared registry between the DOM overlay and the in-canvas projector
// ---------------------------------------------------------------------------

interface Slot {
  root: HTMLDivElement | null
  pill: HTMLButtonElement | null
  line: HTMLSpanElement | null
  /** smoothed vertical offset of the pill relative to its anchor (px) */
  dy: number
  side: 'l' | 'r'
  fresh: boolean
}

export interface LabelRegistry {
  slots: Map<BodyRegionId, Slot>
  tooltip: HTMLDivElement | null
  /** Status legend box (labels on that side stack above it). */
  legend: HTMLDivElement | null
  /** Free screen band (CSS px) for labels: keeps them off the control pill. */
  insets: { top: number; bottom: number }
  labelScale: number
}

export function createLabelRegistry(): LabelRegistry {
  return { slots: new Map(), tooltip: null, legend: null, insets: { top: 8, bottom: 8 }, labelScale: 1 }
}

function slotFor(reg: LabelRegistry, region: BodyRegionId): Slot {
  let s = reg.slots.get(region)
  if (!s) {
    s = { root: null, pill: null, line: null, dy: 0, side: 'r', fresh: true }
    reg.slots.set(region, s)
  }
  return s
}

// ---------------------------------------------------------------------------
// In-canvas projector + layout
// ---------------------------------------------------------------------------

const tmpA = new Vector3()
const tmpC = new Vector3()

interface Item {
  region: BodyRegionId
  slot: Slot
  ax: number
  ay: number
  w: number
  h: number
  side: 'l' | 'r'
  y: number
  /** pill x offset from the anchor, and absolute pill extent */
  px: number
  x0: number
  x1: number
}

/**
 * Screen space collision avoidance: labels are placed top to bottom at their anchor height and
 * pushed down past any already placed label whose box overlaps horizontally. Labels that run
 * past the bottom limit are pulled back up the same way. `x0/x1` are absolute pill extents.
 */
function stack(items: Item[], gap: number, lo: number, hiFor: (it: Item) => number) {
  items.sort((a, b) => a.ay - b.ay)
  const overlapX = (a: Item, b: Item) => a.x0 < b.x1 + gap && b.x0 < a.x1 + gap
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!
    it.y = Math.max(it.ay, lo + it.h / 2)
    for (let pass = 0; pass < items.length; pass++) {
      let moved = false
      for (let j = 0; j < i; j++) {
        const p = items[j]!
        const need = (p.h + it.h) / 2 + gap
        if (overlapX(p, it) && Math.abs(it.y - p.y) < need) {
          it.y = p.y + need
          moved = true
        }
      }
      if (!moved) break
    }
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!
    const max = hiFor(it) - it.h / 2
    if (it.y > max) it.y = max
    for (let j = i + 1; j < items.length; j++) {
      const n = items[j]!
      const need = (n.h + it.h) / 2 + gap
      if (overlapX(n, it) && it.y > n.y - need) it.y = n.y - need
    }
  }
}

export type WorldPoint = readonly [number, number, number]

export interface LabelProjectorProps {
  registry: LabelRegistry
  /** World space anchor of a region label (null hides the label). Called every frame: keep it cheap. */
  anchor: (region: BodyRegionId) => WorldPoint | null
  /** World space point the hover tooltip follows (null when nothing is hovered). */
  hoverPoint: () => WorldPoint | null
}

export function LabelProjector({ registry, anchor, hoverPoint }: LabelProjectorProps) {
  const items = useRef<Item[]>([])
  useFrame(({ camera, size }, dt) => {
    const reg = registry
    const ls = reg.labelScale
    const W = size.width
    const H = size.height
    const gapX = Math.round(20 * ls)
    const list = items.current
    list.length = 0
    // read phase (layout reads only)
    for (const [region, slot] of reg.slots) {
      if (!slot.root || !slot.pill) continue
      const a = anchor(region)
      if (!a) {
        slot.root.style.opacity = '0'
        continue
      }
      tmpA.set(a[0], a[1], a[2]).project(camera)
      if (tmpA.z > 1) {
        slot.root.style.opacity = '0'
        continue
      }
      tmpC.set(0, a[1], 0).project(camera)
      const ax = ((tmpA.x + 1) / 2) * W
      const ay = ((1 - tmpA.y) / 2) * H
      const cx = ((tmpC.x + 1) / 2) * W
      const w = slot.pill.offsetWidth
      const h = slot.pill.offsetHeight
      let side: 'l' | 'r' = ax < cx - 2 ? 'l' : 'r'
      // keep hysteresis near the midline so labels do not flip while the body turns
      if (Math.abs(ax - cx) < 6 && !slot.fresh) side = slot.side
      const fitsR = ax + gapX + w <= W - 6
      const fitsL = ax - gapX - w >= 6
      if (side === 'r' && !fitsR) side = fitsL || ax > W / 2 ? 'l' : 'r'
      else if (side === 'l' && !fitsL) side = fitsR || ax < W / 2 ? 'r' : 'l'
      let px = side === 'r' ? gapX : -gapX - w
      px = Math.max(6 - ax, Math.min(W - 6 - w - ax, px))
      list.push({ region, slot, ax, ay, w, h, side, y: ay, px, x0: ax + px, x1: ax + px + w })
    }
    const gap = 5 * ls
    const lo = reg.insets.top + 4
    const hi = H - reg.insets.bottom - 4
    // the legend sits bottom left: labels reaching into its columns stay above it
    const lg = reg.legend
    const lgTop = lg && lg.offsetHeight > 0 ? lg.offsetTop - 6 : hi
    const lgRight = lg && lg.offsetHeight > 0 ? lg.offsetLeft + lg.offsetWidth + 6 : -1
    stack(list, gap, lo, (it) => (it.x0 < lgRight ? Math.min(hi, lgTop) : hi))
    // write phase
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 14)
    for (const it of list) {
      const s = it.slot
      const target = it.y - it.ay
      if (s.fresh || s.side !== it.side) s.dy = target
      else s.dy += (target - s.dy) * k
      s.side = it.side
      s.fresh = false
      const root = s.root!
      root.style.opacity = '1'
      root.style.transform = `translate3d(${Math.round(it.ax)}px, ${Math.round(it.ay)}px, 0)`
      const px = it.px
      const py = Math.round(s.dy - it.h / 2)
      s.pill!.style.transform = `translate3d(${Math.round(px)}px, ${py}px, 0)`
      if (s.line) {
        const ex = Math.min(Math.max(0, px), px + it.w)
        const ey = s.dy
        const len = Math.hypot(ex, ey)
        s.line.style.width = `${Math.max(0, len - 2)}px`
        s.line.style.transform = `rotate(${Math.atan2(ey, ex)}rad)`
      }
    }
    // hover tooltip
    const tip = reg.tooltip
    const hover = tip ? hoverPoint() : null
    if (tip && hover) {
      tmpA.set(hover[0], hover[1], hover[2]).project(camera)
      const x = ((tmpA.x + 1) / 2) * W
      const y = ((1 - tmpA.y) / 2) * H
      const tw = tip.offsetWidth
      const th = tip.offsetHeight
      const tx = Math.max(6, Math.min(W - tw - 6, x - tw / 2))
      let ty = y - th - 16 * ls
      if (ty < reg.insets.top + 4) ty = y + 18 * ls
      tip.style.transform = `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`
      tip.style.opacity = '1'
    }
  })
  return null
}

// ---------------------------------------------------------------------------
// DOM overlay
// ---------------------------------------------------------------------------

export function StatusMark({ status, size }: { status: Status; size: number }) {
  const Icon = STATUS_SHAPE[status]
  return <Icon aria-hidden size={size} strokeWidth={2.4} className="shrink-0" style={{ color: STATUS_META[status].color }} />
}

export function ValueText({ region, status, ls }: { region: BodyRegionId; status: Status; ls: number }) {
  const text = useAppStore((s) => regionValueText(s, region))
  if (status === 'NO_DATA') return <span className="whitespace-nowrap text-slate-400" style={{ fontSize: 10 * ls }}>{STATUS_META.NO_DATA.crewLabel}</span>
  if (!text) return null
  return (
    <span className="whitespace-nowrap font-mono text-slate-300/90 tabular" style={{ fontSize: 10 * ls }}>
      {text}
    </span>
  )
}

function RegionLabel({ region, status, registry, onSelect }: { region: BodyRegionId; status: Status; registry: LabelRegistry; onSelect: (r: BodyRegionId) => void }) {
  const slot = slotFor(registry, region)
  const ls = registry.labelScale
  const meta = STATUS_META[status]
  useEffect(() => {
    // (re)register: StrictMode and remounts run cleanup before the next mount
    registry.slots.set(region, slot)
    return () => {
      if (registry.slots.get(region) === slot) registry.slots.delete(region)
    }
  }, [registry, region, slot])
  const dot = Math.round(6 * ls)
  return (
    <div
      ref={(el) => {
        slot.root = el
      }}
      className="absolute left-0 top-0 transition-opacity duration-300"
      style={{ opacity: 0, willChange: 'transform' }}
    >
      <span className="absolute block rounded-full" style={{ left: -dot / 2, top: -dot / 2, width: dot, height: dot, background: meta.color, boxShadow: `0 0 10px ${meta.color}` }} />
      <span
        ref={(el) => {
          slot.line = el
        }}
        className="absolute left-0 top-0 block h-px origin-left opacity-70"
        style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}33)` }}
      />
      <button
        ref={(el) => {
          slot.pill = el
        }}
        type="button"
        onClick={() => onSelect(region)}
        aria-label={`${REGION_LABELS[region].label}: ${meta.label}. Focus this region.`}
        className="pointer-events-auto absolute left-0 top-0 flex items-center whitespace-nowrap rounded-full border bg-slate-950/60 leading-none text-slate-100 shadow-lg backdrop-blur-md transition-colors hover:bg-slate-900/85"
        style={{
          borderColor: `${meta.color}55`,
          boxShadow: `0 0 18px ${meta.glow}`,
          gap: 6 * ls,
          padding: `${3 * ls}px ${8 * ls}px`,
          fontSize: 11 * ls,
          borderStyle: status === 'NO_DATA' ? 'dashed' : 'solid',
        }}
      >
        <StatusMark status={status} size={Math.round(11 * ls)} />
        <span className="font-semibold tracking-wide">{REGION_LABELS[region].label}</span>
        <span className="font-medium uppercase tracking-wider" style={{ color: meta.color, fontSize: 10 * ls }}>
          {meta.label}
        </span>
        {status !== 'NO_DATA' && <ValueText region={region} status={status} ls={ls} />}
      </button>
    </div>
  )
}

/** Which regions get a floating label: anything not nominal (and the focused region). */
export function labelledRegions(statuses: Record<BodyRegionId, Status>, selected: BodyRegionId | null): BodyRegionId[] {
  return (Object.keys(statuses) as BodyRegionId[]).filter((r) => {
    if (selected && selected !== r) return false
    const st = statuses[r]
    if (st === 'NO_DATA') return HAS_METRICS[r]
    return st !== 'LOW' || selected === r
  })
}

/** Positioned shell of the hover tooltip (LabelProjector moves it). `glow` is a CSS color. */
export function TooltipShell({ registry, glow, children }: { registry: LabelRegistry; glow?: string; children: ReactNode }) {
  const ls = registry.labelScale
  return (
    <div
      ref={(el) => {
        registry.tooltip = el
      }}
      className="pointer-events-none absolute left-0 top-0 select-none"
      style={{ opacity: 0, zIndex: 3 }}
    >
      <div
        className="whitespace-nowrap rounded-xl border border-white/10 bg-slate-950/80 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md"
        style={{ boxShadow: glow ? `0 0 22px ${glow}` : undefined, minWidth: 150 * ls, padding: `${8 * ls}px ${12 * ls}px` }}
      >
        {children}
      </div>
    </div>
  )
}

/** Tooltip for a hovered body region (used by the procedural fallback). */
export function RegionTooltip({ region, status, selected, registry }: { region: BodyRegionId; status: Status; selected: BodyRegionId | null; registry: LabelRegistry }) {
  const meta = STATUS_META[status]
  const info = REGION_LABELS[region]
  const ls = registry.labelScale
  return (
    <TooltipShell registry={registry} glow={meta.glow}>
      <div className="flex items-center" style={{ gap: 8 * ls }}>
        <StatusMark status={status} size={Math.round(13 * ls)} />
        <span className="font-semibold text-slate-50" style={{ fontSize: 12 * ls }}>
          {info.label}
        </span>
        <span className="ml-auto font-medium uppercase tracking-wider" style={{ color: meta.color, fontSize: 10 * ls }}>
          {meta.label}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between" style={{ gap: 12 * ls }}>
        <span className="text-slate-400" style={{ fontSize: 10 * ls }}>
          {info.system}
        </span>
        <ValueText region={region} status={status} ls={ls} />
      </div>
      {selected !== region && (
        <div className="mt-1 uppercase tracking-[0.14em] text-slate-500" style={{ fontSize: 9 * ls }}>
          Click to focus
        </div>
      )}
    </TooltipShell>
  )
}

/** DOM overlay with every floating label; positioned by LabelProjector. Covers the canvas. */
export function LabelOverlay({
  registry,
  statuses,
  selected,
  visible,
  onSelect,
  tooltip,
}: {
  registry: LabelRegistry
  statuses: Record<BodyRegionId, Status>
  selected: BodyRegionId | null
  visible: boolean
  onSelect: (r: BodyRegionId) => void
  /** Hover tooltip element (a TooltipShell), or null. */
  tooltip?: ReactNode
}) {
  const list = visible ? labelledRegions(statuses, selected) : []
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-live="off">
      {list.map((r) => (
        <RegionLabel key={r} region={r} status={statuses[r]} registry={registry} onSelect={onSelect} />
      ))}
      {tooltip}
    </div>
  )
}
