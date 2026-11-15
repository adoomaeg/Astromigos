---
title: Glossary & Acronyms
description: Terms, acronyms and status labels used in the Astronaut Health Intelligence Platform and in this documentation.
verified: 2026-11-14
---

# Glossary & Acronyms

Terms used in the Astronaut Health Intelligence Platform (AHI), in the app and in these docs.

## Product and status

| Term | Meaning |
| --- | --- |
| **AHI** | Abbreviation of Astronaut Health Intelligence Platform, this project |
| **Decision support** | Information that helps a person decide; AHI never decides, diagnoses or prescribes |
| **Attention level** | `LOW`, `MODERATE`, `HIGH`, `CRITICAL`: operational levels of the prototype, not medical classifications |
| **All good / Keep an eye / Act soon / Act now / Signal lost** | Crew wording for LOW, MODERATE, HIGH, CRITICAL and NO_DATA |
| **Nominal / Watch / Warning / Critical / No data** | Technical labels for the same levels |
| **NO_DATA** | Status when data is missing, stale or the device is offline. Never treated as normal |
| **Ground view** | Layout for the flight surgeon and mission control, whole crew |
| **Crew view** | Calm layout for one astronaut, plain language, top two actions |
| **Presentation mode** | Larger text and fewer details for projectors (`P`) |
| **Guided demo** | The 10 step tour started by **Start demo** |
| **MET** | Mission elapsed time, shown in the top bar on the simulated clock |
| **Scenario** | A scripted simulated situation (nominal, fatigue, CO2, performance decline, sensor failure, acute cardio) |

## Analytics

| Term | Meaning |
| --- | --- |
| **Personal baseline** | A person's own normal range for a metric, learned from their recent data (median and MAD), per activity context |
| **Normal band** | Median +/- 2 robust SD of the personal baseline; shaded "Your normal" on charts |
| **Activity context** | `SLEEP`, `REST`, `WORK`, `EXERCISE` (and `EVA` in the contract). Baselines are kept per context, from the schedule |
| **MAD** | Median absolute deviation: a spread measure that resists outliers. Robust SD = 1.4826 x MAD |
| **Robust z** | How many robust SDs a value is from the personal median |
| **EWMA** | Exponentially weighted moving average; used on z to detect slow drift (half-life 3 h) |
| **Drift** | A slow, persistent move away from the personal normal |
| **Persistence** | Consecutive daily values (sleep, exercise, reaction time, check-in) outside the band |
| **INSUFFICIENT_DATA** | A baseline that does not have enough samples yet ("Still learning your normal") |
| **Rule id** | Identifier of a transparent rule, for example R-HR-01 or R-FAT-01 |
| **Combined rule** | A rule over several signals: R-CARD-01, R-FAT-01, R-ENV-CO2-02 |
| **Risk score** | 0 to 100, noisy-OR of rule weights; bands at 20, 45 and 80 |
| **Noisy-OR** | 1 - product(1 - w): independent moderate signals add up without exceeding 100 |
| **Confidence** | 0 to 1, lowered by missing or questionable key signals and baselines not ready |
| **Contributing factor** | A plain-language reason behind the level, with a weight |
| **Damped Holt** | Exponential smoothing with a damped trend, used for short forecasts |
| **80% interval / forecast cone** | Range where the projection is expected to fall 80% of the time, widening with the horizon |
| **Band exit** | The first projected time a value leaves the personal band |
| **Escalation** | An unacknowledged CRITICAL or HIGH alert stepping up after a delay |
| **Autonomy** | Who can act: `ONBOARD` (crew now) or `GROUND_REVIEW` (flight surgeon on Earth) |
| **On board first step** | Under Mars delays, a step the crew medical officer starts before Earth can answer |
| **What-if** | A hypothetical projection with and without an action; never a claim of clinical efficacy |
| **Self report** | Check-in answers (mood, fatigue, stress, sleep quality, symptoms); capped at MODERATE |
| **Co-occurrence** | Signals that change together; not proof of cause |
| **Rule based** | Logic written as explicit, versioned rules with ids, as opposed to a trained model |
| **Noise free projection** | The what-if simulation run without random noise, so two runs differ only by the action |

## Data and provenance

| Term | Meaning |
| --- | --- |
| **HealthObservation** | The canonical record: one measurement with unit, time, origin, quality and context |
| **data_origin** | Origin label on every record: `REAL_PUBLIC`, `DERIVED`, `SIMULATED`, `MANUAL` |
| **Device adapter** | Code that turns a device or file format into canonical observations |
| **Provenance** | Where a record came from: source, URL, accession, version, file, SHA-256, download time, license, parser |
| **Accession** | Study identifier in a repository, for example OSD-569 |
| **ISA** | Investigation, Study, Assay: the metadata format used by OSDR |
| **L-n / R+n** | n days before launch / n days after return (sample time points) |
| **CBC / CMP** | Complete blood count / comprehensive metabolic panel |
| **Replay** | Playing back a real historical series inside the app, always labeled as historical |
| **Analog** | A ground study that mimics spaceflight conditions (HERA, bed rest, confinement) |
| **SHA-256** | A file fingerprint used to prove a downloaded file is unchanged |
| **FHIR R4** | HL7 health data exchange standard; AHI exports a Bundle with Patient, Device and Observation |
| **LOINC** | Standard codes for clinical observations, used in the FHIR export where well established |

## 3D anatomy

| Term | Meaning |
| --- | --- |
| **Atlas** | The anatomical model behind the 3D body: Z-Anatomy, an open 3D atlas of human anatomy (CC BY-SA 4.0), prepared for the app as 250 structures in nine files. See [3D anatomy assets](../data/anatomy-assets) |
| **Reference anatomy** | One adult reference model shown for every crew member. Not a scan of the astronaut |
| **Structure** | One selectable part of the atlas (a bone, a muscle, an organ, or a merged group such as "Bones of left hand"), with a stable id such as `femur-left` |
| **Anatomical system** | One of nine groups of structures (skin, skeletal, muscular, cardiovascular, respiratory, nervous, digestive, urinary, other). Also a layer of the viewer and one file |
| **Body region (body system)** | One of the seven monitored regions with metrics: brain, heart, lungs, kidneys, muscles, skeleton, skin. A structure reports under at most one region |
| **Tissue class** | The kind of tissue of a structure (bone, muscle, artery, nerve and 15 more). It selects the material the viewer draws it with |
| **Monitored** | A structure whose body region has metrics. It shows that region's status and data |
| **Context only** | A structure no device or metric relates to (for example the stomach, nerves, eyes). It can be explored but never shows a status, because nothing is measured |
| **Related indicator** | A metric that describes a body system as a whole or an associated behavior, not a measurement of the selected structure (for example sleep for the brain, hydration index for the kidneys) |
| **Ghost** | The faint see-through look of everything that is not the current selection. A viewing aid, not a status |
| **Manifest** | `manifest.json`: the list of structures and files of the atlas, with source and license. The contract between the asset pipeline and the viewer |
| **GLB** | Binary form of glTF 2.0, the open 3D file format. The atlas ships one GLB per anatomical system |
| **glTF Transform** | Open source toolkit used by the pipeline to clean and compress the GLB files |
| **Meshopt** | Mesh compression (`EXT_meshopt_compression`) used in the GLB files. Its decoder ships with three.js, so no file is fetched from a CDN |
| **Decimation** | Reducing the triangle count of a mesh while keeping its shape |
| **Procedural** | Generated by code instead of loaded from a model file. Used for the kidneys of the atlas and for the fallback body |
| **Procedural fallback** | The simplified body shown automatically when the atlas cannot load |
| **SDF / Surface Nets** | Signed distance field and the method that turns it into a mesh. Used only by the procedural geometry |
| **BVH** | Bounding volume hierarchy: a spatial index that makes picking a structure under the pointer fast |
| **Blender** | Open source 3D software, used headless (no window) to prepare the atlas |
| **CC BY-SA 4.0** | Creative Commons Attribution-ShareAlike license of the anatomy files: reuse requires attribution and the same license. The app code is MIT |

## Space and NASA

| Term | Meaning |
| --- | --- |
| **HRP** | NASA Human Research Program |
| **Five hazards** | Radiation, isolation and confinement, distance from Earth, gravity fields, hostile and closed environments |
| **OSDR** | NASA Open Science Data Repository |
| **EDA** | NASA Environmental Data Application (ISS cabin environment and radiation) |
| **RadLab** | NASA portal for dosimetry data |
| **NLSP** | NASA Life Sciences Portal |
| **Standard Measures** | The standard set of measures NASA collects before, during and after missions |
| **Inspiration4** | A 3 day SpaceX commercial mission (2021) with 4 crew; source of the OSDR blood panels |
| **Flight surgeon** | The physician on the ground responsible for crew health |
| **Crew medical officer (CMO)** | The crew member trained to act on medical issues on board |
| **Mission control** | The ground team operating the mission |
| **Bio-Monitor / Astroskin** | Canadian Space Agency smart shirt used on the ISS (simulated in AHI) |
| **Actigraphy** | Wrist sensor measuring movement and light, used to estimate sleep |
| **CEVIS / ARED / T2** | ISS exercise devices: cycle ergometer, resistive exercise device, treadmill. Exercise equipment, not medical monitors |
| **HRV (RMSSD)** | Heart rate variability: beat to beat variation. Lower than your normal often goes with stress or poor recovery |
| **SpO2** | Blood oxygen saturation |
| **GCR / SAA** | Galactic cosmic rays / South Atlantic Anomaly, sources of radiation dose on the ISS |
| **mGy / µGy/h** | Absorbed radiation dose / dose rate |
| **SANS** | Spaceflight associated neuro-ocular syndrome; tracked from periodic eye exams (roadmap). The eyes are context only structures today |
| **EVA** | Extravehicular activity (spacewalk) |
| **Light time delay** | One way communication delay: ISS 0.5 s, Moon 1.3 s, Mars about 4 to 22 min |

## AI and analytics vocabulary

| Term | Meaning | In AHI |
| --- | --- | --- |
| **Statistical processing** | Descriptive statistics on recent data (median, MAD, quantiles, EWMA) | Implemented |
| **Machine learning (ML)** | A model whose parameters are learned from labeled or unlabeled training data | Not implemented |
| **LLM** | Large language model, a generative text model | Not used at runtime; a guarded explanation layer is planned |
| **RAG** | Retrieval augmented generation: an LLM answering from retrieved documents | Not implemented |
| **Agent** | Software that plans and calls tools autonomously with an LLM | Not implemented |
| **IQR rule** | Outlier rule based on the interquartile range | Not implemented (robust z is used) |
| **CUSUM** | Cumulative sum control chart for small persistent shifts | Not implemented (EWMA drift is used) |
| **Isolation Forest** | Unsupervised multivariate anomaly detector | Planned (spec US-019) |
| **ARIMA** | Autoregressive integrated moving average forecasting model | Not implemented |
| **XGBoost** | Gradient boosted trees, needs a labeled dataset | Not implemented |
| **SHAP** | Method to attribute a model prediction to its inputs | Not implemented (rules are explained by their factors) |

Details: [AI and analytics approach](../intelligence/ai-and-analytics).

## Documentation status labels

| Label | Meaning |
| --- | --- |
| **IMPLEMENTED** | Present in the code and exercised by the prototype |
| **EXPERIMENTAL** | Implemented but heuristic or not validated |
| **PLANNED** | In the backlog or roadmap, not in the code |
| **CONCEPTUAL** | A design proposal only |
| **NOT_IMPLEMENTED** | Deliberately absent |
| **DEPRECATED** | Being replaced |

## Next steps

- [Introduction](./introduction)
- [Data dictionary](../data/data-dictionary)
- [Health intelligence overview](../intelligence/overview)
