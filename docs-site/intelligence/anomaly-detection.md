---
title: Anomaly Detection
description: Streaming anomaly detection in the Astronaut Health Intelligence Platform, with robust z-score, EWMA drift, daily persistence windows, data quality checks and fixed demo thresholds.
status: IMPLEMENTED
origin: DERIVED
code:
  - frontend/web/src/engine/anomaly.ts
  - frontend/web/src/engine/stats.ts
  - frontend/web/src/engine/series.ts
  - frontend/web/src/engine/config.ts
tests:
  - frontend/web/src/engine/anomaly.test.ts
  - frontend/web/src/engine/stats.test.ts
verified: 2026-11-14
---

# Anomaly Detection

## What it does

The Astronaut Health Intelligence Platform (AHI) keeps one streaming `MetricTracker` per subject and metric. On every sample it updates a bounded history, the [personal baseline](./personal-baseline) of the current context, an acute deviation score, a drift indicator and a persistence counter, and decides whether the metric is `LOW`, `MODERATE`, `HIGH`, `CRITICAL` or `NO_DATA`. It answers three questions: is this value unusual for this person right now, has the signal been slowly moving away, and can we trust the data at all.

## Inputs

| Input | Detail |
| --- | --- |
| Observation | Value, time, quality status and activity context of one `HealthObservation` |
| Personal baseline | Median and robust scale of the current context bucket |
| Metric rules | Bad direction, `minScale`, acute and drift flags, stale window and rule ids from `METRIC_RULES` |
| Device state | `ONLINE`, `DEGRADED`, `DATA_STALE`, `OFFLINE` |

## Method

All methods compare against the personal baseline of the current context, in the metric's **bad direction** (up, down or both). For a value `x`, baseline median `m` and robust scale `s`:

```text
z      = (x - m) / s                    signed robust z
badZ   = z (bad direction up), -z (down), |z| (both)
```

`badZ` is positive when the value is worse than usual. All levels below are demo configuration.

### Robust z-score

The acute check uses the **median of the last 3 readings**, so a single spike is filtered out:

```text
z_acute = (median(x_t, x_t-1, x_t-2) - m) / s
```

| badZ of z_acute | Level |
| --- | --- |
| at least 4 | MODERATE |
| at least 5.5 | HIGH |
| at least 7 | CRITICAL |

In the exercise context (which includes warm-up and the 20 min recovery), two sided metrics only flag an **upward** acute deviation: values below the exercise median are expected during warm-up and cool-down.

### EWMA drift

Slow drifts are invisible to the acute check. The tracker keeps an exponentially weighted moving average of the per reading z (clamped to plus or minus 6):

```text
alpha_t = 1 - 0.5 ^ (dt / halfLife)        halfLife = 180 min
D_t     = D_t-1 + alpha_t (z_t - D_t-1)
```

| Condition on badZ of D | Level |
| --- | --- |
| at least 1.0 for 3 h | MODERATE |
| at least 2.0 for 12 h | HIGH |
| below 0.8 | the drift clears |

**Interpretation.** A drift of 1.0 means the recent average sits about one robust SD on the bad side of normal. The time requirement (persistence) avoids reacting to a single bad hour. The half-life formula keeps the smoothing correct when samples are irregular.

### Daily persistence

Daily metrics (sleep, exercise sessions, reaction tests, check-in answers) cannot drift minute by minute, so they use runs of consecutive values outside the band (badZ of at least 2):

| Condition | Level |
| --- | --- |
| 1 value with badZ of at least 3, or 2 in a row outside the band | MODERATE |
| 3 in a row outside the band | HIGH |

The explanation uses persistence wording, for example "Sleep below your normal for 3 nights".

### Fixed demo thresholds

A few metrics also have fixed thresholds on the 3 reading median, as a safety net independent of the baseline (for example blood oxygen and cabin CO2). They are demo configuration, not official limits, and are listed only in [Thresholds and limitations](./thresholds). Cabin metrics use fixed thresholds only: a module has no "personal" normal.

### Data quality

| Check | Result |
| --- | --- |
| No valid value for `staleMin` minutes (10 min for most vitals, 20 for blood pressure; see the [Data dictionary](../data/data-dictionary)) | Status `NO_DATA`, rule **R-DQ-01** (MODERATE) |
| Device `DATA_STALE` or `OFFLINE` | Status `NO_DATA`, R-DQ-01 |
| 20% or more of the last 15 readings `QUESTIONABLE` | Rule **R-DQ-02** (MODERATE) |
| Questionable values | Cannot escalate beyond MODERATE on their own |

Missing data never looks normal: the metric becomes `NO_DATA` and its body region turns grey with the words "Signal lost".

### Rule ids

| Group | Rules |
| --- | --- |
| Heart | R-HR-01 (acute), R-HR-02 (resting drift), R-HR-03 (demo resting ceiling), R-HRV-01, R-BP-01 |
| Lungs | R-SPO2-01 (vs personal), R-SPO2-02 (demo floor), R-RR-01 |
| Other body | R-TEMP-01, R-ACT-01, R-HYD-01, R-SLEEP-01, R-SLEEP-02, R-EX-01, R-RT-01, R-RAD-02 |
| Cabin | R-ENV-CO2-01, R-ENV-TEMP-01, R-ENV-RH-01, R-ENV-RAD-01 |
| Data quality | R-DQ-01, R-DQ-02 |
| Self report | R-PSY-01 (mood), R-PSY-02 (fatigue), R-PSY-03 (stress), R-PSY-04 (symptoms) |
| Combined | R-CARD-01, R-FAT-01, R-ENV-CO2-02 ([Risk assessment](./risk-assessment#combined-rules)) |

## Outputs

| Output | Content |
| --- | --- |
| `MetricState` | `current`, `status`, `zScore`, `ewma`, `driftZ`, `deviationPct`, `persistenceHours`, `trendPerHour`, `baseline`, `baselineContext`, `quality`, `ruleId`, `explanation` |
| `Anomaly` | `metric`, `detectedAt`, `method` (`ROBUST_Z`, `EWMA`, `PERSISTENCE`, `COMBINED`, `DATA_QUALITY`), `severity`, `explanation` (up to 200 kept) |
| Rule hit | Rule id, level and a factor label such as "HRV 28% below personal baseline for 3 days", consumed by [Risk assessment](./risk-assessment) |

## Limitations

- Univariate: each metric is checked on its own; relationships are handled only by the three combined rules.
- Thresholds on z and drift durations are demo configuration tuned on simulated data (see [Results](../validation/results)).
- Activity context comes from the schedule; a mislabeled context would compare against the wrong bucket.
- No IQR rule, no CUSUM and no multivariate detector ([Methods status](./overview#methods-status)).

## Status

<StatusBadge status="IMPLEMENTED" /> Covered by `anomaly.test.ts` (LOW on normal data, acute jump to CRITICAL, spike filtered by the 3 reading median, EWMA drift with persistence, `NO_DATA` for missing data, questionable cap, context aware exercise baseline, daily persistence) and `stats.test.ts` (robust z, EWMA alpha and step tracking). Spec requirement: US-018.

## Next steps

- [Risk assessment](./risk-assessment)
- [Forecasting](./forecasting)
