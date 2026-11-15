/**
 * AHI application store (zustand) implementing AppState.
 *
 * Owns one HealthEngine (src/engine/engine.ts): an in-browser simulation of the
 * crew devices plus the health intelligence pipeline. The ticker advances the sim
 * clock (simNow += dtReal x speed), the engine steps in whole sim minutes (5 minute
 * steps when far behind), and analytics are re-evaluated at most every
 * PUBLISH_INTERVAL_MS of real time. Only slices whose engine version changed get new
 * object references, so selectors stay cheap. This includes the v2 slices (mission,
 * comms, checkIns, missionDays, statusTimeline).
 *
 * v2 behavior the UI can rely on:
 * - setCommProfile(id): updates commProfileId and mission.commDelaySec (new mission object).
 *   The profile is kept when the scenario changes or resets.
 * - sendToGround(...): returns the message id at once; the message is IN_TRANSIT until
 *   sentAt + one way delay, then DELIVERED (checked at every publication). Delivered consult
 *   requests and health packets get a simulated GROUND_REPLY after the Earth review time
 *   plus the delay.
 * - submitCheckIn(...): becomes that UTC day's check-in for the astronaut (replaces the
 *   simulated one if it was already generated; no simulated one is generated afterwards).
 * - compareIntervention(...): pure and synchronous (a few ms), no state change.
 *
 * Exported API (stable): useAppStore, startTicker.
 */
import { create } from 'zustand'
import type { AppState, ScenarioId } from '../types/domain'
import { COMM_PROFILES, CREW, SCENARIOS } from '../engine/catalog'
import { DEFAULT_SPEED, MISSION_PLAN, SPEED_PRESETS } from '../engine/config'
import { HealthEngine, type SliceName } from '../engine/engine'

export { SPEED_PRESETS }

/** Real ms between analytics publications (health, alerts, history...). */
const PUBLISH_INTERVAL_MS = 250
/** Real ms between ticker calls (clock display). */
const TICK_INTERVAL_MS = 100
/** A long pause (hidden tab) never makes the sim jump more than this much real time. */
const MAX_TICK_MS = 1000
const MIN_SPEED = 1
const MAX_SPEED = 86_400

type DataSlices = Pick<
  AppState,
  | 'crew'
  | 'devices'
  | 'health'
  | 'environment'
  | 'history'
  | 'anomalies'
  | 'alerts'
  | 'recommendations'
  | 'interventions'
  | 'audit'
  | 'mission'
  | 'commProfileId'
  | 'comms'
  | 'checkIns'
  | 'missionDays'
  | 'statusTimeline'
>

let engine = new HealthEngine({ scenarioId: 'NOMINAL' })
let published: Record<SliceName, number> = { ...engine.versions }
let lastPublishReal = -Infinity

function realNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function allSlices(e: HealthEngine): DataSlices {
  published = { ...e.versions }
  return {
    crew: e.crew,
    devices: e.devices,
    health: e.health,
    environment: e.environment,
    history: e.history,
    anomalies: e.anomalies,
    alerts: e.alerts,
    recommendations: e.recommendations,
    interventions: e.interventions,
    audit: e.audit,
    mission: e.mission,
    commProfileId: e.commProfileId,
    comms: e.comms,
    checkIns: e.checkIns,
    missionDays: e.missionDays,
    statusTimeline: e.statusTimeline,
  }
}

/** Only the slices that changed since the last publication. */
function changedSlices(e: HealthEngine): Partial<DataSlices> {
  const v = e.versions
  const out: Partial<DataSlices> = {}
  if (v.crew !== published.crew) out.crew = e.crew
  if (v.devices !== published.devices) out.devices = e.devices
  if (v.health !== published.health) out.health = e.health
  if (v.environment !== published.environment) out.environment = e.environment
  if (v.history !== published.history) out.history = e.history
  if (v.anomalies !== published.anomalies) out.anomalies = e.anomalies
  if (v.alerts !== published.alerts) out.alerts = e.alerts
  if (v.recommendations !== published.recommendations) out.recommendations = e.recommendations
  if (v.interventions !== published.interventions) out.interventions = e.interventions
  if (v.audit !== published.audit) out.audit = e.audit
  if (v.mission !== published.mission) {
    out.mission = e.mission
    out.commProfileId = e.commProfileId
  }
  if (v.comms !== published.comms) out.comms = e.comms
  if (v.checkIns !== published.checkIns) out.checkIns = e.checkIns
  if (v.missionDays !== published.missionDays) out.missionDays = e.missionDays
  if (v.statusTimeline !== published.statusTimeline) out.statusTimeline = e.statusTimeline
  published = { ...v }
  return out
}

export const useAppStore = create<AppState>()((set, get) => ({
  simulationRunId: crypto.randomUUID(),
  scenarios: SCENARIOS,
  ...allSlices(engine),
  clock: { scenarioId: 'NOMINAL', running: true, speed: DEFAULT_SPEED, simNow: engine.simTime, startedAt: engine.startedAt },

  commProfiles: COMM_PROFILES,
  missionPlan: MISSION_PLAN,

  selectedAstronautId: CREW[0]!.id,
  selectedRegion: null,
  selectedStructureId: null,
  selectedMetric: null,

  selectAstronaut: (id) => set({ selectedAstronautId: id, selectedRegion: null, selectedMetric: null, selectedStructureId: null }),
  selectRegion: (region) => set({ selectedRegion: region, selectedStructureId: null }),
  selectStructure: (structureId, region = null) => set({ selectedStructureId: structureId, selectedRegion: structureId ? region : null, selectedMetric: null }),
  selectMetric: (metric) => set({ selectedMetric: metric }),

  setScenario: (id: ScenarioId) => {
    const clock = get().clock
    engine = new HealthEngine({ scenarioId: id, commProfileId: engine.commProfileId })
    lastPublishReal = realNow()
    set({
      ...allSlices(engine),
      simulationRunId: crypto.randomUUID(),
      clock: { ...clock, scenarioId: id, simNow: engine.simTime, startedAt: engine.startedAt },
    })
  },
  play: () => set((s) => ({ clock: { ...s.clock, running: true } })),
  pause: () => set((s) => ({ clock: { ...s.clock, running: false } })),
  setSpeed: (speed) => {
    const v = Number.isFinite(speed) ? Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed)) : DEFAULT_SPEED
    set((s) => ({ clock: { ...s.clock, speed: v } }))
  },
  reset: () => get().setScenario(get().clock.scenarioId),

  acknowledgeAlert: (alertId, actor = 'crew') => {
    if (engine.acknowledgeAlert(alertId, actor)) set(changedSlices(engine))
  },
  logIntervention: (input) => {
    engine.logIntervention(input)
    set(changedSlices(engine))
  },
  dismissRecommendation: (id) => {
    if (engine.dismissRecommendation(id)) set(changedSlices(engine))
  },

  // v2 actions
  setCommProfile: (id) => {
    if (!engine.setCommProfile(id)) return
    // Re-evaluate so deep space onboard first steps appear without waiting for the next tick.
    engine.evaluate()
    set(changedSlices(engine))
  },
  sendToGround: (input) => {
    const id = engine.sendToGround(input)
    set(changedSlices(engine))
    return id
  },
  submitCheckIn: (input) => {
    if (!engine.submitCheckIn(input)) return
    engine.evaluate()
    set(changedSlices(engine))
  },
  compareIntervention: (input) => engine.compareIntervention(input),

  fastForward: (simMs) => {
    const s = get()
    const simNow = s.clock.simNow + Math.max(0, simMs)
    engine.advanceTo(simNow)
    engine.evaluate()
    lastPublishReal = realNow()
    set({ ...changedSlices(engine), clock: { ...s.clock, simNow } })
  },
  tick: (dtRealMs) => {
    const s = get()
    if (!s.clock.running) return
    const dt = Math.min(MAX_TICK_MS, Math.max(0, dtRealMs))
    const simNow = s.clock.simNow + dt * s.clock.speed
    engine.advanceTo(simNow)
    const now = realNow()
    if (now - lastPublishReal >= PUBLISH_INTERVAL_MS) {
      lastPublishReal = now
      engine.evaluate()
      set({ ...changedSlices(engine), clock: { ...s.clock, simNow } })
    } else {
      set({ clock: { ...s.clock, simNow } })
    }
  },
}))

/** Starts the real-time ticker. Returns a stop function. */
export function startTicker(): () => void {
  let last = realNow()
  const id = window.setInterval(() => {
    const now = realNow()
    useAppStore.getState().tick(now - last)
    last = now
  }, TICK_INTERVAL_MS)
  return () => window.clearInterval(id)
}
