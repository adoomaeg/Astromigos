---
title: Overview & Methods Status
description: How the health engine of the Astronaut Health Intelligence Platform turns observations into status, risk, forecasts and recommendations, and which analytic methods are implemented, planned or absent.
status: IMPLEMENTED
origin: SIMULATED, DERIVED
code:
  - frontend/web/src/engine/engine.ts
  - frontend/web/src/engine/config.ts
tests:
  - frontend/web/src/engine/engine.test.ts
verified: 2026-11-14
---

# Overview & Methods Status

The health engine of the Astronaut Health Intelligence Platform (AHI) lives in `frontend/web/src/engine/`. It turns simulated device readings and check-ins into a status per metric, body region and astronaut, a transparent risk score, short forecasts, recommendations and alerts. It is pure TypeScript, runs in the browser and is unit tested with vitest.

::: info Statistical and rule based
Every method on this page is classical statistics or an explicit rule with an id. There is no trained machine learning model and no language model at runtime. Why, and what could come later: [AI and analytics approach](./ai-and-analytics).
:::

## Pipeline

```mermaid
flowchart TB
    A["Device adapters<br/>(sim/adapters.ts)"] --> B["HealthObservation[]<br/>data_origin, quality, context"]
    B --> C["MetricTracker per subject and metric<br/>(anomaly.ts)"]
    C --> C1["Bounded history<br/>(series.ts)"]
    C --> C2["Personal baseline<br/>per activity context"]
    C --> C3["Robust z, EWMA drift,<br/>persistence, data quality"]
    C1 & C2 & C3 --> D["evaluate()<br/>(engine.ts)"]
    D --> E["Metric status and<br/>body regions"]
    D --> F["Combined rules and<br/>risk score (risk.ts)"]
    D --> G["Forecasts<br/>(forecast.ts)"]
    F --> H["Recommendations and<br/>autonomy"]
    F --> I["Alerts, escalation,<br/>audit"]
    I --> J["Earth link<br/>(comms.ts)"]
```

| Stage | Page | Code |
| --- | --- | --- |
| Personal normal per metric and context | [Personal baseline](./personal-baseline) | <CodeLink path="frontend/web/src/engine/baseline.ts" /> |
| Acute deviation, drift, persistence, data quality | [Anomaly detection](./anomaly-detection) | <CodeLink path="frontend/web/src/engine/anomaly.ts" /> |
| Combined rules, score, confidence, regions | [Risk assessment](./risk-assessment) | <CodeLink path="frontend/web/src/engine/risk.ts" /> |
| Short term projection with interval | [Forecasting](./forecasting) | <CodeLink path="frontend/web/src/engine/forecast.ts" /> |
| Next steps, who can act, what-if | [Recommendations, autonomy and what-if](./recommendations) | <CodeLink path="frontend/web/src/engine/recommendations.ts" /> |
| Alert lifecycle and escalation | [Alerts and escalation](./alerts) | <CodeLink path="frontend/web/src/engine/alerts.ts" /> |
| Where the data comes from | [Device simulation and scenarios](./scenario-simulation) | <CodeLink path="frontend/web/src/engine/sim/adapters.ts" /> |
| Check-ins and communication delay | [Self-report and Earth link](./self-report-and-earth-link) | <CodeLink path="frontend/web/src/engine/comms.ts" /> |
| Every fixed number | [Thresholds and limitations](./thresholds) | <CodeLink path="frontend/web/src/engine/config.ts" /> |

How the engine is wired into the app (clock, publishing, bounded memory) is in [Engine and simulation architecture](../architecture/engine-and-simulation).

## Versions

| Component | Version string (in `config.ts`) |
| --- | --- |
| Engine | `ahi-engine 2.0.0` |
| Risk model | `AHI transparent rules v2.0 (demo)` |
| Baseline | `robust-baseline v1 (median/MAD)` |
| Forecast | `Damped Holt linear smoothing v1` |
| Recommendation catalog | `rec-catalog v2.0` |

Versions are stored on every baseline, risk assessment, prediction and recommendation, so each output says which method produced it.

## Methods status

The product spec (section 9.3) lists candidate methods. This table says which ones exist in the code.

| Method | Purpose | Status | Where |
| --- | --- | --- | --- |
| Rolling robust baseline (median, MAD, p05 / p95, context buckets) | Personal normal | <StatusBadge status="IMPLEMENTED" /> | [Personal baseline](./personal-baseline) |
| Robust z-score | Acute deviation from the personal normal | <StatusBadge status="IMPLEMENTED" /> | [Anomaly detection](./anomaly-detection#robust-z-score) |
| EWMA of z | Slow, persistent drift | <StatusBadge status="IMPLEMENTED" /> | [Anomaly detection](./anomaly-detection#ewma-drift) |
| Persistence windows | Repeated daily deviations | <StatusBadge status="IMPLEMENTED" /> | [Anomaly detection](./anomaly-detection#daily-persistence) |
| Data quality and staleness | Missing, stale or questionable data | <StatusBadge status="IMPLEMENTED" /> | [Anomaly detection](./anomaly-detection#data-quality) |
| Transparent rule based risk score 0 to 100 | Attention level | <StatusBadge status="IMPLEMENTED" /> | [Risk assessment](./risk-assessment) |
| Damped Holt linear smoothing with 80% interval | Short term projection | <StatusBadge status="IMPLEMENTED" /> | [Forecasting](./forecasting) |
| Band exit and recovery rule | Time until leaving the normal range | <StatusBadge status="IMPLEMENTED" /> | [Forecasting](./forecasting#band-exit-and-recovery) |
| Deterministic noise free what-if projection | Discussion of an action | <StatusBadge status="EXPERIMENTAL" /> | [Recommendations](./recommendations#what-if-projection) |
| Moving average / rolling median | Smoothing | <StatusBadge status="IMPLEMENTED" /> 30 min window means feed forecasts; the acute check uses a rolling median of 3 readings | [Forecasting](./forecasting#inputs) |
| IQR rule | Outlier detection | <StatusBadge status="NOT_IMPLEMENTED" /> robust z covers it | |
| CUSUM | Small cumulative shifts | <StatusBadge status="NOT_IMPLEMENTED" /> EWMA drift covers it | |
| Isolation Forest | Multivariate anomaly | <StatusBadge status="PLANNED" /> spec US-019 (P1), needs real data | [AI and analytics](./ai-and-analytics) |
| ARIMA | Time series forecasting | <StatusBadge status="NOT_IMPLEMENTED" /> | [AI and analytics](./ai-and-analytics) |
| XGBoost | Risk from a labeled dataset | <StatusBadge status="NOT_IMPLEMENTED" /> no labeled data | [AI and analytics](./ai-and-analytics) |
| SHAP | Model explanation | <StatusBadge status="NOT_IMPLEMENTED" /> rules explain themselves | [AI and analytics](./ai-and-analytics) |
| Survival analysis | Time to event | <StatusBadge status="NOT_IMPLEMENTED" /> | |

## Design principles

- **Personal first.** Status compares each person with their own baseline; fixed thresholds are a demo safety net.
- **Explainable by construction.** Every hit has a rule id, a plain-language label and a weight; the score formula is public.
- **Missing is not normal.** No valid value within a stale window is `NO_DATA`, and it lowers confidence.
- **Bounded and streaming.** O(1) work per sample per metric; histories and logs have caps.
- **Deterministic.** Seeded simulation; the same seed gives the same results (tested).

## Next steps

- [Personal baseline](./personal-baseline)
- [Validation results](../validation/results): what the evaluation measured.
