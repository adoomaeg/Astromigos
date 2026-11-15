---
title: Recursos da NASA e técnicos
description: Links oficiais da NASA, de dispositivos, padrões e ferramentas usados pela Astronaut Health Intelligence Platform.
verified: 2026-11-14
---

# Recursos da NASA e técnicos

Links oficiais usados no projeto da Astronaut Health Intelligence Platform (AHI). Vêm do `PROJECT_MASTER.md` (seção 21) e das consultas feitas em 14/11/2026. As referências científicas citadas nas páginas de ciência estão em [Referências científicas](/pt/science/references).

::: info Nota de pesquisa
Estas fontes sustentam a existência dos repositórios, modalidades de pesquisa, indicadores e equipamentos descritos. Elas **não** garantem que cada arquivo, série temporal, API ou licença esteja disponível. Não presuma que todo equipamento listado tenha integração pública nem que todo dado humano seja aberto. O status de cada fonte está em [Fontes de dados da NASA](/pt/data/sources).
:::

## O desafio

| Recurso | Link |
| --- | --- |
| NASA Space Apps Challenge 2026: Health Monitoring Software | https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ |

## NASA: dados e pesquisa

| Recurso | Link | Uso na AHI |
| --- | --- | --- |
| NASA OSDR (Open Science Data Repository) | https://osdr.nasa.gov/bio/repo/ | Fonte de OSD-569 e OSD-575 |
| Sobre o OSDR | https://science.nasa.gov/biological-physical/data/osdr/ | Contexto |
| OSDR Public API | https://www.nasa.gov/osdr-api/ | Descoberta e download |
| OSDR FAQ (acesso a dados) | https://science.nasa.gov/reference/osdr-faq/ | Política de acesso |
| OSDR Visualization Portal | https://visualization.osdr.nasa.gov/ | Portal de visualização |
| Biological Data API | https://visualization.osdr.nasa.gov/biodata/api/ | Conferência de metadados |
| Environmental Data Application (EDA) | https://visualization.osdr.nasa.gov/eda/ | Replay planejado do ambiente da ISS |
| EDA API (missões) | https://visualization.osdr.nasa.gov/eda/api/missions/ | Lista de missões (só metadados) |
| RadLab | https://visualization.osdr.nasa.gov/radlab/gui/overview/ | Dosimetria (fora do ar em 14/11/2026) |
| NASA Life Sciences Portal (NLSP) | https://nlsp.nasa.gov/ | Estudos análogos, acesso por pedido |
| NASA Standard Measures | https://www.nasa.gov/reference/standard-measures/ | Justificar o catálogo de métricas |
| Artemis II Standard Measures | https://www.nasa.gov/reference/artemis-ii-standard-measures/ | Medidas planejadas |
| NASA HRP: os cinco perigos | https://www.nasa.gov/hrp/hazards/ | Enquadramento dos riscos |

## NASA e parceiros: dispositivos e monitoramento

| Recurso | Link | Equipamento simulado na AHI |
| --- | --- | --- |
| Wearable Tech for Space Station Research | https://www.nasa.gov/missions/station/iss-research/wearable-tech-for-space-station-research/ | Actigrafia |
| NASA NTRS: Wearable Biosensor Monitor to Support Autonomous Crew Health and Readiness to Perform (Astroskin no HERA, 2017) | https://ntrs.nasa.gov/citations/20190001996 | Biossensor vestível testado no análogo HERA |
| Canadian Space Agency: Bio-Monitor | https://www.csa-asc.gc.ca/eng/sciences/bio-monitor.asp | Camiseta inteligente |
| NASA Exercise Countermeasures | https://www.nasa.gov/reference/jsc-exercise-countermeasures/ | CEVIS, ARED, T2 |
| NASA ISS Reference Guide | https://www.nasa.gov/wp-content/uploads/2022/06/508318main_iss_ref_guide_nov2010.pdf | Contexto da estação |

## Padrões e interoperabilidade

| Recurso | Link | Uso na AHI |
| --- | --- | --- |
| HL7 FHIR R4 | https://www.hl7.org/fhir/ | Exportação do relatório de turno |
| ISA Model | https://isa-specs.readthedocs.io/ | Metadados do OSDR |

## Ferramentas do projeto

| Ferramenta | Link |
| --- | --- |
| React | https://react.dev/ |
| Vite | https://vite.dev/ |
| three.js | https://threejs.org/ |
| react-three-fiber | https://r3f.docs.pmnd.rs/ |
| Z-Anatomy (fonte do atlas anatômico 3D, CC BY-SA 4.0; veja [Assets de anatomia 3D](/pt/data/anatomy-assets)) | https://www.z-anatomy.com/ |
| Blender (preparação do atlas 3D, sem interface, em desenvolvimento) | https://www.blender.org/ |
| glTF Transform e meshoptimizer (limpeza e compressão dos arquivos GLB do atlas) | https://gltf-transform.dev/ e https://meshoptimizer.org/ |
| zustand | https://zustand.docs.pmnd.rs/ |
| Recharts | https://recharts.org/ |
| Tailwind CSS | https://tailwindcss.com/ |
| vitest | https://vitest.dev/ |
| VitePress | https://vitepress.dev/ |
| Mermaid | https://mermaid.js.org/ |

## Repositório e portal

| Recurso | Link |
| --- | --- |
| Código | https://github.com/lucaspalharesbarbosa/astronaut-health-intelligence-platform |
| Este portal | https://lucaspalharesbarbosa.github.io/astronaut-health-intelligence-platform/ |

A AHI não é afiliada nem endossada pela NASA.

## Próximos passos

- [Fontes de dados da NASA](/pt/data/sources): o status de cada fonte.
- [Referências científicas](/pt/science/references).
- [Roadmap](/pt/resources/roadmap).
