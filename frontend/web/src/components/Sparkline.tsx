import { useId, useMemo } from 'react'
import type { TimePoint } from '../types/domain'
import { downsample } from './format'

/**
 * Tiny SVG trend line. Null values break the line (gaps stay visible as gaps).
 * Optional personal band is drawn as a faint horizontal stripe.
 */
export function Sparkline({
  points,
  color,
  band,
  height = 28,
  className,
  maxPoints = 90,
  fill = true,
}: {
  points: TimePoint[]
  color: string
  band?: { low: number; high: number } | null
  height?: number
  className?: string
  maxPoints?: number
  fill?: boolean
}) {
  const gid = useId()
  const geo = useMemo(() => {
    const pts = downsample(points, maxPoints)
    const vals = pts.filter((p) => p.v != null).map((p) => p.v as number)
    if (vals.length < 2) return null
    let min = Math.min(...vals)
    let max = Math.max(...vals)
    if (band) {
      min = Math.min(min, band.low)
      max = Math.max(max, band.high)
    }
    const pad = (max - min || Math.abs(max) * 0.05 || 1) * 0.12
    min -= pad
    max += pad
    const t0 = pts[0]!.t
    const t1 = pts[pts.length - 1]!.t
    const W = 100
    const H = height
    const x = (t: number) => (t1 === t0 ? W : ((t - t0) / (t1 - t0)) * W)
    const y = (v: number) => H - ((v - min) / (max - min)) * H
    const segs: string[] = []
    const areas: string[] = []
    let cur: [number, number][] = []
    const flush = () => {
      if (cur.length >= 2) {
        segs.push('M' + cur.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join('L'))
        areas.push(`M${cur[0]![0].toFixed(2)},${H}L` + cur.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join('L') + `L${cur[cur.length - 1]![0].toFixed(2)},${H}Z`)
      }
      cur = []
    }
    for (const p of pts) {
      if (p.v == null) flush()
      else cur.push([x(p.t), y(p.v)])
    }
    flush()
    const last = [...pts].reverse().find((p) => p.v != null)
    return {
      segs,
      areas,
      W,
      H,
      bandY: band ? { y1: y(band.high), y2: y(band.low) } : null,
      lastPt: last ? { x: x(last.t), y: y(last.v as number) } : null,
      endsWithGap: pts[pts.length - 1]!.v == null,
    }
  }, [points, band, height, maxPoints])

  if (!geo) {
    return (
      <svg aria-hidden viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className={className} style={{ height }}>
        <line x1="0" x2="100" y1={height / 2} y2={height / 2} stroke="#94a3b8" strokeOpacity="0.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
    )
  }
  return (
    <svg aria-hidden viewBox={`0 0 ${geo.W} ${geo.H}`} preserveAspectRatio="none" className={className} style={{ height, overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {geo.bandY && <rect x="0" width={geo.W} y={geo.bandY.y1} height={Math.max(0.5, geo.bandY.y2 - geo.bandY.y1)} fill="#5eead4" fillOpacity="0.07" />}
      {fill && geo.areas.map((d, i) => <path key={i} d={d} fill={`url(#${gid})`} />)}
      {geo.segs.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
      {geo.endsWithGap && geo.lastPt && (
        <line x1={geo.lastPt.x} x2={geo.W} y1={geo.lastPt.y} y2={geo.lastPt.y} stroke="#94a3b8" strokeOpacity="0.6" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  )
}
