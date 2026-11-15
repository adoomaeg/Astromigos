---
title: Personal Baseline
description: How the Astronaut Health Intelligence Platform learns each astronaut's own normal range per metric and activity context with robust statistics (median, MAD, quantiles).
status: IMPLEMENTED
origin: DERIVED
code:
  - frontend/web/src/engine/baseline.ts
  - frontend/web/src/engine/stats.ts
  - frontend/web/src/engine/anomaly.ts
  - frontend/web/src/engine/config.ts
tests:
  - frontend/web/src/engine/baseline.test.ts
  - frontend/web/src/engine/stats.test.ts
  - frontend/web/src/engine/anomaly.test.ts
verified: 2026-11-14
---

# Personal Baseline

## What it does

The Astronaut Health Intelligence Platform (AHI) compares each astronaut with **their own** recent values, not with a population average. For every person, metric and activity context it keeps a robust estimate of "normal" and a band around it. Everything downstream (anomaly detection, risk, forecasts, the shaded "Your normal" band on charts) uses this baseline. Why personal ranges matter in spaceflight physiology: [Monitored physiology](../science/monitored-physiology).

## Inputs

| Input | Detail |
| --- | --- |
| Accepted samples | Valid observations of one subject and metric, at 5 min resolution for continuous metrics, one per event for daily metrics |
| Activity context | From the simulated schedule: `SLEEP`, `REST`, `WORK`, `EXERCISE` (exercise, EVA and 20 min of recovery after exercise count as `EXERCISE`) |
| Metric configuration | `minScale`, `bucketed`, physical limits, from `METRIC_RULES` in `config.ts` |
| Startup history | 5 days of minute level history and 14 days of daily metrics are pre-generated, so baselines are ready immediately |

## Method

### Robust statistics

For the samples x1 ... xn in a context bucket:

```text
median   m   = median(x)
MAD          = median(|x_i - m|)
robust SD  s = max(1.4826 x MAD, minScale)
band         = [m - k s, m + k s]   with k = 2, clamped to the metric's physical limits
```

| Variable | Meaning | Demo value |
| --- | --- | --- |
| `m` | Center of the person's normal | |
| `MAD` | Median absolute deviation, a spread measure that ignores outliers | |
| `1.4826` | Makes MAD comparable to a standard deviation for normally distributed data | constant |
| `minScale` | Floor per metric so a very stable signal does not make tiny changes look huge (for example 3.5 bpm for heart rate, 0.7% for SpO2) | per metric |
| `k` | Band half width in robust SD | 2 |

The baseline also stores the mean, SD, p05 and p95 (for display and diagnostics), the sample count `n`, a window label and the version `robust-baseline v1 (median/MAD)`.

**Interpretation.** The band is "where this person usually is in this context". A value outside it is unusual for them, which is not the same as clinically abnormal.

**Assumptions.** Recent history represents the person's normal; the context from the schedule is correct; a spread of 2 robust SD is a reasonable "usual range" for a demo.

### Context buckets

Physiological metrics keep one baseline per context (`SLEEP`, `REST`, `WORK`, `EXERCISE`). A workout is compared with past workouts, so exercise never raises a heart rate alarm by itself. Daily metrics, hydration and cabin metrics use a single bucket.

### Sample size and readiness

| Kind | Minimum samples for `READY` | Reservoir |
| --- | --- | --- |
| Continuous metric, per context | 72 | 5 days at 5 min (1,440 values) |
| Exercise context | 36 | same |
| Daily (event) metric | 5 | 28 values |

Below the minimum the baseline is `INSUFFICIENT_DATA` and the UI says "Still learning your normal". No status is derived from an unready baseline.

### Outlier and drift gate

A sample enters the baseline only if:

- its robust z is below **3.5** (continuous) or **2.5** (daily),
- the drift indicator (EWMA of z) is below **1.0**,
- it is not `QUESTIONABLE`.

If drifting samples entered the baseline, a slow decline would quietly become the new normal. The gate keeps them out until the drift clears.

### Recompute schedule

The reservoir is a fixed size ring buffer (O(1) per push). The bucket baseline is recomputed every **24 accepted samples** (2 sim hours), never on every tick (every 144 samples while pre-generating history).

## Outputs

| Output | Where it is used |
| --- | --- |
| `Baseline` record: `status`, `n`, `median`, `mad`, `mean`, `sd`, `p05`, `p95`, `low`, `high`, `windowLabel`, `version` | `MetricState.baseline` and `contextBaselines` |
| Normal band | Shaded "Your normal" band on the trend chart; "Your normal: 66 to 80 bpm" in metric rows |
| Robust scale | z-scores in [Anomaly detection](./anomaly-detection), band exit in [Forecasting](./forecasting) |
| "Why is this my normal?" | The info button shows window, readings, median, MAD and version |

![Body system detail with the personal normal band and the forecast cone](/screenshots/body-detail.png)

## Limitations

- Context comes from the schedule, not from sensor based activity recognition.
- The band reflects recent days only; a long, slow adaptation to spaceflight would move it (by design, but it must be reviewed by a person).
- `minScale` floors and `k = 2` are demo configuration, not validated values.
- With little history (new crew member, new device) there is no baseline, only `INSUFFICIENT_DATA`.
- Baselines are built from simulated data; no real crew data has been used.

## Status

<StatusBadge status="IMPLEMENTED" /> Covered by `baseline.test.ts` (insufficient data, robust stats, outlier robustness, physical clamping, reservoir), `stats.test.ts` (median, MAD, scale floor) and `anomaly.test.ts` (baseline built on normal data, context aware exercise baseline). Spec requirement: US-017.

## Next steps

- [Anomaly detection](./anomaly-detection)
- [Thresholds and limitations](./thresholds)
