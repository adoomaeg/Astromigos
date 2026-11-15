---
title: Monitored Physiology
description: Why cardiovascular, respiratory, sleep, musculoskeletal, behavioral and hydration signals matter in spaceflight, how they are measured on missions, and what the Astronaut Health Intelligence Platform does with each one today.
status: IMPLEMENTED
origin: SIMULATED, MANUAL
code:
  - frontend/web/src/engine/catalog.ts
  - frontend/web/src/engine/sim/adapters.ts
  - frontend/web/src/engine/sim/physiology.ts
  - frontend/web/src/engine/checkins.ts
verified: 2026-11-14
---

# Monitored Physiology

The Astronaut Health Intelligence Platform (AHI) follows 17 signals per astronaut: 16 physiological or self reported signals, grouped below by body system, plus the personal radiation dose covered on [Radiation & Cabin Environment](/science/radiation-and-environment). This page explains, for each system, why it matters in spaceflight, how it is measured on real missions, what AHI does with it today, and what the limits are.

::: warning All crew signals are simulated
Every physiological value in AHI comes from a simulator (`data_origin: SIMULATED`). The daily check-in is simulated too, and becomes `MANUAL` when a person types it in the app. No signal comes from a real astronaut or from the ISS. The scientific context below explains the design; it is not medical guidance and it is not evidence that the platform detects any real condition.
:::

## Summary

| Body system | AHI metric codes | Simulated source in AHI | Origin | Status |
| --- | --- | --- | --- | --- |
| Cardiovascular | `HEART_RATE`, `HRV_RMSSD`, `SYSTOLIC_BP`, `DIASTOLIC_BP` | Bio-Monitor shirt (sim) | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Respiratory | `SPO2`, `RESPIRATORY_RATE` | Bio-Monitor shirt (sim) | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Thermal | `SKIN_TEMPERATURE` | Bio-Monitor shirt (sim) | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Sleep and circadian rhythm | `SLEEP_DURATION`, `SLEEP_EFFICIENCY`, `ACTIVITY_LEVEL` | Actigraphy watch (sim) | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Musculoskeletal | `EXERCISE_LOAD` | CEVIS, ARED and T2 sessions (sim) | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Behavioral health and cognition | `MOOD`, `PERCEIVED_FATIGUE`, `STRESS`, `REACTION_TIME` | Daily check-in and reaction self-test | SIMULATED or MANUAL | <StatusBadge status="IMPLEMENTED" /> |
| Hydration | `HYDRATION` | Fluid intake log (sim) | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Bone density, muscle volume | none | no source | not applicable | <StatusBadge status="NOT_IMPLEMENTED" /> |
| Eyes (SANS) | none | no source | not applicable | <StatusBadge status="PLANNED" /> roadmap |

Units, cadence and body region for each code are in the [Data Dictionary](/data/data-dictionary). Status for every metric is computed against the astronaut's own normal range ([Personal Baseline](/intelligence/personal-baseline)); a few fixed values act as a demo safety net ([Thresholds & Limitations](/intelligence/thresholds)).

## Cardiovascular

**Why it matters.** The cardiovascular system is strongly gravity dependent, so heart and vascular function change in weightlessness, and the altered function causes problems after flight.[^r14] In microgravity, body fluids shift toward the head; when astronauts return to gravity they may experience lightheadedness and fainting.[^r3] Space radiation adds a possible late risk to the heart and vessels, which is still being studied.[^r14] In the NASA Twins Study, the flight twin showed carotid artery distension and increased intima media thickness among other changes.[^r25]

**How it is measured on missions.** The Canadian Space Agency (CSA) Bio-Monitor, launched to the ISS in December 2018, is a smart shirt, headband and tablet application that records the pulse and electrical activity of the heart, blood pressure, breathing rate and volume, skin temperature, blood oxygen saturation and physical activity.[^r28] Heart rate variability (HRV) is a statistic derived from beat to beat intervals of the heart signal; NASA's exercise countermeasures work also lists blood pressure, ECG and heart rate monitoring among ISS health monitoring items.[^r32]

**What AHI does today.** The simulated Bio-Monitor shirt publishes heart rate and HRV (RMSSD) every minute, and blood pressure every 5 minutes (flagged as an estimate). The engine compares each value with the person's baseline for the same activity context (sleep, rest, work, exercise), detects acute deviations and slow drifts, and applies a demo resting heart rate ceiling as a safety net.

**Limitations.** No real ECG waveform, no cuff blood pressure, no fluid volume measurement and no post flight orthostatic test. A rising heart rate in AHI is a pattern for the crew and flight surgeon to review, never a diagnosis.

## Respiratory

**Why it matters.** Breathing rate and blood oxygen are fast signals of acute trouble. In a closed cabin they also interact with the environment: NASA lists headache, shortness of breath (dyspnea) and fatigue among symptoms of carbon dioxide build up in the body.[^r10]

**How it is measured on missions.** The Bio-Monitor records breathing rate and volume and blood oxygen saturation.[^r28] NASA has also tested a crew worn wearable vest that records heart rate and breathing during sleep.[^r31]

**What AHI does today.** Simulated SpO₂ and breathing rate every minute. SpO₂ has demo floors (HIGH below 92%, CRITICAL below 90%) on top of the personal baseline; in the cabin CO₂ scenario the simulated breathing rate rises with CO₂.

**Limitations.** The SpO₂ floors are demo configuration, not clinical or NASA limits. No real pulse oximeter or respiratory sensor feeds the platform.

## Thermal

**Why it matters.** Body temperature regulation is studied in flight: ESA's T-Mini headband measures core body temperature for hours at a time to study how environmental and physiological factors affect it.[^r31] Cabin temperature is one of the environmental factors NASA lists for closed habitats.[^r1]

**How it is measured on missions.** The Bio-Monitor records skin temperature;[^r28] core temperature needs dedicated devices such as the T-Mini headband.[^r31]

**What AHI does today.** Simulated skin temperature every minute, compared with the personal baseline for the activity context.

**Limitations.** Skin temperature is not core temperature, and AHI does not model heat stress or fever.

## Sleep and circadian rhythm

**Why it matters.** In a study of 64 shuttle astronauts and 21 ISS astronauts, sleep measured by wrist actigraphy was short during spaceflight (about 6.09 hours per night on ISS missions) and also during preflight training; the authors call for countermeasures because chronic sleep loss leads to performance decrements.[^r15] NASA uses wrist worn devices to study how ambient light on the station affects the sleep wake cycle and circadian changes.[^r31]

**How it is measured on missions.** The Actiwatch Spectrum, a wrist device with an accelerometer for motion and photodetectors for ambient light, upgrades earlier station technology used to track sleep length and quality.[^r31] NASA Standard Measures collects activity and light exposure from a wrist sensor plus sleep reports.[^r26]

**What AHI does today.** A simulated actigraphy watch reports a continuous activity score and, once per sleep period, sleep duration and sleep efficiency (both flagged as estimates). Two or three nights in a row outside the personal band raise MODERATE or HIGH attention; the progressive fatigue scenario combines short sleep, falling HRV and a rising resting heart rate.

**Limitations.** Actigraphy estimates sleep from movement; it is not polysomnography. AHI has no light exposure signal and no circadian phase estimate.

## Musculoskeletal and exercise countermeasures

**Why it matters.** NASA reports that weight bearing bones lose on average 1% to 1.5% of mineral density per month in spaceflight.[^r3] A study of 14 ISS crew members on 4 to 6 month flights measured areal bone mineral density losses of 0.9% per month at the spine and 1.4% to 1.5% per month at the hip.[^r16] Muscle is affected too: in 9 ISS crew members after about 6 months, calf muscle volume decreased by 13% on average despite an exercise program.[^r18] Skeletal changes are linked with fluid shifts, the vascular system and energy metabolism, and show parallels with immobilization and ageing.[^r17]

**How it is measured on missions.** In flight, crews exercise on the cycle ergometer (CEVIS), the treadmills (T2 and COLBERT) and the Advanced Resistive Exercise Device (ARED);[^r32] in the muscle study above, aerobic exercise took about 5 hours per week and resistance exercise 3 to 6 days per week, and the regimen varied among crew members.[^r18] Crews with access to ARED, combined with adequate energy intake and vitamin D, maintained bone in most regions during 4 to 6 month missions in one study,[^r19] while a later study found that ARED alone partially attenuated bone loss but did not prevent trabecular bone loss at the hip.[^r20] Bone density itself is measured before and after flight with densitometry (DXA and QCT), not continuously.[^r16][^r20] NASA Standard Measures includes a total body strength test.[^r26]

**What AHI does today.** One simulated 60 minute exercise block per day rotates between CEVIS, ARED and T2. Each session produces an exercise performance value as a percentage of the person's own usual sessions. A run of sessions below the personal band raises attention (the exercise performance decline scenario).

**Limitations.** AHI does not measure bone density, muscle volume or strength, and it does not estimate bone loss. ARED, T2 and CEVIS are exercise devices, not medical monitors; what data they provide depends on their instrumentation.

## Behavioral health and cognition

**Why it matters.** NASA's Behavioral Health Risk states that isolation and confinement can reduce cognitive and behavioral functioning and affect individual and crew health, well being and performance.[^r4]

**How it is measured on missions.** NASA Standard Measures includes cognition tests.[^r26] The Cognition test battery, designed for astronauts, has 10 neuropsychological tests covering domains such as vigilant attention, spatial orientation, emotion processing and risk decision making; its validation shows that practice effects differ between tests, which makes normative data important.[^r21] Self report questionnaires and sleep logs are common complements; one sleep study used daily logs next to actigraphy.[^r15]

**What AHI does today.** A daily check-in records mood, fatigue and stress on a 1 to 5 scale, a sleep quality rating and symptom tags. A short reaction self-test gives one reaction time per day. Answers are compared with the person's own recent answers. Self report alone can reach MODERATE at most: it corroborates objective signals and never escalates on its own. See [Self-report & Earth Link](/intelligence/self-report-and-earth-link).

**Limitations.** The reaction test is simulated and is not the Cognition battery. The check-in is a simplified questionnaire, not a validated psychological instrument, and AHI makes no psychiatric or psychological assessment.

## Hydration

**Why it matters.** NASA notes that crews may face an increased risk of kidney stones due to dehydration.[^r3]

**How it is measured on missions.** NASA Standard Measures uses fluid samples to examine diet and nutrition,[^r26] and Artemis II Standard Measures uses blood, saliva and urine samples to assess nutritional status.[^r27] These are periodic samples, not a continuous hydration sensor.

**What AHI does today.** A simulated fluid intake log produces a hydration index (0 to 100, flagged as an estimate) every 30 minutes, compared with the personal baseline.

**Limitations.** The hydration index is a demo score, not a physiological measurement. AHI has no urine or blood chemistry for the simulated crew.

## Eyes and SANS (not monitored)

**Why it matters.** Spaceflight Associated Neuro-ocular Syndrome (SANS) is a set of eye and brain findings that develops in long duration spaceflight: optic disc edema, chorioretinal folds, globe flattening and hyperopic shifts in refractive error.[^r5][^r22] NASA's Human Research Roadmap states that 70% of crew members experience one or more of these hallmark signs and tracks SANS as an active risk.[^r5] A 2023 clinical update estimated that about 66% of long duration astronauts show the earliest indication of SANS.[^r23] The leading hypothesis links SANS to the headward fluid shift of microgravity, which NASA's Fluid Shifts study investigated with non invasive tools.[^r24]

**How it is measured on missions.** Medical surveillance includes pre, in and post flight assessment with optical coherence tomography (OCT), ocular ultrasound, ophthalmic imaging and visual acuity tests, plus brain and eye MRI before flight and soon after return.[^r5] Artemis II Standard Measures includes MRI scans to examine eye and brain health.[^r27]

**What AHI does today.** Nothing. No eye monitoring device feeds the platform. The eyes in the 3D body are reference anatomy: they can be selected, but they are "context only" and never show a status. Adding imaging derived eye indicators is roadmap work: see the [Roadmap](/resources/roadmap).

::: tip How the platform uses this
- Personal normal ranges per activity context: [Personal Baseline](/intelligence/personal-baseline).
- Acute deviations, drifts and persistence rules: [Anomaly Detection](/intelligence/anomaly-detection).
- Demo safety floors and ceilings (SpO₂, resting heart rate): [Thresholds & Limitations](/intelligence/thresholds).
- The scenarios that exercise these signals: [Device Simulation & Scenarios](/intelligence/scenario-simulation).
- Every metric code, unit and cadence: [Data Dictionary](/data/data-dictionary).
:::

## Next steps

- [Radiation & Cabin Environment](/science/radiation-and-environment): the cabin and radiation signals.
- [Health Monitoring in Space Missions](/science/health-monitoring-in-missions): how real crews are monitored, and why AHI uses personal baselines.
- [Scientific References](/science/references): full citations.

[^r1]: NASA Human Research Program, *5 Hazards of Human Spaceflight*, page last updated 2026-06-12. Reference [R1](/science/references#r1).
[^r3]: NASA Human Research Program, *Hazard: Gravity Fields*, page last updated 2024-08-01. Reference [R3](/science/references#r3).
[^r4]: NASA, *Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders (Behavioral Health Risk)*, updated 2025-09-17. Reference [R4](/science/references#r4).
[^r5]: NASA Human Research Roadmap, *Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)*, last published 2025-05-13. Reference [R5](/science/references#r5).
[^r10]: NASA OCHMO, *NASA-STD-3001 Medical Technical Brief: Carbon Dioxide (CO2)*, OCHMO-TB-004 Rev D, 2026-03-10. Reference [R10](/science/references#r10).
[^r14]: Hughson RL, Helm A, Durante M. Heart in space: effect of the extraterrestrial environment on the cardiovascular system. *Nat Rev Cardiol*. 2018;15(3):167-180. doi:10.1038/nrcardio.2017.157. Reference [R14](/science/references#r14).
[^r15]: Barger LK, Flynn-Evans EE, Kubey A, et al. Prevalence of sleep deficiency and use of hypnotic drugs in astronauts before, during, and after spaceflight: an observational study. *Lancet Neurol*. 2014;13(9):904-912. doi:10.1016/S1474-4422(14)70122-X. Reference [R15](/science/references#r15).
[^r16]: Lang T, LeBlanc A, Evans H, et al. Cortical and trabecular bone mineral loss from the spine and hip in long-duration spaceflight. *J Bone Miner Res*. 2004;19(6):1006-1012. doi:10.1359/JBMR.040307. Reference [R16](/science/references#r16).
[^r17]: Vico L, Hargens A. Skeletal changes during and after spaceflight. *Nat Rev Rheumatol*. 2018;14(4):229-245. doi:10.1038/nrrheum.2018.37. Reference [R17](/science/references#r17).
[^r18]: Trappe S, Costill D, Gallagher P, et al. Exercise in space: human skeletal muscle after 6 months aboard the International Space Station. *J Appl Physiol*. 2009;106(4):1159-1168. doi:10.1152/japplphysiol.91578.2008. Reference [R18](/science/references#r18).
[^r19]: Smith SM, Heer MA, Shackelford LC, et al. Benefits for bone from resistance exercise and nutrition in long-duration spaceflight. *J Bone Miner Res*. 2012;27(9):1896-1906. doi:10.1002/jbmr.1647. Reference [R19](/science/references#r19).
[^r20]: Sibonga J, Matsumoto T, Jones J, et al. Resistive exercise in astronauts on prolonged spaceflights provides partial protection against spaceflight-induced bone loss. *Bone*. 2019;128:112037. doi:10.1016/j.bone.2019.07.013. Reference [R20](/science/references#r20).
[^r21]: Basner M, Savitt A, Moore TM, et al. Development and validation of the Cognition test battery for spaceflight. *Aerosp Med Hum Perform*. 2015;86(11):942-952. doi:10.3357/AMHP.4343.2015. Reference [R21](/science/references#r21).
[^r22]: Lee AG, Mader TH, Gibson CR, et al. Spaceflight associated neuro-ocular syndrome (SANS) and the neuro-ophthalmologic effects of microgravity: a review and an update. *npj Microgravity*. 2020;6:7. doi:10.1038/s41526-020-0097-9. Reference [R22](/science/references#r22).
[^r23]: Brunstetter TJ, Mason SS, Taiym WF, et al. *Spaceflight Associated Neuro-ocular Syndrome (SANS): 2023 Clinical Update*. NASA Human Research Program Investigators' Workshop, 2023. NTRS 20220014606. Reference [R23](/science/references#r23).
[^r24]: NASA, *NASA Fluid Shifts Study Advances Journey to Mars*, 2015-07-20. Reference [R24](/science/references#r24).
[^r25]: Garrett-Bakelman FE, Darshi M, Green SJ, et al. The NASA Twins Study: a multidimensional analysis of a year-long human spaceflight. *Science*. 2019;364(6436):eaau8650. doi:10.1126/science.aau8650. Reference [R25](/science/references#r25).
[^r26]: NASA, *Standard Measures*, page last updated 2025-06-04. Reference [R26](/science/references#r26).
[^r27]: NASA, *Artemis II Standard Measures*, page last updated 2026-03-17. Reference [R27](/science/references#r27).
[^r28]: Canadian Space Agency, *Bio-Monitor: Keeping an eye on astronauts' vital signs*, date modified 2026-02-26. Reference [R28](/science/references#r28).
[^r31]: M. L. Gaskill, *Wearable Tech for Space Station Research*, NASA, 2024-11-13. Reference [R31](/science/references#r31).
[^r32]: NASA Johnson Space Center, *Exercise Countermeasures*, page last updated 2026-01-22. Reference [R32](/science/references#r32).
