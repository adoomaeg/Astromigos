---
title: Testing Strategy
description: How the Astronaut Health Intelligence Platform is tested, the 17 vitest files with 143 tests and what each covers, plus what is not tested yet.
status: IMPLEMENTED
code:
  - frontend/web/package.json
  - .github/workflows/ci.yml
  - .github/workflows/docs-check.yml
tests:
  - frontend/web/src/engine/engine.test.ts
  - frontend/web/src/engine/risk.test.ts
  - frontend/web/src/features/anatomy/atlas/health.test.ts
  - frontend/web/src/features/anatomy/atlas/manifest.contract.test.ts
  - frontend/web/src/state/selection.test.ts
verified: 2026-11-14
---

# Testing Strategy

The rules are the product, so the Astronaut Health Intelligence Platform (AHI) tests the engine first. All tests use **vitest**, run headless (no browser) and are deterministic because the simulator is seeded.

| Fact | Value (2026-11-14) |
| --- | --- |
| Test files | 17 |
| Tests | 143, all passing |
| Typecheck | `npx tsc -b` clean |
| Production build | `npx vite build` ok |
| Where | Next to the code (`*.test.ts`) |
| Run | `npm test` inside `frontend/web` |

## Test pyramid today

| Level | What | Status |
| --- | --- | --- |
| Unit | Statistics, baseline, forecast, risk, alerts, FHIR export | <StatusBadge status="IMPLEMENTED" /> |
| Scenario (engine level integration) | Full engine runs per scenario with seeded data | <StatusBadge status="IMPLEMENTED" /> |
| Store | Slices, references, actions; structure, region and metric selection | <StatusBadge status="IMPLEMENTED" /> (14 tests in 2 files) |
| Anatomy data layer | Structure to region mapping, structure health view, manifest contract against the real GLB files | <StatusBadge status="IMPLEMENTED" /> (29 tests in 2 files) |
| Anatomy assets | `npm run anatomy:validate` on the published files ([3D anatomy assets](../data/anatomy-assets#rebuild)) | <StatusBadge status="IMPLEMENTED" /> (script, not a test) |
| 3D rendering | Visual states, picking, loading and fallback, checked by hand on `anatomy-lab.html` | <StatusBadge status="NOT_IMPLEMENTED" /> (no automated test) |
| Evaluation | Headless replay with metrics ([Results](../validation/results)) | <StatusBadge status="IMPLEMENTED" /> (script, not a test) |
| UI component tests | React components | <StatusBadge status="PLANNED" /> |
| End to end (browser) | Open dashboard, select astronaut, run scenario, acknowledge alert (spec section 16) | <StatusBadge status="PLANNED" /> |
| API, database, ingestion integration | Spec section 16 | <StatusBadge status="PLANNED" /> (no backend) |
| Data tests | Schema, units, timestamps, duplicates, provenance | Partial: enforced inside the OSDR import script (fails on sex mismatch, counts missing cells), not as separate tests |

## The 17 test files

| File | Tests | What it covers |
| --- | --- | --- |
| <CodeLink path="frontend/web/src/engine/stats.test.ts" /> | 8 | Median, MAD and quantiles; robust z ignores a single outlier and honors the scale floor; `badZ` orientation; EWMA alpha from the half-life with irregular steps; smooth tracking of a step change; reproducible seeded randomness; Ornstein-Uhlenbeck noise autocorrelation and unit variance; linear slope |
| <CodeLink path="frontend/web/src/engine/baseline.test.ts" /> | 5 | `INSUFFICIENT_DATA` below the minimum sample size; median plus or minus 2 robust SD band; robustness to outliers; clamping to physical limits; reservoir keeps the most recent values |
| <CodeLink path="frontend/web/src/engine/anomaly.test.ts" /> | 8 | Baseline and LOW on normal data; acute jump to CRITICAL within a few readings; single spike filtered by the 3 reading median; EWMA drift catches a sustained shift and escalates with persistence; missing or stale data is `NO_DATA`, never LOW; questionable data capped at MODERATE; exercise compared with the exercise baseline; consecutive short nights with persistence wording |
| <CodeLink path="frontend/web/src/engine/risk.test.ts" /> | 14 | Score bands; three MODERATE rules become HIGH; one weight per rule and slow patterns capped at HIGH; data quality weight cap; R-CARD-01; R-FAT-01 two of three and three of three; missing data never a normal component; assessment output (rules, factors, confidence, limitations, headline); headline with no findings; region `NO_DATA`; alert dedupe, escalation, auto resolve and history; acute MODERATE blips not actionable; combined rules group components; one recommendation per astronaut and rule with human review |
| <CodeLink path="frontend/web/src/engine/forecast.test.ts" /> | 9 | Damped linear trend; too few points; interval widens with the horizon; binning of irregular points; not eligible with insufficient data; 6 h and 24 h horizons with widening 80% intervals; hours to band exit; daily steps; no band exit while recovering from the opposite side |
| <CodeLink path="frontend/web/src/engine/alerts.test.ts" /> | 5 | CRITICAL escalation at 5 and 15 min; late evaluation jumps to the right level; HIGH at 30 and 90 min, MODERATE never; stops when acknowledged or resolved; escalations audited in the engine |
| <CodeLink path="frontend/web/src/engine/engine.test.ts" /> | 11 | Baselines `READY` at startup; reproducible with the same seed; bounded history; NOMINAL never reaches HIGH over two simulated days; ACUTE_CARDIO reaches CRITICAL within about 15 sim minutes with one grouped alert; it eases after a logged consult (hypothetical); SENSOR_FAILURE goes stale then offline and is `NO_DATA`; PROGRESSIVE_FATIGUE escalates over days; ENVIRONMENTAL_CO2 raises CO2 for everyone and ventilation lowers it; PERFORMANCE_DECLINE lowers output; acknowledging writes an audit event |
| <CodeLink path="frontend/web/src/engine/checkins.test.ts" /> | 8 | One simulated check-in per astronaut per morning; check-in metrics in the brain region; live morning check-ins; fatigue scenario moves answers but stays MODERATE alone; CO2 makes a headache more likely; manual check-in replaces the simulated one and is `MANUAL`; self report reaches MODERATE at most with no alert; high fatigue run count |
| <CodeLink path="frontend/web/src/engine/comms.test.ts" /> | 9 | Delivery after the one way delay and a reply after review plus delay; timing independent of processing rate; handover reports get no reply and replies are non-prescriptive; profile applied to the mission; one automatic health packet per HIGH or CRITICAL alert; on board first step under Mars states the earliest reply; packets and replies audited; profile switch and manual messages; no on board first step under ISS |
| <CodeLink path="frontend/web/src/engine/intervention.test.ts" /> | 7 | Sleep extension: HRV recovers with the action, deterministic, no state change; explicit metric and horizon; null when not applicable; nominal gives identical lines and says so; acute cardio uses a short horizon; ventilation projects CO2; exercise adjustment, one point per session |
| <CodeLink path="frontend/web/src/engine/missionDays.test.ts" /> | 6 | Day 1 to the current day for everyone; plausible values (ISS-like dose, sleep, exercise around plan); deterministic synthesis; live update of the current day with stable references; fatigue and performance decline visible in recent days |
| <CodeLink path="frontend/web/src/engine/timeline.test.ts" /> | 3 | Last 24 sim hours every 15 min after startup; live frames follow the risk level, also after a big jump; bounded to the history window |
| <CodeLink path="frontend/web/src/lib/fhir.test.ts" /> | 7 | Collection bundle with unique full URLs; pseudonymized patients without personal fields; LOINC only for known vital signs; data origin tag on every observation; missing data never exported as a value; cabin observations without a patient; valid FHIR ids and stable UUIDs |
| <CodeLink path="frontend/web/src/state/store.test.ts" /> | 1 | v2 slices published, references stable when unchanged, actions wired |
| <CodeLink path="frontend/web/src/state/selection.test.ts" /> | 13 | Nothing selected at start; `selectStructure` sets structure and region in one update and clears the metric; a context only structure clears the region; `selectStructure(null)` clears everything; `selectRegion` clears the structure; `selectAstronaut` clears structure, region and metric; `selectMetric` keeps them; a clock tick never touches the selection; `focusTarget` (alert View buttons) clears a structure of another region, keeps one of the same region, changes astronaut first and ignores cabin targets; `clearSelection` goes back to the overview |
| <CodeLink path="frontend/web/src/features/anatomy/atlas/health.test.ts" /> | 21 | Every anatomical system mapped by rule; only brain structures map to the brain and only the kidneys map to the kidneys (procedural origin kept); digestive organs, glands, lymphoid and sense organs stay context only; required ids; primary structure of a region; atlas counts; related metrics come only from the catalog and never include cabin metrics; status is `null` for context only, `NO_DATA` (never normal) when health is missing, else the region status; region alerts by severity then time; anomalies inside a time window; observed value at a time, never invented; structure health view for monitored and context only structures; plain language texts never claim a diagnosis or a neurological measurement and contain no em dash or en dash |
| <CodeLink path="frontend/web/src/features/anatomy/atlas/manifest.contract.test.ts" /> | 8 | Reads the real `public/anatomy`: GLB JSON chunk reader; top level shape, source and license facts; valid structures with unique ids; the seven required ids mapped to their regions; paired structures on the side their id names; real structures mapped by the health rules; one file entry per system with consistent counts; every GLB shipped with one mesh node named after each structure id |

## Principles

- **Test the safety properties.** Several tests exist only to prove that missing data is never normal, that self report never escalates alone, that replies never prescribe, and that patients are pseudonymized.
- **Deterministic.** Seeds make every scenario test reproducible.
- **Scenario tests check behavior, not exact numbers**, so tuning a demo value does not break them unless the behavior changes.
- **Evaluation is separate.** Detection times and false alert rates come from `npm run evaluate`, not from asserts.
- **Anatomy is tested as data, not as pixels.** The mapping from structures to regions, the selection rules and the manifest are pure TypeScript and run in node. The contract test reads the published GLB files, so a rebuilt atlas that breaks an id the app relies on fails `npm test`.

## In CI

The CI workflow (`.github/workflows/ci.yml`) runs lint, the typecheck, `npm test` and the production build on pushes and pull requests to `master` that touch `frontend/web/**`. The documentation build runs in pull requests (`docs-check.yml`) and in the deploy on `master`. See [Documentation and deployment](./deployment#validation).

## Next steps

- [Validation strategy](../validation/strategy)
- [Traceability matrix](../validation/traceability)
