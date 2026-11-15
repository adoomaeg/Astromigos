---
title: Feature Status Matrix
description: Every capability of the Astronaut Health Intelligence Platform with its implementation status, data origin, documentation page and source code.
verified: 2026-11-14
---

# Feature Status Matrix

One table per area with every capability of the Astronaut Health Intelligence Platform (AHI): what exists in the code, what is experimental, what is planned and what is deliberately absent. Statuses were checked against `frontend/web/src` on the verification date. Hover a badge for its meaning.

| Status | Meaning |
| --- | --- |
| <StatusBadge status="IMPLEMENTED" /> | Present in the code and exercised by the running prototype |
| <StatusBadge status="EXPERIMENTAL" /> | Implemented, but heuristic or resting on made up parameters |
| <StatusBadge status="PLANNED" /> | In the product spec backlog or the roadmap, not in the code |
| <StatusBadge status="CONCEPTUAL" /> | A design idea or target picture only |
| <StatusBadge status="NOT_IMPLEMENTED" /> | Deliberately absent; listed so nobody assumes it exists |

Data origins: <OriginBadge origin="SIMULATED" /> simulator output, <OriginBadge origin="MANUAL" /> typed by a person, <OriginBadge origin="DERIVED" /> computed by the platform, <OriginBadge origin="REAL_PUBLIC" /> public NASA data. See [Data origins](../data/data-origins).

## Data and simulation

| Capability | Status | Origin | Docs | Code |
| --- | --- | --- | --- | --- |
| Device simulators (smart shirt, actigraphy, CEVIS / ARED / T2, dosimeters, cabin sensor, reaction test, intake log) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | [Device simulation](../intelligence/scenario-simulation) | <CodeLink path="frontend/web/src/engine/sim/adapters.ts" /> |
| Six scripted scenarios | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | [Demo scenarios](../product/demo-scenarios) | <CodeLink path="frontend/web/src/engine/sim/scenarios.ts" /> |
| Canonical `HealthObservation` with `data_origin` and quality | <StatusBadge status="IMPLEMENTED" /> | all | [Data model](../architecture/data-model) | <CodeLink path="frontend/web/src/types/domain.ts" /> |
| Metric catalog (21 metrics) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, MANUAL" /> | [Data dictionary](../data/data-dictionary) | <CodeLink path="frontend/web/src/engine/catalog.ts" /> |
| OSDR discovery and import scripts (OSD-569, OSD-575) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="REAL_PUBLIC" /> | [Dataset catalog](../data/dataset-catalog) | <CodeLink path="frontend/web/scripts/osdr/import.mjs" /> |
| Anatomy asset pipeline (`npm run anatomy:build`: Blender headless export, glTF Transform, validation) | <StatusBadge status="IMPLEMENTED" /> | third party asset, CC BY-SA 4.0 | [3D anatomy assets](../data/anatomy-assets) | <CodeLink path="frontend/web/scripts/anatomy/build.mjs" /> |
| Group means of the OSDR panels | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Dataset catalog](../data/dataset-catalog) | <CodeLink path="frontend/web/src/features/datasources/LabPanelView.tsx" /> |
| Real ISS cabin replay from NASA EDA | <StatusBadge status="PLANNED" /> | <OriginBadge origin="REAL_PUBLIC" /> | [Roadmap](../resources/roadmap) | none |
| Real radiation dose series (EDA, RadLab) | <StatusBadge status="PLANNED" /> | <OriginBadge origin="REAL_PUBLIC" /> | [NASA data sources](../data/sources) | none |
| Live connection to ISS devices | <StatusBadge status="NOT_IMPLEMENTED" /> | | [Responsible use](./responsible-use) | none |
| Ingestion API (`POST /api/v1/observations`) | <StatusBadge status="PLANNED" /> | | [Target architecture](../architecture/target-architecture) | none |

## Health intelligence

| Capability | Status | Origin | Docs | Code |
| --- | --- | --- | --- | --- |
| Personal baseline (median, MAD, p05 / p95, context buckets) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Personal baseline](../intelligence/personal-baseline) | <CodeLink path="frontend/web/src/engine/baseline.ts" /> |
| Robust z-score (acute deviation) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Anomaly detection](../intelligence/anomaly-detection) | <CodeLink path="frontend/web/src/engine/anomaly.ts" /> |
| EWMA drift | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Anomaly detection](../intelligence/anomaly-detection#ewma-drift) | <CodeLink path="frontend/web/src/engine/stats.ts" /> |
| Daily persistence windows | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Anomaly detection](../intelligence/anomaly-detection#daily-persistence) | <CodeLink path="frontend/web/src/engine/anomaly.ts" /> |
| Data quality and staleness (`NO_DATA`) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Anomaly detection](../intelligence/anomaly-detection#data-quality) | <CodeLink path="frontend/web/src/engine/anomaly.ts" /> |
| Fixed demo thresholds (safety net) | <StatusBadge status="IMPLEMENTED" /> | | [Thresholds](../intelligence/thresholds) | <CodeLink path="frontend/web/src/engine/config.ts" /> |
| Combined rules (R-CARD-01, R-FAT-01, R-ENV-CO2-02) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Risk assessment](../intelligence/risk-assessment#combined-rules) | <CodeLink path="frontend/web/src/engine/risk.ts" /> |
| Rule based risk score 0 to 100 and confidence | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Risk assessment](../intelligence/risk-assessment) | <CodeLink path="frontend/web/src/engine/risk.ts" /> |
| Damped Holt forecast with 80% interval | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Forecasting](../intelligence/forecasting) | <CodeLink path="frontend/web/src/engine/forecast.ts" /> |
| Band exit time and recovery rule | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Forecasting](../intelligence/forecasting#band-exit-and-recovery) | <CodeLink path="frontend/web/src/engine/forecast.ts" /> |
| Versioned recommendation catalog and autonomy | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Recommendations](../intelligence/recommendations) | <CodeLink path="frontend/web/src/engine/recommendations.ts" /> |
| What-if projection (with and without an action) | <StatusBadge status="EXPERIMENTAL" /> | <OriginBadge origin="SIMULATED" /> | [Recommendations](../intelligence/recommendations#what-if-projection) | <CodeLink path="frontend/web/src/engine/intervention.ts" /> |
| Alerts, deduplication, auto resolve, escalation | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Alerts](../intelligence/alerts) | <CodeLink path="frontend/web/src/engine/alerts.ts" /> |
| Daily check-in and self report rules | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, MANUAL" /> | [Self-report and Earth link](../intelligence/self-report-and-earth-link) | <CodeLink path="frontend/web/src/engine/checkins.ts" /> |
| Earth link delay model and simulated ground replies | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | [Self-report and Earth link](../intelligence/self-report-and-earth-link#earth-link) | <CodeLink path="frontend/web/src/engine/comms.ts" /> |
| Long term mission days (older days synthesized) | <StatusBadge status="EXPERIMENTAL" /> | <OriginBadge origin="SIMULATED" /> | [Mission features](../product/mission-features#mission-overview) | <CodeLink path="frontend/web/src/engine/missionDays.ts" /> |
| IQR outlier rule | <StatusBadge status="NOT_IMPLEMENTED" /> | | [Methods status](../intelligence/overview#methods-status) | none |
| CUSUM change detection | <StatusBadge status="NOT_IMPLEMENTED" /> | | [Methods status](../intelligence/overview#methods-status) | none |
| Isolation Forest (multivariate anomaly) | <StatusBadge status="PLANNED" /> | | [AI and analytics](../intelligence/ai-and-analytics) | none |
| ARIMA, XGBoost, SHAP | <StatusBadge status="NOT_IMPLEMENTED" /> | | [AI and analytics](../intelligence/ai-and-analytics) | none |
| LLM explanation of a selected recommendation | <StatusBadge status="PLANNED" /> | | [AI and analytics](../intelligence/ai-and-analytics#planned-llm-explanation-layer) | none |
| Sensor based activity recognition | <StatusBadge status="CONCEPTUAL" /> | | [Limitations](../validation/limitations) | none |

## User interface

| Capability | Status | Origin | Docs | Code |
| --- | --- | --- | --- | --- |
| Ground view (whole crew) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | [Product tour](../product/product-tour) | <CodeLink path="frontend/web/src/app/App.tsx" /> |
| Crew view (one astronaut, plain language) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | [Product tour](../product/product-tour#ground-view-and-crew-view) | <CodeLink path="frontend/web/src/features/crewview/CrewView.tsx" /> |
| Anatomical atlas viewer (Z-Anatomy, 250 structures, status highlights, live heart beat and breathing) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | [3D anatomy](../architecture/anatomy-3d) | <CodeLink path="frontend/web/src/features/anatomy/viewer/AtlasViewer.tsx" /> |
| System layers, preset views and skin opacity | <StatusBadge status="IMPLEMENTED" /> | | [3D anatomy](../architecture/anatomy-3d#interaction) | <CodeLink path="frontend/web/src/features/anatomy/viewer/SystemControls.tsx" /> |
| Structure selection and structure panel (monitored or context only) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | [Product tour](../product/product-tour#selecting-a-structure) | <CodeLink path="frontend/web/src/features/attention/StructureDetail.tsx" /> |
| Anatomy to health mapping (structure, region, metrics) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Data model](../architecture/data-model#anatomy-to-health-mapping) | <CodeLink path="frontend/web/src/features/anatomy/atlas/health.ts" /> |
| Alerts and statistical flags per body system in the detail panel | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Product tour](../product/product-tour#region-detail-and-trend-chart) | <CodeLink path="frontend/web/src/features/attention/RegionEvents.tsx" /> |
| Per system lazy loading of the atlas (one GLB per system, session cache) | <StatusBadge status="IMPLEMENTED" /> | | [3D anatomy](../architecture/anatomy-3d#loading-strategy-and-offline-constraint) | <CodeLink path="frontend/web/src/features/anatomy/viewer/atlasLoader.ts" /> |
| Procedural fallback body when the atlas is unavailable | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | [3D anatomy](../architecture/anatomy-3d#fallback) | <CodeLink path="frontend/web/src/features/anatomy/procedural/ProceduralViewer.tsx" /> |
| Female reference model | <StatusBadge status="PLANNED" /> | | [Roadmap](../resources/roadmap#anatomy-next-steps) | none (one reference model for every crew member today) |
| Textures on the anatomy | <StatusBadge status="PLANNED" /> | | [Roadmap](../resources/roadmap#anatomy-next-steps) | none (the source model has none) |
| Per astronaut anatomy (scans, body size) | <StatusBadge status="NOT_IMPLEMENTED" /> | | [3D anatomy](../architecture/anatomy-3d#limitations) | none |
| Body system detail and trend chart with personal band | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | [Product tour](../product/product-tour#region-detail-and-trend-chart) | <CodeLink path="frontend/web/src/components/TrendChart.tsx" /> |
| Status timeline with event markers | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Product tour](../product/product-tour#status-timeline) | <CodeLink path="frontend/web/src/features/timeline/index.tsx" /> |
| Alerts drawer, critical banner, optional sound | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | [Product tour](../product/product-tour#alerts-drawer) | <CodeLink path="frontend/web/src/features/alerts/Alerts.tsx" /> |
| Mission overview (dose, exercise, sleep) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | [Mission features](../product/mission-features#mission-overview) | <CodeLink path="frontend/web/src/features/mission/index.tsx" /> |
| Shift handover report | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, MANUAL" /> | [Mission features](../product/mission-features#shift-handover-report) | <CodeLink path="frontend/web/src/features/report/index.tsx" /> |
| FHIR R4 export (Patient, Device, Observation) | <StatusBadge status="IMPLEMENTED" /> | all | [Mission features](../product/mission-features#fhir-r4-export) | <CodeLink path="frontend/web/src/lib/fhir.ts" /> |
| Data and model dialog (real datasets, devices, model card, origins) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="REAL_PUBLIC, DERIVED" /> | [Mission features](../product/mission-features#data-and-model) | <CodeLink path="frontend/web/src/features/datasources/DataModelDialog.tsx" /> |
| 10 step guided demo | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | [Demo scenarios](../product/demo-scenarios#guided-demo) | <CodeLink path="frontend/web/src/features/tour/steps.ts" /> |
| Presentation mode and keyboard shortcuts | <StatusBadge status="IMPLEMENTED" /> | | [Design system](../product/design-system) | <CodeLink path="frontend/web/src/app/shortcuts.tsx" /> |
| Eye monitoring (SANS); the eyes are context only structures today | <StatusBadge status="PLANNED" /> | | [Roadmap](../resources/roadmap) | none |
| Flight surgeon review queue | <StatusBadge status="PLANNED" /> | | [Roadmap](../resources/roadmap) | none |
| Hosted web app for judges | <StatusBadge status="PLANNED" /> | | [Roadmap](../resources/roadmap) | none |

## Platform and operations

| Capability | Status | Docs | Code |
| --- | --- | --- | --- |
| Browser only runtime (no external service; only the app's own static files) | <StatusBadge status="IMPLEMENTED" /> | [Architecture overview](../architecture/overview) | <CodeLink path="frontend/web/src/state/store.ts" /> |
| Backend (Python, FastAPI, Pydantic) | <StatusBadge status="PLANNED" /> | [Target architecture](../architecture/target-architecture) | none |
| Database (PostgreSQL, optional TimescaleDB) | <StatusBadge status="PLANNED" /> | [Target architecture](../architecture/target-architecture) | none |
| Authentication and role based access | <StatusBadge status="PLANNED" /> | [Target architecture](../architecture/target-architecture) | none |
| Persistent audit trail | <StatusBadge status="PLANNED" /> | [Governance](../data/governance-and-privacy) | none (in memory today) |
| Unit and scenario tests (143 tests, 17 files) | <StatusBadge status="IMPLEMENTED" /> | [Testing](../engineering/testing) | <CodeLink path="frontend/web/src/engine/engine.test.ts" /> |
| Headless evaluation of the engine | <StatusBadge status="IMPLEMENTED" /> | [Results](../validation/results) | <CodeLink path="frontend/web/scripts/evaluate.ts" /> |
| End to end browser tests | <StatusBadge status="PLANNED" /> | [Testing](../engineering/testing) | none |
| CI and documentation deployment (GitHub Actions, GitHub Pages) | <StatusBadge status="IMPLEMENTED" /> | [Deployment](../engineering/deployment) | <CodeLink path=".github/workflows/docs-deploy.yml" /> |

## Next steps

- [Traceability matrix](../validation/traceability): capability, requirement, code, tests and data in one table.
- [Roadmap](../resources/roadmap): order of the planned items.
