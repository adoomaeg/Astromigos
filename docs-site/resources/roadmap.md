---
title: Roadmap
description: Next steps for the Astronaut Health Intelligence Platform in rough priority order, from real NASA cabin and radiation data to a FastAPI backend, review workflow, role based access and the next steps of the 3D anatomy.
status: PLANNED
verified: 2026-11-14
---

# Roadmap

The Astronaut Health Intelligence Platform (AHI) today is a browser only prototype with simulated device data and two real NASA datasets as reference. This page lists the next steps, in rough priority order. Nothing on this page is implemented yet unless it says so. Current status of every capability: [Feature status matrix](../overview/feature-status).

## Where we are

| Area | Status |
| --- | --- |
| Simulation of crew devices and cabin, six scenarios | Done |
| Health engine (baselines, anomalies, risk, forecasts, recommendations, alerts) | Done, unit tested, evaluated on simulated data |
| Ground and Crew views, guided demo | Done |
| 3D anatomy on a real anatomical atlas (Z-Anatomy): 250 selectable structures, system layers, structure panel, health mapping, reproducible asset pipeline, procedural fallback | Done |
| Earth link, check-in, mission overview, handover report with FHIR R4 export, what-if | Done |
| Real NASA OSDR data (OSD-569 CBC, OSD-575 CMP) as `REAL_PUBLIC` reference | Done |
| Documentation portal on GitHub Pages (EN and PT-BR) | Done |
| Backend, database, authentication | Not started |

## Planned steps

### 1. Real ISS cabin replay from NASA EDA (P0)

Replace the cabin simulator with a `REAL_PUBLIC` **replay** of a real ISS period: CO2, temperature and humidity from the EDA **Data Tables** CSV of 1 or 2 payload missions that have CO2, with a manifest, canonical `HealthObservation` records (`subject_id: "CABIN"`) and a fitness report. The replay is labeled as historical, and the cabin data describes the ISS during a payload mission, not this crew. This is the largest credibility gain available.

### 2. Real radiation dose (P0)

Import the EDA dose series (GCR, SAA and accumulated dose) with unit and calculation method documented. Add **NASA RadLab** once it is back online (it returned HTTP 500 on 2026-11-14): check which instruments cover the ISS, the units and the download format.

### 3. Scientific grounding (P0 and P1)

- A table metric x NASA Standard Measure x HRP hazard, with links, to justify the catalog.
- Ground each demo threshold in a citable source (for example the NASA-STD-3001 habitability standard family, with document, section and version), or keep the demo label.
- Calibrate the vital sign, sleep and exercise simulators with published ranges (with DOI) and document them in the model card.

### 4. Backend: FastAPI and ingestion API

Implement the architecture of `PROJECT_MASTER.md` section 7: a modular monolith with **Python + FastAPI**, Pydantic schemas, PostgreSQL (TimescaleDB optional), Redis and background jobs, deployed with Docker Compose.

- `POST /api/v1/observations` ingestion of canonical batches (`202 Accepted` with accepted and rejected counts).
- The engine stages behind services (baseline, anomaly, prediction, risk, recommendation, audit).
- Adapters keep the same contract, so the UI and the engine rules do not change. See [Target architecture](../architecture/target-architecture).

### 5. More OSDR imports

- OSD-656 (urine inflammation panel) and the OSD-575 multiplex panels, if their relative values can be explained clearly.
- Cortisol or immune markers with clinical units from human studies.
- Analog sleep or cognition data from NLSP or OSDR, labeled as analog participants.

### 6. Flight surgeon review workflow

A review queue for HIGH and CRITICAL items: assign, comment, approve or reject a recommendation, with every step in the audit trail. Today the simulated flight surgeon replies are templates.

### 7. Role based access (RBAC)

Authentication and roles for crew, crew medical officer, flight surgeon, mission control, researcher and data engineer, matching the personas in the spec. Each role sees only what it needs.

### 8. SANS tracking from periodic exams

Spaceflight associated neuro-ocular syndrome is tracked from periodic exams (OCT, ocular ultrasound), not from a continuous wearable. A future extension would import those exam results as point measurements and give the eyes a status. Today the eyes are context only structures of the 3D atlas: they can be selected but no monitoring device feeds them, so they show no status.

### 9. 3D anatomy next steps {#anatomy-next-steps}

The atlas viewer is done ([3D anatomy](../architecture/anatomy-3d)). What comes next:

| Item | Why |
| --- | --- |
| **Female reference model** | Today one reference model (adult male source, neutral groin) stands for every crew member. A second reference model would let the body follow the crew member's sex. It needs a source with a compatible license and the same structure ids |
| **Textures** | The source has flat colors only, so all detail comes from geometry and materials. Textures would add surface detail, at a cost in download size |
| **BodyParts3D kidney alternative** | The kidneys are simple procedural shapes because the kidney model inside Z-Anatomy has a non commercial license. BodyParts3D, the database Z-Anatomy is based on, is a candidate source for real kidney geometry under a share alike license; its license terms must be checked first |
| **Eye monitoring (SANS)** | See step 8: the eye structures already exist and only need data |
| **Keyboard selection of structures and automated visual tests** | Structures can only be selected with a pointer, and rendering is checked by hand |

Not planned: per astronaut anatomy (scans or body size). The body is reference anatomy by design.

### 10. Deployment

- Publish this documentation portal: done with GitHub Actions and GitHub Pages ([Documentation and deployment](../engineering/deployment)).
- Host the static web app so judges can open it without installing anything.
- Later, the Docker Compose stack of the backend.

## Also considered

- Multivariate anomaly detection (for example Isolation Forest) once there is enough real data, kept explainable.
- Sensor based activity recognition instead of schedule based context.
- Using a language model only to explain an already selected recommendation in natural language, never to diagnose, invent limits or hide uncertainty (spec US-024 and section 9.7, see [AI and analytics](../intelligence/ai-and-analytics#planned-llm-explanation-layer)).

## Next steps

- [Limitations and known issues](../validation/limitations): what the roadmap addresses.
- [Pipeline, normalization and quality](../data/pipeline-and-quality#contributor-priorities): priorities for the data team.
- [NASA data sources](../data/sources): the state of each NASA source.
