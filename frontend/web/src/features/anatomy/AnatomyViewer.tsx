/**
 * AHI anatomy viewer: the 3D body that shows per region health status at a glance.
 *
 * It renders the reference atlas (Z-Anatomy, see ./viewer) and falls back automatically to the
 * simplified procedural model (./procedural) when the atlas manifest or a required file cannot
 * load. An error boundary guarantees that a 3D failure never breaks the dashboard.
 * Reads selection, region status and live vitals from useAppStore. Fills its parent.
 */
import { Component, Suspense, lazy, useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { useAtlasManifest } from './atlas/manifest'
import type { AtlasManifest } from './atlas/types'
import { REQUIRED_STRUCTURE_IDS } from './atlas/types'
import { AtlasViewer } from './viewer/AtlasViewer'
import { useAnatomyDebug } from './viewer/atlasStore'

export interface AnatomyViewerProps {
  /** Fills its parent. Reads selection, region status and live vitals from useAppStore. */
  className?: string
  /** Show the layer, view and reset controls (default true). */
  showControls?: boolean
  /** Idle auto-rotate when nothing is selected (default true). */
  autoRotate?: boolean
  /** Bloom glow post-processing (default true). Disable for very low end GPUs. */
  bloom?: boolean
  /**
   * Size multiplier for floating labels, tooltip, legend and controls (presentation mode, e.g. 1.3).
   * Default: 1, or 1.3 automatically while `<html data-present="true">` is set.
   */
  labelScale?: number
  /** Simpler, smaller controls for small containers such as the Crew view (default false). */
  compact?: boolean
  /** Show the collapsible status legend in the bottom left corner (default true). */
  legend?: boolean
}

// The procedural model is only downloaded when the atlas is unavailable.
const ProceduralViewer = lazy(() => import('./procedural/ProceduralViewer').then((m) => ({ default: m.ProceduralViewer })))

const FALLBACK_NOTICE = 'Reference atlas unavailable. Showing simplified model.'

function Message({ className, text, busy }: { className?: string; text: string; busy?: boolean }) {
  return (
    <div className={clsx('relative flex h-full w-full items-center justify-center', className)}>
      <div role="status" className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5 text-[11px] tracking-wide text-cyan-100/80 backdrop-blur-md">
        <span className={clsx('h-1.5 w-1.5 rounded-full', busy ? 'animate-pulse bg-cyan-300' : 'bg-slate-400')} />
        {text}
      </div>
    </div>
  )
}

/** Catches render and WebGL errors of a viewer so the rest of the dashboard keeps working. */
class ViewerBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.warn('[anatomy] viewer failed, showing the fallback', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** The atlas is usable only when it holds every structure the application relies on. */
function isUsable(m: AtlasManifest): boolean {
  if (!m.systems.length || !m.bounds) return false
  const ids = new Set(m.structures.map((s) => s.id))
  const files = new Set(m.systems.map((f) => f.id))
  return REQUIRED_STRUCTURE_IDS.every((id) => ids.has(id)) && m.structures.every((s) => !REQUIRED_STRUCTURE_IDS.includes(s.id as (typeof REQUIRED_STRUCTURE_IDS)[number]) || files.has(s.system))
}

// dev only: scripted checks can force the fallback and tune render quality
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __ahiAnatomyDebug?: unknown }).__ahiAnatomyDebug = useAnatomyDebug

export function AnatomyViewer(props: AnatomyViewerProps) {
  const forced = useAnatomyDebug((s) => s.forceFallback)
  const { manifest, error } = useAtlasManifest()
  const [fatal, setFatal] = useState<string | null>(null)
  const unavailable = <Message className={props.className} text="3D body view unavailable" />
  const procedural = (
    <ViewerBoundary fallback={unavailable}>
      <Suspense fallback={<Message className={props.className} text="Loading simplified model" busy />}>
        <ProceduralViewer {...props} notice={FALLBACK_NOTICE} />
      </Suspense>
    </ViewerBoundary>
  )
  if (forced || error || fatal || (manifest && !isUsable(manifest))) return procedural
  if (!manifest) return <Message className={props.className} text="Loading reference anatomy" busy />
  return (
    <ViewerBoundary fallback={procedural}>
      <AtlasViewer {...props} manifest={manifest} onFatal={setFatal} />
    </ViewerBoundary>
  )
}
