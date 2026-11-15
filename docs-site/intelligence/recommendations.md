---
title: Recommendations, Autonomy & What-if
description: How the Astronaut Health Intelligence Platform selects non-prescriptive next steps from a versioned catalog, decides who can act under communication delay, and projects a hypothetical what-if comparison.
status: IMPLEMENTED
origin: DERIVED, SIMULATED
code:
  - frontend/web/src/engine/recommendations.ts
  - frontend/web/src/engine/intervention.ts
  - frontend/web/src/features/whatif/index.tsx
tests:
  - frontend/web/src/engine/risk.test.ts
  - frontend/web/src/engine/intervention.test.ts
  - frontend/web/src/engine/comms.test.ts
verified: 2026-11-14
---

# Recommendations, Autonomy & What-if

## What it does

For every actionable rule hit, the Astronaut Health Intelligence Platform (AHI) picks one **non-prescriptive** next step from a versioned catalog (`rec-catalog v2.0`), explains why in plain language, says **who can act** (crew on board or flight surgeon on Earth) and whether human review is required. A **what-if** comparison can then show a hypothetical trajectory with and without the action.

::: danger Never a treatment
The catalog never recommends medication or a treatment. Items are steps such as "Review sleep schedule and light exposure" or "Request flight surgeon review now".
:::

## Inputs

| Input | Detail |
| --- | --- |
| Rule hits | From [Risk assessment](./risk-assessment), after suppression by combined rules |
| Earth link profile | One way delay of the active profile ([Earth link](./self-report-and-earth-link#earth-link)) |
| Current simulated state | For the what-if projection |

## Method

### Selection

1. **Actionable hits**: any HIGH or CRITICAL rule, plus MODERATE trend, combined, environment and data quality rules. A single acute z blip at MODERATE only changes the status.
2. **One recommendation per subject and rule per episode** (a new episode starts after a 30 min gap), with the rule label as the first part of the rationale and the linked intervention kind.
3. **Human review**: items that are HIGH, CRITICAL or addressed to the flight surgeon have `requiresHumanReview: true`.
4. Cabin items use `astronautId: 'CABIN'`.

### Catalog (selection)

| Rule | Recommendation | Audience |
| --- | --- | --- |
| R-SLEEP-01, R-SLEEP-02 | Review sleep schedule and light exposure | Crew |
| R-HRV-01 | Review recovery: sleep, workload and exercise intensity | Crew |
| R-FAT-01 | Request flight surgeon review of the recovery pattern | Flight surgeon |
| R-HR-01, R-HR-03 | Pause activity, rest, and request flight surgeon review | Flight surgeon |
| R-CARD-01 | Request flight surgeon review now | Flight surgeon |
| R-SPO2-01 | Check sensor fit, then request review if it persists | Flight surgeon |
| R-EX-01 | Adjust exercise load and recovery with the trainer | Crew |
| R-HYD-01 | Hydrate per protocol | Crew |
| R-RAD-02 | Review accumulated dose with mission control | Mission Control |
| R-ENV-CO2-01 | Ventilate the module and check the CO2 scrubber | Mission Control (on board) |
| R-ENV-CO2-02 | Ventilate and keep monitoring breathing and reaction time | Crew |
| R-ENV-RAD-01 | Follow the radiation shelter procedure from mission control | Mission Control |
| R-DQ-01, R-DQ-02 | Check sensor fit and connection / skin contact | Crew |
| R-PSY-01 | Check in with the crew medical officer and plan some recovery time | Crew |

The full catalog is `REC_CATALOG` in `recommendations.ts`.

### Autonomy

| Value | Meaning | Typical items |
| --- | --- | --- |
| `ONBOARD` | The crew can act now | Self care, crew medical officer, onboard checks, cabin ventilation |
| `GROUND_REVIEW` | A flight surgeon or Mission Control on Earth should review it | Flight surgeon review, dose decisions |

**On board first step.** Under the Mars profiles, a HIGH or CRITICAL `GROUND_REVIEW` item also creates one onboard step per astronaut: "Crew medical officer: start the onboard assessment protocol now". Its rationale states the earliest Earth reply:

```text
earliest reply = 2 x one way delay + 4 min minimum review
               = about 48 min for Mars farthest (22 min one way)
```

### What-if projection

`compareIntervention({ astronautId, kind, metric?, horizonHours? })` runs the **noise free** simulation model twice from the current state: once with a hypothetical intervention logged now, once without. Because both runs use the same deterministic model with noise off, the only difference between the lines is the action.

| Kind | Default metric | Default horizon |
| --- | --- | --- |
| `SLEEP_EXTENSION` | HRV | 48 h, every 30 min |
| `REST_PROTOCOL`, `MEDICAL_CONSULT` | Heart rate | 24 h; 2 h every 5 min while an acute event is active |
| `CABIN_VENTILATION` | Cabin CO2 | 8 h, every 15 min |
| `EXERCISE_ADJUSTMENT` | Exercise performance | 120 h, one point per planned session |
| `HYDRATION` | Hydration index | 12 h, every 15 min |
| `SENSOR_CHECK` | none | |

It is a pure function (no state change, under 5 ms per call) and returns both trajectories, the personal band (rest context), plain assumptions and the disclaimer "Simulation for discussion only. Not evidence of clinical efficacy."

![What-if comparison: projected heart rate variability with and without a sleep extension](/screenshots/whatif.png)

## Outputs

- `Recommendation`: `ruleId`, `title`, `rationale`, `priority`, `audience`, `region`, `requiresHumanReview`, `status`, `interventionKind`, `active`, `catalogVersion`, `autonomy`.
- `InterventionComparison`: `metric`, `kind`, `horizonHours`, `without`, `with`, `band`, `assumptions`, `disclaimer`.
- **Mark done** logs an `Intervention` in the audit trail; the simulator then applies a hypothetical relief, recorded as simulation.

## Limitations

- The catalog is a demo list written for this prototype, not an approved operational procedure set.
- Intervention effect sizes in the what-if and in the simulator are made up parameters, not evidence; this is why the feature is marked <StatusBadge status="EXPERIMENTAL" />.
- Autonomy is decided by audience and profile only; real crew authority rules are richer.
- No language model rewrites or explains recommendations ([AI and analytics](./ai-and-analytics#planned-llm-explanation-layer)).

## Status

<StatusBadge status="IMPLEMENTED" /> selection, catalog and autonomy, covered by `risk.test.ts` (one per astronaut and rule, human review, linked intervention, actionability) and `comms.test.ts` (on board first step under Mars, none under ISS). <StatusBadge status="EXPERIMENTAL" /> what-if, covered by `intervention.test.ts` (7 tests, deterministic, no state change). Spec requirements: US-022, US-023.

## Next steps

- [Alerts and escalation](./alerts)
- [Self-report and Earth link](./self-report-and-earth-link)
