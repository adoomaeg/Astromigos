---
title: Forecasting
description: Short term projections in the Astronaut Health Intelligence Platform with damped Holt linear smoothing, an 80% interval, eligibility rules, band exit time and the recovery rule.
status: IMPLEMENTED
origin: DERIVED
code:
  - frontend/web/src/engine/forecast.ts
  - frontend/web/src/engine/config.ts
tests:
  - frontend/web/src/engine/forecast.test.ts
verified: 2026-11-14
---

# Forecasting

## What it does

The Astronaut Health Intelligence Platform (AHI) projects a few metrics a short time ahead, with an uncertainty interval, **only when there is enough recent data**. The main product question it answers is "if things continue like this, when will this value leave the person's normal range?". The UI shows "Stable over next 6 h", "Projected to leave your normal range in ~5 h" or "Not enough data to forecast yet".

## Inputs

| Metric | Series used |
| --- | --- |
| Heart rate, HRV, SpO2 | 30 min means of the last 24 h, context adjusted to resting values (exercise excluded) |
| Sleep duration, exercise performance | Daily values (up to the last 14) |
| Cabin CO2 | 30 min means of the last 24 h |

Forecasts are recomputed every 10 sim minutes. The personal band of the rest context is used for band exit.

## Method

### Damped Holt linear smoothing

For a series y (one point per 30 min window, or per day):

```text
level_t   = alpha y_t + (1 - alpha)(level_t-1 + phi trend_t-1)
trend_t   = beta (level_t - level_t-1) + (1 - beta) phi trend_t-1
yhat_t+h  = level_t + (phi + phi^2 + ... + phi^h) trend_t
```

| Variable | Meaning | Value |
| --- | --- | --- |
| `alpha` | How fast the level follows new data | 0.4 |
| `beta` | How fast the trend follows changes of level | 0.15 |
| `phi` | Trend damping: the trend fades with the horizon instead of growing forever | 0.9 |
| `h` | Steps ahead (windows or days) | |

**Interpretation.** A damped trend is a cautious extrapolation: it continues the recent direction but flattens out, which suits physiological signals that rarely change linearly for long.

### 80% interval

The interval uses the standard deviation of recent one step residuals, widened with the horizon:

```text
sd_h  = residSd x sqrt(1 + sum over j < h of (alpha (1 + beta (phi + ... + phi^j)))^2)
range = yhat +/- 1.2816 x sd_h
```

`1.2816` is the z value of a central 80% interval under a normal error assumption. Only recent residuals are used, because the series may have changed regime.

### Eligibility and horizons

| Series | Requirement | Horizon |
| --- | --- | --- |
| Continuous | At least 12 half hour windows, last value less than 2 h old | 6 h |
| Continuous | At least 40 windows | 24 h |
| Daily | At least 5 values, last value less than 2 days old | 1 day |
| Daily | At least 10 values | 3 days |

Otherwise the prediction is `eligible: false` with a reason such as "8 of 12 half-hour windows with data". This follows spec section 9.6: show only horizons supported by the data.

### Band exit and recovery

- **Band exit.** `hoursToBandExit` is the first time the central projection leaves the personal band, or 0 if the latest window is already outside.
- **Recovery rule.** A series that just came back from the opposite side of the band (an excursion outside the band in the last 6 windows, with the trend pointing back) is recovering, so its momentum is not reported as a drift out of the normal range.

## Outputs

`Prediction` per metric: `method` (`Damped Holt linear smoothing v1`), `horizonHours`, `points` (`t`, `v`, `lo`, `hi`), `intervalLabel` ("80% interval"), `hoursToBandExit`, `eligible`, and the disclaimer:

> Statistical projection from recent simulated data. Not a clinical prediction: uncertainty grows with the horizon and the projection assumes recent conditions continue.

On the trend chart the projection is the dashed **forecast cone** after "now".

## Limitations

- Assumes recent conditions continue; a scheduled event (exercise, sleep) is not anticipated.
- The normal error assumption behind the interval is not verified; intervals are not calibrated on real data.
- Only five crew metrics and cabin CO2 are forecast.
- No ARIMA or other model selection ([Methods status](./overview#methods-status)).

## Status

<StatusBadge status="IMPLEMENTED" /> Covered by `forecast.test.ts` (damped linear trend, too few points, widening interval, irregular binning, eligibility, 6 h and 24 h horizons, band exit, daily steps, recovery rule). Spec requirement: US-021.

## Next steps

- [Recommendations, autonomy and what-if](./recommendations)
- [Personal baseline](./personal-baseline)
