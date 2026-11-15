---
title: Spaceflight Health Hazards
description: The five hazards of human spaceflight defined by the NASA Human Research Program, and how each one maps to what the Astronaut Health Intelligence Platform monitors or simulates.
verified: 2026-11-14
---

# Spaceflight Health Hazards

The NASA Human Research Program (HRP) groups the health threats of human spaceflight into five hazards: space radiation, isolation and confinement, distance from Earth, gravity fields, and hostile or closed environments.[^r1] The Astronaut Health Intelligence Platform (AHI) uses this framework to decide which body systems and cabin signals deserve a place on the dashboard, and to be honest about which hazards it does not cover.

::: info Educational context only
This page summarizes public NASA material to explain the design of the platform. It is not medical guidance. AHI is a decision support prototype, not a medical device, and all crew data shown in the app is simulated.
:::

## The five hazards at a glance

NASA notes that the hazards do not act alone: they "can feed off one another and exacerbate effects on the human body", and they are studied with ground analogs, laboratories and the International Space Station (ISS).[^r1]

| Hazard | What NASA describes | Main body systems involved |
| --- | --- | --- |
| **Space radiation** | Invisible ionizing radiation that NASA considers one of the most hazardous aspects of spaceflight.[^r1] Sources include galactic cosmic rays, solar particle events and particles trapped in Earth's magnetic field.[^r7] | Long term cancer risk, central nervous system, degenerative effects; acute effects from large solar events[^r8][^r9] |
| **Isolation and confinement** | Behavioral responses appear in small groups isolated and confined far from Earth; crews must be carefully chosen, trained and supported.[^r1] NASA tracks this as the Behavioral Health Risk.[^r4] | Mood, stress, cognition, sleep, teamwork |
| **Distance from Earth** | Instructions, supplies and medical care become harder to receive as missions go farther. Mars is on average 140 million miles away and the communication delay can reach up to 20 minutes one way.[^r2] | Every system: the crew must handle medical events with minimal support from Earth[^r2] |
| **Gravity fields** | Muscles, bones, inner ear and organs must adjust to each new gravity level.[^r1] Weight bearing bones lose on average 1% to 1.5% of mineral density per month in spaceflight, fluids shift toward the head, and the return to gravity can cause lightheadedness and fainting.[^r3] | Musculoskeletal, cardiovascular, eyes, balance, kidneys |
| **Hostile or closed environments** | A spacecraft is both a home and a machine; temperature, pressure, lighting, noise, microbes and immune responses must be managed inside a closed ecosystem.[^r1] | Respiratory (cabin CO₂), thermal comfort, immune system |

## How each hazard maps to the platform

The table below shows where each hazard appears in AHI today. Every signal listed is **simulated** (`data_origin: SIMULATED`) unless marked otherwise; the daily check-in becomes `MANUAL` when a person types it in the app. Metric codes are defined in the [Data Dictionary](/data/data-dictionary), and the status of each capability is tracked in the [Feature Status Matrix](/overview/feature-status).

| Hazard | What AHI monitors or simulates | Metric codes | Status in AHI |
| --- | --- | --- | --- |
| Space radiation | Area dose rate with simulated South Atlantic Anomaly passes, and personal accumulated dose per astronaut | `RADIATION_DOSE_RATE`, `RADIATION_DOSE` | <StatusBadge status="IMPLEMENTED" /> simulated. Real dosimetry from NASA EDA or RadLab: <StatusBadge status="PLANNED" /> |
| Isolation and confinement | Daily self report of mood, fatigue and stress, plus a short reaction time test | `MOOD`, `PERCEIVED_FATIGUE`, `STRESS`, `REACTION_TIME` | <StatusBadge status="IMPLEMENTED" /> simulated or manual. Self report alone is capped at a MODERATE attention level |
| Distance from Earth | Earth link profiles (ISS, Moon, Mars closest, Mars farthest) with simulated one way delays, delayed flight surgeon replies and on board first steps | not a metric (communication profile) | <StatusBadge status="IMPLEMENTED" /> simulated. Delays are approximate public figures configured for the demo |
| Gravity fields | Exercise performance against the personal baseline (CEVIS, ARED and T2 sessions), activity level, blood pressure and heart rate | `EXERCISE_LOAD`, `ACTIVITY_LEVEL`, `SYSTOLIC_BP`, `DIASTOLIC_BP`, `HEART_RATE` | <StatusBadge status="IMPLEMENTED" /> simulated. Bone density, muscle volume and eye changes are **not** monitored |
| Hostile or closed environments | Cabin CO₂, air temperature and relative humidity; effect of high CO₂ on simulated breathing rate and reaction time | `CO2`, `CABIN_TEMPERATURE`, `RELATIVE_HUMIDITY` | <StatusBadge status="IMPLEMENTED" /> simulated. Real ISS cabin telemetry from NASA EDA: <StatusBadge status="PLANNED" /> |

::: warning What is not covered
AHI does not model cancer risk, immune function, microbiology, noise, lighting, bone mineral density, muscle volume, sensorimotor function or eye health. Some of these are measured on real missions only through periodic exams or biospecimens (see [Health Monitoring in Space Missions](/science/health-monitoring-in-missions)). The platform does not estimate radiation health risk; it only displays simulated dose values against demo watch levels.
:::

## Hazard by hazard

### Space radiation

Outside Earth's protective atmosphere and magnetic field, crews are exposed to galactic cosmic rays, solar particle events and trapped particles.[^r7][^r9] NASA sets a career exposure limit and a limit for solar particle events in its standard NASA-STD-3001.[^r8] AHI simulates an area dose rate and a personal accumulated dose so the dashboard can show how radiation would sit next to physiology. Details, units and the difference between dose and dose rate are on [Radiation & Cabin Environment](/science/radiation-and-environment).

### Isolation and confinement

NASA describes a risk of adverse cognitive or behavioral changes and psychiatric disorders, and states that the isolation and confinement of spaceflight can reduce cognitive and behavioral functioning.[^r4] On the ISS, selection, training and behavioral health countermeasures have mainly mitigated this risk, while countermeasures for exploration missions are not yet developed and validated.[^r4] AHI does not diagnose anything in this domain: it records short self reports and a reaction time test and compares each person with their own recent answers.

### Distance from Earth

For Mars, NASA highlights communication delays of up to 20 minutes one way and the need for crews to confront situations with minimal support from Earth.[^r2] Other NASA material places the Mars delay between about 4 minutes at closest approach and around 24 minutes at the greatest distance.[^r6] This is why AHI shows on board first steps and simulates delayed replies from a flight surgeon on Earth. The delays in the app are demo configuration based on approximate public figures, not mission planning values.

### Gravity fields

Microgravity unloads bones and muscles and shifts body fluids toward the head; NASA also links this fluid shift to pressure on the eyes and vision problems.[^r3] Exercise on dedicated devices is the main in flight countermeasure for bone and muscle (see [Monitored Physiology](/science/monitored-physiology)). AHI tracks simulated exercise performance and cardiovascular signals, but it has no data source for bone density, muscle volume or eye structure.

### Hostile or closed environments

A spacecraft must keep a safe internal ecosystem.[^r1] Carbon dioxide is a well documented example: NASA associates higher cabin CO₂ with headaches and limits the average one hour CO₂ partial pressure in its standard.[^r10] AHI simulates cabin CO₂, temperature and humidity and includes a scenario where CO₂ rises and the crew's breathing rate and reaction time shift.

::: tip How the platform uses this
- The hazards frame the body regions of the 3D viewer and the metric catalog: see the [Data Dictionary](/data/data-dictionary).
- Status is driven first by each astronaut's own normal range: see [Personal Baseline](/intelligence/personal-baseline).
- Fixed values (cabin CO₂, radiation watch levels, SpO₂ floor) are demo configuration, not official limits: see [Thresholds & Limitations](/intelligence/thresholds).
- Which of these capabilities are implemented, simulated or planned: see the [Feature Status Matrix](/overview/feature-status).
:::

## Next steps

- [Monitored Physiology](/science/monitored-physiology): why each body system matters and what AHI does with it.
- [Radiation & Cabin Environment](/science/radiation-and-environment): radiation sources, CO₂, temperature and humidity.
- [Scientific References](/science/references): the full list of sources used in this section.

[^r1]: NASA Human Research Program, *5 Hazards of Human Spaceflight*, page last updated 2026-06-12. <https://www.nasa.gov/hrp/hazards/>. Reference [R1](/science/references#r1).
[^r2]: NASA Human Research Program, *Hazard: Distance From Earth*, page last updated 2024-08-01. <https://www.nasa.gov/hrp/hazard-distance-from-earth/>. Reference [R2](/science/references#r2).
[^r3]: NASA Human Research Program, *Hazard: Gravity Fields*, page last updated 2024-08-01. <https://www.nasa.gov/hrp/hazard-gravity-fields/>. Reference [R3](/science/references#r3).
[^r4]: NASA, *Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders Leading to In-mission Health and Performance and Long-term Health Effects (Behavioral Health Risk)*, published 2025-03-11, updated 2025-09-17. Reference [R4](/science/references#r4).
[^r6]: K. Schauer, *Space Communications: 7 Things You Need to Know*, NASA Goddard, 2020 (updated 2026-02-09). Reference [R6](/science/references#r6).
[^r7]: NASA JSC Space Radiation Analysis Group, *What is space radiation?*, last updated 2025-09-24. Reference [R7](/science/references#r7).
[^r8]: NASA OCHMO, *NASA-STD-3001 Technical Brief: Design for Ionizing Radiation Protection*, OCHMO-TB-020 Rev G, 2025-06-06. Reference [R8](/science/references#r8).
[^r9]: NASA, *Why Space Radiation Matters*, 2017 (updated 2025-08-22). Reference [R9](/science/references#r9).
[^r10]: NASA OCHMO, *NASA-STD-3001 Medical Technical Brief: Carbon Dioxide (CO2)*, OCHMO-TB-004 Rev D, 2026-03-10. Reference [R10](/science/references#r10).
