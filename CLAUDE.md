# AHI: Astronaut Health Intelligence (NASA Space Apps 2026, Health Monitoring Software)

Full product spec: `PROJECT_MASTER.md` (pt-BR). Read sections 1, 6, 9 and 13 before touching analytics.

## Hard rules
- Never use the em dash or en dash characters in any text: UI strings, docs, comments, commits. Use period, comma, colon or parentheses.
- UI language: English (international judging). Plain language first, technical term second.
- This is decision support, NOT a medical device. No diagnosis, no medication, no invented "official NASA limits".
  Personal baseline bands drive status. Any fixed threshold lives in `src/engine/config.ts`, labeled "demo configuration, not an official limit".
- All device data is simulated and must carry `data_origin: 'SIMULATED'`; the UI always shows a SIMULATED badge.
- Missing data is never treated as normal: it becomes `NO_DATA` / `DATA_STALE`.

## Layout (frontend/web, React 19 + TS + Vite 8 + Tailwind v4 + three/r3f)
- `src/types/domain.ts`: shared contract. Additive changes only.
- `src/engine/`: simulators (device adapters), baseline, anomaly, risk, forecast, recommendations. Pure TS, unit tested with vitest.
- `src/state/store.ts`: zustand store implementing `AppState`; `startTicker()` drives the sim clock.
- `src/features/anatomy/`: 3D body viewer (procedural, no external model files).
- `src/features/*`, `src/components/`: UI. `src/lib/status.ts`: status colors and labels.

## Commands (run inside frontend/web)
- `npm run dev` (port 5173), `npx tsc -b`, `npm test`, `npx vite build`.
- TS has `erasableSyntaxOnly` (no enums, no parameter properties) and `noUnusedLocals`.
