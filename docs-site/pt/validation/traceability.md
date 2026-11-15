---
title: Matriz de rastreabilidade
description: Cada capacidade da Astronaut Health Intelligence Platform ligada ao requisito, ao código, aos testes, à origem dos dados, ao método e à referência.
status: IMPLEMENTED
verified: 2026-11-14
---

# Matriz de rastreabilidade

Esta matriz liga cada capacidade da Astronaut Health Intelligence Platform (AHI) ao **requisito** do documento mestre (histórias de usuário US-xxx do `PROJECT_MASTER.md`, seção 11), ao **código**, aos **testes**, à **origem dos dados**, ao **método** documentado e à **referência** científica ou de fonte. O status de cada linha está na [Matriz de status das funcionalidades](/pt/overview/feature-status).

## Simulação e dados

| Capacidade | Requisito | Código | Testes | Origem | Método | Referência |
| --- | --- | --- | --- | --- | --- | --- |
| Simulador de vitais (Bio-Monitor) | US-010 | <CodeLink path="frontend/web/src/engine/sim/adapters.ts" />, <CodeLink path="frontend/web/src/engine/sim/physiology.ts" /> | <CodeLink path="frontend/web/src/engine/engine.test.ts" /> | <OriginBadge origin="SIMULATED" /> | [Simulação](/pt/intelligence/scenario-simulation) | [Fisiologia monitorada](/pt/science/monitored-physiology) |
| Simulador de sono e atividade | US-011 | <CodeLink path="frontend/web/src/engine/sim/schedule.ts" /> | <CodeLink path="frontend/web/src/engine/anomaly.test.ts" /> | <OriginBadge origin="SIMULATED" /> | [Simulação](/pt/intelligence/scenario-simulation) | [Fisiologia monitorada](/pt/science/monitored-physiology) |
| Simulador ambiental e de radiação | US-012 | <CodeLink path="frontend/web/src/engine/sim/cabin.ts" /> | <CodeLink path="frontend/web/src/engine/engine.test.ts" /> | <OriginBadge origin="SIMULATED" /> | [Simulação](/pt/intelligence/scenario-simulation) | [Radiação e ambiente](/pt/science/radiation-and-environment) |
| Simulador de exercício | US-013 | <CodeLink path="frontend/web/src/engine/sim/adapters.ts" /> | <CodeLink path="frontend/web/src/engine/missionDays.test.ts" /> | <OriginBadge origin="SIMULATED" /> | [Simulação](/pt/intelligence/scenario-simulation) | [Monitoramento em missões](/pt/science/health-monitoring-in-missions) |
| Modelo canônico e normalização | US-007 | <CodeLink path="frontend/web/src/types/domain.ts" /> | <CodeLink path="frontend/web/src/lib/fhir.test.ts" /> | todas | [Modelo de dados](/pt/architecture/data-model) | `PROJECT_MASTER.md` 6.3 |
| Astronautas pseudonimizados, missão e dispositivos | US-003, US-004, US-005 | <CodeLink path="frontend/web/src/engine/catalog.ts" /> | <CodeLink path="frontend/web/src/lib/fhir.test.ts" /> | <OriginBadge origin="SIMULATED" /> | [Governança](/pt/data/governance-and-privacy) | `PROJECT_MASTER.md` 17 |
| Importação de dataset da NASA | US-008 | <CodeLink path="frontend/web/scripts/osdr/import.mjs" /> | checagens do script | <OriginBadge origin="REAL_PUBLIC" /> | [Pipeline](/pt/data/pipeline-and-quality) | [Catálogo de datasets](/pt/data/dataset-catalog) |
| Validação de qualidade dos dados | US-009 | <CodeLink path="frontend/web/scripts/osdr/lib.mjs" />, <CodeLink path="frontend/web/src/engine/anomaly.ts" /> | <CodeLink path="frontend/web/src/engine/anomaly.test.ts" /> | <OriginBadge origin="REAL_PUBLIC, DERIVED" /> | [Pipeline](/pt/data/pipeline-and-quality), [Anomalias](/pt/intelligence/anomaly-detection) | OSDR (manifestos em `data/manifests/`) |
| API de ingestão | US-006 | | | | [Arquitetura alvo](/pt/architecture/target-architecture) | `PROJECT_MASTER.md` 10 |
| Persistência | US-002 | | | | [Arquitetura alvo](/pt/architecture/target-architecture) | `PROJECT_MASTER.md` 7 |

## Inteligência de saúde

| Capacidade | Requisito | Código | Testes | Origem | Método | Referência |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline individual | US-017 | <CodeLink path="frontend/web/src/engine/baseline.ts" /> | <CodeLink path="frontend/web/src/engine/baseline.test.ts" />, <CodeLink path="frontend/web/src/engine/stats.test.ts" /> | <OriginBadge origin="DERIVED" /> | [Linha de base pessoal](/pt/intelligence/personal-baseline) | `PROJECT_MASTER.md` 9.2 |
| Anomalias univariadas | US-018 | <CodeLink path="frontend/web/src/engine/anomaly.ts" /> | <CodeLink path="frontend/web/src/engine/anomaly.test.ts" /> | <OriginBadge origin="DERIVED" /> | [Anomalias](/pt/intelligence/anomaly-detection) | `PROJECT_MASTER.md` 9.3, 9.4 |
| Anomalias multivariadas | US-019 | parcial: regras combinadas em <CodeLink path="frontend/web/src/engine/risk.ts" /> | <CodeLink path="frontend/web/src/engine/risk.test.ts" /> | <OriginBadge origin="DERIVED" /> | [Risco](/pt/intelligence/risk-assessment); Isolation Forest em [IA e análise](/pt/intelligence/ai-and-analytics) | `PROJECT_MASTER.md` 9.3 |
| Avaliação de risco | US-020 | <CodeLink path="frontend/web/src/engine/risk.ts" /> | <CodeLink path="frontend/web/src/engine/risk.test.ts" /> | <OriginBadge origin="DERIVED" /> | [Risco](/pt/intelligence/risk-assessment) | `PROJECT_MASTER.md` 9.5 |
| Projeção de tendências | US-021 | <CodeLink path="frontend/web/src/engine/forecast.ts" /> | <CodeLink path="frontend/web/src/engine/forecast.test.ts" /> | <OriginBadge origin="DERIVED" /> | [Previsão](/pt/intelligence/forecasting) | `PROJECT_MASTER.md` 9.6 |
| Comparação com e sem intervenção | US-022 | <CodeLink path="frontend/web/src/engine/intervention.ts" /> | <CodeLink path="frontend/web/src/engine/intervention.test.ts" /> | <OriginBadge origin="SIMULATED" /> | [Recomendações](/pt/intelligence/recommendations) | Parâmetros do simulador |
| Recomendações por regras | US-023 | <CodeLink path="frontend/web/src/engine/recommendations.ts" /> | <CodeLink path="frontend/web/src/engine/risk.test.ts" />, <CodeLink path="frontend/web/src/engine/comms.test.ts" /> | <OriginBadge origin="DERIVED" /> | [Recomendações](/pt/intelligence/recommendations) | `PROJECT_MASTER.md` 9.7 |
| Explicação com IA | US-024 | | | | [IA e análise](/pt/intelligence/ai-and-analytics) | `PROJECT_MASTER.md` 9.7 |
| Alertas e reconhecimento | US-025 | <CodeLink path="frontend/web/src/engine/alerts.ts" /> | <CodeLink path="frontend/web/src/engine/alerts.test.ts" />, <CodeLink path="frontend/web/src/engine/risk.test.ts" /> | <OriginBadge origin="DERIVED, MANUAL" /> | [Alertas](/pt/intelligence/alerts) | Tempos de demo em `config.ts` |
| Check-in diário | sem US (v2) | <CodeLink path="frontend/web/src/engine/checkins.ts" /> | <CodeLink path="frontend/web/src/engine/checkins.test.ts" /> | <OriginBadge origin="SIMULATED, MANUAL" /> | [Autorrelato](/pt/intelligence/self-report-and-earth-link) | [Monitoramento em missões](/pt/science/health-monitoring-in-missions) |
| Comunicação com atraso | sem US (v2) | <CodeLink path="frontend/web/src/engine/comms.ts" /> | <CodeLink path="frontend/web/src/engine/comms.test.ts" /> | <OriginBadge origin="SIMULATED" /> | [Earth link](/pt/intelligence/self-report-and-earth-link) | [Riscos à saúde em voos espaciais](/pt/science/spaceflight-hazards) |

## Produto e governança

| Capacidade | Requisito | Código | Testes | Origem | Método ou página | Referência |
| --- | --- | --- | --- | --- | --- | --- |
| Painel de saúde | US-014 | <CodeLink path="frontend/web/src/app/App.tsx" /> | <CodeLink path="frontend/web/src/state/store.test.ts" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | [Tour do produto](/pt/product/product-tour) | `PROJECT_MASTER.md` 8.1 |
| Séries históricas | US-015 | <CodeLink path="frontend/web/src/components/TrendChart.tsx" />, <CodeLink path="frontend/web/src/engine/series.ts" /> | <CodeLink path="frontend/web/src/engine/engine.test.ts" />, <CodeLink path="frontend/web/src/engine/timeline.test.ts" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | [Tour do produto](/pt/product/product-tour) | `PROJECT_MASTER.md` 8.2 |
| Proveniência visível | US-016 | <CodeLink path="frontend/web/src/features/datasources/DataModelDialog.tsx" /> | <CodeLink path="frontend/web/src/lib/fhir.test.ts" /> | <OriginBadge origin="REAL_PUBLIC, DERIVED" /> | [Origens](/pt/data/data-origins) | [Catálogo de datasets](/pt/data/dataset-catalog) |
| Visão de longo prazo | sem US (v2) | <CodeLink path="frontend/web/src/engine/missionDays.ts" /> | <CodeLink path="frontend/web/src/engine/missionDays.test.ts" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | [Recursos da missão](/pt/product/mission-features) | Metas de demo em [Limiares](/pt/intelligence/thresholds) |
| Relatório de turno e FHIR R4 | sem US (v2) | <CodeLink path="frontend/web/src/lib/fhir.ts" /> | <CodeLink path="frontend/web/src/lib/fhir.test.ts" /> | <OriginBadge origin="SIMULATED, MANUAL" /> | [Recursos da missão](/pt/product/mission-features) | HL7 FHIR R4 ([Recursos](/pt/resources/nasa-resources)) |
| Cenários de demonstração | US-026 | <CodeLink path="frontend/web/src/engine/sim/scenarios.ts" /> | <CodeLink path="frontend/web/src/engine/engine.test.ts" /> | <OriginBadge origin="SIMULATED" /> | [Simulação](/pt/intelligence/scenario-simulation) | `PROJECT_MASTER.md` 13 |
| Auditoria | US-027 | <CodeLink path="frontend/web/src/engine/engine.ts" /> | <CodeLink path="frontend/web/src/engine/alerts.test.ts" />, <CodeLink path="frontend/web/src/engine/comms.test.ts" /> | <OriginBadge origin="DERIVED, MANUAL" /> | [Alertas](/pt/intelligence/alerts) | `PROJECT_MASTER.md` 17 |
| Demo final | US-028 | <CodeLink path="frontend/web/src/features/tour/steps.ts" /> | | <OriginBadge origin="SIMULATED" /> | [Cenários e demo](/pt/product/demo-scenarios) | `docs/demo-script.md` |
| Visualizador do atlas anatômico (corpo 3D) | sem US (v3) | <CodeLink path="frontend/web/src/features/anatomy/viewer/AtlasViewer.tsx" /> | nenhum para a renderização (verificação visual em `anatomy-lab.html`) | <OriginBadge origin="SIMULATED, DERIVED" /> | [Anatomia 3D](/pt/architecture/anatomy-3d) | Z-Anatomy ([Assets de anatomia 3D](/pt/data/anatomy-assets)) |
| Contrato do manifesto do atlas | sem US (v3) | <CodeLink path="frontend/web/src/features/anatomy/atlas/types.ts" /> | <CodeLink path="frontend/web/src/features/anatomy/atlas/manifest.contract.test.ts" />, `validate.mjs` | Z-Anatomy, CC BY-SA 4.0 | [Contrato do manifesto](/pt/architecture/anatomy-3d#manifest-contract) | [Assets de anatomia 3D](/pt/data/anatomy-assets) |
| Mapeamento da anatomia para a saúde | sem US (v3) | <CodeLink path="frontend/web/src/features/anatomy/atlas/health.ts" /> | <CodeLink path="frontend/web/src/features/anatomy/atlas/health.test.ts" />, <CodeLink path="frontend/web/src/features/anatomy/atlas/manifest.contract.test.ts" /> | <OriginBadge origin="DERIVED" /> | [Modelo de dados](/pt/architecture/data-model#anatomy-to-health-mapping) | [Fisiologia monitorada](/pt/science/monitored-physiology) |
| Seleção de estrutura e painel da estrutura | sem US (v3) | <CodeLink path="frontend/web/src/features/attention/StructureDetail.tsx" /> | <CodeLink path="frontend/web/src/state/selection.test.ts" />, <CodeLink path="frontend/web/src/features/anatomy/atlas/health.test.ts" /> (componentes do painel: nenhum) | <OriginBadge origin="SIMULATED, DERIVED" /> | [Tour do produto](/pt/product/product-tour#selecting-a-structure) | |
| Alertas e sinalizações por sistema do corpo | sem US (v3) | <CodeLink path="frontend/web/src/features/attention/RegionEvents.tsx" /> | <CodeLink path="frontend/web/src/features/anatomy/atlas/health.test.ts" /> (alertas, anomalias e valor observado por região) | <OriginBadge origin="DERIVED" /> | [Tour do produto](/pt/product/product-tour#detalhe-da-regiao) | |
| Carga sob demanda por sistema | sem US (v3) | <CodeLink path="frontend/web/src/features/anatomy/viewer/atlasLoader.ts" /> | nenhum (interface); a lista de arquivos é conferida por <CodeLink path="frontend/web/src/features/anatomy/atlas/manifest.contract.test.ts" /> | Z-Anatomy, CC BY-SA 4.0 | [Anatomia 3D](/pt/architecture/anatomy-3d#loading) | |
| Corpo procedural de fallback | sem US (v3) | <CodeLink path="frontend/web/src/features/anatomy/AnatomyViewer.tsx" /> | nenhum (verificação visual, fallback forçado em `anatomy-lab.html`) | <OriginBadge origin="SIMULATED, DERIVED" /> | [Anatomia 3D](/pt/architecture/anatomy-3d#fallback) | |
| Pipeline de assets de anatomia | sem US (v3) | <CodeLink path="frontend/web/scripts/anatomy/build.mjs" /> | `validate.mjs` (`npm run anatomy:validate`), <CodeLink path="frontend/web/src/features/anatomy/atlas/manifest.contract.test.ts" /> | Z-Anatomy, CC BY-SA 4.0 | [Assets de anatomia 3D](/pt/data/anatomy-assets) | Z-Anatomy e BodyParts3D |
| Modelo feminino de referência, texturas, anatomia por astronauta, monitoramento ocular (SANS) | sem US | | | | Planejado ou ausente: [Matriz de status](/pt/overview/feature-status#interface-e-produto), [Roadmap](/pt/resources/roadmap#anatomy-next-steps) | |
| Estrutura do projeto | US-001 | <CodeLink path="frontend/web/package.json" /> | CI (<CodeLink path=".github/workflows/ci.yml" />) | | [Estrutura do projeto](/pt/engineering/project-structure) | |

## Lacunas de rastreabilidade

- Sem teste automatizado para a renderização do corpo 3D (a camada de dados da anatomia é testada), os componentes de interface e os scripts de importação do OSDR.
- Os recursos da v2 (check-in, comunicação, visão de missão, relatório, linha do tempo) e da v3 (atlas anatômico, seleção de estrutura, pipeline de assets) não têm história de usuário própria no documento mestre.
- Referências científicas por limiar ainda não existem: todo limiar é configuração de demo ([Limiares](/pt/intelligence/thresholds)).

## Próximos passos

- [Matriz de status das funcionalidades](/pt/overview/feature-status).
- [Estratégia de testes](/pt/engineering/testing).
- [Referências científicas](/pt/science/references).
