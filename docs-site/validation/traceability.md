---
title: Traceability Matrix
description: Traceability of every capability of the Astronaut Health Intelligence Platform to its product spec requirement, source code, tests, data, method and reference.
verified: 2026-11-14
---

# Traceability Matrix

Each row links a capability of the Astronaut Health Intelligence Platform (AHI) to the requirement it implements (user story ids from the backlog in `PROJECT_MASTER.md`, section 11, when there is one), the code that is the source of truth, the tests that cover it, the data it uses, the method and where it is documented. Status per capability: [Feature status matrix](../overview/feature-status).

## Data and simulation

| Capability | Requirement | Code | Tests | Data | Method | Reference |
| --- | --- | --- | --- | --- | --- | --- |
| Canonical observation with origin and quality | US-007 | <CodeLink path="frontend/web/src/types/domain.ts" /> | via `engine.test.ts` | all | Spec 6.3 model | [Data model](../architecture/data-model) |
| Smart shirt simulator (HR, HRV, SpO2, RR, BP, skin temperature) | US-010 | <CodeLink path="frontend/web/src/engine/sim/adapters.ts" /> | `engine.test.ts`, `stats.test.ts` | <OriginBadge origin="SIMULATED" /> | Lag plus OU noise | [Device simulation](../intelligence/scenario-simulation) |
| Sleep and activity simulator | US-011 | <CodeLink path="frontend/web/src/engine/sim/physiology.ts" /> | `engine.test.ts`, `missionDays.test.ts` | <OriginBadge origin="SIMULATED" /> | Nightly plan | [Device simulation](../intelligence/scenario-simulation) |
| Cabin environment simulator | US-012 | <CodeLink path="frontend/web/src/engine/sim/cabin.ts" /> | `engine.test.ts` | <OriginBadge origin="SIMULATED" /> | Orbit and SAA dose model | [Device simulation](../intelligence/scenario-simulation) |
| Exercise simulator (CEVIS, ARED, T2) | US-013 | <CodeLink path="frontend/web/src/engine/sim/physiology.ts" /> | `engine.test.ts`, `intervention.test.ts` | <OriginBadge origin="SIMULATED" /> | Session model | [Device simulation](../intelligence/scenario-simulation) |
| NASA OSDR import with provenance | US-008, US-016 | <CodeLink path="frontend/web/scripts/osdr/import.mjs" /> | none (checks inside the script) | <OriginBadge origin="REAL_PUBLIC" /> OSD-569, OSD-575 | SHA-256, manifest | [Dataset catalog](../data/dataset-catalog) |
| Data quality flags (missing, questionable, stale) | US-009 | <CodeLink path="frontend/web/src/engine/anomaly.ts" /> | `anomaly.test.ts`, `engine.test.ts` | <OriginBadge origin="SIMULATED" /> | Stale windows, questionable share | [Anomaly detection](../intelligence/anomaly-detection#data-quality) |
| Ingestion API | US-006 | none | none | | | [Target architecture](../architecture/target-architecture) |
| Persistence | US-002 | none | none | | | [Target architecture](../architecture/target-architecture) |

## Health intelligence

| Capability | Requirement | Code | Tests | Data | Method | Reference |
| --- | --- | --- | --- | --- | --- | --- |
| Personal baseline | US-017 | <CodeLink path="frontend/web/src/engine/baseline.ts" /> | `baseline.test.ts`, `stats.test.ts` | <OriginBadge origin="DERIVED" /> | Median, MAD, p05 / p95, context buckets | [Personal baseline](../intelligence/personal-baseline) |
| Univariate anomaly detection | US-018 | <CodeLink path="frontend/web/src/engine/anomaly.ts" /> | `anomaly.test.ts` | <OriginBadge origin="DERIVED" /> | Robust z, EWMA, persistence | [Anomaly detection](../intelligence/anomaly-detection) |
| Multivariate anomaly detection | US-019 | none | none | | Isolation Forest (planned) | [AI and analytics](../intelligence/ai-and-analytics) |
| Risk assessment | US-020 | <CodeLink path="frontend/web/src/engine/risk.ts" /> | `risk.test.ts` | <OriginBadge origin="DERIVED" /> | Combined rules, noisy-OR score, confidence | [Risk assessment](../intelligence/risk-assessment) |
| Trend projection | US-021 | <CodeLink path="frontend/web/src/engine/forecast.ts" /> | `forecast.test.ts` | <OriginBadge origin="DERIVED" /> | Damped Holt, 80% interval | [Forecasting](../intelligence/forecasting) |
| With and without intervention | US-022 | <CodeLink path="frontend/web/src/engine/intervention.ts" /> | `intervention.test.ts` | <OriginBadge origin="SIMULATED" /> | Noise free projection | [What-if](../intelligence/recommendations#what-if-projection) |
| Rule based recommendations | US-023 | <CodeLink path="frontend/web/src/engine/recommendations.ts" /> | `risk.test.ts`, `comms.test.ts` | <OriginBadge origin="DERIVED" /> | Versioned catalog, autonomy | [Recommendations](../intelligence/recommendations) |
| LLM explanation of a recommendation | US-024 | none | none | | Guarded LLM (planned) | [AI and analytics](../intelligence/ai-and-analytics#planned-llm-explanation-layer) |
| Alerts and acknowledgement | US-025 | <CodeLink path="frontend/web/src/engine/alerts.ts" /> | `alerts.test.ts`, `risk.test.ts` | <OriginBadge origin="DERIVED" /> | Dedupe, auto resolve, escalation | [Alerts](../intelligence/alerts) |
| Audit trail | US-027 | <CodeLink path="frontend/web/src/engine/engine.ts" /> | `alerts.test.ts`, `engine.test.ts`, `comms.test.ts` | <OriginBadge origin="MANUAL" /> | Event log with actor and time | [Governance](../data/governance-and-privacy#audit-trail) |
| Daily check-in and self report | none (v2 addition) | <CodeLink path="frontend/web/src/engine/checkins.ts" /> | `checkins.test.ts` | <OriginBadge origin="SIMULATED, MANUAL" /> | Personal band on 1 to 5 answers | [Self-report](../intelligence/self-report-and-earth-link) |
| Earth link delay | none (v2 addition) | <CodeLink path="frontend/web/src/engine/comms.ts" /> | `comms.test.ts` | <OriginBadge origin="SIMULATED" /> | Light time delay model | [Earth link](../intelligence/self-report-and-earth-link#earth-link) |
| Long term mission days | none (v2 addition) | <CodeLink path="frontend/web/src/engine/missionDays.ts" /> | `missionDays.test.ts` | <OriginBadge origin="SIMULATED" /> | Seeded synthesis plus history | [Mission features](../product/mission-features#mission-overview) |
| Status timeline | none (v2 addition) | <CodeLink path="frontend/web/src/engine/engine.ts" /> | `timeline.test.ts` | <OriginBadge origin="DERIVED" /> | Frames every 15 sim min | [Product tour](../product/product-tour#status-timeline) |

## Product

| Capability | Requirement | Code | Tests | Data | Method | Reference |
| --- | --- | --- | --- | --- | --- | --- |
| Health dashboard (Ground view) | US-014 | <CodeLink path="frontend/web/src/app/App.tsx" /> | `store.test.ts` (state only) | <OriginBadge origin="SIMULATED" /> | | [Product tour](../product/product-tour) |
| Historical series with baseline overlay and gaps | US-015 | <CodeLink path="frontend/web/src/components/TrendChart.tsx" /> | none (UI) | <OriginBadge origin="SIMULATED, DERIVED" /> | | [Product tour](../product/product-tour#region-detail-and-trend-chart) |
| Provenance view | US-016 | <CodeLink path="frontend/web/src/features/datasources/RealDatasetsTab.tsx" /> | none (UI) | <OriginBadge origin="REAL_PUBLIC" /> | | [Data origins](../data/data-origins) |
| Demo scenarios (start, pause, reset) | US-026 | <CodeLink path="frontend/web/src/features/topbar/ScenarioControl.tsx" /> | `engine.test.ts` | <OriginBadge origin="SIMULATED" /> | | [Demo scenarios](../product/demo-scenarios) |
| Final demo (seeded, offline, script) | US-028 | <CodeLink path="frontend/web/src/features/tour/steps.ts" /> | `engine.test.ts` (reproducibility) | <OriginBadge origin="SIMULATED" /> | | [Guided demo](../product/demo-scenarios#guided-demo) |
| FHIR R4 export | Spec 10.3 | <CodeLink path="frontend/web/src/lib/fhir.ts" /> | `fhir.test.ts` | all | Bundle of Patient, Device, Observation | [FHIR export](../product/mission-features#fhir-r4-export) |
| Pseudonymized astronaut registry | US-003 | <CodeLink path="frontend/web/src/engine/catalog.ts" /> | `fhir.test.ts` (no PII) | configuration | | [Governance](../data/governance-and-privacy) |
| Mission and phase | US-004 | <CodeLink path="frontend/web/src/engine/catalog.ts" /> | `comms.test.ts` (mission reference) | configuration | | [Data model](../architecture/data-model) |
| Devices and sources | US-005 | <CodeLink path="frontend/web/src/features/datasources/DevicesTab.tsx" /> | `engine.test.ts` (device states) | <OriginBadge origin="SIMULATED" /> | | [Data dictionary](../data/data-dictionary#simulated-devices) |
| Anatomical atlas viewer (3D body) | none (v3 addition) | <CodeLink path="frontend/web/src/features/anatomy/viewer/AtlasViewer.tsx" /> | none for rendering (visual check on `anatomy-lab.html`) | <OriginBadge origin="SIMULATED, DERIVED" /> | Tissue materials, status highlights, live vitals | [3D anatomy](../architecture/anatomy-3d) |
| Atlas manifest contract | none (v3 addition) | <CodeLink path="frontend/web/src/features/anatomy/atlas/types.ts" /> | `manifest.contract.test.ts`, `validate.mjs` | Z-Anatomy, CC BY-SA 4.0 | Manifest checked against every GLB | [Manifest contract](../architecture/anatomy-3d#manifest-contract) |
| Anatomy to health mapping | none (v3 addition) | <CodeLink path="frontend/web/src/features/anatomy/atlas/health.ts" /> | `health.test.ts`, `manifest.contract.test.ts` | <OriginBadge origin="DERIVED" /> | Structure to region by rule; metrics from the catalog | [Data model](../architecture/data-model#anatomy-to-health-mapping) |
| Structure selection and structure panel | none (v3 addition) | <CodeLink path="frontend/web/src/features/attention/StructureDetail.tsx" /> | `selection.test.ts`, `health.test.ts` (panel components: none, UI) | <OriginBadge origin="SIMULATED, DERIVED" /> | Atomic structure and region selection | [Product tour](../product/product-tour#selecting-a-structure) |
| Alerts and flags per body system | none (v3 addition) | <CodeLink path="frontend/web/src/features/attention/RegionEvents.tsx" /> | `health.test.ts` (region alerts, anomalies, observed value) | <OriginBadge origin="DERIVED" /> | Active alerts by severity, flags of the last 24 h | [Product tour](../product/product-tour#region-detail-and-trend-chart) |
| Per system lazy loading | none (v3 addition) | <CodeLink path="frontend/web/src/features/anatomy/viewer/atlasLoader.ts" /> | none (UI); file list checked by `manifest.contract.test.ts` | Z-Anatomy, CC BY-SA 4.0 | One GLB per system, session cache | [3D anatomy](../architecture/anatomy-3d#loading-strategy-and-offline-constraint) |
| Procedural fallback body | none (v3 addition) | <CodeLink path="frontend/web/src/features/anatomy/AnatomyViewer.tsx" /> | none (visual check, forced on `anatomy-lab.html`) | <OriginBadge origin="SIMULATED, DERIVED" /> | Error boundary, usable manifest check | [3D anatomy](../architecture/anatomy-3d#fallback) |
| Anatomy asset pipeline | none (v3 addition) | <CodeLink path="frontend/web/scripts/anatomy/build.mjs" /> | `validate.mjs` (`npm run anatomy:validate`), `manifest.contract.test.ts` | Z-Anatomy, CC BY-SA 4.0 | Pinned SHA-256, headless Blender, glTF Transform | [3D anatomy assets](../data/anatomy-assets) |
| Female reference model, textures, per astronaut anatomy, eye monitoring (SANS) | none | none | none | | Planned or absent | [Feature status](../overview/feature-status#user-interface), [Roadmap](../resources/roadmap#anatomy-next-steps) |
| Project setup (monorepo, README, lint, tests) | US-001 | <CodeLink path="frontend/web/package.json" /> | CI | | | [Project structure](../engineering/project-structure) |

US-001 is only partly met: there is no backend, no Docker Compose and no `.env.example`, because the prototype has no server.

## Science references

Which hazard and physiological rationale stands behind each monitored signal is documented, with references, in [Monitored physiology](../science/monitored-physiology) and [Scientific references](../science/references).

## Next steps

- [Feature status matrix](../overview/feature-status)
- [Testing strategy](../engineering/testing)
