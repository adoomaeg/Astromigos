---
title: Thresholds & Limitations
description: Every fixed threshold and tunable number of the Astronaut Health Intelligence Platform, all demo configuration and not official NASA limits, with the limits of the health intelligence engine.
status: IMPLEMENTED
code:
  - frontend/web/src/engine/config.ts
  - frontend/web/src/engine/sim/scenarios.ts
verified: 2026-11-14
---

# Thresholds & Limitations

This page is the single place where the fixed numbers of the Astronaut Health Intelligence Platform (AHI) are listed. Every value lives in `frontend/web/src/engine/config.ts` (intervention effects in `sim/scenarios.ts`).

::: danger Demo configuration, not official limits
The values below were chosen so the prototype behaves sensibly with simulated data. They are **not** NASA limits, flight rules, habitability standards or clinical thresholds, and they would need review by a flight surgeon with a citable source before any real use. Personal baseline bands drive status first; fixed thresholds are a safety net.
:::

## Fixed demo thresholds

Applied to the median of the last 3 readings. Heart rate thresholds apply only outside exercise and recovery.

| Rule | Metric | Condition | Level | Name in config |
| --- | --- | --- | --- | --- |
| R-SPO2-02 | Blood oxygen | below 90% | CRITICAL | demo safety floor |
| R-SPO2-02 | Blood oxygen | below 92% | HIGH | demo watch floor |
| R-HR-03 | Heart rate (outside exercise) | above 135 bpm | CRITICAL | demo resting ceiling |
| R-HR-03 | Heart rate (outside exercise) | above 120 bpm | HIGH | demo resting watch level |
| R-ENV-CO2-01 | Cabin CO2 | above 7500 ppm | CRITICAL | demo critical level |
| R-ENV-CO2-01 | Cabin CO2 | above 5300 ppm | HIGH | demo warning level |
| R-ENV-CO2-01 | Cabin CO2 | above 4000 ppm | MODERATE | demo watch level |
| R-ENV-TEMP-01 | Cabin temperature | above 27 °C or below 18 °C | MODERATE | demo comfort band |
| R-ENV-RH-01 | Relative humidity | above 70% or below 25% | MODERATE | demo comfort band |
| R-ENV-RAD-01 | Radiation dose rate | above 100 µGy/h | HIGH | demo particle event level |
| R-RAD-02 | Accumulated dose | above 50 mGy | MODERATE | demo mission dose watch level |

Lab reference ranges printed in the OSDR files are the testing lab's ranges and are never used for status or alerts. Scientific context for these quantities (for example how cabin CO2 and dose are discussed in the literature): [Radiation and cabin environment](../science/radiation-and-environment).

## Other demo configuration

| Area | Values | Page |
| --- | --- | --- |
| Baseline | Band k = 2 robust SD; minimum samples 72 / 36 / 5; gate z 3.5 (daily 2.5); gate drift 1.0; recompute every 24 samples; per metric `minScale` | [Personal baseline](./personal-baseline) |
| Anomaly | Acute z 4 / 5.5 / 7; drift half-life 180 min, 1.0 for 3 h, 2.0 for 12 h, clear below 0.8; persistence 2 and 3 in a row, single value z 3; questionable share 20% of 15 | [Anomaly detection](./anomaly-detection) |
| Stale windows | 10 min most vitals, 20 min blood pressure, 90 min hydration, 45 min dose, 18 to 50 h daily metrics | [Data dictionary](../data/data-dictionary) |
| Risk | Weights 0.20 / 0.45 / 0.85; bands 20 / 45 / 80; slow patterns capped at HIGH; symptom weight 0.05; corroboration at fatigue 4 or more for 2 check-ins | [Risk assessment](./risk-assessment) |
| Forecast | alpha 0.4, beta 0.15, phi 0.9; 30 min windows; 12 / 40 windows for 6 / 24 h; 5 / 10 daily values for 1 / 3 days; z 1.2816 | [Forecasting](./forecasting) |
| Alerts | Auto resolve after 10 min clear; escalation CRITICAL 5 and 15 min, HIGH 30 and 90 min; 150 alerts kept | [Alerts](./alerts) |
| Earth link | Review time 4 to 8 min; re-check 10 / 30 / 60 / 120 min; automatic packet at HIGH | [Self-report and Earth link](./self-report-and-earth-link#earth-link) |
| Mission plan | 180 days, 100 mGy radiation budget, 60 min exercise per day, 8 h sleep target | [Mission features](../product/mission-features#mission-overview) |
| Mission days synthesis | 0.42 mGy per day scaled by a personal shield factor, 5% higher dose days, 6% missed sessions | [Mission features](../product/mission-features#mission-overview) |
| What-if | Default metrics and horizons, 2 h horizon during an acute event, at most 168 h; every intervention effect size | [Recommendations](./recommendations#what-if-projection) |

## Limitations of the engine

- **Simulated data.** Nothing has been validated on real crews; the evaluation uses the same simulator that generated the data ([Results](../validation/results)).
- **Demo numbers.** Thresholds, weights, timings and effect sizes are not grounded in a cited standard yet. Grounding each one in a citable source (for example the NASA-STD-3001 family, with document, section and version), or keeping the demo label, is on the [roadmap](../resources/roadmap).
- **Context from the schedule.** Activity context is not inferred from sensors.
- **Forecasts** assume recent conditions continue and are not calibrated.
- **Correlation is not cause.** Combined rules report co-occurrence.
- **Older mission days** are synthesized from each profile.

The full list of known issues across the platform is in [Limitations and known issues](../validation/limitations).

## Status

<StatusBadge status="IMPLEMENTED" /> as demo configuration. Grounding in citable sources: <StatusBadge status="PLANNED" />.

## Next steps

- [Responsible use](../overview/responsible-use)
- [Validation strategy](../validation/strategy)
