---
title: Dataset Catalog
description: The real public NASA OSDR datasets used by the Astronaut Health Intelligence Platform (OSD-569 and OSD-575), with provenance, variables, import rules and limitations.
status: IMPLEMENTED
origin: REAL_PUBLIC, DERIVED
code:
  - frontend/web/scripts/osdr/import.mjs
  - frontend/web/scripts/osdr/lib.mjs
  - frontend/web/src/data/osdr.ts
  - frontend/web/src/features/datasources/RealDatasetsTab.tsx
verified: 2026-11-14
---

# Dataset Catalog

The canonical list of real public datasets in the Astronaut Health Intelligence Platform (AHI). Two NASA OSDR datasets from the Inspiration4 mission are imported and shown as **historical reference** in **Tools > Data and model > Real datasets**. How they were found: [NASA data sources](./sources#nasa-osdr).

::: warning Reference only
These datasets are **not** used to train, tune or calibrate the engine, do not set thresholds, and are never mixed with the simulated crew. The Inspiration4 subjects (C001 to C004) are not ORION, LYRA, VEGA or ATLAS. Lab reference ranges are the testing lab's ranges and are never used for status or alerts.
:::

## Catalog

| Accession | Content | Rows | Analytes | Time points | Subjects | Origin |
| --- | --- | --- | --- | --- | --- | --- |
| [OSD-569](#osd-569-complete-blood-count) | Complete blood count (CBC) | 553 | 20 | 7 | 4 | <OriginBadge origin="REAL_PUBLIC" /> |
| [OSD-575](#osd-575-comprehensive-metabolic-panel) | Comprehensive metabolic panel (CMP) | 531 | 19 | 7 | 4 | <OriginBadge origin="REAL_PUBLIC" /> |
| Group means of both | Mean per analyte and time point, sexes pooled | | | | | <OriginBadge origin="DERIVED" /> |

## OSD-569: complete blood count

| Field | Value |
| --- | --- |
| Source | NASA Open Science Data Repository (OSDR) |
| Study page | [osdr.nasa.gov/bio/repo/data/studies/OSD-569](https://osdr.nasa.gov/bio/repo/data/studies/OSD-569) |
| Metadata version | OSDR metadata version 4; public release 14-May-2024 |
| File | `LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv` (26,138 bytes) |
| SHA-256 | `10a878b009eb...` (full value in `data/manifests/OSD-569.json`) |
| Population | 4 subjects C001 to C004 (2 female, 2 male per sample metadata); "four private astronauts". Age not stated |
| Mission | SpaceX Inspiration4 (2021-09-16 to 2021-09-18) |
| Design | Repeated measures, 7 ground time points: L-92, L-44, L-3, R+1, R+45, R+82, R+194. No in-flight samples |
| Assay | Whole blood in K2 EDTA tube, Quest Diagnostics test code 6399, Sysmex XN analyzer |
| Variables | 20 analytes: WBC, RBC, hemoglobin, hematocrit, MCV, MCH, MCHC, RDW, platelets, MPV, 5 absolute and 5 percent differential counts; units and lab reference ranges per row |
| License | Not stated in the source (`license: null`) |

## OSD-575: comprehensive metabolic panel

| Field | Value |
| --- | --- |
| Study page | [osdr.nasa.gov/bio/repo/data/studies/OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) |
| Metadata version | OSDR metadata version 3; public release 14-May-2024 |
| File | `LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv` (25,275 bytes) |
| SHA-256 | `dab247eb794e...` (full value in `data/manifests/OSD-575.json`) |
| Population | Same 4 subjects C001 to C004 (2 female, 2 male); age not stated |
| Design | Same 7 time points in the file |
| Assay | Fresh serum (serum separator tube), Quest Diagnostics test code 10231, Beckman Coulter AU5800 |
| Variables | 19 analytes: glucose, BUN, creatinine, BUN/creatinine ratio, sodium, potassium, chloride, CO2, calcium, total protein, albumin, globulin, A/G ratio, total bilirubin, alkaline phosphatase, AST, ALT, two eGFR variants |
| License | Not stated in the source (`license: null`) |

Both datasets come from the same Inspiration4 biospecimen program (Weill Cornell IRB protocol 21-05023569; the metadata states that all crew members consented to data and sample sharing). The `SUBMITTED` files were preferred over the `TRANSFORMED` ones: they are in long format with an explicit units column.

::: info Known discrepancy
The OSD-575 description lists post-flight time points R+1, R+45 and R+82, but the CMP file also contains R+194. It is shown as found in the file and flagged in the manifest.
:::

## Candidates examined

| Accession | Content | Decision |
| --- | --- | --- |
| **OSD-569** | Inspiration4 whole blood: complete blood count (CSV, 26 KB), RNA-seq, WGS | **Chosen**: small clinical CBC table, 7 time points, units and lab ranges in the file |
| **OSD-575** | Inspiration4 serum metabolic panel and cytokine arrays | **Chosen (CMP only)**: clinical chemistry with units and lab ranges. Multiplex panels not imported (relative, unitless values) |
| OSD-656 | Inspiration4 urine inflammation panel | Rejected for now: relative NGS counts, no clinical units |
| OSD-570, 571, 574, 687 | Inspiration4 single cell, plasma omics, skin, histone profiling | Rejected: omics, not dashboard measures |
| OSD-572, 573, 630 | Inspiration4 swabs and stool | Rejected: microbial, not human physiology |
| OSD-542, OSD-140, bed rest studies | Ground analogs | Rejected: analog and omics (would have to be labeled as such) |

The full list with reasons is in `docs/data-source-inventory.md`; the machine readable output is `data/manifests/osdr-discovery.json`.

## Import rules applied

Run inside `frontend/web` (Node 20+, no dependencies):

```bash
node scripts/osdr/discover.mjs   # search and shortlist -> data/manifests/osdr-discovery.json
node scripts/osdr/import.mjs     # download, hash, parse, write manifests and processed JSON
```

- The scripts only contact `https://` hosts on an allow list (osdr.nasa.gov, visualization.osdr.nasa.gov, api.nasa.gov, science.nasa.gov, www.nasa.gov). The OSDR storage bucket is accepted only as a redirect target issued by osdr.nasa.gov.
- Downloaded files are untrusted data: hashed and parsed as text only, never executed.
- Values are kept exactly as reported. Non numeric cells (22 cells: 21 `NA` for BUN/creatinine ratio, 1 total bilirubin) stay `null` with the raw text; nothing is imputed.
- Analyte name variants are merged only when the unit is identical; subject sex is checked against the ISA metadata, and the import fails on any mismatch.
- The two race based eGFR rows are kept in the raw and long format files but not displayed.
- Group means are `DERIVED` (sexes pooled) and labeled as such.

| Path | Content |
| --- | --- |
| `data/raw/<OSD>/` | Original CSV byte for byte, plus API responses as received |
| `data/manifests/<OSD>.json` | `DatasetRecord`, files with URL, size, SHA-256 and download time, protocols, quality counts, discrepancies |
| `data/processed/<OSD>.observations.json` | Long format, one row per source row, `data_origin: REAL_PUBLIC` |
| `frontend/web/src/data/<OSD>.json` | Compact panel for the UI (about 25 KB each), lazy loaded |

The general pipeline for future datasets is in [Pipeline, normalization and quality](./pipeline-and-quality).

## How the data is shown

![Data and model dialog showing a real NASA OSDR lab panel with provenance](/screenshots/data-model.png)

- Labeled "Historical public research data. Not live telemetry and not this crew."
- Pick an analyte to see each subject across the 7 time points, a break where the flight has no samples, the lab range printed in the source, the group mean, the assay protocol and the file SHA-256.

## Limitations

- Four people on one 3 day commercial flight: not representative of long duration ISS or exploration crews. No statistical claim can be made.
- Fasting status, age and time of day of collection are not stated.
- No in-flight samples.
- The OSDR search index may miss relevant studies.

## Next steps

- [Data origins and provenance](./data-origins)
- [Governance and privacy](./governance-and-privacy)
