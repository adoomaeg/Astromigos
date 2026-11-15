---
title: Data Dictionary
description: The 21 metric codes of the Astronaut Health Intelligence Platform with unit, cadence, stale window, body region, bad direction, device and data origin, plus the check-in and lab record formats.
status: IMPLEMENTED
origin: SIMULATED, MANUAL, REAL_PUBLIC
code:
  - frontend/web/src/engine/catalog.ts
  - frontend/web/src/engine/config.ts
  - frontend/web/src/types/domain.ts
verified: 2026-11-14
---

# Data Dictionary

This is the canonical table of the metrics in the Astronaut Health Intelligence Platform (AHI). Codes are the `MetricCode` values of `src/types/domain.ts`, defined in `src/engine/catalog.ts`; cadence and stale windows come from `METRIC_RULES` in `src/engine/config.ts`. The physiology behind each signal is explained in [Monitored physiology](../science/monitored-physiology).

## Metric catalog

21 metrics: 17 per astronaut and 4 for the cabin (`subject_id: "CABIN"`). The canonical unit is the unit data must have when it reaches the engine. **Cadence** is what the simulator emits and the engine expects. **Stale after** is how long a metric can go without a valid value before it becomes `NO_DATA`. **Bad direction** is the side of the personal band that counts as worse.

| Code | Label | Unit | Cadence | Stale after | Region | Bad direction | Device (simulated) | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `HEART_RATE` | Heart rate | bpm | 1 min | 10 min | heart | both | Bio-Monitor shirt | <OriginBadge origin="SIMULATED" /> |
| `HRV_RMSSD` | Heart rate variability | ms | 1 min window | 10 min | heart | down | Bio-Monitor shirt | <OriginBadge origin="SIMULATED" /> |
| `SPO2` | Blood oxygen | % | 1 min | 10 min | lungs | down | Bio-Monitor shirt | <OriginBadge origin="SIMULATED" /> |
| `RESPIRATORY_RATE` | Breathing rate | br/min | 1 min | 10 min | lungs | both | Bio-Monitor shirt | <OriginBadge origin="SIMULATED" /> |
| `SYSTOLIC_BP` | Blood pressure (systolic) | mmHg | 5 min | 20 min | heart | both | Bio-Monitor shirt (estimate) | <OriginBadge origin="SIMULATED" /> |
| `DIASTOLIC_BP` | Blood pressure (diastolic) | mmHg | 5 min | 20 min | heart | both | Bio-Monitor shirt (estimate) | <OriginBadge origin="SIMULATED" /> |
| `SKIN_TEMPERATURE` | Skin temperature | °C | 1 min | 10 min | skin | both | Bio-Monitor shirt | <OriginBadge origin="SIMULATED" /> |
| `ACTIVITY_LEVEL` | Activity | score 0 to 100 | 1 min | 10 min | muscles | down | Actigraphy watch | <OriginBadge origin="SIMULATED" /> |
| `SLEEP_DURATION` | Sleep duration | h | daily (06:00 UTC) | 36 h | brain | down | Actigraphy watch | <OriginBadge origin="SIMULATED" /> |
| `SLEEP_EFFICIENCY` | Sleep efficiency | % | daily (06:00 UTC) | 36 h | brain | down | Actigraphy watch | <OriginBadge origin="SIMULATED" /> |
| `EXERCISE_LOAD` | Exercise performance | % of personal baseline | per session | 32 h | muscles | down | CEVIS, ARED, T2 | <OriginBadge origin="SIMULATED" /> |
| `REACTION_TIME` | Reaction time | ms | 2 tests per day | 18 h | brain | up | Reaction self-test | <OriginBadge origin="SIMULATED" /> |
| `HYDRATION` | Hydration index | score 0 to 100 | 30 min | 90 min | kidneys | down | Fluid intake log | <OriginBadge origin="SIMULATED" /> |
| `RADIATION_DOSE` | Accumulated dose | mGy | 15 min | 45 min | bones | up | Personal dosimeter | <OriginBadge origin="SIMULATED" /> |
| `MOOD` | Mood (self report) | 1 to 5 | daily | 50 h | brain | down | Daily check-in | <OriginBadge origin="SIMULATED, MANUAL" /> |
| `PERCEIVED_FATIGUE` | Fatigue (self report) | 1 to 5 | daily | 50 h | brain | up | Daily check-in | <OriginBadge origin="SIMULATED, MANUAL" /> |
| `STRESS` | Stress (self report) | 1 to 5 | daily | 50 h | brain | up | Daily check-in | <OriginBadge origin="SIMULATED, MANUAL" /> |
| `CO2` | Cabin CO2 | ppm | 1 min | 10 min | environment | up | Cabin environment sensor | <OriginBadge origin="SIMULATED" /> |
| `CABIN_TEMPERATURE` | Cabin temperature | °C | 1 min | 10 min | environment | both | Cabin environment sensor | <OriginBadge origin="SIMULATED" /> |
| `RELATIVE_HUMIDITY` | Humidity | % | 1 min | 10 min | environment | both | Cabin environment sensor | <OriginBadge origin="SIMULATED" /> |
| `RADIATION_DOSE_RATE` | Radiation dose rate | µGy/h | 1 min | 10 min | environment | up | Area radiation monitor | <OriginBadge origin="SIMULATED" /> |

Notes:

- Each metric also has a **display range** in the catalog: a chart range only, never a clinical limit.
- `EXERCISE_LOAD` is relative to the person's own usual sessions; the daily summary also tracks exercise minutes against the plan.
- Fixed demo thresholds that apply to some of these metrics are listed only in [Thresholds and limitations](../intelligence/thresholds).
- The real OSDR lab analytes (CBC and CMP) are not part of this catalog; they are listed in the [Dataset catalog](./dataset-catalog).

## Body regions

| Region | Label | System | Metrics |
| --- | --- | --- | --- |
| `brain` | Brain | Neuro and sleep | Sleep, reaction time, mood, fatigue, stress |
| `heart` | Heart | Cardiovascular | Heart rate, HRV, blood pressure |
| `lungs` | Lungs | Respiratory | Blood oxygen, breathing rate |
| `kidneys` | Kidneys | Renal and hydration | Hydration index |
| `muscles` | Muscles | Musculoskeletal | Activity, exercise performance |
| `bones` | Skeleton | Bone and radiation | Accumulated dose |
| `skin` | Skin | Thermal | Skin temperature |

Cabin metrics map to `environment`. A region with all its metrics missing is `NO_DATA`, never `LOW`. The eyes have no metric: in the 3D body they are context only structures.

Which anatomical structures of the 3D atlas report under each region, and which are context only, is defined in [Anatomy to health mapping](../architecture/data-model#anatomy-to-health-mapping).

## Simulated devices

| Device | Kind | Assigned | Metrics |
| --- | --- | --- | --- |
| Bio-Monitor shirt (sim) | `BIO_MONITOR` | each astronaut | HR, HRV, SpO2, breathing rate, skin temperature, systolic and diastolic BP |
| Actigraphy watch (sim) | `ACTIGRAPHY` | each astronaut | Activity, sleep duration, sleep efficiency |
| CEVIS cycle ergometer, ARED resistive exercise device, T2 treadmill (sim) | `EXERCISE_*` | shared | Exercise performance |
| Personal dosimeter (sim) | `DOSIMETER` | each astronaut | Accumulated dose |
| Cabin environment sensor (sim) | `ENV_SENSOR` | cabin | CO2, temperature, humidity |
| Area radiation monitor (sim) | `DOSIMETER` | cabin | Dose rate |
| Reaction self-test and fluid intake log (sim) | app based | each astronaut | Reaction time, hydration (not listed as devices in the UI) |

Device behavior (states, battery, failures) is described in [Device simulation and scenarios](../intelligence/scenario-simulation).

## Daily check-in record

```json
{
  "id": "CHK-AST-02-2026-11-14",
  "astronautId": "AST-02",
  "at": 1794643200000,
  "mood": 3, "fatigue": 4, "stress": 3, "sleepQuality": 2,
  "symptoms": ["headache"],
  "note": "",
  "data_origin": "MANUAL"
}
```

Scales 1 to 5. For mood and sleep quality 5 is best; for fatigue and stress 5 is worst. Mood, fatigue and stress become the `MOOD`, `PERCEIVED_FATIGUE` and `STRESS` metrics; sleep quality and symptoms are context only. Symptom tags: headache, congestion, back pain, nausea, eye discomfort, trouble sleeping.

## Lab result record (long format)

`data/processed/<OSD>.observations.json`, one row per source row:

| Field | Meaning |
| --- | --- |
| `subject`, `sex` | Source pseudonym (C001 to C004) and sex from the ISA metadata |
| `analyte`, `unit` | As reported in the file |
| `value` | Number, or `null` with the raw text kept |
| `range_low`, `range_high` | The testing lab's range: **not a NASA limit and never used for alerts** |
| `timepoint`, `days_from_event`, `phase` | L-92 to R+194, days from launch or return, pre or post flight |
| `data_origin` | `REAL_PUBLIC` |

## Enumerations

Data origin, quality status, mission phase, activity context, device kind and state, risk level and the other enumerations are listed in [Data model and contracts](../architecture/data-model#enumerations).

## Next steps

- [Pipeline, normalization and quality](./pipeline-and-quality)
- [Personal baseline](../intelligence/personal-baseline): how each metric gets its normal band.
