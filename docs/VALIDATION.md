# Validation and limitations

## What the checks establish

The automated suite exercises synthetic physiology and scenario behavior, baselines, anomaly and risk rules, alerts, forecasts, check-ins, communication delay, intervention simulations, state selection, anatomy contracts, medical-history isolation, and case follow-up behavior.

Newer workflow checks include:

- Personal history entries remain associated with the correct astronaut.
- Shared cabin events remain distinguishable from personal records.
- Corrupt local-storage entries do not break otherwise valid histories.
- Logging an action or acknowledging an alert does not imply resolution.
- Unknown or still-abnormal readings keep a case open.
- Cleared readings require a written follow-up review before resolution.
- Repeated issue episodes and different simulation runs do not mix notes.
- Logos and portraits honor a GitHub Pages repository subpath.
- The built HTML, public images, and anatomy files exist in the publication artifact.

Run `npm test`, `npm run build`, and `npm run verify:pages` inside `frontend/web` for current results. Test counts are not frozen in this document because the suite changes over time.

## What passing does not establish

Passing tests establish behavior under the tested inputs and configurations. They do not establish medical accuracy, diagnostic sensitivity, acceptable false-alarm rates for flight, treatment effectiveness, regulatory approval, or performance on real astronaut telemetry.

A production build verifies the TypeScript and bundling pipeline. The static publication check verifies asset paths and files. Neither proves that every browser, graphics driver, viewport, assistive technology, or WebGL interaction behaves correctly. A browser review and accessibility evaluation remain separate work.

## Data boundaries

All live monitoring is synthetic. Forecasts depend on simplified assumptions. Intervention relief is deliberately hypothetical. Public OSDR reference panels concern a different mission and are not injected as the named Artemis II crew's live physiology.

Medical-history examples and manually entered notes are for demonstration only. The app does not provide authentication, protected clinical storage, verified authorship, or cross-device synchronization. A “review” is an interface action in a simulation, not a verified clinical sign-off.

## Current operational limitations

- No real device connection or real medical-service integration.
- No durable cross-run case archive or mission-session replay.
- Retained sample history is bounded; older detection readings can become unavailable.
- Shared reference anatomy is not individualized imaging.
- No independent clinical or operational validation.
- Historical AHI screenshots and pages in `docs-site/` predate the current design.

## Proposed further evaluation

Evaluate whether users can explain why an alert appeared, identify uncertainty, locate the responsible reviewer, and distinguish an action log from a resolved case. Measure the completeness of a handover and test how the interface behaves when signals are missing, multiple issues overlap, or communication is delayed. These are future evaluation tasks, not reported study results.
