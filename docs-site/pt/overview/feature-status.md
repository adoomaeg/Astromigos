---
title: Matriz de status das funcionalidades
description: Cada capacidade da Astronaut Health Intelligence Platform com status de implementação, origem dos dados, código e documentação.
verified: 2026-11-14
---

# Matriz de status das funcionalidades

Esta página é a lista única do que a Astronaut Health Intelligence Platform (AHI) **faz hoje**, do que é **plano** e do que **não existe de propósito**. Cada linha foi conferida contra o código em `frontend/web/src` em 14/11/2026.

## Como ler

| Status | Significado |
| --- | --- |
| <StatusBadge status="IMPLEMENTED" /> | Presente no código e em uso no protótipo |
| <StatusBadge status="EXPERIMENTAL" /> | Implementado, mas heurístico ou sem validação externa; pode mudar |
| <StatusBadge status="PLANNED" /> | No backlog ou roadmap; ainda não existe no código |
| <StatusBadge status="CONCEPTUAL" /> | Proposta de desenho, não implementação |
| <StatusBadge status="NOT_IMPLEMENTED" /> | Ausente de propósito; citado só para evitar confusão |

| Origem | Significado |
| --- | --- |
| <OriginBadge origin="SIMULATED" /> | Gerado pelos simuladores. Não é evidência clínica |
| <OriginBadge origin="MANUAL" /> | Digitado por uma pessoa na interface |
| <OriginBadge origin="DERIVED" /> | Calculado pela plataforma a partir de outros dados |
| <OriginBadge origin="REAL_PUBLIC" /> | Dado público real da NASA, com proveniência |

Definições completas em [Origens e proveniência dos dados](/pt/data/data-origins).

## Dados e simulação

| Capacidade | Status | Origem | Código | Documentação |
| --- | --- | --- | --- | --- |
| Adapters de dispositivos simulados (camiseta Bio-Monitor, actigrafia, CEVIS, ARED, T2, cabine, dosímetros, teste de reação, registro de ingestão) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | <CodeLink path="frontend/web/src/engine/sim/adapters.ts" /> | [Simulação](/pt/intelligence/scenario-simulation) |
| Seis cenários roteirizados | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | <CodeLink path="frontend/web/src/engine/sim/scenarios.ts" /> | [Simulação](/pt/intelligence/scenario-simulation) |
| Relógio semeado e reproduzível | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | <CodeLink path="frontend/web/src/state/store.ts" /> | [Motor e simulação](/pt/architecture/engine-and-simulation) |
| Modelo canônico `HealthObservation` | <StatusBadge status="IMPLEMENTED" /> | todas | <CodeLink path="frontend/web/src/types/domain.ts" /> | [Modelo de dados](/pt/architecture/data-model) |
| Datasets reais OSD-569 e OSD-575 (Inspiration4) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="REAL_PUBLIC, DERIVED" /> | <CodeLink path="frontend/web/src/data/osdr.ts" /> | [Catálogo de datasets](/pt/data/dataset-catalog) |
| Scripts de descoberta e importação do OSDR | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="REAL_PUBLIC" /> | <CodeLink path="frontend/web/scripts/osdr/import.mjs" /> | [Pipeline e qualidade](/pt/data/pipeline-and-quality) |
| Pipeline de assets de anatomia (`npm run anatomy:build`: exportação no Blender sem interface, glTF Transform, validação) | <StatusBadge status="IMPLEMENTED" /> | asset de terceiros, CC BY-SA 4.0 | <CodeLink path="frontend/web/scripts/anatomy/build.mjs" /> | [Assets de anatomia 3D](/pt/data/anatomy-assets) |
| Replay real do ambiente da ISS (NASA EDA) | <StatusBadge status="PLANNED" /> | | | [Fontes da NASA](/pt/data/sources) |
| Série real de dose de radiação (EDA, RadLab) | <StatusBadge status="PLANNED" /> | | | [Fontes da NASA](/pt/data/sources) |
| Conexão com a ISS ou com equipamentos reais | <StatusBadge status="NOT_IMPLEMENTED" /> | | | [Limitações](/pt/validation/limitations) |

## Inteligência de saúde

| Capacidade | Status | Origem | Código | Documentação |
| --- | --- | --- | --- | --- |
| Baseline pessoal robusta por contexto (mediana, MAD, p05, p95) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | <CodeLink path="frontend/web/src/engine/baseline.ts" /> | [Linha de base pessoal](/pt/intelligence/personal-baseline) |
| z robusto agudo, deriva EWMA, persistência diária | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | <CodeLink path="frontend/web/src/engine/anomaly.ts" /> | [Detecção de anomalias](/pt/intelligence/anomaly-detection) |
| Qualidade do dado (`NO_DATA`, sinal questionável) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | <CodeLink path="frontend/web/src/engine/anomaly.ts" /> | [Detecção de anomalias](/pt/intelligence/anomaly-detection) |
| Regras combinadas (R-CARD-01, R-FAT-01, R-ENV-CO2-02) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | <CodeLink path="frontend/web/src/engine/risk.ts" /> | [Avaliação de risco](/pt/intelligence/risk-assessment) |
| Escore de risco 0 a 100 (noisy-OR) e confiança | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | <CodeLink path="frontend/web/src/engine/risk.ts" /> | [Avaliação de risco](/pt/intelligence/risk-assessment) |
| Previsão Holt amortecida com intervalo de 80% | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | <CodeLink path="frontend/web/src/engine/forecast.ts" /> | [Previsão](/pt/intelligence/forecasting) |
| Catálogo de recomendações com autonomia | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | <CodeLink path="frontend/web/src/engine/recommendations.ts" /> | [Recomendações](/pt/intelligence/recommendations) |
| Projeção "e se" sem ruído | <StatusBadge status="EXPERIMENTAL" /> | <OriginBadge origin="SIMULATED" /> | <CodeLink path="frontend/web/src/engine/intervention.ts" /> | [Recomendações](/pt/intelligence/recommendations) |
| Alertas, deduplicação, resolução automática e escalonamento | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | <CodeLink path="frontend/web/src/engine/alerts.ts" /> | [Alertas](/pt/intelligence/alerts) |
| Check-in diário (simulado e digitado) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, MANUAL" /> | <CodeLink path="frontend/web/src/engine/checkins.ts" /> | [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link) |
| Comunicação com atraso e respostas simuladas da Terra | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | <CodeLink path="frontend/web/src/engine/comms.ts" /> | [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link) |
| Avaliação reproduzível do motor (`npm run evaluate`) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | <CodeLink path="frontend/web/scripts/evaluate.ts" /> | [Resultados](/pt/validation/results) |
| Camada de explicação com LLM (US-024) | <StatusBadge status="PLANNED" /> | | | [IA e análise](/pt/intelligence/ai-and-analytics) |
| Isolation Forest (anomalia multivariada) | <StatusBadge status="PLANNED" /> | | | [IA e análise](/pt/intelligence/ai-and-analytics) |
| ARIMA, XGBoost, SHAP, análise de sobrevivência | <StatusBadge status="NOT_IMPLEMENTED" /> | | | [IA e análise](/pt/intelligence/ai-and-analytics) |
| Regra IQR e CUSUM | <StatusBadge status="NOT_IMPLEMENTED" /> | | | [Visão geral dos métodos](/pt/intelligence/overview) |
| Reconhecimento de atividade por sensor (hoje o contexto vem do cronograma) | <StatusBadge status="CONCEPTUAL" /> | | | [Limitações](/pt/validation/limitations) |
| Treinamento de modelo, RAG, agentes ou prompts em tempo de execução | <StatusBadge status="NOT_IMPLEMENTED" /> | | | [IA e análise](/pt/intelligence/ai-and-analytics) |

## Interface e produto

| Capacidade | Status | Origem | Código | Documentação |
| --- | --- | --- | --- | --- |
| "Ground view" (tripulação, corpo, atenção, linha do tempo, vitais) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | <CodeLink path="frontend/web/src/app/App.tsx" /> | [Tour do produto](/pt/product/product-tour) |
| "Crew view" para o astronauta | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | <CodeLink path="frontend/web/src/features/crewview/CrewView.tsx" /> | [Tour do produto](/pt/product/product-tour) |
| Visualizador do atlas anatômico (Z-Anatomy, 250 estruturas, destaques de status, coração e pulmões ao vivo) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | <CodeLink path="frontend/web/src/features/anatomy/viewer/AtlasViewer.tsx" /> | [Anatomia 3D](/pt/architecture/anatomy-3d) |
| Camadas por sistema, vistas predefinidas e opacidade da pele | <StatusBadge status="IMPLEMENTED" /> | | <CodeLink path="frontend/web/src/features/anatomy/viewer/SystemControls.tsx" /> | [Anatomia 3D](/pt/architecture/anatomy-3d#interaction) |
| Seleção de estrutura e painel da estrutura (monitorada ou só contexto) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | <CodeLink path="frontend/web/src/features/attention/StructureDetail.tsx" /> | [Tour do produto](/pt/product/product-tour#selecting-a-structure) |
| Mapeamento da anatomia para a saúde (estrutura, região, métricas) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | <CodeLink path="frontend/web/src/features/anatomy/atlas/health.ts" /> | [Modelo de dados](/pt/architecture/data-model#anatomy-to-health-mapping) |
| Alertas e sinalizações estatísticas por sistema do corpo no painel de detalhe | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | <CodeLink path="frontend/web/src/features/attention/RegionEvents.tsx" /> | [Tour do produto](/pt/product/product-tour#detalhe-da-regiao) |
| Carga sob demanda do atlas por sistema (um GLB por sistema, cache de sessão) | <StatusBadge status="IMPLEMENTED" /> | | <CodeLink path="frontend/web/src/features/anatomy/viewer/atlasLoader.ts" /> | [Anatomia 3D](/pt/architecture/anatomy-3d#loading) |
| Corpo procedural de fallback quando o atlas não está disponível | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | <CodeLink path="frontend/web/src/features/anatomy/procedural/ProceduralViewer.tsx" /> | [Anatomia 3D](/pt/architecture/anatomy-3d#fallback) |
| Modelo feminino de referência | <StatusBadge status="PLANNED" /> | | | [Roadmap](/pt/resources/roadmap#anatomy-next-steps). Hoje há um único modelo de referência para todos |
| Texturas na anatomia | <StatusBadge status="PLANNED" /> | | | [Roadmap](/pt/resources/roadmap#anatomy-next-steps). O modelo de origem não tem texturas |
| Anatomia por astronauta (exames, tamanho do corpo) | <StatusBadge status="NOT_IMPLEMENTED" /> | | | [Anatomia 3D](/pt/architecture/anatomy-3d#limitations) |
| Gaveta de alertas, som opcional e trilha de auditoria | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED, MANUAL" /> | <CodeLink path="frontend/web/src/features/alerts/Alerts.tsx" /> | [Tour do produto](/pt/product/product-tour) |
| Linha do tempo de status da tripulação | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="DERIVED" /> | <CodeLink path="frontend/web/src/features/timeline/index.tsx" /> | [Tour do produto](/pt/product/product-tour) |
| Visão de longo prazo da missão (dias antigos sintetizados) | <StatusBadge status="EXPERIMENTAL" /> | <OriginBadge origin="SIMULATED, DERIVED" /> | <CodeLink path="frontend/web/src/engine/missionDays.ts" /> | [Recursos da missão](/pt/product/mission-features) |
| Relatório de passagem de turno | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, DERIVED, MANUAL" /> | <CodeLink path="frontend/web/src/features/report/index.tsx" /> | [Recursos da missão](/pt/product/mission-features) |
| Exportação FHIR R4 (Bundle em arquivo) | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED, MANUAL" /> | <CodeLink path="frontend/web/src/lib/fhir.ts" /> | [Recursos da missão](/pt/product/mission-features) |
| Diálogo "Data and model" | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="REAL_PUBLIC, DERIVED" /> | <CodeLink path="frontend/web/src/features/datasources/DataModelDialog.tsx" /> | [Recursos da missão](/pt/product/mission-features) |
| Demo guiada de 10 passos | <StatusBadge status="IMPLEMENTED" /> | <OriginBadge origin="SIMULATED" /> | <CodeLink path="frontend/web/src/features/tour/steps.ts" /> | [Cenários e demo](/pt/product/demo-scenarios) |
| Modo apresentação, atalhos de teclado, modo compacto | <StatusBadge status="IMPLEMENTED" /> | | <CodeLink path="frontend/web/src/app/shortcuts.tsx" /> | [Design system](/pt/product/design-system) |
| Interface em português | <StatusBadge status="NOT_IMPLEMENTED" /> | | | A interface é só em inglês, por decisão (júri internacional) |
| Acompanhamento ocular (SANS); hoje os olhos são estruturas só de contexto | <StatusBadge status="PLANNED" /> | | | [Roadmap](/pt/resources/roadmap) |
| Fluxo real de revisão do médico de voo | <StatusBadge status="PLANNED" /> | | | [Roadmap](/pt/resources/roadmap) |

## Plataforma e engenharia

| Capacidade | Status | Origem | Código | Documentação |
| --- | --- | --- | --- | --- |
| Testes unitários e de cenário (143 testes em 17 arquivos) | <StatusBadge status="IMPLEMENTED" /> | | <CodeLink path="frontend/web/src/engine/engine.test.ts" /> | [Estratégia de testes](/pt/engineering/testing) |
| CI no GitHub Actions (lint, tipos, testes e build do app; build do portal em pull requests) | <StatusBadge status="IMPLEMENTED" /> | | <CodeLink path=".github/workflows/ci.yml" /> | [Documentação e deploy](/pt/engineering/deployment) |
| Portal de documentação bilíngue no GitHub Pages | <StatusBadge status="IMPLEMENTED" /> | | <CodeLink path=".github/workflows/docs-deploy.yml" /> | [Documentação e deploy](/pt/engineering/deployment) |
| Backend FastAPI e API REST de ingestão | <StatusBadge status="PLANNED" /> | | | [Arquitetura alvo](/pt/architecture/target-architecture) |
| Banco de dados (PostgreSQL, TimescaleDB opcional) | <StatusBadge status="PLANNED" /> | | | [Arquitetura alvo](/pt/architecture/target-architecture) |
| Autenticação e controle de acesso por papel (RBAC) | <StatusBadge status="PLANNED" /> | | | [Arquitetura alvo](/pt/architecture/target-architecture) |
| Docker Compose, observabilidade, testes de integração e ponta a ponta | <StatusBadge status="PLANNED" /> | | | [Arquitetura alvo](/pt/architecture/target-architecture) |
| Desenho da arquitetura alvo (monólito modular) | <StatusBadge status="CONCEPTUAL" /> | | | [Arquitetura alvo](/pt/architecture/target-architecture) |
| Implantação publicada do app | <StatusBadge status="PLANNED" /> | | | O app roda localmente por enquanto; só o portal é publicado ([Roadmap](/pt/resources/roadmap)) |

::: tip DICA
Para ver cada capacidade ligada a código, testes, dados e método, use a [Matriz de rastreabilidade](/pt/validation/traceability).
:::

## Próximos passos

- [Matriz de rastreabilidade](/pt/validation/traceability): capacidade, código, testes, dados e método.
- [Limitações e problemas conhecidos](/pt/validation/limitations).
- [Roadmap](/pt/resources/roadmap): o que vem a seguir.
