import { useAppStore } from '../../state/store'
import { useUiStore, type ViewMode } from '../../app/uiStore'
import type { ScenarioId } from '../../types/domain'

/**
 * Guided demo tour: the story of docs/demo-script.md plus the v2 features.
 * Each step names the element to spotlight (data-tour anchors, first match wins) and
 * sets up the scene through store actions. Setup is idempotent: going Back never
 * restarts a scenario that is already running.
 */
export interface TourStep {
  id: string
  title: string
  caption: string
  /** Optional "try it" hint shown under the caption. */
  hint?: string
  /** data-tour anchor names in priority order. None found: caption is centered, no spotlight. */
  anchors: string[]
  view: ViewMode
  setup?: () => void
  /** Auto-play dwell time for this step. */
  durationMs: number
}

const REID = 'AST-01'
const CHRISTINA = 'AST-02'

function app() {
  return useAppStore.getState()
}

function ensureScenario(id: ScenarioId) {
  if (app().clock.scenarioId !== id) app().setScenario(id)
}

const HOUR_MS = 3_600_000
/** Fatigue reaches HIGH around 33 sim hours (see engine evaluation). The demo jumps there. */
const FATIGUE_DEMO_HOURS = 48

/**
 * A presenter spends seconds on a step, far less than the sim days the fatigue pattern needs.
 * Jump the simulation forward synchronously so the story (alerts, actions, comparison) is there.
 */
function ensureFatigueProgress() {
  const s = app()
  const elapsedH = (s.clock.simNow - s.clock.startedAt) / HOUR_MS
  if (elapsedH < FATIGUE_DEMO_HOURS - 6) s.fastForward((FATIGUE_DEMO_HOURS - elapsedH) * HOUR_MS)
}

function focus(astronautId: string, region: Parameters<ReturnType<typeof app>['selectRegion']>[0] = null) {
  const s = app()
  if (s.selectedAstronautId !== astronautId) s.selectAstronaut(astronautId)
  app().selectRegion(region)
  if (!region) app().selectMetric(null)
}

function closeOverlays() {
  useUiStore.getState().setAlertsOpen(false)
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'crew',
    title: 'Meet the crew',
    caption: 'Four astronauts, each compared with their own normal. Every card says in plain words how that person is doing: All good, Keep an eye, Act soon or Act now.',
    anchors: ['crew'],
    view: 'ground',
    durationMs: 9000,
    setup: () => {
      ensureScenario('NOMINAL')
      app().setSpeed(60)
      app().setCommProfile('ISS')
      focus(REID)
      app().play()
    },
  },
  {
    id: 'body',
    title: 'The body at a glance',
    caption:
      'The 3D anatomy is linked to the live data. Organs that need attention light up in the color of their status. The heart beats at the live heart rate and the lungs breathe at the live breathing rate.',
    hint: 'Click any structure: the panel shows its data, or says it is shown for reference only.',
    anchors: ['body'],
    view: 'ground',
    durationMs: 9000,
    setup: () => focus(app().selectedAstronautId),
  },
  {
    id: 'acute',
    title: 'Acute cardio event',
    caption: "Reid Wiseman’s heart rate jumps while his blood oxygen drops. Within simulated minutes a CRITICAL banner appears, and it escalates if nobody acknowledges it.",
    anchors: ['banner', 'headline'],
    view: 'ground',
    durationMs: 14000,
    setup: () => {
      ensureScenario('ACUTE_CARDIO')
      app().setSpeed(60)
      focus(REID)
      app().play()
    },
  },
  {
    id: 'actions',
    title: 'What to do, and who can do it',
    caption: 'Each action says why, and whether the crew can act on board now or needs the flight surgeon. Mark done logs it in the audit trail and the simulation shows a hypothetical recovery.',
    hint: 'Try Mark done on the rest protocol.',
    anchors: ['actions', 'attention'],
    view: 'ground',
    durationMs: 12000,
    setup: () => {
      ensureScenario('ACUTE_CARDIO')
      focus(REID)
    },
  },
  {
    id: 'comms',
    title: 'Far from Earth',
    caption: 'Now picture the same crew near Mars, 22 minutes away each way. Any answer from Earth takes at least 44 minutes, so Astromigos puts on-board steps first and shows the wait.',
    anchors: ['comms'],
    view: 'ground',
    durationMs: 11000,
    setup: () => app().setCommProfile('MARS_FAR'),
  },
  {
    id: 'fatigue',
    title: 'Slow drift: progressive fatigue',
    caption: 'Fast forward at 1 hour per second. Christina Koch sleeps less and her heart variability falls below her own normal. The timeline shows the status drifting over days.',
    anchors: ['timeline', 'crew'],
    view: 'ground',
    durationMs: 12000,
    setup: () => {
      ensureScenario('PROGRESSIVE_FATIGUE')
      ensureFatigueProgress()
      app().setSpeed(3600)
      focus(CHRISTINA)
      app().play()
    },
  },
  {
    id: 'normal',
    title: 'Her normal, not an average',
    caption: "The shaded band is Christina Koch’s personal normal. Markers on the chart show alerts, logged actions and check-ins, and the dashed cone is the forecast.",
    hint: 'The (i) next to "Your normal" explains how it was learned.',
    anchors: ['attention'],
    view: 'ground',
    durationMs: 12000,
    setup: () => {
      ensureScenario('PROGRESSIVE_FATIGUE')
      ensureFatigueProgress()
      focus(CHRISTINA, 'heart')
      app().selectMetric('HRV_RMSSD')
    },
  },
  {
    id: 'whatif',
    title: 'What if she follows the advice?',
    caption: 'Compare the next hours with and without the action, side by side. It is a hypothetical projection, never a promise of clinical effect.',
    anchors: ['whatif', 'actions', 'attention'],
    view: 'ground',
    durationMs: 10000,
    setup: () => {
      ensureScenario('PROGRESSIVE_FATIGUE')
      ensureFatigueProgress()
      app().setSpeed(600)
      focus(CHRISTINA)
    },
  },
  {
    id: 'crewview',
    title: 'Crew view: for the astronaut',
    caption: 'The same data for the person it is about: plain words, the top two things to do, big vitals against their own normal, and a 30 second daily check-in.',
    anchors: ['checkin', 'actions', 'viewtoggle'],
    view: 'crew',
    durationMs: 12000,
    setup: () => focus(CHRISTINA),
  },
  {
    id: 'tools',
    title: 'Mission tools',
    caption: 'The Tools menu holds the long-term mission overview (radiation budget, exercise, sleep), a handover report for the next shift, and where every number comes from. All data here is simulated and labeled.',
    anchors: ['tools', 'scenario'],
    view: 'ground',
    durationMs: 11000,
    setup: closeOverlays,
  },
]

/** Puts the app back into a calm, predictable state after the tour. */
export function restoreAfterTour() {
  const s = app()
  if (s.clock.scenarioId !== 'NOMINAL') s.setScenario('NOMINAL')
  app().setSpeed(60)
  app().setCommProfile('ISS')
  app().selectRegion(null)
  app().selectMetric(null)
  app().selectAstronaut(REID)
  app().play()
}
