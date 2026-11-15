---
title: Model Card
description: Model card of the Astronaut Health Intelligence Platform health engine, with intended use, users, data, method summary, evaluation summary, limitations and ethical considerations.
status: IMPLEMENTED
origin: SIMULATED, DERIVED
code:
  - docs/model-card.md
  - frontend/web/scripts/evaluate.ts
  - frontend/web/src/engine/config.ts
  - frontend/web/src/features/datasources/ModelCardTab.tsx
verified: 2026-11-14
---

# Model Card

Model card of the health engine of the Astronaut Health Intelligence Platform (AHI). The generated source is `docs/model-card.md`, written by `npm run evaluate` on 2026-11-14; the same content is shown in the app under **Tools > Data and model > Model card**.

| | |
| --- | --- |
| Engine | `ahi-engine 2.0.0` |
| Risk model | `AHI transparent rules v2.0 (demo)` |
| Baseline | `robust-baseline v1 (median/MAD)` |
| Forecast | `Damped Holt linear smoothing v1` |
| Recommendation catalog | `rec-catalog v2.0` |
| Type | Transparent statistical rules; **no trained machine learning model and no language model** ([AI and analytics](../intelligence/ai-and-analytics)) |

::: danger Not a medical device
AHI does not diagnose, does not recommend medication and does not use official NASA limits. Every fixed number is demo configuration that would need flight surgeon review before any real use. All device data is **SIMULATED**; check-ins typed in the UI are `MANUAL`.
:::

## Intended use

A hackathon prototype of **decision support** for crew health monitoring on long duration missions. It helps the crew, a crew medical officer and a flight surgeon notice when a crew member drifts away from **their own** normal, explains why in plain language, and suggests a non-prescriptive next step.

**Out of scope:** clinical decisions, emergency response, use on real patients or on real astronaut data.

## Intended users

| User | Use |
| --- | --- |
| Crew member | Understand their own state in plain words (Crew view), daily check-in |
| Crew medical officer | Act on board first, especially under a long communication delay |
| Flight surgeon | Review trends, factors and alerts; every HIGH or CRITICAL item requires human review |
| Mission Control | Cabin environment, device status, dose planning |

## Data

- An in-browser simulator of a 4 person crew (seeded, reproducible): smart shirt (heart rate, HRV, SpO2, breathing rate, skin temperature, blood pressure estimate), actigraphy (activity, sleep), exercise devices (CEVIS, ARED, T2), reaction self-test, fluid intake log, personal and area dosimeters, cabin CO2, temperature and humidity ([Device simulation](../intelligence/scenario-simulation)).
- A daily check-in (mood, fatigue, stress, sleep quality on 1 to 5, symptom tags), simulated each morning or typed in the UI.
- 5 days of minute level history and 14 days of daily metrics are generated at startup so personal baselines are ready.
- Six scenarios: nominal, progressive fatigue, cabin CO2 rise, exercise performance decline, sensor failure, acute cardio event.
- The two real NASA OSDR datasets are historical reference only. They are **not** used to train, tune or calibrate the engine ([Dataset catalog](../data/dataset-catalog)).

## Method summary

| Step | Summary | Page |
| --- | --- | --- |
| 1. Personal baseline | Median and MAD per person, metric and activity context; band = median plus or minus 2 robust SD; outliers and drifting samples kept out | [Personal baseline](../intelligence/personal-baseline) |
| 2. Detection | Robust z of the last 3 readings, EWMA drift with persistence, daily persistence, fixed demo thresholds as a safety net, data quality (`NO_DATA`, never normal) | [Anomaly detection](../intelligence/anomaly-detection) |
| 3. Combined rules | R-CARD-01, R-FAT-01, R-ENV-CO2-02 (co-occurrence only) | [Risk assessment](../intelligence/risk-assessment#combined-rules) |
| 4. Self report | Compared with the person's own answers, capped at MODERATE, one shared weight, never an alert | [Self-report](../intelligence/self-report-and-earth-link) |
| 5. Risk score | Noisy-OR of one weight per rule, bands 20 / 45 / 80, CRITICAL needs an acute CRITICAL rule, confidence from data availability | [Risk assessment](../intelligence/risk-assessment) |
| 6. Alerts | One per person and rule, auto resolve, escalation of unacknowledged CRITICAL and HIGH alerts | [Alerts](../intelligence/alerts) |
| 7. Earth link | Health packets with light delay, simulated replies, on board first step under Mars | [Earth link](../intelligence/self-report-and-earth-link#earth-link) |
| 8. Forecast and what-if | Damped Holt with 80% interval; noise free what-if with made up effect sizes | [Forecasting](../intelligence/forecasting), [What-if](../intelligence/recommendations#what-if-projection) |

All fixed numbers: [Thresholds and limitations](../intelligence/thresholds).

## Evaluation (simulated data)

| Summary | Value |
| --- | --- |
| Nominal false alerts at HIGH or above | 0 per crew day over 60 crew days (99.97% of time at LOW) |
| Acute cardio event | First alert, HIGH and CRITICAL at 7 min |
| Sensor failure | First alert at 14 min, peak MODERATE by design |
| Cabin CO2 rise | First alert at 90 min, HIGH at 140 min |
| Progressive fatigue | First alert at 31.8 h, HIGH at 33.5 h |
| Exercise performance decline | First alert at 27.5 h, HIGH at 75.5 h |

Full tables, method and caveats: [Results and evidence](./results). The evaluation uses the same simulator that generated the data: it shows internal consistency, not real world performance.

## Limitations

- Simulated data and a simplified physiological model; nothing is validated against real crews.
- Thresholds, weights, escalation timings, review times and intervention effect sizes are demo configuration.
- Activity context comes from the schedule, not from activity recognition.
- Correlation between signals does not prove cause.
- Self report is subjective, and simulated answers are a model of how people might answer.
- Older mission days are synthesized from each profile.
- Forecasts assume recent conditions continue; they are not clinical predictions.

The complete list: [Limitations and known issues](./limitations).

## Ethical considerations

- Decision support for humans: every HIGH or CRITICAL item requires human review.
- Plain language first, no diagnostic wording; missing data is never shown as normal.
- Pseudonymized crew identifiers; no real personal data.

More: [Responsible use](../overview/responsible-use), [Governance and privacy](../data/governance-and-privacy).

## Next steps

- [Validation strategy](./strategy)
- [Traceability matrix](./traceability)
