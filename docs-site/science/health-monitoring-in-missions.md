---
title: Health Monitoring in Space Missions
description: How crew health is monitored on real missions (wearables, exercise devices, periodic exams, biospecimens, NASA Standard Measures and Artemis II Standard Measures), why personal baselines make sense, and how this shaped the Astronaut Health Intelligence Platform.
verified: 2026-11-14
---

# Health Monitoring in Space Missions

Real crew health monitoring mixes continuous wearables, scheduled exercise sessions, periodic exams and biological samples collected before, during and after flight. This page summarizes public descriptions of that practice and explains which parts inspired the design of the Astronaut Health Intelligence Platform (AHI).

::: warning No live mission integration
AHI is **not** connected to the ISS, to any spacecraft, to any of the devices below, or to any NASA or CSA system. The devices on this page are the real world reference for AHI's **simulated** adapters. Everything the crew dashboard shows is simulated (`SIMULATED`) or typed in the app (`MANUAL`).
:::

## Monitoring modalities

| Modality | Example on missions | What it records | Continuous or periodic | AHI counterpart |
| --- | --- | --- | --- | --- |
| Wearable vital signs | CSA **Bio-Monitor**: smart shirt, headband and tablet application, launched to the ISS in December 2018[^r28] | Pulse and electrical activity of the heart, blood pressure, breathing rate and volume, skin temperature, blood oxygen saturation, physical activity[^r28] | Continuous during wear sessions, including sleep and exercise[^r28] | "Bio-Monitor shirt (sim)" |
| Wrist actigraphy | **Actiwatch Spectrum**: accelerometer for motion and photodetectors for ambient light[^r31] | Sleep length and quality estimates, activity, light exposure[^r31] | Continuous | "Actigraphy watch (sim)" |
| Exercise devices | **CEVIS** cycle ergometer, **ARED** resistive device, **T2** and **COLBERT** treadmills[^r32] | Session data that depend on each device's instrumentation | Per session | "CEVIS cycle ergometer (sim)", "ARED resistive exercise device (sim)", "T2 treadmill (sim)" |
| Dosimeters | Personal dosimeters such as CSA's EVARM (spacewalks) and ESA's Active Dosimeter[^r31] | Radiation exposure | Continuous | "Personal dosimeter (sim)", "Area radiation monitor (sim)" |
| Cabin environment | ISS environmental telemetry, published for research periods in NASA EDA[^r11]; personal CO₂ monitors have also been tested[^r31] | CO₂, temperature, humidity, radiation doses | Continuous | "Cabin environment sensor (sim)" |
| Eye and brain imaging | OCT, ocular ultrasound, ophthalmic imaging, visual acuity; MRI before flight and after return[^r5] | Structural eye and brain changes linked to SANS | Periodic | None (roadmap) |
| Biospecimens | Blood, saliva, urine and fecal samples in Standard Measures[^r26][^r27] | Nutrition, immune function, microbiome, cardiovascular markers | Periodic | None for the simulated crew. Real public Inspiration4 blood panels are shown as historical reference only |
| Cognitive and self report | Cognition tests and sleep reports in Standard Measures[^r26] | Cognitive performance, sleep, well being | Periodic (daily or per session) | Daily check-in and "Reaction self-test (sim)" |

::: info Astroskin and Bio-Monitor
Astroskin is a bio-monitoring smart shirt developed by Hexoskin (Carré Technologies, Montreal) under earlier CSA contracts.[^r29] A shirt and headband Astroskin system was tested by NASA and CSA in the Human Exploration Research Analog (HERA), where 16 crewmembers wore it for continuous 24 hour monitoring; the authors reported lessons on data loss, Bluetooth communication and comfort, and noted that the data were not compared with laboratory standard devices.[^r30] The Bio-Monitor flight system was developed for CSA by Carré Technologies.[^r28] AHI's simulated shirt is modeled on this family of devices, not on any proprietary data format.
:::

## NASA Standard Measures

Spaceflight Standard Measures is a NASA flight study that collects a standardized set of measurements across several body systems, before, during and after a mission, to show how spaceflight, isolation, confinement and weightlessness affect health and performance.[^r26] It includes:[^r26]

- activity and light exposure through a wrist sensor;
- sleep reports;
- fluid samples to examine diet and nutrition;
- saliva to measure immune system function;
- cognition tests;
- sensorimotor tests for balance and inner ear function;
- a total body strength test;
- fecal samples to study changes in microorganisms.

### Artemis II Standard Measures

Artemis II Standard Measures is a branch of the same experiment for participating Artemis II astronauts; according to NASA, Spaceflight Standard Measures has collected data from more than 30 astronauts on ISS missions since 2018.[^r27] For Artemis II it includes blood, saliva and urine samples (nutritional status, cardiovascular health and immune function), MRI scans of eye and brain health, balance and vestibular tests with motion sickness surveys, muscle performance tests, microbiome changes, and physical function tests such as exiting a capsule and simulated moonwalks in a pressurized suit immediately after return.[^r27]

::: warning Reference, not a data feed
Standard Measures and Artemis II Standard Measures are used in AHI as **domain references** that justify which signals are worth monitoring. AHI does not hold or display any Standard Measures data, and this documentation does not assume such data are openly available.
:::

## Why personal baselines make sense

Spaceflight research consistently compares each person with their own earlier measurements:

- Standard Measures collects the same measures before, during and after flight, which makes each astronaut's preflight values the natural reference.[^r26]
- The sleep study of shuttle and ISS crews compared in flight sleep with each astronaut's own preflight and postflight intervals.[^r15]
- The NASA Twins Study monitored one astronaut before, during and after a one year mission, with his identical twin on the ground as a genetically matched control.[^r25]
- In the Cognition test battery, practice effects and test retest variability differ between tests, which is why the authors stress normative data from the population of interest.[^r21]
- Exercise programs varied among crew members in the ISS muscle study.[^r18]

These designs suggest that a value that is normal for one astronaut may be unusual for another. AHI applies the same idea in software: status is driven first by each astronaut's own rolling normal range (median and robust spread per activity context), and only a few fixed demo values act as a safety net. This is a design choice inspired by the research above; it has not been clinically validated.

## How this informs the platform design

| Practice on missions | Design decision in AHI |
| --- | --- |
| Several devices with different cadences (continuous wearables, per session exercise, daily reports) | Device adapters normalize every source to one observation model with origin, quality and activity context |
| Monitoring before, during and after flight against personal references | [Personal Baseline](/intelligence/personal-baseline) per astronaut and context |
| Wearables lose data and drop connections (as reported in HERA testing)[^r30] | Missing data is never treated as normal: it becomes `NO_DATA` or `DATA_STALE`, and a sensor failure scenario exists |
| Crews far from Earth must act with minimal ground support[^r2] | Simulated Earth link delays, on board first steps and delayed flight surgeon replies ([Self-report & Earth Link](/intelligence/self-report-and-earth-link)) |
| Periodic exams and biospecimens are not continuous signals | Lab data are shown only as dated historical reference (Inspiration4 panels from NASA OSDR), never mixed with simulated live data ([Dataset Catalog](/data/dataset-catalog)) |
| Flight surgeons make medical decisions | AHI is decision support only: see [Responsible Use](/overview/responsible-use) |

::: tip How the platform uses this
- Where each simulated device sits in the data flow: [Device Simulation & Scenarios](/intelligence/scenario-simulation).
- How origins are labeled (`REAL_PUBLIC`, `DERIVED`, `SIMULATED`, `MANUAL`): [Data Origins & Provenance](/data/data-origins).
- What is implemented and what is planned: [Feature Status Matrix](/overview/feature-status).
:::

## Next steps

- [Monitored Physiology](/science/monitored-physiology): body system by body system.
- [NASA Data Sources](/data/sources): OSDR, EDA, RadLab, NLSP and Standard Measures status.
- [Scientific References](/science/references): full citations.

[^r2]: NASA Human Research Program, *Hazard: Distance From Earth*, page last updated 2024-08-01. Reference [R2](/science/references#r2).
[^r5]: NASA Human Research Roadmap, *Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)*, last published 2025-05-13. Reference [R5](/science/references#r5).
[^r11]: NASA Open Science Data Repository, *Environmental Data App (EDA)*. Reference [R11](/science/references#r11).
[^r15]: Barger LK, Flynn-Evans EE, Kubey A, et al. Prevalence of sleep deficiency and use of hypnotic drugs in astronauts before, during, and after spaceflight: an observational study. *Lancet Neurol*. 2014;13(9):904-912. doi:10.1016/S1474-4422(14)70122-X. Reference [R15](/science/references#r15).
[^r18]: Trappe S, Costill D, Gallagher P, et al. Exercise in space: human skeletal muscle after 6 months aboard the International Space Station. *J Appl Physiol*. 2009;106(4):1159-1168. doi:10.1152/japplphysiol.91578.2008. Reference [R18](/science/references#r18).
[^r21]: Basner M, Savitt A, Moore TM, et al. Development and validation of the Cognition test battery for spaceflight. *Aerosp Med Hum Perform*. 2015;86(11):942-952. doi:10.3357/AMHP.4343.2015. Reference [R21](/science/references#r21).
[^r25]: Garrett-Bakelman FE, Darshi M, Green SJ, et al. The NASA Twins Study: a multidimensional analysis of a year-long human spaceflight. *Science*. 2019;364(6436):eaau8650. doi:10.1126/science.aau8650. Reference [R25](/science/references#r25).
[^r26]: NASA, *Standard Measures*, page last updated 2025-06-04. <https://www.nasa.gov/reference/standard-measures/>. Reference [R26](/science/references#r26).
[^r27]: NASA, *Artemis II Standard Measures*, page last updated 2026-03-17. <https://www.nasa.gov/reference/artemis-ii-standard-measures/>. Reference [R27](/science/references#r27).
[^r28]: Canadian Space Agency, *Bio-Monitor: Keeping an eye on astronauts' vital signs*, date modified 2026-02-26. Reference [R28](/science/references#r28).
[^r29]: Canadian Space Agency, *Wireless body sensors for medical care in space*, 2015-12-23. Reference [R29](/science/references#r29).
[^r30]: Toscano W, Cowings P, Sullivan P, et al. *Wearable Biosensor Monitor to Support Autonomous Crew Health and Readiness to Perform*. NASA Human Research Program Investigators' Workshop, 2017. NTRS 20190001996. Reference [R30](/science/references#r30).
[^r31]: M. L. Gaskill, *Wearable Tech for Space Station Research*, NASA, 2024-11-13. Reference [R31](/science/references#r31).
[^r32]: NASA Johnson Space Center, *Exercise Countermeasures*, page last updated 2026-01-22. Reference [R32](/science/references#r32).
