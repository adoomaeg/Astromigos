---
title: Responsible Use
description: Medical disclaimer and decision support boundaries of the Astronaut Health Intelligence Platform, human in the loop rules and correlation versus cause.
status: IMPLEMENTED
code:
  - frontend/web/src/engine/config.ts
  - frontend/web/src/engine/recommendations.ts
verified: 2026-11-14
---

# Responsible Use

The Astronaut Health Intelligence Platform (AHI) deals with health information, so its limits are part of the product, not a footnote. This page states what AHI is, what it is not, and the rules every screen, record and contribution follows.

::: danger Medical disclaimer
AHI is a monitoring, trend analysis and **decision support** prototype. It is **not a medical device**, not certified, not validated on real crews and not meant for real patients. It does not diagnose, does not recommend medication or treatment, and does not replace the flight surgeon or Mission Control. Fixed thresholds are **demo configuration, not official NASA limits**. Simulated data is **not clinical evidence**.
:::

## Decision support boundaries

| AHI does | AHI does not |
| --- | --- |
| Compare each person with their own baseline | Diagnose a condition or name a disease |
| Describe deviations, trends and uncertainty | Prescribe medication or treatment |
| Suggest non-prescriptive next steps from a versioned catalog ("Review sleep schedule and light exposure", "Request flight surgeon review now") | Replace the flight surgeon or Mission Control |
| Say who can act (crew on board or flight surgeon on Earth) | Make autonomous clinical decisions |
| Flag missing or questionable data | Claim a live connection to ISS devices |
| Show hypothetical what-if projections | Claim clinical efficacy of any action |

The wording follows the same line: the app says "Act soon" or "Needs flight surgeon", never a disease name. Simulated flight surgeon replies are templates that never prescribe medication and state that they are simulated.

## Human in the loop

- Every HIGH or CRITICAL recommendation, and every item addressed to the flight surgeon, **requires human review** (`requiresHumanReview`).
- Alerts stay open until a person acknowledges them or the rule has been clear for a while; unacknowledged CRITICAL and HIGH alerts escalate ([Alerts and escalation](../intelligence/alerts)).
- Every human action (acknowledge, mark done, check-in, message to Earth) and notable system event is written to the audit trail with time and actor.
- Self report never escalates on its own: a check-in alone reaches MODERATE at most.

## Correlation is not causation

When cabin CO2 rises and the crew's breathing rate and reaction time shift at the same time, AHI reports a **co-occurrence** (rule R-ENV-CO2-02 states "This is co-occurrence, not proof of cause"). Combined rules show signals that moved together; they do not prove why.

## Thresholds and plans are demo configuration

Status is driven by personal baseline bands. The few fixed thresholds, the mission plan (180 days, 100 mGy radiation budget, 60 min exercise per day, 8 h sleep), escalation timings, Earth review times and every intervention effect size live in `src/engine/config.ts` and are labeled "demo configuration, not an official limit". The values are listed once, in [Thresholds and limitations](../intelligence/thresholds).

## Simulated data is labeled everywhere

- The top bar always shows a **SIMULATED** badge; charts, messages and reports repeat the label.
- Public data is never presented as live telemetry, and other people's data is never merged into the crew.
- Missing data is never treated as normal: it becomes `NO_DATA`, shown in grey with the words "Signal lost".

Labels and their rules: [Data origins and provenance](../data/data-origins). Privacy and handling rules: [Governance and privacy](../data/governance-and-privacy).

## Use of AI

There is no language model, no trained machine learning model, no retrieval and no agent at runtime. The project was developed with AI assistance (Claude Code), which is a development tool, not a platform feature. Details and the planned, guarded explanation layer: [AI and analytics approach](../intelligence/ai-and-analytics).

## If you build on it

- Keep every fixed number in `config.ts` with the demo label until a qualified person reviews it with a citable source.
- Keep the data origin on every record.
- Do not add diagnostic wording, medication or treatment advice to any text.
- Validate on real, appropriately consented data before any operational claim ([Validation strategy](../validation/strategy)).

## Next steps

- [Limitations and known issues](../validation/limitations)
- [Model card](../validation/model-card)
