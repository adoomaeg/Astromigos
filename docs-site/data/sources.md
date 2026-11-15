---
title: NASA Data Sources
description: The NASA data sources examined for the Astronaut Health Intelligence Platform (OSDR, EDA, RadLab, NLSP, Standard Measures, Artemis II), what each offers and its status.
status: IMPLEMENTED
origin: REAL_PUBLIC
code:
  - frontend/web/scripts/osdr/discover.mjs
  - frontend/web/scripts/osdr/import.mjs
verified: 2026-11-14
---

# NASA Data Sources

The Astronaut Health Intelligence Platform (AHI) separates three things clearly: **simulated** crew data (everything on the live dashboard), **real public** NASA data (shown only as historical reference), and **reference material** that justifies what is monitored. This page lists every NASA source examined and what was found. The datasets actually imported are detailed in the [Dataset catalog](./dataset-catalog).

::: info Checked on 2026-11-14
All queries were made live against public NASA endpoints on 2026-11-14 (UTC), without API keys or authentication. Availability can change.
:::

## Summary

| Source | What it offers | Status on 2026-11-14 | Used in AHI |
| --- | --- | --- | --- |
| [NASA OSDR](#nasa-osdr) | Space life science studies, files and ISA metadata | Public APIs reachable | <StatusBadge status="IMPLEMENTED" /> OSD-569 and OSD-575 |
| [NASA EDA](#nasa-eda) | ISS cabin environment telemetry and radiation doses | API lists 24 payload missions (metadata only); telemetry CSV via the Data Tables tab | <StatusBadge status="PLANNED" /> top priority (P0) |
| [NASA RadLab](#nasa-radlab) | Dosimetry from several instruments and agencies | HTTP 500 on all routes | <StatusBadge status="PLANNED" /> retry later |
| [NLSP](#nasa-life-sciences-portal-nlsp) | Discovery portal for life science and human health data | Reachable; access per resource | <StatusBadge status="PLANNED" /> analog data |
| [Standard Measures](#nasa-standard-measures-and-artemis-ii) | The standard set of measures NASA collects | Reachable; reference, not a dataset | Justification of the catalog |
| [Artemis II Standard Measures](#nasa-standard-measures-and-artemis-ii) | Measures planned for Artemis II | Reachable; reference only | No |
| [HRP hazards](#nasa-hrp-hazards) | Framework of spaceflight risks | Reachable; reference | Frames every data domain |

::: warning No public live vital signs
There is no public, continuous physiological telemetry of astronauts (heart rate, ECG, SpO2 minute by minute). That is why the vitals in AHI are simulated, and the plan is to calibrate the simulator with published ranges rather than to look for a live feed. See [Health monitoring in space missions](../science/health-monitoring-in-missions).
:::

## NASA OSDR

The NASA Open Science Data Repository is the main repository for space life science: studies, files, ISA metadata, missions, subjects and biospecimens.

- Portal: [osdr.nasa.gov/bio/repo](https://osdr.nasa.gov/bio/repo/)
- API documentation: [nasa.gov/osdr-api](https://www.nasa.gov/osdr-api/)
- Access policy: [OSDR FAQ](https://science.nasa.gov/reference/osdr-faq/)

### Endpoints used

| Step | Endpoint | Notes |
| --- | --- | --- |
| Search | `https://osdr.nasa.gov/osdr/data/search?term=<term>&type=cgene&from=0&size=100` | 14 terms, results deduplicated by accession |
| Study metadata | `https://osdr.nasa.gov/osdr/data/osd/meta/<n>` | ISA metadata: description, factors, protocols, samples, sex, mission |
| File listing | `https://osdr.nasa.gov/osdr/data/osd/files/<n>` | File names, sizes, categories, download path |
| Cross check | `https://visualization.osdr.nasa.gov/biodata/api/v2/dataset/<OSD>/` | The Biological Data API returns the same metadata and download URLs |
| Other entities | `https://osdr.nasa.gov/geode-py/ws/api/{missions,payloads,hardware,subjects,biospecimens,experiments}` | Missions, payloads, hardware, subjects, biospecimens |

### How discovery was done

1. Searched 14 terms. Total hits reported by the API: human 227, astronaut 68, Inspiration4 8, crew 87, spaceflight 395, physiology 23, sleep 3, cardiovascular 28, immune 74, blood 146, "Homo sapiens" 120, "complete blood count" 6, "metabolic panel" 0, cytokine 7.
2. Across the first 100 hits of each term: **367 unique studies, 110 with organism Homo sapiens**. Most of those are cell cultures, organoids, tissue chips or ground analogs, not astronauts.
3. Read metadata and file listings of the human candidates and recorded a decision for each (chosen or rejected, and why). The decisions are in the [Dataset catalog](./dataset-catalog#candidates-examined).
4. Downloaded only the chosen files, hashed them and parsed them as text.

::: tip The search index is not exhaustive
OSD-575 and OSD-656 never appeared in any search result although they exist and are public. They were found through the "related studies" list in the OSD-569 and OSD-575 descriptions. Always read study descriptions.
:::

Not found: continuous physiological signals (ECG, HR, SpO2), astronaut sleep or actigraphy files, or cabin telemetry as human data. The term "sleep" returned 3 hits, none with human sleep measurements.

## NASA EDA

The Environmental Data Application holds real ISS cabin environment telemetry (CO2, temperature, humidity) and radiation doses for the periods of ISS research missions.

- Portal: [visualization.osdr.nasa.gov/eda](https://visualization.osdr.nasa.gov/eda/)
- API: `https://visualization.osdr.nasa.gov/eda/api/missions/` lists **24 payload missions**: Rodent Research (RR-1, RR-3 to RR-10, RR-12, RR-17 to RR-20, RR-22, RR-23, RR-25, RR-28), APEX-03-1, APEX-03-2, APEX-04, VEG-01A, VEG-01B and VEG-01C.
- Each mission record holds only `name`, `title`, `description` and `link`: **metadata only, no time series through the API**.
- Telemetry comes from the interface, **Data Tables** tab, as a CSV download.
- Fields seen on the page: `CO2_ppm_ISS` and `CO2_ppm_Ground` (cabin vs ground control), temperature, humidity, and radiation doses (GCR and SAA, plus the accumulated dose).

Cautions for import: not every mission has CO2; the missions are rodent and plant payloads, so the data describes the ISS cabin in that period, **not the crew**; `CO2_ppm_Ground` is a ground control and must not be imported as cabin data.

Planned use: replace the cabin simulator with a `REAL_PUBLIC` **replay** of a real ISS period, clearly labeled as historical ([Roadmap](../resources/roadmap)).

## NASA RadLab

- Portal: [visualization.osdr.nasa.gov/radlab/gui/overview](https://visualization.osdr.nasa.gov/radlab/gui/overview/)
- Dosimetry data from several instruments and agencies, with instrument and period selection.
- **Status on 2026-11-14: HTTP 500** on `/radlab/`, `/radlab/gui/` and `/radlab/api/`. To retry later. Meanwhile the EDA doses are the path for real radiation data. Background: [Radiation and cabin environment](../science/radiation-and-environment).

## NASA Life Sciences Portal (NLSP)

- Portal: [nlsp.nasa.gov](https://nlsp.nasa.gov/)
- A discovery portal for historical life science and human health data (LSDA, HRP), including analog studies.
- No API is assumed. Many datasets require a formal request. It may be the path to real sleep and cognition data from analogs, which would be labeled as analog participants, never as astronauts.

## NASA Standard Measures and Artemis II

- [Standard Measures](https://www.nasa.gov/reference/standard-measures/): the standardized set of measures NASA collects before, during and after missions (wrist activity and light, sleep reports, nutrition related samples, saliva and immune function, cognitive tests, sensorimotor and balance tests, strength, microbiome).
- Use in AHI: **justify the metric catalog**. The daily check-in is a simplified questionnaire in this style.
- [Artemis II Standard Measures](https://www.nasa.gov/reference/artemis-ii-standard-measures/): what is planned. No open data is assumed.

## NASA HRP hazards

The [NASA HRP hazards](https://www.nasa.gov/hrp/hazards/) page frames every data domain in AHI (radiation, isolation and confinement, distance from Earth, gravity fields, hostile and closed environments). How each hazard maps to monitored signals is explained in [Spaceflight health hazards](../science/spaceflight-hazards).

## Next steps

- [Dataset catalog](./dataset-catalog): OSD-569 and OSD-575 in detail.
- [Pipeline, normalization and quality](./pipeline-and-quality): how to deliver new real data.
- [NASA and technical resources](../resources/nasa-resources): every official link in one place.
