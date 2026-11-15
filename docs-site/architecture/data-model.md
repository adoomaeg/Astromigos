---
title: Data Model & Contracts
description: The canonical HealthObservation, the domain entities with an ER diagram, the enumerations, the anatomy to health mapping and the selection contract of the Astronaut Health Intelligence Platform.
status: IMPLEMENTED
code:
  - frontend/web/src/types/domain.ts
  - frontend/web/src/engine/sim/adapters.ts
  - frontend/web/src/features/anatomy/atlas/health.ts
  - frontend/web/src/features/anatomy/atlas/types.ts
  - frontend/web/src/state/store.ts
tests:
  - frontend/web/src/features/anatomy/atlas/health.test.ts
  - frontend/web/src/state/selection.test.ts
verified: 2026-11-14
---

# Data Model & Contracts

The single source of truth for the data contracts of the Astronaut Health Intelligence Platform (AHI) is `frontend/web/src/types/domain.ts`, shared by the engine, the store and every UI feature. It follows section 6 of `PROJECT_MASTER.md`. The list of metric codes, units and regions is in the [Data dictionary](../data/data-dictionary).

::: warning Additive changes only
`domain.ts` is a shared contract. Add new optional fields or new union members; never rename or remove fields that other modules use. TypeScript `enum` is not allowed (`erasableSyntaxOnly`), so enumerations are string unions.
:::

## HealthObservation (canonical model)

One record per measurement. Vitals, cabin readings (`subject_id: "CABIN"`), lab results and self report all use the same shape.

```json
{
  "observation_id": "uuid or an idempotent key from the source",
  "subject_id": "AST-01",
  "mission_id": "MISSION-001",
  "device_id": "DEV-BIO-AST-01",
  "metric_code": "HEART_RATE",
  "value": 72.4,
  "unit": "bpm",
  "measured_at": "2026-11-13T14:30:00Z",
  "received_at": "2026-11-13T14:30:02Z",
  "data_origin": "SIMULATED",
  "source_reference": {
    "repository": null,
    "dataset_accession": null,
    "file_name": null,
    "record_reference": null
  },
  "quality": { "status": "VALID", "confidence": 1.0, "is_estimated": false },
  "context": { "mission_phase": "IN_FLIGHT", "activity": "REST" },
  "metadata": {}
}
```

| Field | Required | Type | Rules |
| --- | --- | --- | --- |
| `observation_id` | yes | string | Unique. Use an idempotent key from the source to deduplicate |
| `subject_id` | yes | string | Pseudonym (`AST-01`...), or `"CABIN"` for the environment |
| `mission_id` | recommended | string | Mission or study |
| `device_id` | recommended | string | Logical device or instrument |
| `metric_code` | yes | `MetricCode` | One of the codes in the [Data dictionary](../data/data-dictionary) |
| `value` | yes | number or `null` | **`null` when missing, never zero** |
| `unit` | yes | string | Canonical unit after normalization |
| `measured_at` | yes | ISO 8601 UTC | Always UTC |
| `received_at` | recommended | ISO 8601 UTC | Ingestion time |
| `data_origin` | yes | `DataOrigin` | `REAL_PUBLIC`, `DERIVED`, `SIMULATED` or `MANUAL` |
| `source_reference` | yes if imported | object | Repository, accession, file and record |
| `quality.status` | yes | `QualityStatus` | `VALID`, `QUESTIONABLE`, `INVALID`, `MISSING` |
| `quality.confidence` | recommended | 0 to 1 | Lower for estimated or doubtful values |
| `quality.is_estimated` | recommended | boolean | `true` for derived or interpolated values |
| `context.mission_phase` | recommended | `MissionPhase` | `PRE_FLIGHT`, `IN_FLIGHT`, `POST_FLIGHT` |
| `context.activity` | recommended | `ActivityContext` | `SLEEP`, `REST`, `WORK`, `EXERCISE`, `EVA` |
| `metadata` | optional | object | Original value and unit, time point label, population type |

Rules from the spec: store timestamps in UTC, normalize units without deleting the original value, never replace a missing value with zero, record quality and source for every imported record, and deduplicate by `observation_id`.

## Entities

```mermaid
erDiagram
    ASTRONAUT ||--o{ DEVICE : "assigned"
    ASTRONAUT ||--o{ HEALTH_OBSERVATION : "subject of"
    DEVICE ||--o{ HEALTH_OBSERVATION : "produces"
    ASTRONAUT ||--o{ METRIC_STATE : "has"
    METRIC_STATE ||--o| BASELINE : "compared with"
    ASTRONAUT ||--o{ ANOMALY : "has"
    ASTRONAUT ||--|| RISK_ASSESSMENT : "current"
    ASTRONAUT ||--o{ PREDICTION : "has"
    RISK_ASSESSMENT ||--o{ RECOMMENDATION : "suggests"
    RECOMMENDATION ||--o{ INTERVENTION : "may log"
    ASTRONAUT ||--o{ ALERT : "receives"
    ASTRONAUT ||--o{ CHECK_IN : "answers"
    ASTRONAUT ||--o{ COMM_MESSAGE : "about"
    ASTRONAUT ||--o{ MISSION_DAY_SUMMARY : "per day"
    MISSION ||--o{ ASTRONAUT : "crew"
```

| Entity | Purpose | Key fields |
| --- | --- | --- |
| `Astronaut` | Pseudonymized crew member | `id` (`AST-01`), `callsign`, `role`, `roleShort`, `age`, `sex`, `missionDay`, `color` |
| `Mission` | Mission and phase | `id`, `name`, `vehicle`, `phase`, `startedAt`, `commDelaySec` (one way) |
| `Device` | Logical device and its state | `id`, `kind`, `name`, `assignedTo`, `state`, `batteryPct`, `signalPct`, `lastSeenAt`, `data_origin`, `metrics`, `detail` |
| `MetricState` | Latest state of one metric for one subject | `current`, `status`, `zScore`, `ewma`, `trendPerHour`, `baseline`, `quality`, `driftZ`, `deviationPct`, `persistenceHours`, `baselineContext`, `contextBaselines`, `ruleId`, `explanation` |
| `Baseline` | Personal normal for one metric | `status` (`READY` or `INSUFFICIENT_DATA`), `n`, `median`, `mad`, `mean`, `sd`, `p05`, `p95`, `low`, `high`, `windowLabel`, `version` |
| `Anomaly` | A detected deviation | `metric`, `detectedAt`, `method` (`ROBUST_Z`, `EWMA`, `PERSISTENCE`, `COMBINED`, `DATA_QUALITY`), `severity`, `explanation` |
| `RiskAssessment` | Attention level of one astronaut | `risk_level`, `risk_score` (0 to 100), `contributing_factors`, `triggered_rules`, `confidence`, `model_version`, `evaluated_at`, `data_window`, `limitations`, `headline` |
| `Prediction` | Short term forecast of one metric | `method`, `horizonHours`, `points` (`t`, `v`, `lo`, `hi`), `intervalLabel`, `hoursToBandExit`, `eligible`, `disclaimer` |
| `Recommendation` | Non-prescriptive next step | `ruleId`, `title`, `rationale`, `priority`, `audience`, `region`, `requiresHumanReview`, `status`, `interventionKind`, `active`, `catalogVersion`, `autonomy` |
| `Intervention` | An action logged by a person | `kind`, `recommendationId`, `loggedAt`, `actor`, `note` |
| `Alert` | Notification with acknowledgement | `severity`, `title`, `detail`, `region`, `metric`, `ruleId`, `createdAt`, `acknowledgedAt`, `acknowledgedBy`, `resolvedAt`, `escalatedAt`, `escalationLevel` |
| `AuditEvent` | Audit trail entry | `at`, `actor`, `action`, `detail` |
| `CheckIn` | Daily subjective check-in | `mood`, `fatigue`, `stress`, `sleepQuality` (1 to 5), `symptoms`, `note`, `data_origin` |
| `CommMessage` | Message between vehicle and Earth | `direction`, `kind`, `title`, `body`, `sentAt`, `arrivesAt`, `status`, `relatedRecommendationId`, `relatedAlertId`, `data_origin` |
| `MissionDaySummary` | One mission day for the long term view | `missionDay`, `date`, `sleepHours`, `exerciseMinutes`, `exercisePlannedMinutes`, `restingHr`, `hrv`, `radiationDoseMgy`, `cumulativeDoseMgy`, `riskLevel`, `exerciseLoadPct`, `synthesized` |
| `MissionPlan` | Long term budgets (demo configuration) | `plannedDurationDays`, `radiationBudgetMgy`, `exercisePlanMinutesPerDay`, `sleepTargetHours`, `note` |
| `StatusFrame` | Snapshot for the timeline, every 15 sim minutes | `t`, `levels` (astronaut id or `CABIN` to status) |
| `InterventionComparison` | What-if result | `metric`, `kind`, `horizonHours`, `without`, `with`, `band`, `assumptions`, `disclaimer` |
| `DatasetRecord` | Provenance of a real public dataset | `source_name`, `source_url`, `dataset_accession`, `dataset_version`, `title`, `downloaded_at`, `license`, `access_classification`, `file_name`, `sha256`, `parser_version`, `study_population`, `mission`, `study_design`, `collection_phase`, `notes`, `data_origin` |

Other shared types: `RegionState` (status and summary per body region), `AstronautHealth` (activity, metrics, regions, risk, predictions), `EnvironmentState` (cabin metrics, status, forecasts, headline), `ScenarioDefinition`, `SimulationClock`, `CommProfile`, `EngineEvaluation`, and the store contract `AppState` / `AppStateV2`.

## Enumerations

| Type | Values | Notes |
| --- | --- | --- |
| `DataOrigin` | `REAL_PUBLIC`, `DERIVED`, `SIMULATED`, `MANUAL` | Required on every record. See [Data origins](../data/data-origins) |
| `QualityStatus` | `VALID`, `QUESTIONABLE`, `INVALID`, `MISSING` | Questionable data is capped at MODERATE |
| `RiskLevel` | `LOW`, `MODERATE`, `HIGH`, `CRITICAL` | Operational attention level, not a medical classification |
| `Status` | `RiskLevel` plus `NO_DATA` | `NO_DATA` covers stale data and offline devices |
| `MissionPhase` | `PRE_FLIGHT`, `IN_FLIGHT`, `POST_FLIGHT` | |
| `ActivityContext` | `SLEEP`, `REST`, `WORK`, `EXERCISE`, `EVA` | Baselines use `SLEEP`, `REST`, `WORK`, `EXERCISE`. Context comes from the schedule today |
| `DeviceKind` | `BIO_MONITOR`, `ACTIGRAPHY`, `BP_MONITOR`, `EXERCISE_CEVIS`, `EXERCISE_ARED`, `EXERCISE_T2`, `ENV_SENSOR`, `DOSIMETER` | |
| `DeviceState` | `ONLINE`, `DEGRADED`, `DATA_STALE`, `OFFLINE` | Degraded values are `QUESTIONABLE` |
| `BodyRegionId` | `brain`, `heart`, `lungs`, `kidneys`, `muscles`, `bones`, `skin` | Plus `environment` for cabin metrics |
| `InterventionKind` | `REST_PROTOCOL`, `SLEEP_EXTENSION`, `HYDRATION`, `EXERCISE_ADJUSTMENT`, `SENSOR_CHECK`, `CABIN_VENTILATION`, `MEDICAL_CONSULT` | |
| `Recommendation.audience` | `CREW`, `FLIGHT_SURGEON`, `MISSION_CONTROL` | |
| `Recommendation.autonomy` | `ONBOARD`, `GROUND_REVIEW` | Who can close the loop |
| `AuditEvent.action` | `ALERT_ACK`, `INTERVENTION_LOGGED`, `SCENARIO_CHANGED`, `RULE_EVALUATED`, `RECOMMENDATION_UPDATED`, `ALERT_ESCALATED`, `COMM_SENT`, `COMM_RECEIVED`, `COMM_PROFILE_CHANGED`, `CHECKIN_RECORDED` | |
| `CommProfileId` | `ISS`, `MOON`, `MARS_NEAR`, `MARS_FAR` | |
| `CommMessage.kind` | `HEALTH_PACKET`, `CONSULT_REQUEST`, `GROUND_REPLY`, `HANDOVER_REPORT` | Direction `DOWNLINK` (to Earth) or `UPLINK` (to the vehicle) |
| `ScenarioId` | `NOMINAL`, `PROGRESSIVE_FATIGUE`, `ENVIRONMENTAL_CO2`, `PERFORMANCE_DECLINE`, `SENSOR_FAILURE`, `ACUTE_CARDIO` | See [Demo scenarios](../product/demo-scenarios) |

## Anatomy to health mapping {#anatomy-to-health-mapping}

The 3D atlas has 250 anatomical structures; the platform monitors seven body regions. One file, `src/features/anatomy/atlas/health.ts`, decides which region a structure reports under. It is the **only place that links anatomy to health data**: it reuses `BodyRegionId` and the metric catalog and adds no data of its own. This table is the canonical copy of that mapping.

| Structures (rule) | Region | Related metrics (from the catalog) | In the atlas | How to read it |
| --- | --- | --- | --- | --- |
| Integumentary system: skin | `skin` | `SKIN_TEMPERATURE` | 1 | One surface reading from the smart shirt. It is not a map of the whole skin |
| Skeletal system: bones and cartilage | `bones` | `RADIATION_DOSE` | 39 | Accumulated dose is whole body exposure, shown as long term bone health context. No device measures bone density |
| Skeletal system: teeth (tissue `tooth`) | none | none | 2 | **Context only** |
| Muscular system: muscles and tendons | `muscles` | `ACTIVITY_LEVEL`, `EXERCISE_LOAD` | 133 | Activity and exercise performance describe the muscles as a whole. They are not measurements of the selected muscle |
| Cardiovascular system: heart, arteries, veins | `heart` | `HEART_RATE`, `HRV_RMSSD`, `SYSTOLIC_BP`, `DIASTOLIC_BP` | 29 | They describe the heart and circulation as a whole, not one vessel |
| Respiratory system: lungs, airways, larynx, diaphragm | `lungs` | `SPO2`, `RESPIRATORY_RATE` | 6 | They describe breathing and gas exchange as a whole |
| Nervous system: brain structures only (cortex, deep structures of the cerebrum, cerebellum, brainstem) | `brain` | `SLEEP_DURATION`, `SLEEP_EFFICIENCY`, `REACTION_TIME`, `MOOD`, `PERCEIVED_FATIGUE`, `STRESS` | 4 | **Related indicators** of alertness and recovery. They are behavioral and self reported signals, never neurological measurements |
| Nervous system: spinal cord and nerves | none | none | 13 | **Context only** |
| Urinary system: kidneys (tissue `kidney`) | `kidneys` | `HYDRATION` | 2 | Hydration index estimated from fluid intake logs. A **related indicator**, not a measurement of kidney function |
| Urinary system: ureters and bladder | none | none | 2 | **Context only** |
| Digestive system; other organs (glands, thymus, spleen, eyes) | none | none | 19 | **Context only** |

Rules of the mapping:

- **Related indicators, not measurements.** A metric belongs to a region, never to one structure. The structure panel says so in plain words for every region (`REGION_RELATION`), so an indicator is never read as a measurement of the selected structure, and never as a diagnosis.
- **Context only** means no device or metric of the prototype relates to the structure. It can be explored, but it never shows a health status, not even "All good": no status is shown because nothing is measured, which is not the same as normal.
- **Metrics always come from the catalog.** `relatedMetrics()` returns the codes whose `region` in `METRIC_CATALOG` matches; the mapping file never lists or invents indicators. Metric definitions: [Data dictionary](../data/data-dictionary).
- **Missing data is never normal.** A monitored structure whose astronaut has no health state yet is `NO_DATA`.
- **The manifest holds anatomy only.** The asset pipeline never encodes monitoring rules, so the atlas can be rebuilt without touching health logic.

Main functions (all pure TypeScript, unit tested in `health.test.ts`):

| Function | Returns |
| --- | --- |
| `regionOfStructure(s)` | The `BodyRegionId` a structure reports under, or `null` when it is context only |
| `isContextOnly(s)` | `true` when nothing monitors the structure |
| `relatedMetrics(s)`, `metricsOfRegion(region)` | Catalog metric codes of the region |
| `structureStatus(health, s)` | Status of the structure's region, `NO_DATA` when health is missing, `null` when context only |
| `primaryStructureOfRegion(manifest, region)` | The organ a region is named after (camera target); `null` for muscles and bones on purpose |
| `selectStructureHealth(state, astronautId, s)` | Everything the panel shows: region, status, summary, metrics, missing metrics, active alerts and recent statistical flags |
| `regionAlerts(...)`, `regionAnomalies(...)` | Active alerts (most severe first) and anomalies (newest first) of one astronaut in one region |

## Selection contract {#selection-contract}

The app store keeps one selection that every panel and the 3D viewer share. The structure fields are additive (marked "Additive (v3, anatomical atlas)" in `domain.ts`).

| State or action | Behavior |
| --- | --- |
| `selectedStructureId` (string or `null`) | Id of the structure selected in the 3D viewer. `null` when only a region, or nothing, is selected |
| `selectStructure(id, region?)` | Sets the structure and its region **in one update** and clears the selected metric. For a context only structure the region is `null`. `selectStructure(null)` clears structure, region and metric |
| `selectRegion(region)` | Selects the whole region and clears the structure (a body system chip always means the whole region) |
| `selectAstronaut(id)` | Clears structure, region and metric |
| `selectMetric(metric)` | Keeps the structure and the region |

- The viewer calls `selectStructure(id, regionOfStructure(structure))`, so a structure and its region can never disagree.
- Alerts, factors and vitals use `focusTarget()` (`src/features/shared/hooks.ts`): it selects the region and clears a structure of another region, but keeps a structure of the same region and only opens the metric.
- `Esc` and the **Overview** button clear the selection (`clearSelection()`).
- A clock tick never touches the selection.

Covered by `src/state/selection.test.ts` (13 tests).

## Contracts between modules

| Contract | Rule |
| --- | --- |
| `domain.ts` | Additive changes only: new optional fields or new union members; never rename or remove a used field |
| Device adapter | `id`, `kind`, `name`, `assignedTo`, `metrics`, `read(simNow)` returning `HealthObservation[]`, optional `readEvents(from, to)`, `status(simNow)` ([Extending](../engineering/contributing#add-a-device-adapter)) |
| Engine to store | `EngineEvaluation` slices with a version per slice; unchanged slices keep their references |
| Store to UI | `AppState` / `AppStateV2` (state plus actions), including the [selection contract](#selection-contract) |
| Asset pipeline to viewer | `AtlasManifest` in `public/anatomy/manifest.json` ([Manifest contract](./anatomy-3d#manifest-contract)) |
| Anatomy to health | `atlas/health.ts` only ([Anatomy to health mapping](#anatomy-to-health-mapping)) |
| Export | FHIR R4 `Bundle` (`collection`) with `Patient`, `Device`, `Observation` ([FHIR export](../product/mission-features#fhir-r4-export)) |

The planned REST API that would expose the same entities is described in [Target architecture](./target-architecture).

## Next steps

- [Data dictionary](../data/data-dictionary): every metric code.
- [Data origins and provenance](../data/data-origins)
- [Engine and simulation](./engine-and-simulation)
- [3D anatomy rendering](./anatomy-3d): the viewer that uses the mapping.
