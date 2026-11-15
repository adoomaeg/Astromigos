---
title: Validation Strategy
description: How the Astronaut Health Intelligence Platform is verified today (tests, headless evaluation, review against sources) and the staged plan to validate it on real data, with what each stage can and cannot prove.
status: IMPLEMENTED
verified: 2026-11-14
---

# Validation Strategy

Validation answers two different questions for the Astronaut Health Intelligence Platform (AHI):

1. **Verification**: does the software do what its rules say? This is done today.
2. **Validation**: are the rules useful and safe for real crews? This is **not** done, and cannot be done with simulated data.

::: warning Current claim
Today AHI can claim **internal consistency on simulated data** and nothing more. It must not be described as accurate, sensitive, specific or clinically validated.
:::

## Levels of evidence

| Level | Question | Method | Status |
| --- | --- | --- | --- |
| L0. Code correctness | Do functions compute what they claim? | Unit tests on statistics, baseline, forecast, risk, alerts, FHIR | <StatusBadge status="IMPLEMENTED" /> |
| L1. Behavioral safety properties | Is missing data never normal? Does self report never escalate alone? Do replies never prescribe? | Dedicated tests | <StatusBadge status="IMPLEMENTED" /> |
| L2. Scenario consistency | Do the rules detect the situations the simulator creates, without false alerts in nominal runs? | Headless evaluation over seeds | <StatusBadge status="IMPLEMENTED" /> |
| L3. Source fidelity | Do docs and UI match the code and the cited sources? | Review against `frontend/web/src`, NASA pages checked on 2026-11-14, `verified` dates on pages | <StatusBadge status="IMPLEMENTED" /> |
| L4. Simulator realism | Do simulated ranges match published physiology? | Calibration with literature (DOI) per metric | <StatusBadge status="PLANNED" /> |
| L5. Retrospective real data | Does the engine behave sensibly on real historical data? | Replay of NASA EDA cabin data; analog sleep or cognition data labeled as analog | <StatusBadge status="PLANNED" /> |
| L6. Expert review | Are thresholds, wording and recommendations acceptable to flight surgeons? | Structured review of `config.ts` and the catalog with citable sources | <StatusBadge status="PLANNED" /> |
| L7. Usability | Can crew and flight surgeons use it under time pressure? | Moderated sessions with tasks from the [user journeys](../product/user-journeys) | <StatusBadge status="PLANNED" /> |
| L8. Prospective clinical validation | Does it improve outcomes? | Out of scope for a hackathon prototype | <StatusBadge status="NOT_IMPLEMENTED" /> |

## How each level is run today

### L0 and L1: tests

143 vitest tests in 17 files run on every push and pull request ([Testing strategy](../engineering/testing)). Safety properties are asserted explicitly, for example "missing or stale data is NO_DATA, never LOW" and "self report alone reaches MODERATE at most and no alert".

### L2: headless evaluation

`npm run evaluate` replays the engine without a UI:

| Design choice | Why |
| --- | --- |
| Nominal scenario over 5 seeds x 72 h x 4 crew (60 crew days) | Estimates the false alert rate where every alert is false |
| Each problem scenario run once with its own horizon (3 to 120 h) | Measures time to first alert, to HIGH and to CRITICAL |
| Evaluation grid per scenario (1, 5 or 15 min) | Fast scenarios need fine resolution; slow ones do not |
| Results versioned in `evaluation.json` with the engine version | Any rule change shows up as a diff |

The expected behaviors are encoded in the scenario tests of `engine.test.ts` (nominal never reaches HIGH, the acute event reaches CRITICAL, the sensor failure becomes `NO_DATA` and never LOW, slow scenarios escalate over days) and in the design rule that slow patterns are capped at HIGH. Results: [Results and evidence](./results).

### L3: source fidelity

Every documentation page with technical content carries `verified: 2026-11-14` and links its source files. NASA source availability was checked live on that date ([NASA data sources](../data/sources)). Scientific claims link to references ([Scientific references](../science/references)).

## Known threats to validity

| Threat | Effect | Mitigation |
| --- | --- | --- |
| Same simulator generates and evaluates | Detection is optimistic by construction | Stated on every result; real data replay planned (L5) |
| Rules tuned on the scenarios | Overfitting to six stories | Scenario tests check behavior, not exact values; more scenarios and seeds needed |
| Schedule gives perfect activity context | Real context inference will add errors | Listed as a limitation |
| No labeled outcomes | Cannot estimate clinical sensitivity or specificity | No such claim is made |

## Next steps

- [Results and evidence](./results)
- [Traceability matrix](./traceability)
- [Roadmap](../resources/roadmap)
