---
title: Frontend & State
description: How the React frontend of the Astronaut Health Intelligence Platform is organized, the app shell, feature modules, the zustand stores and the rendering and layout decisions.
status: IMPLEMENTED
code:
  - frontend/web/src/app/App.tsx
  - frontend/web/src/app/uiStore.ts
  - frontend/web/src/app/shortcuts.tsx
  - frontend/web/src/state/store.ts
  - frontend/web/src/index.css
tests:
  - frontend/web/src/state/store.test.ts
  - frontend/web/src/state/selection.test.ts
verified: 2026-11-14
---

# Frontend & State

The user interface of the Astronaut Health Intelligence Platform (AHI) is a single page React 19 application in `frontend/web/src`, built with Vite 8 and styled with Tailwind CSS v4.

## App shell

`src/app/App.tsx` starts the ticker, registers global shortcuts and the critical alert sound, and renders one of two views over the same live state:

| View | Layout | For |
| --- | --- | --- |
| **Ground view** | Top bar; crew rail, center stage (headline and 3D body), attention panel; status timeline; vitals strip | Flight surgeon and Mission Control |
| **Crew view** | One astronaut, big status word, top two actions, check-in, "Your body vs your normal" | The astronaut |

The reading order of the Ground view is deliberate: who (crew) > what (body and headline) > why and what to do (attention panel) > when (timeline) > live values (vitals). Overlays (alerts drawer, shortcuts help, guided tour) sit on top of either view. A "Skip to what needs attention" link is the first focusable element.

## Feature modules

| Folder | Content |
| --- | --- |
| `features/topbar` | Identity, SIMULATED chip and provenance popover, scenario player, Earth link control, tools menu, priority collapse on narrow widths |
| `features/crew` | Crew rail cards |
| `features/stage` | Center stage: headline, body system chips, lazy 3D viewer |
| `features/anatomy` | 3D body: atlas viewer, health mapping, procedural fallback ([3D anatomy](./anatomy-3d)) |
| `features/attention` | Overall status, recommended actions, autonomy badges, factors, forecasts, region detail, structure detail, alerts and flags per body system |
| `features/shared` | Shared hooks and selection helpers (`focusTarget`, `clearSelection`, `useSelectedStructure`) |
| `features/timeline` | Status lanes and event markers |
| `features/vitals` | Live vitals, cabin, devices indicator |
| `features/alerts` | Alerts drawer, banner support, optional chime |
| `features/comms` | Earth link drawer and delay phrases |
| `features/checkin` | Daily check-in dialog |
| `features/crewview` | Crew view |
| `features/mission` | Mission overview |
| `features/report` | Shift handover report and FHIR export button |
| `features/whatif` | What-if comparison |
| `features/datasources` | Data and model dialog (real datasets, simulated devices, model card, data origins) |
| `features/tour` | 10 step guided demo |
| `features/lab` | Development only lab page with fake state |
| `components/` | Shared pieces: trend chart, sparkline, risk gauge, status, metric value, baseline info, formatting |
| `lib/` | `status.ts` (status colors and labels), `fhir.ts` (FHIR R4 export) |

## State

Two zustand stores keep domain state and UI preferences apart.

### App store (`src/state/store.ts`)

Implements the `AppState` contract of `src/types/domain.ts` (plus the additive v2 slices). It owns one `HealthEngine`.

| Slice group | Content |
| --- | --- |
| Reference | `mission`, `crew`, `devices`, `scenarios`, `commProfiles`, `missionPlan` |
| Clock | `clock` (`scenarioId`, `running`, `speed`, `simNow`, `startedAt`) |
| Analytics | `health` (per astronaut: metrics, regions, risk, predictions), `environment`, `history`, `anomalies`, `alerts`, `recommendations`, `interventions`, `audit` |
| v2 | `comms`, `checkIns`, `missionDays`, `statusTimeline`, `commProfileId` |
| Selection | `selectedAstronautId`, `selectedRegion`, `selectedMetric`, `selectedStructureId` with `selectAstronaut`, `selectRegion`, `selectMetric`, `selectStructure` ([selection contract](./data-model#selection-contract)) |
| Actions | `setScenario`, `play`, `pause`, `setSpeed`, `reset`, `acknowledgeAlert`, `logIntervention`, `dismissRecommendation`, `fastForward`, `setCommProfile`, `sendToGround`, `submitCheckIn`, `compareIntervention` |

**Publishing model.** A ticker (`startTicker()`, every 100 ms real time) advances the sim clock. Analytics are re-evaluated at most every 250 ms real time, and only slices whose engine version changed get new object references. Components subscribe with narrow selectors and re-render only when their own data changes. Details: [Engine and simulation](./engine-and-simulation#simulation-clock-and-publishing).

### UI store (`src/app/uiStore.ts`)

View mode (Ground or Crew), presentation mode, alert sound preference, alerts drawer and shortcuts help visibility, critical banners hidden by the user, and guided tour state. View, presentation and sound persist in `localStorage`; if storage is unavailable, preferences simply do not persist.

## Rendering decisions

| Decision | Why |
| --- | --- |
| Slice versioning plus narrow selectors | A publication every 250 ms does not re-render the whole tree |
| 3D scene reads vitals from the store without subscribing | Animation every frame with zero React renders |
| Floating 3D labels are plain DOM positioned by a projector | Crisp text, no per frame React work |
| Lazy chunks for the 3D viewer, Data and model dialog and OSDR panels | Faster first paint |
| The 3D atlas is one file per anatomical system, fetched on demand and cached for the session | The default view downloads about 3 MB; switching astronaut never reloads geometry |
| The right panel has three levels: structure, body region, overview | A structure selected in the 3D body reuses the region detail, so the data is shown one way only |
| `fastForward(simMs)` | The guided demo jumps the simulation synchronously (for example to sim hour 48 of the fatigue scenario) |

## Layout modes

Pure CSS (no JavaScript) screen modes defined in `src/index.css`:

| Mode | When | What changes |
| --- | --- | --- |
| Short | Desktop width with a viewport height up to 820 px (for example 1280x720) | Timeline becomes a slim ribbon that expands on hover or focus, vitals drop sparklines, crew cards become compact rows |
| Default | Typical laptop and desktop | Full layout |
| Roomy | 1680x1000 and larger | Wider attention panel, taller timeline, an extra crew vital, all forecasts expanded |
| Presentation | `P` or Tools menu | Text floor of 13 px, larger type, secondary details hidden |

Visual language, colors and accessibility measures: [Design system and accessibility](../product/design-system).

## Status

<StatusBadge status="IMPLEMENTED" /> Covered by `store.test.ts` (v2 slices published, references stable when unchanged, actions wired) and `selection.test.ts` (structure, region and metric selection). UI components have no automated tests yet; end to end tests are [planned](../engineering/testing).

## Next steps

- [Engine and simulation](./engine-and-simulation)
- [Product tour](../product/product-tour)
