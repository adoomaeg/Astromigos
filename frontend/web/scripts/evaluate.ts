/**
 * Headless engine evaluation (npm run evaluate).
 *
 * Runs the AHI engine without the UI and measures:
 *  - NOMINAL: 3 sim days x 4 crew per seed (5 seeds). False alerts per crew day at HIGH or
 *    above, and at MODERATE or above, plus the highest attention level reached. In NOMINAL
 *    every alert is a false alert by construction (no simulated problem exists).
 *  - each scenario: time from scenario start to the first alert, to HIGH and to CRITICAL for
 *    the scenario target, and the peak level and score.
 * Analytics are evaluated on a fixed sim time grid, like the store does at a given speed.
 *
 * Writes src/engine/evaluation.json (EngineEvaluation) and docs/model-card.md.
 * All data is SIMULATED; these numbers describe the prototype rules on simulated data only.
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EngineEvaluation, RiskLevel, ScenarioId, Status } from '../src/types/domain'
import { SCENARIOS } from '../src/engine/catalog'
import { ANOMALY, BASELINE, ENGINE_VERSION, ESCALATION, FIXED_THRESHOLDS, RISK, RISK_MODEL_VERSION, SIM } from '../src/engine/config'
import { HealthEngine } from '../src/engine/engine'
import { levelRank } from '../src/engine/anomaly'

const MIN_MS = 60_000
const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_JSON = resolve(HERE, '../src/engine/evaluation.json')
const OUT_MD = resolve(HERE, '../../../docs/model-card.md')

const rank = (s: Status) => (s === 'NO_DATA' ? -1 : levelRank(s))
const worst = (a: Status, b: Status): Status => (rank(b) > rank(a) ? b : a)

function step(e: HealthEngine, stepMin: number): void {
  e.advanceTo(e.simTime + stepMin * MIN_MS)
  e.evaluate()
}

// ---------------------------------------------------------------------------
// Nominal false alert rate
// ---------------------------------------------------------------------------

const NOMINAL_HOURS = 72
const NOMINAL_STEP_MIN = 15
const SEEDS = [SIM.seed, SIM.seed + 1, SIM.seed + 2, SIM.seed + 3, SIM.seed + 4]

interface NominalResult {
  seed: number
  crewHigh: number
  crewModerate: number
  cabinAlerts: number
  maxLevel: Status
  frames: Record<string, number>
  rules: Record<string, number>
}

function runNominal(seed: number): NominalResult {
  const e = new HealthEngine({ scenarioId: 'NOMINAL', seed })
  const frames: Record<string, number> = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 }
  let maxLevel: Status = 'LOW'
  const end = e.startedAt + NOMINAL_HOURS * 60 * MIN_MS
  while (e.simTime < end) {
    step(e, NOMINAL_STEP_MIN)
    for (const h of Object.values(e.health)) {
      frames[h.risk.risk_level] = (frames[h.risk.risk_level] ?? 0) + 1
      maxLevel = worst(maxLevel, h.risk.risk_level)
    }
  }
  const alerts = e.alerts.filter((a) => a.createdAt >= e.startedAt)
  const crew = alerts.filter((a) => a.astronautId !== null)
  const rules: Record<string, number> = {}
  for (const a of crew) rules[a.ruleId] = (rules[a.ruleId] ?? 0) + 1
  return {
    seed,
    crewHigh: crew.filter((a) => levelRank(a.severity) >= levelRank('HIGH')).length,
    crewModerate: crew.length,
    cabinAlerts: alerts.length - crew.length,
    maxLevel,
    frames,
    rules,
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const SCENARIO_RUNS: Array<{ id: ScenarioId; hours: number; stepMin: number }> = [
  { id: 'ACUTE_CARDIO', hours: 3, stepMin: 1 },
  { id: 'SENSOR_FAILURE', hours: 3, stepMin: 1 },
  { id: 'ENVIRONMENTAL_CO2', hours: 12, stepMin: 5 },
  { id: 'PROGRESSIVE_FATIGUE', hours: 96, stepMin: 15 },
  { id: 'PERFORMANCE_DECLINE', hours: 120, stepMin: 15 },
]

type ScenarioResult = EngineEvaluation['scenarios'][number] & { stepMin: number }

function runScenario(id: ScenarioId, hours: number, stepMin: number): ScenarioResult {
  const def = SCENARIOS.find((s) => s.id === id)!
  const target = def.targetAstronautId
  const e = new HealthEngine({ scenarioId: id })
  let first: { t: number; rule: string } | null = null
  let tHigh: number | null = null
  let tCrit: number | null = null
  let peak: Status = 'LOW'
  let peakScore = 0
  const end = e.startedAt + hours * 60 * MIN_MS
  while (e.simTime < end) {
    step(e, stepMin)
    const elapsed = (e.simTime - e.startedAt) / MIN_MS
    if (!first) {
      const a = e.alerts.filter((x) => (target ? x.astronautId === target : true)).sort((p, q) => p.createdAt - q.createdAt)[0]
      if (a) first = { t: (a.createdAt - e.startedAt) / MIN_MS, rule: a.ruleId }
    }
    // Level: the target's attention level; for cabin scenarios the worst of the cabin and the crew.
    let level: Status
    let score: number
    if (target) {
      level = e.health[target]!.risk.risk_level
      score = e.health[target]!.risk.risk_score
    } else {
      level = e.environment.status
      score = 0
      for (const h of Object.values(e.health)) {
        level = worst(level, h.risk.risk_level)
        score = Math.max(score, h.risk.risk_score)
      }
    }
    peak = worst(peak, level)
    peakScore = Math.max(peakScore, score)
    if (tHigh === null && rank(level) >= levelRank('HIGH')) tHigh = elapsed
    if (tCrit === null && level === 'CRITICAL') tCrit = elapsed
  }
  return {
    scenarioId: id,
    target,
    timeToFirstAlertMin: first ? Math.round(first.t) : null,
    timeToHighMin: tHigh,
    timeToCriticalMin: tCrit,
    peakLevel: peak,
    firstAlertRule: first?.rule ?? null,
    simulatedHours: hours,
    peakScore,
    stepMin,
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function fmtMin(m: number | null): string {
  if (m === null) return 'not reached'
  if (m < 120) return `${m} min`
  return `${(m / 60).toFixed(1)} h`
}

const t0 = performance.now()
const nominal = SEEDS.map((s) => {
  const r = runNominal(s)
  console.log(`nominal seed ${s}: HIGH+ ${r.crewHigh}, MODERATE+ ${r.crewModerate}, cabin ${r.cabinAlerts}, max ${r.maxLevel}`)
  return r
})
const crewDays = (NOMINAL_HOURS / 24) * 4 * SEEDS.length
const totalFrames = nominal.reduce((s, r) => s + Object.values(r.frames).reduce((a, b) => a + b, 0), 0)
const levelShare: Partial<Record<Status, number>> = {}
for (const l of ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as RiskLevel[]) {
  levelShare[l] = Math.round((nominal.reduce((s, r) => s + (r.frames[l] ?? 0), 0) / totalFrames) * 10000) / 10000
}
const nominalRules: Record<string, number> = {}
for (const r of nominal) for (const [k, v] of Object.entries(r.rules)) nominalRules[k] = (nominalRules[k] ?? 0) + v

const scenarios = SCENARIO_RUNS.map((s) => {
  const r = runScenario(s.id, s.hours, s.stepMin)
  console.log(`${s.id}: first alert ${fmtMin(r.timeToFirstAlertMin)} (${r.firstAlertRule}), HIGH ${fmtMin(r.timeToHighMin)}, CRITICAL ${fmtMin(r.timeToCriticalMin)}, peak ${r.peakLevel} (${r.peakScore})`)
  return r
})

const evaluation: EngineEvaluation = {
  generatedAt: new Date().toISOString(),
  engineVersion: ENGINE_VERSION,
  nominal: {
    simulatedHours: NOMINAL_HOURS,
    crewHours: NOMINAL_HOURS * 4 * SEEDS.length,
    falseAlertsPerCrewDay: Math.round((nominal.reduce((s, r) => s + r.crewHigh, 0) / crewDays) * 1000) / 1000,
    maxLevel: nominal.reduce<Status>((m, r) => worst(m, r.maxLevel), 'LOW'),
    moderateAlertsPerCrewDay: Math.round((nominal.reduce((s, r) => s + r.crewModerate, 0) / crewDays) * 1000) / 1000,
    seeds: SEEDS,
    levelShare,
  },
  scenarios: scenarios.map(({ stepMin: _s, ...rest }) => rest),
  notes: [
    'All data is SIMULATED. These numbers describe the prototype rules on simulated data, not clinical performance.',
    `NOMINAL: ${SEEDS.length} seeds x ${NOMINAL_HOURS} sim hours x 4 crew = ${crewDays} crew days, analytics every ${NOMINAL_STEP_MIN} sim minutes. Every alert in NOMINAL counts as a false alert.`,
    'falseAlertsPerCrewDay counts crew alerts at HIGH or above; moderateAlertsPerCrewDay counts crew alerts at MODERATE or above (any rule).',
    `NOMINAL crew alerts by rule: ${Object.keys(nominalRules).length ? Object.entries(nominalRules).map(([k, v]) => `${k} ${v}`).join(', ') : 'none'}. Cabin alerts: ${nominal.reduce((s, r) => s + r.cabinAlerts, 0)}.`,
    `Scenario times are minutes from the scenario start (08:00 UTC sim time), measured on the evaluation grid: ${scenarios.map((s) => `${s.scenarioId} every ${s.stepMin} min`).join(', ')}.`,
    'Level = the target astronaut attention level (cabin scenario: worst of the cabin status and the crew levels).',
    'Self report (check-ins) feeds recommendations and risk factors but never raises alerts on its own.',
  ],
}

writeFileSync(OUT_JSON, `${JSON.stringify(evaluation, null, 2)}\n`)

// ---------------------------------------------------------------------------
// Model card
// ---------------------------------------------------------------------------

const thresholdRows = FIXED_THRESHOLDS.map((f) => `| ${f.ruleId} | ${f.metric} | ${f.op} ${f.value} | ${f.level} | ${f.name}${f.restOnly ? ', outside exercise' : ''} |`).join('\n')
const scenarioRows = evaluation.scenarios
  .map((s) => `| ${s.scenarioId} | ${s.target ?? 'cabin'} | ${fmtMin(s.timeToFirstAlertMin)} (${s.firstAlertRule ?? 'none'}) | ${fmtMin(s.timeToHighMin)} | ${fmtMin(s.timeToCriticalMin)} | ${s.peakLevel} (score ${s.peakScore}) | ${s.simulatedHours} h |`)
  .join('\n')
const md = `# Model card: AHI health intelligence engine

Generated by \`npm run evaluate\` (frontend/web/scripts/evaluate.ts) on ${evaluation.generatedAt}.
Engine: ${ENGINE_VERSION}. Risk model: ${RISK_MODEL_VERSION}.

## Intended use

AHI (Astronaut Health Intelligence) is a hackathon prototype of **decision support** for crew health monitoring on
long duration missions. It helps the crew, a crew medical officer and a flight surgeon notice when a crew member drifts
away from **their own** normal, explains why in plain language, and suggests a non-prescriptive next step.

**It is not a medical device.** It does not diagnose, does not recommend medication, and does not use official NASA
limits. Every fixed number is demo configuration (src/engine/config.ts) that would need flight surgeon review before
any real use. All device data in this prototype is **SIMULATED** (\`data_origin: 'SIMULATED'\`); check-ins typed in the
UI are \`MANUAL\`.

Out of scope: clinical decisions, emergency response, use on real patients or real astronaut data.

## Data

- In-browser simulator of a 4 person crew (seeded, reproducible): smart shirt (heart rate, HRV, SpO2, breathing rate,
  skin temperature, blood pressure estimate), actigraphy (activity, sleep), exercise devices (CEVIS, ARED, T2),
  reaction self-test, fluid intake log, personal and area dosimeters, cabin CO2, temperature and humidity.
- Daily check-in (mood, fatigue, stress, sleep quality on 1 to 5, symptom tags), simulated each morning or typed in the UI.
- ${SIM.historyDays} days of minute level history and ${SIM.dailyHistoryDays} days of daily metrics are generated at startup so personal baselines are ready.
- Six scenarios: nominal, progressive fatigue, cabin CO2 rise, exercise performance decline, sensor failure, acute cardio event.

## Method

1. **Personal baseline** per metric and activity context (sleep, rest, work, exercise): median and MAD over the
   person's own recent values. Normal band = median +/- ${BASELINE.bandK} robust SD (robust SD = 1.4826 x MAD, floored per metric).
   Samples far from the baseline or during a drift are kept out, so a slow decline does not become the new normal.
2. **Detection** (all against the personal baseline): robust z of the last 3 readings (acute: z >= ${ANOMALY.acuteZ.MODERATE} / ${ANOMALY.acuteZ.HIGH} / ${ANOMALY.acuteZ.CRITICAL}
   for MODERATE / HIGH / CRITICAL), EWMA drift of z (half-life ${ANOMALY.drift.halfLifeMin / 60} h; MODERATE after ${ANOMALY.drift.moderateMinHours} h, HIGH after ${ANOMALY.drift.highMinHours} h),
   daily persistence (2 values in a row outside the band: MODERATE, ${ANOMALY.event.highRun}: HIGH), fixed demo thresholds as a safety net,
   and data quality (missing or stale data is NO_DATA, never normal).
3. **Combined rules**: R-CARD-01 (heart rate and SpO2 both HIGH: CRITICAL), R-FAT-01 (2 or 3 of short sleep, low HRV,
   high resting heart rate: MODERATE or HIGH), R-ENV-CO2-02 (crew signals shift while CO2 is elevated: co-occurrence only).
4. **Self report** (v2): R-PSY-01/02/03 compare mood, fatigue and stress with the person's own answers and are capped at
   MODERATE; all self report rules share one weight, so a check-in alone reaches MODERATE at most. High reported fatigue
   in the last ${RISK.selfReportCorroborateRun} check-ins corroborates R-FAT-01 as an extra factor. Reported symptoms (R-PSY-04) are
   informational factors ("You reported a headache today"), never a diagnosis. Self report never raises an alert.
5. **Risk score**: noisy-OR of one weight per rule (MODERATE ${RISK.weights.MODERATE}, HIGH ${RISK.weights.HIGH}, CRITICAL ${RISK.weights.CRITICAL});
   score = 100 x (1 - product(1 - w)). Bands: MODERATE >= ${RISK.bands.MODERATE}, HIGH >= ${RISK.bands.HIGH}, CRITICAL >= ${RISK.bands.CRITICAL}. CRITICAL needs an acute
   CRITICAL rule; slow patterns are capped at HIGH. Confidence drops with missing or questionable key signals.
6. **Alerts and escalation**: one alert per person and rule, auto resolved after the rule is clear. Unacknowledged
   alerts escalate (CRITICAL after ${ESCALATION.CRITICAL!.join(' and ')} min, HIGH after ${ESCALATION.HIGH!.join(' and ')} min).
7. **Earth link** (v2): HIGH and CRITICAL alerts downlink a health packet automatically; messages take the one way light
   delay of the active profile (ISS, Moon, Mars). A simulated flight surgeon reply comes back after a review time plus
   the delay. Under Mars profiles a HIGH or CRITICAL ground review item also gets an onboard first step, because Earth
   cannot answer before 2 x delay + review time.
8. **Forecast and what-if**: damped Holt projection with an 80% interval; the what-if comparison runs the noise free
   simulation model with and without a hypothetical intervention. Effect sizes are simulation parameters, not evidence.

### Demo thresholds (not official limits)

| Rule | Metric | Condition | Level | Note |
| --- | --- | --- | --- | --- |
${thresholdRows}

## Evaluation (simulated data)

### Nominal false alerts

${crewDays} crew days (${SEEDS.length} seeds x ${NOMINAL_HOURS} sim hours x 4 crew), analytics every ${NOMINAL_STEP_MIN} sim minutes. In the nominal scenario there is no simulated problem,
so every alert is a false alert.

| Measure | Value |
| --- | --- |
| Crew alerts at HIGH or above per crew day | ${evaluation.nominal.falseAlertsPerCrewDay} |
| Crew alerts at MODERATE or above per crew day | ${evaluation.nominal.moderateAlertsPerCrewDay} |
| Highest attention level reached | ${evaluation.nominal.maxLevel} |
| Share of time at LOW / MODERATE / HIGH / CRITICAL | ${(['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const).map((l) => `${((levelShare[l] ?? 0) * 100).toFixed(1)}%`).join(' / ')} |
| Nominal crew alerts by rule | ${Object.keys(nominalRules).length ? Object.entries(nominalRules).map(([k, v]) => `${k}: ${v}`).join(', ') : 'none'} |

### Scenario detection

Minutes from the scenario start, measured on the evaluation grid (${scenarios.map((s) => `${s.scenarioId}: ${s.stepMin} min`).join(', ')}).

| Scenario | Target | First alert (rule) | HIGH | CRITICAL | Peak | Run |
| --- | --- | --- | --- | --- | --- | --- |
${scenarioRows}

Slow scenarios are capped at HIGH by design (they call for review, not an emergency response); only the acute cardio
event reaches CRITICAL. The sensor failure scenario is a data quality case: it should reach MODERATE (signal lost,
status unknown) and never look normal.

## Limitations

- Simulated data and a simplified physiological model; nothing here is validated against real crews.
- The evaluation measures the rules against the same simulator that generated the data, so it shows internal
  consistency, not real world sensitivity or specificity.
- Thresholds, weights, escalation timings, review times and intervention effect sizes are demo configuration.
- Activity context comes from the schedule, not from activity recognition.
- Correlation between signals does not prove cause (for example CO2 and breathing rate).
- Self report is subjective and simulated answers are a model of how people might answer.
- The long-term mission view synthesizes older days from each profile; only the recent days come from the simulation history.

## Ethical considerations

- Decision support for humans: every HIGH or CRITICAL item requires human review.
- Plain language first, no diagnostic wording; missing data is never shown as normal.
- Pseudonymized crew identifiers; no real personal data.
`
writeFileSync(OUT_MD, md)
console.log(`wrote ${OUT_JSON} and ${OUT_MD} in ${Math.round((performance.now() - t0) / 1000)} s`)
