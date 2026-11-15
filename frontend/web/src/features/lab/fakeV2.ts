/**
 * DEV ONLY. Fake v2 data for the features lab page (features-lab.html).
 * Never imported by shipped components. Seeds the store through useAppStore.setState so every
 * v2 component can be checked before the engine v2 lands.
 */
import { useAppStore } from '../../state/store'
import type { Alert, AppState, CheckIn, CommMessage, InterventionComparison, Intervention, MissionDaySummary, Status, StatusFrame, TimePoint } from '../../types/domain'

const MIN = 60000
const H = 60 * MIN
const DAY = 24 * H

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function frames(now: number, ids: string[]): StatusFrame[] {
  const out: StatusFrame[] = []
  const r = rng(7)
  const start = now - 5 * DAY
  for (let t = start; t <= now; t += 10 * MIN) {
    const ago = (now - t) / H
    const levels: Record<string, Status> = {}
    for (const id of ids) {
      let s: Status = r() < 0.01 ? 'MODERATE' : 'LOW'
      if (id === 'AST-01' && ago > 19.5 && ago < 20.5) s = ago > 19.8 && ago < 20.2 ? 'CRITICAL' : 'HIGH'
      if (id === 'AST-02') {
        if (ago < 50 && ((ago > 40 && ago < 44) || (ago > 26 && ago < 34) || ago < 18)) s = 'MODERATE'
        if (ago < 6) s = 'HIGH'
      }
      if (id === 'AST-03' && ago < 3) s = 'NO_DATA'
      if (id === 'AST-03' && ago > 70 && ago < 71) s = 'NO_DATA'
      if (id === 'CABIN' && ago > 28 && ago < 33) s = ago > 30 && ago < 31.5 ? 'HIGH' : 'MODERATE'
      levels[id] = s
    }
    // A gap in the record (no frames) to check gap rendering.
    if (ago > 90 && ago < 92) continue
    out.push({ t, levels })
  }
  return out
}

function missionDays(id: string, idx: number, lastDay: number, startIso: string, plan: AppState['missionPlan']): MissionDaySummary[] {
  const r = rng(100 + idx)
  const out: MissionDaySummary[] = []
  let cum = 0
  let hr = 56 + idx * 3
  let hrv = 62 - idx * 4
  const start = Date.parse(startIso)
  for (let d = 1; d <= lastDay; d++) {
    const dose = 0.42 + idx * 0.05 + (r() - 0.5) * 0.12 + (d === 23 ? 1.4 : 0)
    cum += dose
    hr += (r() - 0.5) * 1.6 + (id === 'AST-02' && d > lastDay - 6 ? 0.9 : 0)
    hrv += (r() - 0.5) * 3 - (id === 'AST-02' && d > lastDay - 6 ? 2.2 : 0)
    const lost = id === 'AST-03' && d === lastDay
    const exercise = r() < 0.06 ? null : Math.round(plan.exercisePlanMinutesPerDay * (0.75 + r() * 0.35) - (id === 'AST-04' ? d * 0.6 : 0))
    let risk: Status = r() < 0.08 ? 'MODERATE' : 'LOW'
    if (id === 'AST-02' && d > lastDay - 5) risk = d === lastDay ? 'HIGH' : 'MODERATE'
    if (id === 'AST-01' && d === lastDay - 1) risk = 'CRITICAL'
    if (lost) risk = 'NO_DATA'
    out.push({
      astronautId: id,
      missionDay: d,
      date: new Date(start + (d - 1) * DAY).toISOString().slice(0, 10),
      sleepHours: lost ? null : Math.round((7.1 + (r() - 0.5) * 1.6 - (id === 'AST-02' && d > lastDay - 6 ? 1.4 : 0)) * 10) / 10,
      exerciseMinutes: exercise,
      exercisePlannedMinutes: plan.exercisePlanMinutesPerDay,
      restingHr: lost ? null : Math.round(hr * 10) / 10,
      hrv: lost ? null : Math.round(hrv * 10) / 10,
      radiationDoseMgy: Math.round(dose * 1000) / 1000,
      cumulativeDoseMgy: Math.round(cum * 1000) / 1000,
      riskLevel: risk,
      data_origin: 'SIMULATED',
      synthesized: d < lastDay - 4,
    })
  }
  return out
}

function checkIns(now: number, ids: string[]): CheckIn[] {
  const r = rng(42)
  const out: CheckIn[] = []
  const today = Math.floor(now / DAY) * DAY
  for (const id of ids) {
    for (let d = 4; d >= 0; d--) {
      if (d === 0 && id !== 'AST-02') continue
      const at = today - d * DAY + 7.5 * H
      if (at > now) continue
      const tired = id === 'AST-02' && d < 3
      out.push({
        id: `CI-${id}-${d}`,
        astronautId: id,
        at,
        mood: tired ? 2 : 3 + Math.round(r() * 2),
        fatigue: tired ? 4 : 1 + Math.round(r() * 2),
        stress: tired ? 3 : 1 + Math.round(r() * 2),
        sleepQuality: tired ? 2 : 3 + Math.round(r()),
        symptoms: tired ? ['headache', 'trouble sleeping'] : r() < 0.2 ? ['congestion'] : ['none'],
        note: tired && d === 0 ? 'Woke up twice, noisy fan near the sleep station.' : '',
        data_origin: d === 0 ? 'MANUAL' : 'SIMULATED',
      })
    }
  }
  return out.sort((a, b) => b.at - a.at)
}

function comms(now: number): CommMessage[] {
  const base = { relatedRecommendationId: null, relatedAlertId: null }
  return [
    { ...base, id: 'CM-3', direction: 'DOWNLINK', astronautId: 'AST-02', kind: 'CONSULT_REQUEST', title: 'Flight surgeon consult: Christina Koch', body: 'Flight surgeon review requested for Christina Koch.\nCurrent status: Warning. Sleep below personal normal for 3 nights, HRV trending down.\nSimulated data. Decision support only, not a diagnosis.', sentAt: now - 6 * MIN, arrivesAt: now + 16 * MIN, status: 'IN_TRANSIT', data_origin: 'SIMULATED' },
    { ...base, id: 'CM-2', direction: 'UPLINK', astronautId: 'AST-01', kind: 'GROUND_REPLY', title: 'Ground reply: Reid Wiseman health packet reviewed', body: 'Flight surgeon reviewed the packet. No change to the plan. Repeat the blood pressure check after the next sleep period. (Simulated reply.)', sentAt: now - 9 * H, arrivesAt: now - 9 * H + 22 * MIN, status: 'DELIVERED', data_origin: 'SIMULATED' },
    { ...base, id: 'CM-1', direction: 'DOWNLINK', astronautId: 'AST-01', kind: 'HEALTH_PACKET', title: 'Health packet: Reid Wiseman', body: 'Reid Wiseman (CDR). Status: Nominal.\nVitals: HR 64 bpm, SpO2 98 %.', sentAt: now - 10 * H, arrivesAt: now - 10 * H + 22 * MIN, status: 'DELIVERED', data_origin: 'SIMULATED' },
  ] as CommMessage[]
}

function fakeAlerts(now: number): Alert[] {
  const mk = (id: string, astronautId: string | null, severity: Alert['severity'], title: string, agoH: number, metric: Alert['metric'], region: Alert['region'], acked: boolean): Alert => ({
    id,
    astronautId,
    severity,
    title,
    detail: 'Lab fake alert.',
    region,
    metric,
    ruleId: 'LAB',
    createdAt: now - agoH * H,
    acknowledgedAt: acked ? now - agoH * H + 4 * MIN : null,
    acknowledgedBy: acked ? 'crew' : null,
    resolvedAt: null,
  })
  return [
    mk('LAB-A1', 'AST-01', 'CRITICAL', 'Heart rate far above personal normal', 20, 'HEART_RATE', 'heart', true),
    mk('LAB-A2', 'AST-02', 'MODERATE', 'Sleep shorter than usual', 30, 'SLEEP_DURATION', 'brain', true),
    mk('LAB-A3', 'AST-02', 'HIGH', 'HRV below personal normal for 2 days', 5.5, 'HRV_RMSSD', 'heart', false),
    mk('LAB-A4', 'AST-03', 'MODERATE', 'Bio-Monitor shirt stopped sending data', 2.9, null, null, false),
    mk('LAB-A5', null, 'HIGH', 'Cabin CO2 rising', 30.5, 'CO2', 'environment', true),
  ]
}

function fakeInterventions(now: number): Intervention[] {
  return [
    { id: 'LAB-I1', astronautId: 'AST-01', kind: 'REST_PROTOCOL', recommendationId: null, loggedAt: now - 19.6 * H, actor: 'crew', note: '' },
    { id: 'LAB-I2', astronautId: 'AST-02', kind: 'SLEEP_EXTENSION', recommendationId: null, loggedAt: now - 26 * H, actor: 'CMO', note: 'Added 45 min' },
    { id: 'LAB-I3', astronautId: 'CABIN', kind: 'CABIN_VENTILATION', recommendationId: null, loggedAt: now - 30 * H, actor: 'crew', note: '' },
  ]
}

function compare(s: AppState, input: { astronautId: string; kind: InterventionComparison['kind'] }): InterventionComparison | null {
  if (input.kind === 'MEDICAL_CONSULT') return null
  const ms = s.health[input.astronautId]?.metrics.HEART_RATE
  const now = s.clock.simNow
  const start = ms?.current ?? 72
  const b = ms?.baseline
  const band = b && b.status === 'READY' ? { low: b.low, high: b.high } : { low: start - 12, high: start + 6 }
  const without: TimePoint[] = []
  const withA: TimePoint[] = []
  for (let i = 0; i <= 24; i++) {
    const t = now + i * 30 * MIN
    without.push({ t, v: start + i * 0.45 })
    withA.push({ t, v: start + i * 0.45 - (1 - Math.exp(-i / 6)) * 9 })
  }
  return {
    astronautId: input.astronautId,
    metric: 'HEART_RATE',
    kind: input.kind,
    horizonHours: 12,
    without,
    with: withA,
    band,
    assumptions: ['Current drift continues at the rate of the last 6 hours.', 'The action starts now and is followed for the full horizon.', 'Effect size taken from the demo simulator, not from clinical studies.'],
    disclaimer: 'Hypothetical trajectories from the simulator. Real responses vary between people.',
  }
}

export function seedV2() {
  const s = useAppStore.getState()
  const now = s.clock.simNow
  const ids = s.crew.map((c) => c.id)
  const lastDay = Math.floor((now - Date.parse(s.mission.startedAt)) / DAY) + 1
  const md: Record<string, MissionDaySummary[]> = {}
  s.crew.forEach((c, i) => (md[c.id] = missionDays(c.id, i, lastDay, s.mission.startedAt, s.missionPlan)))
  useAppStore.setState({
    commProfileId: 'MARS_FAR',
    statusTimeline: frames(now, [...ids, 'CABIN']),
    checkIns: checkIns(now, ids),
    comms: comms(now),
    missionDays: md,
    alerts: [...fakeAlerts(now), ...s.alerts.filter((a) => !a.id.startsWith('LAB-'))],
    interventions: [...fakeInterventions(now), ...s.interventions.filter((i) => !i.id.startsWith('LAB-'))],
    sendToGround: (input) => {
      const st = useAppStore.getState()
      const p = st.commProfiles.find((x) => x.id === st.commProfileId)
      const delay = (p?.oneWayDelaySec ?? 1) * 1000
      const id = `CM-${Math.round(Math.random() * 1e6)}`
      const msg: CommMessage = {
        id,
        direction: 'DOWNLINK',
        astronautId: input.astronautId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        sentAt: st.clock.simNow,
        arrivesAt: st.clock.simNow + delay,
        status: 'IN_TRANSIT',
        relatedRecommendationId: input.recommendationId ?? null,
        relatedAlertId: input.alertId ?? null,
        data_origin: 'SIMULATED',
      }
      useAppStore.setState({ comms: [msg, ...st.comms] })
      return id
    },
    submitCheckIn: (input) => {
      const st = useAppStore.getState()
      const c: CheckIn = { ...input, id: `CI-${Math.round(Math.random() * 1e6)}`, at: st.clock.simNow, data_origin: 'MANUAL' }
      useAppStore.setState({ checkIns: [c, ...st.checkIns] })
    },
    compareIntervention: (input) => compare(useAppStore.getState(), input),
  })
}

export function clearV2() {
  useAppStore.setState({ commProfileId: 'ISS', statusTimeline: [], checkIns: [], comms: [], missionDays: {}, compareIntervention: () => null, sendToGround: () => '', submitCheckIn: () => {} })
}
