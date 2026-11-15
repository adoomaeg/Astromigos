---
title: Radiation & Cabin Environment
description: Space radiation sources, dose versus dose rate, cabin CO2, temperature and humidity, what NASA EDA and RadLab provide, and how the Astronaut Health Intelligence Platform simulates these signals with demo thresholds.
status: IMPLEMENTED
origin: SIMULATED
code:
  - frontend/web/src/engine/sim/cabin.ts
  - frontend/web/src/engine/config.ts
verified: 2026-11-14
---

# Radiation & Cabin Environment

Two of the five spaceflight hazards come from outside the body: space radiation and the hostile or closed environment of the spacecraft.[^r1] This page explains the science behind the six environmental signals of the Astronaut Health Intelligence Platform (AHI) and is explicit about what is simulated.

::: warning Simulated values and demo thresholds
All radiation and cabin values in AHI are simulated (`data_origin: SIMULATED`). Every fixed number used for status (CO₂ levels, temperature and humidity bands, radiation watch levels) is **demo configuration, not an official limit**. The full list is on [Thresholds & Limitations](/intelligence/thresholds). This page is educational context, not radiation protection or medical guidance.
:::

## Space radiation

### Sources

| Source | What it is | When it matters |
| --- | --- | --- |
| Galactic cosmic rays (GCR) | High energy nuclei from outside the solar system, mostly iron or lighter; flux is higher at solar minimum[^r7] | The main source of daily radiation for astronauts outside Earth's geomagnetic field[^r7] |
| Solar particle events (SPE) | Bursts of energetic particles from the Sun, often linked with flares and fast coronal mass ejections; the most energetic particles arrive within tens of minutes[^r7] | Infrequent, more common near solar maximum; can cause acute effects without adequate shielding[^r8] |
| Trapped radiation and the South Atlantic Anomaly (SAA) | Protons and electrons trapped in the Van Allen belts. Over the southern Atlantic the inner belt dips to about 200 km, and flights in low Earth orbit cross this region six or seven times a day[^r7] | A significant fraction of exposure in low Earth orbit comes from SAA passes[^r7] |

NASA links space radiation to increased lifetime cancer risk, central nervous system effects and degenerative diseases, and beyond low Earth orbit to a risk of radiation sickness.[^r9] The NASA-STD-3001 technical brief describes acute radiation syndromes from SPEs (nausea, vomiting, fatigue) and long term risks such as cancer and changes in cognition, motor function and behavior.[^r8]

### Dose and dose rate

- **Dose rate** is how fast radiation is being received right now (for example micrograys per hour). It is what an area monitor shows during an SAA pass or a solar event.
- **Accumulated dose** is the total received over a period (for example milligrays since mission start). It is what matters for long term risk.
- **Absorbed dose** (gray, Gy) measures energy deposited in matter. NASA's exposure limits are expressed as **effective dose** (sievert, Sv), which NASA computes with its own quality factors and tissue weighting model.[^r8] The two units are not interchangeable.

NASA-STD-3001 sets a career limit: an individual crewmember's total career effective dose from spaceflight radiation shall be less than 600 mSv. It also limits exposure to the design reference solar particle event to less than 250 mSv effective dose.[^r8] The same standard includes requirements for personal and area monitoring of space radiation and for alerting on elevated exposure rates.[^r8] Crews carry personal dosimeters; examples include CSA's EVARM dosimeters for spacewalks and ESA's Active Dosimeter, also flown on Artemis I.[^r31]

### What AHI simulates

| Signal | Code | Simulation | Demo threshold (not an official limit) |
| --- | --- | --- | --- |
| Area dose rate | `RADIATION_DOSE_RATE` (µGy/h) | Orbit modulation with a 92.7 minute period, plus SAA like peaks on some orbits | HIGH above 100 µGy/h ("demo particle event level") |
| Personal accumulated dose | `RADIATION_DOSE` (mGy) | Integrated per astronaut with a personal shielding factor | MODERATE above 50 mGy ("demo mission dose watch level"); demo mission budget 100 mGy over 180 days |

::: info Units are absorbed dose
AHI shows absorbed dose (mGy, µGy/h), while NASA limits are effective dose (mSv). The demo watch levels are therefore **not comparable** with the NASA career or SPE limits, and AHI does not estimate radiation health risk. The simulated mean of 0.42 mGy per day is described in the code as an ISS like order of magnitude; it has not been calibrated against a cited dosimetry dataset.
:::

## Cabin carbon dioxide

On Earth, average indoor air contains about 0.08% to 0.1% CO₂. In a spacecraft there is no natural removal, so CO₂ depends on scrubbing equipment such as the ISS Carbon Dioxide Removal Assembly (CDRA).[^r10] NASA's technical brief reports:[^r10]

- In a study of ISS Expeditions 2 to 31, 19 of 49 astronauts (about 38.7%) reported headaches, and CO₂ level was among the factors significantly associated with them.
- NASA-STD-3001 limits the average one hour CO₂ partial pressure in the habitable volume to no more than 3 mmHg, to keep the incidence of headaches below 1.4%.
- Since a flight rule approved in 2016, ISS CO₂ has consistently stayed at or below a 3.00 mmHg 24 hour average, with occasional brief excursions; levels vary between ISS nodes.
- Several terrestrial studies found no clear reduction of cognition or decision making at CO₂ levels currently maintained on spacecraft and submarines.

### How AHI handles CO₂

AHI simulates cabin CO₂ in parts per million (ppm) with a daily cycle around about 2,600 ppm. In the cabin CO₂ scenario, a simulated scrubber degradation raises CO₂, and the crew's simulated breathing rate and reaction time shift.

| Demo level | Value | Approximate partial pressure at 760 mmHg total pressure |
| --- | --- | --- |
| MODERATE ("demo watch level") | above 4,000 ppm | about 3.0 mmHg |
| HIGH ("demo warning level") | above 5,300 ppm | about 4.0 mmHg |
| CRITICAL ("demo critical level") | above 7,500 ppm | about 5.7 mmHg |

::: warning Gap: demo CO₂ levels are not aligned with NASA-STD-3001
The partial pressure column is our own conversion (ppm x 760 / 1,000,000), assuming one standard atmosphere; it is not a NASA figure, and real cabin pressure may differ. It shows that the demo HIGH and CRITICAL levels sit above the 3 mmHg one hour average in NASA-STD-3001.[^r10] They were chosen to make the demo scenario readable, not to reproduce the standard. Aligning them with the published standard (and expressing CO₂ as partial pressure) is a candidate improvement; the current values are listed on [Thresholds & Limitations](/intelligence/thresholds).
:::

## Cabin temperature and humidity

Temperature is one of the environmental factors NASA lists for keeping a safe ecosystem inside a spacecraft.[^r1] AHI simulates cabin air temperature (around 22.6 °C) and relative humidity (around 45%) with small daily cycles, and flags values outside a demo comfort band: 18 to 27 °C and 25% to 70% relative humidity. These bands are demo configuration; this documentation did not find and verify an official source for them, so no official range is quoted here.

## NASA environmental data sources

Both portals belong to the NASA Open Science Data Repository (OSDR), which hosts space life science data including environmental telemetry.[^r13]

| Source | What it provides | Status on 2026-11-14 | Used in AHI |
| --- | --- | --- | --- |
| [NASA Environmental Data App (EDA)](https://visualization.osdr.nasa.gov/eda/) | ISS cabin CO₂, temperature and relative humidity, and radiation doses split into GCR, SAA, total and accumulated, for the periods of ISS research payload missions (Rodent Research, APEX and VEG). Raw and summary tables can be downloaded from its Data Tables tab[^r11] | Reachable. Its API lists 24 payload missions with metadata only; telemetry is downloaded as CSV from the interface | Not yet. Replacing the cabin simulator with a `REAL_PUBLIC` replay is a top priority |
| [NASA RadLab](https://visualization.osdr.nasa.gov/radlab/gui/overview/) | Single point of access to radiation telemetry from instruments of several space agencies, for the ISS and beyond low Earth orbit, with export and an API[^r12] | Intermittent: the project's source check recorded HTTP 500 on its routes; the overview page loaded during a later check the same day | No |

EDA data come from ISS periods of rodent and plant research missions. They are real cabin measurements, but they are **not crew health data**, and the ground control channels (such as `CO2_ppm_Ground`) must not be read as cabin values. More detail is on [NASA Data Sources](/data/sources) and [Dataset Catalog](/data/dataset-catalog).

::: tip How the platform uses this
- All demo levels for CO₂, temperature, humidity and radiation: [Thresholds & Limitations](/intelligence/thresholds).
- Cabin metrics use fixed demo thresholds only (a module has no "personal" normal); crew metrics use [Personal Baseline](/intelligence/personal-baseline).
- The CO₂ scenario and the simulated devices: [Device Simulation & Scenarios](/intelligence/scenario-simulation).
- Codes, units and origins: [Data Dictionary](/data/data-dictionary).
:::

## Next steps

- [Health Monitoring in Space Missions](/science/health-monitoring-in-missions): how real crews are monitored.
- [NASA Data Sources](/data/sources): the status of EDA, RadLab and OSDR in detail.
- [Scientific References](/science/references): full citations.

[^r1]: NASA Human Research Program, *5 Hazards of Human Spaceflight*, page last updated 2026-06-12. Reference [R1](/science/references#r1).
[^r7]: NASA JSC Space Radiation Analysis Group, *What is space radiation?*, last updated 2025-09-24. <https://srag.jsc.nasa.gov/spaceradiation/what/what.cfm>. Reference [R7](/science/references#r7).
[^r8]: NASA Office of the Chief Health and Medical Officer, *NASA-STD-3001 Technical Brief: Design for Ionizing Radiation Protection*, OCHMO-TB-020 Rev G, 2025-06-06. Reference [R8](/science/references#r8).
[^r9]: NASA, *Why Space Radiation Matters*, 2017-04-13 (updated 2025-08-22). Reference [R9](/science/references#r9).
[^r10]: NASA Office of the Chief Health and Medical Officer, *NASA-STD-3001 Medical Technical Brief: Carbon Dioxide (CO2)*, OCHMO-TB-004 Rev D, 2026-03-10. Reference [R10](/science/references#r10).
[^r11]: NASA Open Science Data Repository, *Environmental Data App (EDA)*. <https://visualization.osdr.nasa.gov/eda/>. Reference [R11](/science/references#r11).
[^r12]: NASA Open Science Data Repository, *RadLab: Overview*. <https://visualization.osdr.nasa.gov/radlab/gui/overview/>. Reference [R12](/science/references#r12).
[^r13]: NASA Science, *About OSDR*, last updated 2026-10-23. Reference [R13](/science/references#r13).
[^r31]: M. L. Gaskill, *Wearable Tech for Space Station Research*, NASA, 2024-11-13. Reference [R31](/science/references#r31).
