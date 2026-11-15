# AHI engine

In-browser simulation and health intelligence pipeline. Pure TypeScript, unit tested with vitest (`npm test`).
Decision support only: no diagnosis, no medication, no official limits. All device data is `SIMULATED`.

## Pipeline

```
device adapters (sim/adapters.ts)  ->  canonical HealthObservation[] (data_origin SIMULATED, quality, context)
  -> MetricTracker per subject + metric (anomaly.ts): bounded history, personal baseline, robust z, EWMA drift
  -> evaluate() (engine.ts): metric status, combined rules, risk, regions, forecasts,
     anomalies, alerts, recommendations, audit
  -> zustand store (src/state/store.ts) publishes only the slices that changed
```

| File | Role |
| --- | --- |
| `config.ts` | All tunable numbers and fixed thresholds (demo configuration, not official limits). |
| `sim/profiles.ts` | Per astronaut physiology parameters (age, sex, seeded individual offset). |
| `sim/schedule.ts` | Daily schedule: sleep 22:00 to 06:00 UTC, work, lunch, 1 h exercise block, reaction tests. |
| `sim/physiology.ts` | "True" state: targets + circadian rhythm + scenario effects, first order lag, OU noise. |
| `sim/cabin.ts` | Cabin CO2, temperature, humidity, radiation dose rate (orbit modulation, SAA passes). |
| `sim/scenarios.ts` | Scenario severities over time and hypothetical intervention relief. |
| `sim/adapters.ts` | Bio-Monitor shirt, actigraphy watch, CEVIS / ARED / T2, cabin sensor, dosimeters, reaction self-test, intake log. |
| `series.ts` | Bounded history: last 2 h at 1 min, 5 days at 5 min; daily metrics keep 40 points. |
| `baseline.ts` | Robust personal baseline and the fixed size reservoir. |
| `anomaly.ts` | Streaming detection per metric (O(1) per sample). |
| `risk.ts` | Combined rules, risk score, confidence, headline, body regions. |
| `forecast.ts` | Damped Holt projection with 80% interval. |
| `recommendations.ts`, `alerts.ts` | Versioned recommendation catalog, dedupe, grouping, autonomy (onboard vs ground), alert lifecycle and escalation. |
| `comms.ts` | Earth link: delayed downlinks, simulated flight surgeon replies (v2). |
| `checkins.ts` | Daily crew check-in: simulated answers, manual answers, self report summary (v2). |
| `missionDays.ts` | Long-term mission day summaries: seeded synthesis of older days (v2). |
| `intervention.ts` | What-if comparison: noise free projection with and without an intervention (v2). |
| `evaluation.json` | Output of `npm run evaluate` (scripts/evaluate.ts); also writes docs/model-card.md. |

## Simulation

- Seeded and reproducible (`SIM.seed`). Every noise channel has its own stream.
- Noise is an Ornstein-Uhlenbeck process (smooth, correlated), not white jitter.
- Heart rate follows a target with a lag (rises in about 1 min, recovers in about 2.5 min); exercise uses a warm-up, main set and cool-down profile per device (ARED has sets).
- Sleep length and efficiency come from a nightly plan; the watch reports them at 06:00.
- Device states: `ONLINE`, `DEGRADED` (weak signal, values `QUESTIONABLE`), `DATA_STALE`, `OFFLINE`, with battery and signal.
- On startup 5 days of minute level history (plus 14 days of daily metrics) are generated, so baselines are `READY` immediately.

## Scenarios (start at 08:00 UTC sim time)

| Scenario | Target | Evolution | Visible at |
| --- | --- | --- | --- |
| `NOMINAL` | none | stable | any speed |
| `ACUTE_CARDIO` | AST-01 | HR to about 145 at rest and SpO2 to about 89 between minute 2 and 14 | CRITICAL in about 10 sim min (60x: 10 s) |
| `SENSOR_FAILURE` | AST-03 | Bio-Monitor DEGRADED at 10 min, DATA_STALE at 20 min, OFFLINE at 45 min | 60x |
| `ENVIRONMENTAL_CO2` | cabin | CO2 +3900 ppm over about 3.5 h; RR and reaction time shift for everyone | 600x |
| `PROGRESSIVE_FATIGUE` | AST-02 | full severity after 54 h: later bedtime, lower sleep efficiency, HRV -38%, resting HR +8 | 3600x (HIGH by about day 2) |
| `PERFORMANCE_DECLINE` | AST-04 | exercise output falls about 7.5% per day (max -32%) | 3600x (HIGH after 3 sessions) |

Interventions (`logIntervention`) apply a clearly hypothetical relief in the simulator, logged in the audit as SIMULATION:
`SLEEP_EXTENSION` and `REST_PROTOCOL` ease fatigue, `REST_PROTOCOL` and `MEDICAL_CONSULT` ease the acute event,
`CABIN_VENTILATION` lowers CO2, `SENSOR_CHECK` restores the device after 3 sim min, `EXERCISE_ADJUSTMENT` eases the decline,
`HYDRATION` raises the hydration index.

## Personal baseline

- Per context bucket for physiological metrics: `SLEEP`, `REST`, `WORK`, `EXERCISE` (exercise plus 20 min of recovery), so a workout is compared with past workouts and never alarms.
- Robust statistics: median, MAD, p05, p95. Robust SD = 1.4826 x MAD, floored per metric (`METRIC_RULES[].minScale`).
- Normal band = median +/- 2 robust SD.
- `INSUFFICIENT_DATA` below 72 samples (36 for exercise, 5 for daily metrics).
- Samples enter the baseline at 5 min resolution only if their |z| < 3.5 and the drift indicator is below 1, so a slow decline does not become the new normal. Baselines are recomputed every 24 accepted samples (2 sim hours), never on every tick.

## Detection rules

| Method | Definition | Level |
| --- | --- | --- |
| Robust z (acute) | z of the median of the last 3 readings vs the current context baseline, in the bad direction | >= 4 MODERATE, >= 5.5 HIGH, >= 7 CRITICAL |
| EWMA drift | EWMA (half-life 3 h) of per reading z | >= 1.0 for 3 h MODERATE, >= 2.0 and 12 h HIGH |
| Daily persistence | consecutive values outside the band (sleep, exercise, reaction time) | 1 value with z >= 3 or 2 in a row MODERATE, 3 in a row HIGH |
| Fixed demo thresholds | `FIXED_THRESHOLDS` in `config.ts` on the 3 reading median | as configured |
| Data quality | no valid value for `staleMin`, or device `DATA_STALE` / `OFFLINE` | `NO_DATA` status, rule R-DQ-01 (MODERATE) |
| Questionable signal | 20% or more of the last 15 readings questionable | R-DQ-02 (MODERATE); questionable data is capped at MODERATE |

In the exercise context (which includes warm-up and the 20 min recovery) two-sided metrics (heart rate, blood pressure,
breathing rate, skin temperature) only flag an upward acute deviation: values below the exercise median are expected
during warm-up and cool-down. This was found by `npm run evaluate` (nominal false alerts on blood pressure, v2).

Rule ids: R-HR-01 (acute HR), R-HR-02 (resting HR drift), R-HR-03 (demo resting ceiling), R-HRV-01, R-SPO2-01 (vs personal), R-SPO2-02 (demo floor),
R-RR-01, R-BP-01, R-TEMP-01, R-ACT-01, R-HYD-01, R-SLEEP-01, R-SLEEP-02, R-EX-01, R-RT-01, R-RAD-02,
R-ENV-CO2-01, R-ENV-TEMP-01, R-ENV-RH-01, R-ENV-RAD-01, R-DQ-01, R-DQ-02, the self report rules R-PSY-01 to R-PSY-04 (below)
and the combined rules:

- R-CARD-01: heart rate and SpO2 both HIGH or worse at the same time: CRITICAL.
- R-FAT-01: two of {short sleep or low efficiency, HRV below normal, resting HR above normal}: MODERATE; all three: HIGH.
  High self reported fatigue (>= 4 of 5) in the last 2 check-ins adds the factor "You also reported high fatigue in your last 2 check-ins" (no extra level).
- R-ENV-CO2-02: CO2 at MODERATE or worse while breathing rate drifts up or reaction time slows: MODERATE (co-occurrence, not proof of cause).

## Demo thresholds (config.ts, not official limits)

| Metric | Threshold | Level |
| --- | --- | --- |
| SpO2 | < 92% / < 90% | HIGH / CRITICAL |
| Heart rate outside exercise | > 120 / > 135 bpm | HIGH / CRITICAL |
| Cabin CO2 | > 4000 / > 5300 / > 7500 ppm | MODERATE / HIGH / CRITICAL |
| Cabin temperature | outside 18 to 27 °C | MODERATE |
| Humidity | outside 25 to 70% | MODERATE |
| Radiation dose rate | > 100 µGy/h | HIGH |
| Accumulated dose | > 50 mGy | MODERATE |

## Risk score

One weight per triggered rule (worst level of that rule): MODERATE 0.20, HIGH 0.45, CRITICAL 0.85; data quality rules are capped at 0.20.

```
risk_score = round(100 x (1 - product(1 - w_i)))
LOW < 20 <= MODERATE < 45 <= HIGH < 80 <= CRITICAL
```

Several moderate deviations escalate by construction (three MODERATE rules = 49 = HIGH). CRITICAL requires at least one CRITICAL rule;
slow multi-day patterns are capped at 79 (HIGH) because they call for review, not an emergency response.
Cabin rules count in every crew member's score. Confidence starts at 0.95 and drops 0.15 per missing key signal
(HR, HRV, SpO2, RR, sleep), 0.07 per questionable one and 0.05 per baseline that is not ready (floor 0.15).

## Forecast

Damped Holt (alpha 0.4, beta 0.15, phi 0.9) on 30 min means of the last 24 h, context adjusted to resting values (exercise excluded) for
HR, HRV and SpO2; daily values for sleep duration and exercise load; 30 min means for cabin CO2.
6 h horizon with at least 12 half-hour windows, 24 h with at least 40; daily metrics: 1 day with 5 values, 3 days with 10.
80% interval from the one step residual SD, widened with the horizon. `hoursToBandExit` is the first time the central projection leaves the personal band (0 if already outside).

## Alerts and recommendations

- Actionable hits: any HIGH or CRITICAL rule, and MODERATE trend, combined, environment and data quality rules. A single acute z blip at MODERATE only changes the status.
- Combined rules group their components (one alert instead of five) unless a component is CRITICAL.
- One active alert per subject + rule. Escalation updates it, or raises a new one if it was already acknowledged. Alerts auto-resolve (`resolvedAt`) after 10 sim min clear. History is kept (max 150).
- One recommendation per subject + rule per episode, from a versioned catalog (`rec-catalog v2.0`), with the linked `interventionKind`. HIGH, CRITICAL or flight surgeon items require human review. Cabin items use `astronautId: 'CABIN'`.

## Earth link (v2, `comms.ts`)

Hazard: distance from Earth. Profiles in `catalog.ts` (`COMM_PROFILES`): ISS 0.5 s, Moon 1.3 s, Mars closest 4 min, Mars farthest 22 min (one way).

- `setCommProfile(id)` sets `commProfileId` and `mission.commDelaySec` (new `mission` object). The store keeps the profile across scenario changes.
  Messages already in transit keep their arrival time.
- `sendToGround(input)` queues a DOWNLINK (`data_origin` MANUAL) and returns its id. `arrivesAt = sentAt + one way delay`;
  status is `IN_TRANSIT` until the precise sim clock passes `arrivesAt`, then `DELIVERED` (checked at every evaluation).
- When a CONSULT_REQUEST or HEALTH_PACKET is delivered, a simulated flight surgeon reviews it for 4 to 8 sim minutes (seeded per
  message, `COMMS.reviewMinMin..reviewMaxMin`) and sends a GROUND_REPLY (UPLINK, SIMULATED). The reply appears when Earth sends it
  (`IN_TRANSIT`) and is delivered on board one delay later. It acknowledges, asks to continue the onboard protocol and re-check in
  10 / 30 / 60 / 120 min (CRITICAL / HIGH / MODERATE / LOW), never prescribes medication, and says it is simulated.
- A HEALTH_PACKET is downlinked automatically when an alert reaches HIGH or CRITICAL (once per alert id), with the attention level,
  score, latest key values and top factors.
- Timing uses the scheduled times, never the moment of evaluation, so results do not depend on the simulation speed.
- Audit: `COMM_SENT`, `COMM_RECEIVED`, `COMM_PROFILE_CHANGED`. `comms` is newest first (by `sentAt`), max 120.
- Autonomy: every recommendation has `autonomy`: `ONBOARD` (crew self care, crew medical officer, onboard checks, cabin ventilation)
  or `GROUND_REVIEW` (flight surgeon, mission control dose decisions). Under Mars profiles, a HIGH or CRITICAL `GROUND_REVIEW` item
  also creates ONE onboard first step per astronaut: "Crew medical officer: start the onboard assessment protocol now", whose rationale
  states the earliest Earth reply (2 x one way delay + 4 min minimum review, e.g. about 48 min for Mars farthest).

## Alert escalation (v2)

`ESCALATION` in `config.ts` (demo configuration): an unacknowledged, unresolved CRITICAL alert reaches `escalationLevel` 1 after 5 sim
min and 2 after 15 min; HIGH after 30 and 90 min. `escalatedAt` is the time the step was due. Each step is audited (`ALERT_ESCALATED`);
acknowledging or resolving the alert stops it.

## Daily check-ins (v2, `checkins.ts`)

- One SIMULATED check-in per astronaut each sim morning at about 07:00 UTC (personal offset +/- 20 min), for the 14 pre-generated
  days and live. Answers (1..5) follow the simulated state with seeded noise: progressive fatigue raises fatigue and stress and lowers
  mood and sleep quality; cabin CO2 makes a reported headache much more likely; exercise decline adds muscle soreness; sleep quality
  follows last night's simulated efficiency and duration.
- `submitCheckIn(input)` (UI, `data_origin` MANUAL) records a check-in at the current sim time. It becomes that UTC day's check-in:
  it replaces the simulated one if it was already generated (the self report trackers are rebuilt from the list), a second manual
  answer the same day replaces the first, and no simulated check-in is generated for that day afterwards. Audit: `CHECKIN_RECORDED`.
- Each check-in produces MOOD, PERCEIVED_FATIGUE and STRESS observations (event metrics, brain region) compared with the person's
  own answers: band = median +/- 1.5 (scale floor 0.75), 2 check-ins in a row outside the band (or one answer 3 points away) is
  MODERATE. Rules R-PSY-01 (mood), R-PSY-02 (fatigue), R-PSY-03 (stress) are capped at MODERATE, and all self report rules share one
  weight in the score: **self report alone reaches MODERATE at most**. They create ONBOARD recommendations but never alerts.
- R-PSY-04: symptom tags from today's check-in are a non-diagnostic factor ("You reported a headache today", weight 0.05, still LOW).
- `checkIns` is newest first, max 120.

## Long-term mission view (v2, `missionDays.ts`)

`missionPlan` = `MISSION_PLAN` (demo configuration, not official limits: 180 days, 100 mGy demo radiation budget, 60 min exercise
per day to match the simulated schedule, 8 h sleep target). `missionDays[astronautId]` holds mission day 1 .. current mission day
(day 44 at startup; day d is the UTC date `MISSION.startedAt + d days`), ascending:

1. Older days: seeded synthesis per profile (sleep around 8 h in bed x efficiency with some short nights, 6% missed sessions and a
   few partial ones, resting HR and HRV around the profile, about 0.42 mGy per day x shield factor with 5% higher days). Synthesized
   doses are scaled to add up exactly to the dosimeter reading at the start of the history (no jump). `synthesized: true`.
2. Days in the 14 day daily window: sleep and exercise from the same nightly plans and sessions as the sleep and exercise metrics
   (`exerciseLoadPct` = session output vs the personal usual).
3. Days in the 5 day minute history: resting HR and HRV are rest context means, dose from the dosimeter (daily snapshots), attention
   level = worst status frame of that day when frames exist (otherwise a simple sleep and exercise heuristic).

The current day refreshes at most every 15 sim minutes; completed days keep their object references. Scenarios therefore show up
in the recent days (fatigue: sleep down, HRV down, level up; performance decline: exercise output down).

## Status timeline (v2)

`statusTimeline`: one frame every 15 sim minutes (`TIMELINE.frameEveryMin`) with each astronaut's risk level and the cabin status
(`CABIN`), ascending by `t`. Frames are computed in the simulation step at every 15 min boundary with the same rules as `evaluate()`
(only the scoring, no texts or forecasts), so a big jump at high speed still gets every frame. During startup the last 24 sim hours
are framed (97 frames, about 50 ms); live frames are appended and the list is kept to the 5 day history window.

## What-if comparison (v2, `intervention.ts`)

`compareIntervention({ astronautId, kind, metric?, horizonHours? })` runs the noise free simulation model twice from the current
state: with a HYPOTHETICAL intervention logged now and without it. It returns both trajectories, the personal band (rest context
baseline), plain assumptions and the disclaimer "Simulation for discussion only. Not evidence of clinical efficacy."

| Kind | Default metric | Default horizon |
| --- | --- | --- |
| SLEEP_EXTENSION | HRV_RMSSD | 48 h, every 30 min |
| REST_PROTOCOL, MEDICAL_CONSULT | HEART_RATE | 24 h; 2 h every 5 min while an acute event is active |
| CABIN_VENTILATION | CO2 (astronautId `CABIN`) | 8 h, every 15 min |
| EXERCISE_ADJUSTMENT | EXERCISE_LOAD | 120 h, one point per planned session |
| HYDRATION | HYDRATION | 12 h, every 15 min |
| SENSOR_CHECK | none (returns null) | |

Physiological values are resting equivalents (activity and daily rhythm removed); CO2 keeps the daily swing. Pure function, no state
change, under 5 ms per call.

## Evaluation (`npm run evaluate`)

`scripts/evaluate.ts` (run with tsx) runs the engine headless: NOMINAL for 3 sim days x 4 crew x 5 seeds (alerts at HIGH or above and at
MODERATE or above per crew day, highest level, share of time per level) and every scenario (time to first alert, to HIGH, to CRITICAL,
peak level and score). It writes `src/engine/evaluation.json` and `docs/model-card.md`.

## Performance

- The store publishes slices every 250 ms real time; every v2 slice (`mission`, `comms`, `checkIns`, `missionDays`, `statusTimeline`)
  gets a new reference only when its engine version changed.
- Startup pre-generation (5 days at 5 min plus 2 h at 1 min) takes about 1.2 s warm and 2 to 3 s cold on a laptop; the v2 work adds about
  100 ms (status frames for the last 24 h, check-ins, mission days). Check-in times are cached per day so the simulation step does not
  hash on every step.

## Limitations

- Simulated data and a simplified physiological model; not validated against real crews.
- Thresholds and weights are demo configuration. They need flight surgeon review before any real use.
- Context buckets come from the schedule, not from sensor based activity recognition.
- Forecasts assume recent conditions continue; they are not clinical predictions.
- Intervention effects are hypothetical simulation devices, not outcomes. The what-if comparison uses the same made-up effect sizes.
- Ground replies are templated simulations, not medical advice; review times are demo configuration.
- Check-in answers are simulated self report; self report is subjective and never escalates on its own.
- Older mission days are synthesized from each profile, not simulated minute by minute.
