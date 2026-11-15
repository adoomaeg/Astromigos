---
title: Target Architecture
description: The conceptual target architecture of the Astronaut Health Intelligence Platform from the product spec, a modular monolith with FastAPI, PostgreSQL, an ingestion API and role based access, none of which is implemented yet.
status: CONCEPTUAL
verified: 2026-11-14
---

# Target Architecture

::: warning Conceptual, not implemented
Everything on this page is a **design target** from the product spec (`PROJECT_MASTER.md`, sections 7 and 10). There is no backend, no REST API, no database and no authentication in the current implementation. The running prototype is described in [Architecture overview](./overview).
:::

The Astronaut Health Intelligence Platform (AHI) was built browser first so the hackathon demo is reliable offline, but its contracts (canonical `HealthObservation`, device adapter interface, `data_origin`, versioned rules) were chosen so that a server can be added without changing the engine rules or the UI.

## Architectural decision

**Modular monolith with asynchronous processing** (spec section 7.1): one deployable backend with clear internal modules, background jobs for imports and analytics, and no microservices, Kafka or Kubernetes in the MVP. A language model must not be the core of any clinical decision.

## Context

```mermaid
flowchart LR
    NASA["NASA OSDR / NLSP"] --> ING["Data ingestion"]
    EDA["NASA EDA / RadLab"] --> ING
    DEV["Device adapters<br/>(real or simulated)"] --> ING
    MAN["Manual / CSV import"] --> ING
    ING --> CAN["Canonical health model"]
    CAN --> DB[("PostgreSQL /<br/>TimescaleDB")]
    DB --> ENG["Health intelligence engine"]
    ENG --> API["FastAPI"]
    API --> UI["React dashboard"]
    ENG --> ALERT["Alerts and recommendations"]
    ALERT --> UI
```

<p class="ahi-caption">Conceptual (not implemented). Adapted from the product spec, section 7.3.</p>

## Components

```mermaid
flowchart TB
    subgraph Frontend
      DASH["Mission health dashboard"]
      DETAIL["Astronaut detail"]
      ALERTUI["Alerts center"]
      DATAUI["Data sources"]
      SCEN["Scenario simulator"]
    end
    subgraph Backend
      API["FastAPI"]
      AUTH["Authentication / RBAC"]
      ASTR["Astronaut and mission"]
      DEVICE["Device management"]
      ING["Ingestion"]
      OBS["Observation service"]
      BASE["Baseline service"]
      ANOM["Anomaly detection"]
      PRED["Prediction service"]
      RISK["Risk engine"]
      REC["Recommendation engine"]
      AUDIT["Audit"]
    end
    subgraph Storage
      PG[("PostgreSQL")]
      REDIS[("Redis")]
      RAW[("Raw files")]
    end
    DASH --> API
    DETAIL --> API
    ALERTUI --> API
    DATAUI --> API
    SCEN --> API
    API --> AUTH
    API --> ASTR
    API --> DEVICE
    API --> ING
    ING --> OBS
    ING --> RAW
    OBS --> PG
    BASE --> PG
    ANOM --> PG
    PRED --> PG
    RISK --> PG
    REC --> PG
    AUDIT --> PG
    API --> REDIS
```

<p class="ahi-caption">Conceptual (not implemented). Adapted from the product spec, section 7.4.</p>

## Recommended stack (spec section 7.2)

| Layer | Technology | Status |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite, Tailwind CSS, Recharts | <StatusBadge status="IMPLEMENTED" /> (without shadcn/ui) |
| Backend API | Python + FastAPI, Pydantic schemas | <StatusBadge status="PLANNED" /> |
| ORM and migrations | SQLAlchemy + Alembic | <StatusBadge status="PLANNED" /> |
| Database | PostgreSQL, TimescaleDB optional | <StatusBadge status="PLANNED" /> |
| Cache and jobs | Redis; Celery, RQ or an asyncio worker | <StatusBadge status="PLANNED" /> |
| Data science | pandas, NumPy, SciPy | <StatusBadge status="PLANNED" /> |
| ML and explainability | scikit-learn, XGBoost, SHAP | <StatusBadge status="CONCEPTUAL" /> see [AI and analytics](../intelligence/ai-and-analytics) |
| Tests | pytest, httpx, Playwright | <StatusBadge status="PLANNED" /> (vitest exists for the engine) |
| Observability | OpenTelemetry, structured logs | <StatusBadge status="PLANNED" /> |
| Deployment | Docker Compose | <StatusBadge status="PLANNED" /> |

## Processing flow

```mermaid
sequenceDiagram
    participant Source as NASA / device / simulator
    participant Ingest as Ingestion API
    participant Validator as Validator and normalizer
    participant DB as PostgreSQL
    participant Engine as Intelligence engine
    participant UI as Dashboard
    Source->>Ingest: POST observations
    Ingest->>Validator: Validate payload
    Validator->>Validator: Normalize unit and provenance
    Validator->>DB: Persist observation
    DB-->>Ingest: Accepted
    Ingest-->>Source: 202 Accepted
    DB-->>Engine: Trigger processing job
    Engine->>Engine: Baseline, anomaly, risk
    Engine->>DB: Persist assessment and prediction
    UI->>Ingest: GET health summary
    Ingest->>DB: Read latest state
    DB-->>UI: Health summary
```

<p class="ahi-caption">Conceptual (not implemented). Adapted from the product spec, section 7.5.</p>

## Planned API (spec section 10)

Base URL `http://localhost:8000/api/v1`. All endpoints are <StatusBadge status="PLANNED" />.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/observations` | Ingest a batch of observations for one subject |
| POST | `/datasets/import` | Create an import job |
| GET | `/datasets`, `/data-sources` | List imported datasets and sources |
| POST, GET | `/astronauts` | Create or list pseudonymized astronauts |
| GET | `/astronauts/{id}/health`, `/history`, `/baseline`, `/anomalies`, `/risks`, `/predictions`, `/recommendations` | Per astronaut views |
| POST | `/alerts/{id}/acknowledge` | Acknowledge an alert |
| POST | `/interventions` | Log an intervention |
| POST | `/scenarios/{scenario_id}/run` | Run a simulation |
| GET | `/devices`, `/devices/{id}/status` | Devices |
| GET | `/health/ready`, `/health/live` | Readiness and liveness |

`POST /observations` answers `202 Accepted` with `accepted_count`, `rejected_count` and the batch `data_origin`. The batch format is shown in [Pipeline, normalization and quality](../data/pipeline-and-quality#ingestion-batch-planned-backend).

## Role based access

Planned roles match the personas: crew member, crew medical officer, flight surgeon, Mission Control, researcher and admin or data engineer. Each role sees only what it needs ([Use cases and stakeholders](../overview/use-cases)).

## What carries over from the prototype

| Today | In the target |
| --- | --- |
| `HealthObservation` in `domain.ts` | Pydantic schema with the same fields |
| `DeviceAdapter` (`read()`, `status()`) | Python adapters (`connect`, `disconnect`, `read_observations`, `normalize`, `get_device_status`) |
| Engine modules (baseline, anomaly, risk, forecast, recommendations, alerts) | Backend services with the same rules and versions |
| In-memory audit | Persistent audit table |
| FHIR R4 export in the browser | Same export, server side when needed; FHIR stays an exchange format, not a sensor protocol |

## Next steps

- [Roadmap](../resources/roadmap): the order of these steps.
- [Feature status matrix](../overview/feature-status)
