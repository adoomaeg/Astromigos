---
title: Use Cases & Stakeholders
description: Who the Astronaut Health Intelligence Platform serves, what each stakeholder needs and which use cases the prototype supports today.
status: IMPLEMENTED
origin: SIMULATED, MANUAL
verified: 2026-11-14
---

# Use Cases & Stakeholders

This page lists the people the Astronaut Health Intelligence Platform (AHI) is designed for and the situations it supports. Personas come from the product spec (`PROJECT_MASTER.md`, section 2.5); the crew medical officer was added because communication delay makes the on board role central. Step by step flows are in [User journeys and roles](../product/user-journeys).

## Stakeholders

| Stakeholder | Need | Where in AHI | Status |
| --- | --- | --- | --- |
| **Crew member** | Understand their own state and habits | Crew view, daily check-in, top two actions | <StatusBadge status="IMPLEMENTED" /> |
| **Crew medical officer** | Act on board first when Earth is far | On board first steps, autonomy badges, Earth link drawer | <StatusBadge status="IMPLEMENTED" /> |
| **Flight surgeon** | Follow signals and investigate changes | Ground view, body system detail with trend chart, alerts, handover report | <StatusBadge status="IMPLEMENTED" /> |
| **Mission Control** | Understand operational risk | Alerts drawer, cabin environment, device status, mission overview | <StatusBadge status="IMPLEMENTED" /> |
| **Researcher** | Explore historical data and provenance | Data and model dialog, OSDR panels, model card | <StatusBadge status="IMPLEMENTED" /> |
| **Admin / data engineer** | Manage sources and data quality | Import scripts and manifests only; no admin UI | <StatusBadge status="PLANNED" /> (UI) |
| **Hackathon judges** | Understand the idea in minutes | Guided demo, presentation mode, this portal | <StatusBadge status="IMPLEMENTED" /> |

::: info Roles are not enforced
There is no login and no role based access control. Every person using the browser sees everything; the Ground and Crew views are layouts, not permissions. Role based access is [planned](../architecture/target-architecture).
:::

## Use cases

| ID | Use case | Primary actor | Supported by | Status |
| --- | --- | --- | --- | --- |
| UC-01 | See the whole crew's status at a glance | Flight surgeon, Mission Control | Crew rail, 3D body, status timeline | <StatusBadge status="IMPLEMENTED" /> |
| UC-02 | Understand why a status changed | Flight surgeon | Contributing factors, rule ids, region detail, "Why is this my normal?" | <StatusBadge status="IMPLEMENTED" /> |
| UC-03 | React to an acute event | Crew, flight surgeon | CRITICAL banner, combined rule R-CARD-01, recommended actions, escalation | <StatusBadge status="IMPLEMENTED" /> |
| UC-04 | Notice a slow drift early | Flight surgeon, crew | EWMA drift, persistence, forecasts with band exit time | <StatusBadge status="IMPLEMENTED" /> |
| UC-05 | Act under a long communication delay | Crew medical officer | Mars profiles, on board first step, earliest reply time | <StatusBadge status="IMPLEMENTED" /> |
| UC-06 | Report subjective state | Crew member | Daily check-in (`MANUAL`) | <StatusBadge status="IMPLEMENTED" /> |
| UC-07 | Detect a lost or bad signal | Mission Control | `NO_DATA`, device states, data quality rules | <StatusBadge status="IMPLEMENTED" /> |
| UC-08 | Monitor the cabin | Mission Control | Cabin CO2, temperature, humidity, dose rate | <StatusBadge status="IMPLEMENTED" /> |
| UC-09 | Hand over a shift | Flight surgeon | Shift handover report, print, FHIR R4 export | <StatusBadge status="IMPLEMENTED" /> |
| UC-10 | Discuss "what if we act" | Crew, flight surgeon | What-if comparison (hypothetical) | <StatusBadge status="EXPERIMENTAL" /> |
| UC-11 | Track long term budgets | Mission Control | Mission overview (dose, exercise, sleep) | <StatusBadge status="IMPLEMENTED" /> |
| UC-12 | Inspect real public data with provenance | Researcher | Data and model, Real datasets tab | <StatusBadge status="IMPLEMENTED" /> |
| UC-13 | Ingest real device or file data through an API | Data engineer | `POST /api/v1/observations` | <StatusBadge status="PLANNED" /> |
| UC-14 | Review and approve recommendations in a queue | Flight surgeon | Review workflow | <StatusBadge status="PLANNED" /> |

The what-if comparison is marked experimental because its intervention effects are made up simulation parameters ([Recommendations, autonomy and what-if](../intelligence/recommendations#what-if-projection)).

## Out of scope use cases

- Diagnosing a condition or naming a disease.
- Recommending medication or treatment.
- Taking an action without a human (every HIGH or CRITICAL item requires human review).
- Presenting public historical data as live crew telemetry.

See [Responsible use](./responsible-use).

## Next steps

- [User journeys and roles](../product/user-journeys)
- [Feature status matrix](./feature-status)
