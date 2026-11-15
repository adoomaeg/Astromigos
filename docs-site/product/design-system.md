---
title: Design System & Accessibility
description: Status colors, typography, surfaces, components, UX decisions and the accessibility measures actually present in the Astronaut Health Intelligence Platform app.
status: IMPLEMENTED
code:
  - frontend/web/src/lib/status.ts
  - frontend/web/src/components/Status.tsx
  - frontend/web/src/index.css
  - frontend/web/src/app/shortcuts.tsx
  - frontend/web/src/components/MetricValue.tsx
verified: 2026-11-14
---

# Design System & Accessibility

The visual language of the Astronaut Health Intelligence Platform (AHI) is a dark "mission control" look: deep navy space backgrounds, glass panels, a teal accent and five status colors that always come with words and an icon. This page documents what is in the code (`src/index.css`, `src/lib/status.ts`, `src/components/`), not a wish list.

## Status language

Defined once in `src/lib/status.ts` and used by the UI and the 3D viewer. Plain words first, technical label second.

| Status | Crew wording | Technical label | Color | Icon (lucide) | Dot |
| --- | --- | --- | --- | --- | --- |
| `LOW` | All good | Nominal | `#34d399` green | CircleCheck | filled |
| `MODERATE` | Keep an eye | Watch | `#fbbf24` amber | Eye | filled |
| `HIGH` | Act soon | Warning | `#fb923c` orange | TriangleAlert | filled, slow pulse |
| `CRITICAL` | Act now | Critical | `#f43f5e` red | OctagonAlert | filled, fast pulse |
| `NO_DATA` | Signal lost | No data | `#94a3b8` slate | WifiOff | **hollow and dashed**, never filled |

`NO_DATA` deliberately looks different from `LOW` (hollow dashed dot, grey, no animation in 3D) so missing data never reads as normal.

## 3D body

The body is a realistic anatomical atlas, so color has two separate jobs. **Tissue colors** (bone, muscle, vessels, organs) are reference anatomy and carry no meaning about health. **Status colors** are the same five `STATUS_META` colors as everywhere else and appear only as highlights on top of the anatomy.

| State of a structure | Visual | Meaning |
| --- | --- | --- |
| Normal | Natural tissue color | Nominal, or context only |
| Hovered | Cyan tint and tooltip | Under the pointer |
| Selected | Cyan rim; everything else becomes a faint see-through ghost | Focus. Ghosting is a viewing aid, not a status |
| Related to alert | Pulsing rim in the status color (amber, orange, red), with a floating label | Its body system is not nominal |
| Data unavailable | Grey, desaturated, no motion | `NO_DATA` |

- A nominal body shows no status color at all, so any amber, orange or red reads as attention.
- **Cyan is selection, never status.** It is the viewer accent (`#5ee7f5`), close to the app accent.
- **Monitored vs context only.** A structure that no device or metric relates to never gets a status color or a status word. Its panel shows a neutral "Context only" badge and says that no status is shown because nothing is measured.
- **Related indicators.** The structure panel always says that the numbers describe the body system as a whole, not the selected structure.
- **Reference anatomy caption.** "Reference anatomy: Z-Anatomy atlas (CC BY-SA 4.0)" stays visible under the body, with an info button for the credits and the "one reference model for every crew member" statement.
- **Controls** follow the same glass style: Layers (one switch per anatomical system with a tissue colored swatch), a skin opacity slider, layer presets, the preset views Front, Back, Left and Right, and reset.

Full list of states and how they are drawn: [3D anatomy](../architecture/anatomy-3d#visual-states). How users meet them: [Product tour](./product-tour#selecting-a-structure).

## Color tokens

| Token | Value | Use |
| --- | --- | --- |
| `space-950` to `space-600` | `#04070d` to `#22324f` | Backgrounds and surfaces (darkest to lightest) |
| `ink-100`, `ink-300`, `ink-500` | `#e8eefc`, `#a9b6cf`, `#7d8ba6` | Primary, secondary and muted text |
| `accent`, `accent-strong` | `#5eead4`, `#2dd4bf` | Focus rings, links, guided tour spotlight |
| Status colors | see above | Status only, never decoration |

Data origin badges reuse a consistent scheme (for example a violet `SIMULATED` chip in the top bar). This documentation portal uses the same accent (`#5eead4` in dark mode, a deeper cyan in light mode for contrast).

## Typography

| Role | Font |
| --- | --- |
| Interface | Inter (400 to 700), with `cv11` and `ss01` features |
| Numbers and codes | JetBrains Mono; tabular figures (`.tabular`) so live values do not jitter |
| Minimum size in presentation mode | 13 px for every text style, including chart ticks |

## Surfaces and layout

- **Glass panels** (`glass`, `glass-strong` utilities): translucent gradients with a blur and a soft shadow, over a radial "space" background.
- **One spacing scale**: 12 px between panels, 16 px inside panels.
- **Reading order** of the Ground view: crew (who), body and headline (what), attention panel (why and what to do), timeline (when), vitals (live values).
- **Screen modes** in pure CSS: short (viewport height up to 820 px), default, roomy (1680x1000 and up), presentation ([Frontend and state](../architecture/frontend#layout-modes)).

## Components

| Component | Where | Notes |
| --- | --- | --- |
| Status pill, icon and dot | `components/Status.tsx` | Icon plus words plus color |
| Metric value | `components/MetricValue.tsx` | Tweened numbers, snapped when reduced motion is on or the page is hidden |
| Trend chart | `components/TrendChart.tsx` | Personal band ("Your normal"), gaps for missing data, forecast cone, event markers |
| Sparkline | `components/Sparkline.tsx` | 6 h history in crew cards and vitals |
| Risk gauge | `components/RiskGauge.tsx` | 0 to 100 score with level |
| Baseline info | `components/BaselineInfo.tsx` | "Why is this my normal?" |
| Autonomy badge | `features/attention/AutonomyBadge.tsx` | "Can act on board now", "Needs flight surgeon", "Earth reply in N min+" |
| Origin badge | `features/datasources/shared.tsx` | `REAL_PUBLIC`, `DERIVED`, `SIMULATED`, `MANUAL` |
| Structure detail | `features/attention/StructureDetail.tsx` | Selected structure card, "Reference anatomy" badge, "Monitored with" block or "Context only" card |
| Alerts and flags | `features/attention/RegionEvents.tsx` | Open alerts with the triggering metric, observed value against the personal normal, origin badge and rule id |
| Anatomy controls and caption | `features/anatomy/viewer/SystemControls.tsx`, `Attribution.tsx` | Layers, skin opacity, presets, views, reset; source caption |

## UX decisions

| Decision | Reason |
| --- | --- |
| Plain language first ("Act soon"), technical term second ("Warning") | Crew readability under stress; international judging |
| Two views over the same state (Ground and Crew) | Different needs, one source of truth |
| At most two actions in the Crew view | Reduce load; the rest is in the Ground view |
| Every recommendation says who can act | Communication delay makes autonomy part of the answer |
| Always visible SIMULATED badge | Honesty about data origin |
| Gaps in charts stay gaps | Missing data is never filled or smoothed over |
| Critical banner floats over the stage header | The 3D body keeps its size during alerts (247 to 359 px tall at 1280x720, measured with the earlier procedural body) |
| Realistic anatomy with status as a highlight | Tissue color shows what a structure is; status color shows only what needs attention |
| Context only structures show no status | "Nothing is measured" must never look like "normal" |
| Top bar priority collapse | Labels go first on narrow widths; Start demo and the alerts bell are never clipped |
| Alert sound off by default | Opt in, two tone chime for new critical alerts only |

## Accessibility measures in the code

| Measure | Implementation |
| --- | --- |
| Color is never the only cue | Status always pairs color with an icon and words; `NO_DATA` also changes shape (hollow, dashed) |
| Keyboard operation | Global shortcuts (`1` to `4`, `V`, `P`, `A`, `Space`, `Esc`, `?`, arrows in the tour); timeline markers navigable with arrow keys and `Enter`; shortcuts ignored while typing |
| Visible focus | `focus-ring` utility (2 px accent outline) on interactive elements |
| Skip link | "Skip to what needs attention" as the first focusable element |
| Accessible names | About 90 `aria-label` attributes; short vital labels keep the full name in the title and accessible name |
| Live regions | `aria-live` in alerts, 3D labels, Crew view, center stage, data dialog and guided tour |
| ARIA roles | Dialogs, menus (`menuitem`, `menuitemradio`, `menuitemcheckbox`), tabs, radio groups, switch, progress bar, status and alert roles |
| Screen reader only text | `sr-only` text where icons stand alone |
| Reduced motion | `prefers-reduced-motion: reduce` disables animations and transitions globally and snaps tweened numbers |
| Readable sizes | Presentation mode enforces a 13 px floor and scales 3D labels by 1.3 |

::: warning Not audited
These measures exist in the code, but no formal WCAG audit or screen reader test has been done. 3D content is not accessible to screen readers beyond its labels and the equivalent text panels: single structures can only be selected with a pointer, while body systems are reachable from the chips with the keyboard. This is listed in [Limitations and known issues](../validation/limitations).
:::

## Next steps

- [Product tour](./product-tour)
- [Frontend and state](../architecture/frontend)
