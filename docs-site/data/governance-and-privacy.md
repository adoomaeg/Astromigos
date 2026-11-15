---
title: Governance & Privacy
description: Privacy, pseudonymization, access, population labeling, auditability and governance rules of the Astronaut Health Intelligence Platform, with what is implemented and what is planned.
status: IMPLEMENTED
origin: SIMULATED, REAL_PUBLIC
code:
  - frontend/web/src/lib/fhir.ts
  - frontend/web/src/app/uiStore.ts
  - frontend/web/scripts/osdr/lib.mjs
tests:
  - frontend/web/src/lib/fhir.test.ts
verified: 2026-11-14
---

# Governance & Privacy

How the Astronaut Health Intelligence Platform (AHI) handles personal data, access, populations and traceability. The rules come from section 17 of the product spec; the status column says how each one is enforced today.

## Privacy and pseudonymization

- The simulated crew uses pseudonymized ids (`AST-01` to `AST-04`) and fictional callsigns (ORION, LYRA, VEGA, ATLAS).
- The real datasets keep the source pseudonyms (C001 to C004). No attempt is made to link them to named people.
- The FHIR R4 export contains `Patient` resources with pseudonymized ids only: no name, birth date, gender or other personal data (covered by a test in `fhir.test.ts`).
- Only processed, publicly accessible OSDR files were used. Controlled access data (for example astronaut sequencing data) was never requested or touched.
- UI preferences (view, presentation mode, alert sound) are stored only in the browser's `localStorage`. There is no backend, no account and no tracking.
- The 3D body is one reference model shown for every crew member. It is not a scan of anyone and holds no personal data.

## Populations are never mixed

| Population | Example | How AHI treats it |
| --- | --- | --- |
| Long duration astronauts | ISS crews | No public continuous data found; vitals are simulated |
| Commercial astronauts, short flight | Inspiration4 (4 people, 3 days) | `REAL_PUBLIC` reference panels; not representative of long missions, no statistical claim |
| Analog participants | HERA, bed rest, confinement studies | Would be labeled analog; never presented as astronaut data |
| Non human | Rodents, plants, cells | Not human physiology; EDA cabin data from payload missions describes the cabin, not the crew |

The proposed `metadata.population_type` values for future imports are listed in [Pipeline, normalization and quality](./pipeline-and-quality#healthobservation-from-a-real-source).

## Governance rules (product spec section 17)

| # | Rule | Status today |
| --- | --- | --- |
| 1 | Do not import identifiable personal data without authorization | <StatusBadge status="IMPLEMENTED" /> only public, pseudonymized files |
| 2 | Respect terms, licenses and restrictions of each dataset | <StatusBadge status="IMPLEMENTED" /> license recorded, "not stated" when absent; the 3D anatomy keeps its CC BY-SA 4.0 license and attribution ([Third party licenses](#third-party-licenses)) |
| 3 | Do not bypass OSDR access controls | <StatusBadge status="IMPLEMENTED" /> allow listed hosts, public files only |
| 4 | Use pseudonyms in demo data | <StatusBadge status="IMPLEMENTED" /> |
| 5 | Do not log unnecessary sensitive information | <StatusBadge status="IMPLEMENTED" /> no server logs exist; audit holds actions, not personal data |
| 6 | Do not treat animal data as human data | <StatusBadge status="IMPLEMENTED" /> |
| 7 | Do not present analog results as astronaut results | <StatusBadge status="IMPLEMENTED" /> |
| 8 | Version models, parameters and rules | <StatusBadge status="IMPLEMENTED" /> engine, risk model, baseline, forecast and catalog versions |
| 9 | Trace which data produced each alert | <StatusBadge status="IMPLEMENTED" /> rule id, metric, factors and audit events, in memory only |
| 10 | Show limitations and uncertainty | <StatusBadge status="IMPLEMENTED" /> confidence, intervals, limitations on every assessment |
| 11 | Require human validation for health decisions | <StatusBadge status="IMPLEMENTED" /> `requiresHumanReview` on HIGH, CRITICAL and flight surgeon items |
| 12 | Use generative AI only for controlled explanation and summarization | <StatusBadge status="NOT_IMPLEMENTED" /> no generative AI at runtime; a guarded layer is [planned](../intelligence/ai-and-analytics#planned-llm-explanation-layer) |

## Third party licenses {#third-party-licenses}

| Material | License | Obligation |
| --- | --- | --- |
| Application code | MIT (`LICENSE` at the repository root) | Keep the license notice |
| 3D anatomy files (`frontend/web/public/anatomy/*.glb`, `manifest.json`) | **CC BY-SA 4.0**, derived from Z-Anatomy, which is based on BodyParts3D (CC BY-SA 2.1 Japan) | Keep the attribution, state the changes, share derived files under the same license. The MIT license does not cover these files |
| NASA OSDR datasets (OSD-569, OSD-575) | Not stated by the source | Recorded as "not stated"; no license is assumed |

The anatomy files carry their own `LICENSE.md`, the app shows the attribution under the 3D body, and upstream content with a non commercial license (ear, kidney) is excluded from the files. Full record: [3D anatomy assets](./anatomy-assets#license-and-attribution).

## Audit trail

The engine records `AuditEvent` entries (`at`, `actor`, `action`, `detail`) for acknowledgements, logged interventions, scenario changes, escalations, Earth link messages, profile changes and check-ins. The trail is shown in the alerts drawer (History tab) and is bounded to 300 entries.

::: warning In memory only
The audit trail lives in the browser tab and is lost on reload. A persistent, tamper evident audit store needs the planned backend ([Target architecture](../architecture/target-architecture)).
:::

## Security posture today

| Topic | Today | Planned |
| --- | --- | --- |
| Authentication and roles | None; anyone with the page sees everything | RBAC for crew, crew medical officer, flight surgeon, mission control, researcher, data engineer |
| Transport | Static files; the docs portal is served over HTTPS by GitHub Pages | TLS for every published service |
| Secrets | None needed: no API keys | Secrets outside the code |
| Third party calls | Web fonts from Google Fonts when the page loads; no other third party call. Everything else, including the 3D anatomy files, is served from the app's own origin (no CDN) | Self hosted fonts if needed |
| Downloaded files | Treated as untrusted: hashed, parsed as text, never executed | Same |

## Next steps

- [Data origins and provenance](./data-origins)
- [Responsible use](../overview/responsible-use)
