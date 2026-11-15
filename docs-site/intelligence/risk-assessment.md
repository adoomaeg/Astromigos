---
title: Risk Assessment
description: The transparent, rule based risk score of the Astronaut Health Intelligence Platform, with combined rules, the noisy-OR formula, level bands, caps, confidence and body region status.
status: IMPLEMENTED
origin: DERIVED
code:
  - frontend/web/src/engine/risk.ts
  - frontend/web/src/engine/config.ts
tests:
  - frontend/web/src/engine/risk.test.ts
verified: 2026-11-14
---

# Risk Assessment

## What it does

The Astronaut Health Intelligence Platform (AHI) combines the rule hits of one astronaut (from [Anomaly detection](./anomaly-detection), combined rules, cabin rules and self report) into an **operational attention level** (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`), a **risk score from 0 to 100**, the **contributing factors** in plain language, a **confidence** value and a calm one sentence **headline**. It also gives each body region a status for the 3D body.

::: warning Attention levels, not medical classifications
The levels are operational levels of the prototype (spec section 9.5). They are not diagnoses, not validated clinical categories and not a probability of any medical event.
:::

## Inputs

| Input | Detail |
| --- | --- |
| Metric rule hits | One per triggered rule id with its worst level, from each `MetricTracker` |
| Combined rules | R-CARD-01, R-FAT-01, R-ENV-CO2-02 (below) |
| Cabin rule hits | Count in every crew member's score: everyone breathes the same air |
| Self report | R-PSY-01 to R-PSY-04 from the daily check-in |
| Data availability | Missing or questionable key signals and unready baselines |

## Method

### Combined rules

| Rule | Condition (as coded) | Level |
| --- | --- | --- |
| **R-CARD-01** | Heart rate and SpO2 both at HIGH or worse at the same time | CRITICAL |
| **R-FAT-01** | Two of: short sleep or low sleep efficiency (MODERATE or worse); HRV below normal (MODERATE, or drift of at least 1.2 robust SD down); resting heart rate drift of at least 1.0 robust SD up | MODERATE; all three: HIGH |
| **R-ENV-CO2-02** | Cabin CO2 at MODERATE or worse while breathing rate drifts up (at least 0.8) or reaction time is at least 2 robust SD slower | MODERATE (co-occurrence, not proof of cause) |

Combined rules **suppress** their components in the alert list (one grouped alert instead of five), so the person sees the pattern, not five fragments. Missing data never counts as a normal component. High self reported fatigue (4 or 5 out of 5) in the last 2 check-ins adds the factor "You also reported high fatigue in your last 2 check-ins" to R-FAT-01 without raising its level.

### Score (noisy-OR)

Each triggered rule contributes one weight, from the worst level of that rule:

| Level | Weight w |
| --- | --- |
| MODERATE | 0.20 |
| HIGH | 0.45 |
| CRITICAL | 0.85 |

```text
risk_score = round(100 x (1 - product over rules of (1 - w_i)))

LOW < 20 <= MODERATE < 45 <= HIGH < 80 <= CRITICAL
```

| Variable | Meaning |
| --- | --- |
| `w_i` | Weight of rule i (one per rule id, worst level) |
| `1 - w_i` | "Share of attention left" after rule i; the product is the share left after all rules |
| `risk_score` | 0 when nothing triggered, approaches 100 as rules accumulate |

**Interpretation.** Several independent moderate deviations escalate by construction, without exceeding 100. Example: three MODERATE rules give 100 x (1 - 0.8^3) = 49, which is HIGH. One HIGH rule alone gives 45 (HIGH); one CRITICAL rule gives 85 (CRITICAL).

**Assumptions.** Rules are treated as roughly independent signals; weights are demo values chosen so that the levels behave sensibly on simulated scenarios.

### Caps and special weights

| Rule of the score | Why |
| --- | --- |
| CRITICAL requires at least one CRITICAL rule; otherwise the score is capped at 79 | Slow multi day patterns call for review, not an emergency response |
| Data quality rules weigh at most 0.20 | A lost signal means "unknown", not "worse" |
| Self report rules share **one** weight (the largest) | A check-in alone reaches MODERATE at most |
| A reported symptom (R-PSY-04) weighs 0.05 | Informational, stays LOW on its own |
| Cabin rules count in every crew member's score | Shared environment |

### Confidence

```text
confidence = 0.95
           - 0.15 per missing key signal       (HR, HRV, SpO2, breathing rate, sleep)
           - 0.07 per questionable key signal
           - 0.05 per key baseline not READY
clamped to [0.15, 0.95]
```

Confidence says how much data is behind the level, not how likely the level is to be right. When core vitals are missing the UI says "Status cannot be confirmed".

### Body regions

Each region takes the worst status of its metrics and of the rules mapped to it. A region whose metrics are all missing is `NO_DATA`; an unmonitored region is `NO_DATA`, never `LOW`.

## Outputs

`RiskAssessment` (spec section 9.5):

| Field | Content |
| --- | --- |
| `risk_level`, `risk_score` | Level and 0 to 100 score |
| `contributing_factors` | Plain-language factors with weights, for example "HRV 28% below personal baseline for 3 days" |
| `triggered_rules` | Rule ids |
| `confidence` | 0.15 to 0.95 |
| `model_version` | `AHI transparent rules v2.0 (demo)` |
| `evaluated_at`, `data_window` | When and on which window |
| `limitations` | Always includes: simulated data only; decision support, not a diagnosis; thresholds are demo configuration; correlation does not prove cause; plus missing signals |
| `headline` | One calm sentence, for example "All indicators are within your normal range." |

![What needs attention panel with status, score, confidence, actions and factors](/screenshots/attention-actions.png)

## Limitations

- Weights, bands and caps are demo configuration, tuned on the same simulator that produced the data.
- The score is not calibrated as a probability and must not be read as one.
- Independence between rules is an approximation (for example sleep and HRV are related).
- Only three combined patterns exist; other relationships are not modeled.

## Status

<StatusBadge status="IMPLEMENTED" /> Covered by `risk.test.ts` (14 tests: bands, noisy-OR escalation, caps, data quality weight, R-CARD-01, R-FAT-01, missing data as a component, assessment output, headlines, regions, alert dedupe, actionability, grouping, recommendations). Spec requirement: US-020.

## Next steps

- [Recommendations, autonomy and what-if](./recommendations)
- [Alerts and escalation](./alerts)
