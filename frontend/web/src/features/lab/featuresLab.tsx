/**
 * DEV ONLY lab page for the v2 feature components (served at /features-lab.html by `vite`).
 * Seeds fake v2 data through useAppStore.setState; the shipped components never do this.
 */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import type { Recommendation } from '../../types/domain'
import { startTicker, useAppStore } from '../../state/store'
import { Button, Panel } from '../../components/ui'
import { TimelineStrip } from '../timeline'
import { CommsIndicator } from '../comms'
import { CheckInButton } from '../checkin'
import { MissionOverviewButton } from '../mission'
import { HandoverReportButton } from '../report'
import { WhatIfButton } from '../whatif'
import { clearV2, seedV2 } from './fakeV2'

const now = () => useAppStore.getState().clock.simNow
const rec = (id: string, title: string, kind: Recommendation['interventionKind']): Recommendation => ({
  id,
  astronautId: 'AST-02',
  ruleId: 'LAB',
  title,
  rationale: 'Lab recommendation.',
  priority: 'MODERATE',
  audience: 'CREW',
  region: 'heart',
  requiresHumanReview: false,
  createdAt: now(),
  status: 'PENDING',
  interventionKind: kind,
})

function Lab() {
  const [seeded, setSeeded] = useState(false)
  const [running, setRunning] = useState(false)
  const selected = useAppStore((s) => s.selectedAstronautId)
  const crew = useAppStore((s) => s.crew)
  useEffect(() => {
    useAppStore.getState().pause()
    seedV2()
    setSeeded(true)
  }, [])
  useEffect(() => {
    if (!running) return
    useAppStore.getState().play()
    const stop = startTicker()
    return () => {
      stop()
      useAppStore.getState().pause()
    }
  }, [running])
  const recs = [rec('LAB-R1', 'Extend the next sleep period by 45 minutes', 'SLEEP_EXTENSION'), rec('LAB-R2', 'Ask for a flight surgeon consult', 'MEDICAL_CONSULT'), rec('LAB-R3', 'Check the Bio-Monitor shirt', 'SENSOR_CHECK'), rec('LAB-R4', 'Keep monitoring', null)]
  return (
    <div className="flex min-h-full flex-col gap-3 p-3">
      <header className="glass relative z-40 flex h-14 shrink-0 items-center gap-3 rounded-2xl px-4">
        <span className="text-sm font-bold tracking-[0.08em]">Astromigos features lab</span>
        <span className="text-[11px] text-ink-500">dev only, fake v2 data</span>
        <div className="flex-1" />
        <CommsIndicator />
        <MissionOverviewButton />
        <HandoverReportButton />
        <CheckInButton astronautId={selected} />
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={seeded ? 'ghost' : 'primary'}
          onClick={() => {
            seedV2()
            setSeeded(true)
          }}
        >
          Seed v2 demo data
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            clearV2()
            setSeeded(false)
          }}
        >
          Empty state
        </Button>
        <Button variant="ghost" onClick={() => setRunning((r) => !r)}>
          {running ? 'Pause clock' : 'Run clock'}
        </Button>
        <span className="ml-2 text-[11px] text-ink-500">Selected:</span>
        {crew.map((c) => (
          <Button key={c.id} variant={c.id === selected ? 'primary' : 'subtle'} onClick={() => useAppStore.getState().selectAstronaut(c.id)}>
            {c.callsign}
          </Button>
        ))}
      </div>
      <div className="text-[11px] text-ink-500">TimelineStrip at 48, 56 and 120 px</div>
      <TimelineStrip className="h-12" />
      <TimelineStrip className="h-14" />
      <TimelineStrip className="h-[120px]" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {crew.map((c) => (
          <CheckInButton key={c.id} astronautId={c.id} variant="prominent" />
        ))}
      </div>
      <Panel title="Action cards (WhatIfButton)" bodyClassName="p-4">
        <ul className="flex flex-col gap-2">
          {recs.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.035] p-3 ring-1 ring-white/[0.06]">
              <span className="text-sm">
                {r.title} <span className="text-[11px] text-ink-500">({r.interventionKind ?? 'no intervention'})</span>
              </span>
              <WhatIfButton recommendation={r} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
