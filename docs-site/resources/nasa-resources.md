---
title: NASA & Technical Resources
description: Official NASA data, research and device links and the technical standards and tools used by the Astronaut Health Intelligence Platform.
verified: 2026-11-14
---

# NASA & Technical Resources

Official links used by the Astronaut Health Intelligence Platform (AHI), from section 21 of the product spec plus the technical documentation of the tools it is built with. Scientific papers are listed separately in [Scientific references](../science/references).

::: info Availability
NASA source availability was checked on 2026-11-14 (OSDR APIs reachable; EDA reachable; RadLab returned HTTP 500; NLSP, Standard Measures, Artemis II Standard Measures and HRP hazards pages reachable). Details per source: [NASA data sources](../data/sources).
:::

## Challenge

| Resource | Link |
| --- | --- |
| NASA Space Apps Challenge 2026, Health Monitoring Software | [spaceappschallenge.org](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) |

## NASA data and research

| Resource | What it is | Link |
| --- | --- | --- |
| NASA OSDR | Open Science Data Repository: space life science studies and files | [osdr.nasa.gov/bio/repo](https://osdr.nasa.gov/bio/repo/) |
| About OSDR | Overview of the repository | [science.nasa.gov](https://science.nasa.gov/biological-physical/data/osdr/) |
| OSDR Public API | API documentation | [nasa.gov/osdr-api](https://www.nasa.gov/osdr-api/) |
| OSDR FAQ | Access policy and questions | [science.nasa.gov](https://science.nasa.gov/reference/osdr-faq/) |
| OSDR Visualization Portal | Biological Data API and visual tools | [visualization.osdr.nasa.gov](https://visualization.osdr.nasa.gov/) |
| Environmental Data Application (EDA) | ISS cabin environment and radiation for payload missions | [visualization.osdr.nasa.gov/eda](https://visualization.osdr.nasa.gov/eda/) |
| RadLab | Dosimetry from several instruments | [visualization.osdr.nasa.gov/radlab](https://visualization.osdr.nasa.gov/radlab/gui/overview/) |
| NASA Life Sciences Portal (NLSP) | Discovery of life science and human health data | [nlsp.nasa.gov](https://nlsp.nasa.gov/) |
| NASA Standard Measures | Standard set of measures collected before, during and after missions | [nasa.gov](https://www.nasa.gov/reference/standard-measures/) |
| Artemis II Standard Measures | Measures planned for Artemis II | [nasa.gov](https://www.nasa.gov/reference/artemis-ii-standard-measures/) |
| HRP hazards of human spaceflight | Human Research Program risk framework | [nasa.gov/hrp/hazards](https://www.nasa.gov/hrp/hazards/) |

## NASA devices and monitoring

| Resource | Link |
| --- | --- |
| Wearable tech for space station research | [nasa.gov](https://www.nasa.gov/missions/station/iss-research/wearable-tech-for-space-station-research/) |
| NTRS: Wearable Biosensor Monitor to Support Autonomous Crew Health and Readiness to Perform (Astroskin in HERA, 2017) | [ntrs.nasa.gov](https://ntrs.nasa.gov/citations/20190001996) |
| Canadian Space Agency Bio-Monitor | [csa-asc.gc.ca](https://www.csa-asc.gc.ca/eng/sciences/bio-monitor.asp) |
| NASA exercise countermeasures | [nasa.gov](https://www.nasa.gov/reference/jsc-exercise-countermeasures/) |
| ISS reference guide (PDF) | [nasa.gov](https://www.nasa.gov/wp-content/uploads/2022/06/508318main_iss_ref_guide_nov2010.pdf) |

How these devices relate to the simulated ones: [Health monitoring in space missions](../science/health-monitoring-in-missions) and [Data dictionary](../data/data-dictionary#simulated-devices).

## Standards and interoperability

| Standard | Use in AHI | Link |
| --- | --- | --- |
| HL7 FHIR R4 | Export of Patient, Device and Observation resources | [hl7.org/fhir](https://www.hl7.org/fhir/) |
| LOINC | Codes for well established vital signs in the export | [loinc.org](https://loinc.org/) |
| ISA model | Metadata format of OSDR studies | [isa-specs.readthedocs.io](https://isa-specs.readthedocs.io/) |

## Tools the platform is built with

| Tool | Use | Link |
| --- | --- | --- |
| React | UI framework | [react.dev](https://react.dev/) |
| Vite | Build and dev server | [vite.dev](https://vite.dev/) |
| Tailwind CSS | Styling | [tailwindcss.com](https://tailwindcss.com/) |
| three.js | 3D rendering | [threejs.org](https://threejs.org/) |
| react-three-fiber | React renderer for three.js | [docs.pmnd.rs](https://docs.pmnd.rs/react-three-fiber) |
| Z-Anatomy | Source of the 3D anatomical atlas (CC BY-SA 4.0), see [3D anatomy assets](../data/anatomy-assets) | [z-anatomy.com](https://www.z-anatomy.com/) |
| Blender | Headless preparation of the 3D atlas (development time) | [blender.org](https://www.blender.org/) |
| glTF Transform and meshoptimizer | Cleaning and compressing the GLB files of the atlas | [gltf-transform.dev](https://gltf-transform.dev/), [meshoptimizer.org](https://meshoptimizer.org/) |
| zustand | State store | [github.com/pmndrs/zustand](https://github.com/pmndrs/zustand) |
| Recharts | Charts | [recharts.org](https://recharts.org/) |
| vitest | Tests | [vitest.dev](https://vitest.dev/) |
| VitePress | This documentation portal | [vitepress.dev](https://vitepress.dev/) |
| Mermaid | Diagrams in this portal | [mermaid.js.org](https://mermaid.js.org/) |
| GitHub Pages and Actions | Hosting and CI for this portal | [docs.github.com/pages](https://docs.github.com/en/pages) |

## Project links

| Resource | Link |
| --- | --- |
| Source code | [github.com/lucaspalharesbarbosa/astronaut-health-intelligence-platform](https://github.com/lucaspalharesbarbosa/astronaut-health-intelligence-platform) |
| This portal | [lucaspalharesbarbosa.github.io/astronaut-health-intelligence-platform](https://lucaspalharesbarbosa.github.io/astronaut-health-intelligence-platform/) |

## Next steps

- [Scientific references](../science/references)
- [NASA data sources](../data/sources)
