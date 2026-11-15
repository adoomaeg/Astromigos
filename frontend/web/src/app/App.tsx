import { useEffect } from 'react'
import { publicAsset } from '../lib/assets'
import { startTicker, useAppStore } from '../state/store'
import { TopBar } from '../features/topbar/TopBar'
import { CrewRail } from '../features/crew/CrewRail'
import { CenterStage } from '../features/stage/CenterStage'
import { AttentionPanel } from '../features/attention/AttentionPanel'
import { VitalsStrip } from '../features/vitals/VitalsStrip'
import { AlertsDrawer } from '../features/alerts/Alerts'
import { useCriticalSound } from '../features/alerts/sound'
import { TimelineStrip } from '../features/timeline'
import { CrewView } from '../features/crewview/CrewView'
import { Tour } from '../features/tour/Tour'
import { MedicalHistoryDialog } from '../features/medicalhistory'
import { CaseTrackerDialog } from '../features/casetracker'
import { ShortcutsOverlay, useGlobalShortcuts } from './shortcuts'
import { useUiStore } from './uiStore'

/**
 * Two views over the same live state.
 * Ground view (flight surgeon / mission control), reading order: crew (who) > body + headline (what)
 * > attention panel (why, what to do) > timeline > live vitals.
 * Crew view: one astronaut, plain language, big type, top two actions.
 */
// Dev only: expose the store for manual scenario poking from the console.
if (import.meta.env.DEV) {
  const w = window as unknown as { __ahi: typeof useAppStore; __ahiUi: typeof useUiStore }
  w.__ahi = useAppStore
  w.__ahiUi = useUiStore
}

/** Portrait directory and action desk beside the full-height anatomy workspace. */
function GroundView() {
  return (
    <>
      <div className="mission-section-heading">
        <div><span className="workspace-kicker">01 / Flight deck</span><h2>Four people. One mission.</h2></div>
        <p>Artemis II crew · Simulated health telemetry</p>
      </div>
      <main className="mission-workspace">
        <div className="mission-desk">
          <CrewRail className="crew-roster" />
          <div id="attention" className="analysis-desk">
            <AttentionPanel className="min-h-0 flex-1" />
          </div>
        </div>
        <div className="anatomy-workspace">
          <div className="anatomy-heading"><span>02 / Human systems</span><span>Interactive anatomy atlas</span></div>
          <CenterStage className="min-h-0 flex-1" />
        </div>
      </main>
      <div className="telemetry-heading"><span className="workspace-kicker">03 / Telemetry</span><h2>Every signal matters.</h2></div>
      <VitalsStrip className="h-auto shrink-0 lg:h-[156px]" />
      <TimelineStrip className="h-[72px] shrink-0" />
      <p className="crew-photo-credit">Crew portraits: NASA · Public crew identities with synthetic demonstration data. <a href="https://www.nasa.gov/feature/our-artemis-crew/" target="_blank" rel="noreferrer">Meet the Artemis II crew ↗</a></p>
    </>
  )
}

export default function App() {
  useEffect(() => startTicker(), [])
  useGlobalShortcuts()
  useCriticalSound()
  const viewMode = useUiStore((s) => s.viewMode)
  const presentation = useUiStore((s) => s.presentation)
  useEffect(() => {
    document.documentElement.dataset.present = presentation ? 'true' : 'false'
    document.documentElement.dataset.view = viewMode
  }, [presentation, viewMode])
  return (
    <div className="app-shell flex min-h-full flex-col gap-4 p-3 lg:p-6">
      <a href="#attention" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-space-950">
        Skip to what needs attention
      </a>
      <div className="workspace-masthead">
        <div className="flex items-center gap-4">
          <img src={publicAsset('nasa-logo.svg')} alt="NASA" className="nasa-insignia" width="76" height="64" />
          <div>
          <div className="workspace-kicker">Human spaceflight / Artemis II</div>
          <h1 className="workspace-title">Astromigos<span className="brand-period">.</span></h1>
          </div>
        </div>
        <div className="workspace-caption">CREW HEALTH, CONNECTED<br />{viewMode === 'crew' ? 'PERSONAL WORKSPACE' : 'MISSION OPERATIONS WORKSPACE'}</div>
      </div>
      <TopBar />
      {viewMode === 'crew' ? <CrewView /> : <GroundView />}
      <AlertsDrawer />
      <MedicalHistoryDialog />
      <CaseTrackerDialog />
      <ShortcutsOverlay />
      <Tour />
    </div>
  )
}
