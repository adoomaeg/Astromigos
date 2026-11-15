---
title: Origens e proveniência dos dados
description: As quatro categorias de origem de dado (REAL_PUBLIC, DERIVED, SIMULATED, MANUAL), onde cada uma aparece e como a proveniência é registrada.
status: IMPLEMENTED
origin: REAL_PUBLIC, DERIVED, SIMULATED, MANUAL
code:
  - frontend/web/src/types/domain.ts
  - frontend/web/src/features/datasources/OriginsTab.tsx
  - frontend/web/src/features/topbar/ProvenancePopover.tsx
tests:
  - frontend/web/src/lib/fhir.test.ts
  - frontend/web/src/engine/checkins.test.ts
verified: 2026-11-14
---

# Origens e proveniência dos dados

Na Astronaut Health Intelligence Platform (AHI), **todo registro carrega o campo `data_origin`**, e a interface sempre mostra a origem do dado. Esta página é a definição canônica das quatro categorias.

::: info Regra de ouro
Nunca misturar sem marcar: dado simulado com dado real, astronauta com participante de estudo análogo, humano com animal, solo com voo. A origem fica visível em cada tela.
:::

## As quatro categorias

| Origem | O que é | Onde aparece hoje |
| --- | --- | --- |
| <OriginBadge origin="SIMULATED" /> `SIMULATED` | Valor sintético gerado por simulador | **Toda** leitura de dispositivo da tripulação: camiseta inteligente, actigrafia, equipamentos de exercício, sensores da cabine, dosímetros. Check-ins gerados pela simulação. Respostas do médico de voo simulado |
| <OriginBadge origin="MANUAL" /> `MANUAL` | Digitado por uma pessoa na interface | Check-ins digitados no app, intervenções registradas ("Mark done"), reconhecimento de alertas |
| <OriginBadge origin="DERIVED" /> `DERIVED` | Calculado a partir de dados de origem conhecida | Baselines, escores de risco, previsões, quadros da linha do tempo, médias de grupo dos datasets reais |
| <OriginBadge origin="REAL_PUBLIC" /> `REAL_PUBLIC` | Obtido de fonte pública, com proveniência completa | Dois painéis laboratoriais do NASA OSDR (OSD-569 e OSD-575), só como referência histórica |

::: warning ATENÇÃO
Um valor `DERIVED` herda as limitações dos dados de entrada. Um escore de risco calculado sobre dados `SIMULATED` continua sendo um resultado sobre dados simulados: **não é evidência clínica**.
:::

::: info A anatomia 3D não é dado de saúde
O modelo anatômico do corpo 3D é um **asset de referência** de terceiros (Z-Anatomy, CC BY-SA 4.0), não um registro sobre uma pessoa. Ele não leva o selo `data_origin`; a proveniência dele (fonte, checksum, licença, modificações) é mantida com o mesmo cuidado em [Assets de anatomia 3D](/pt/data/anatomy-assets). As cores de status desenhadas sobre ele vêm dos dados de saúde com selo, descritos acima.
:::

## Como a origem aparece na interface

| Lugar | O que mostra |
| --- | --- |
| Barra superior | Selo `SIMULATED` sempre visível. Ao clicar, abre "Where this data comes from", com a lista dos adapters ativos |
| Detalhe de cada métrica | Selos de qualidade e de origem ao lado do valor, e em cada alerta e sinalização estatística |
| Detalhe da estrutura e corpo 3D | Selo "Reference anatomy" ("Z-Anatomy atlas" ou "AHI procedural") na estrutura selecionada; legenda de fonte sob o corpo |
| Relatório de turno | Selo "SIMULATED DATA" |
| Exportação FHIR | A origem vai como tag em cada recurso |
| "Data and model" > "Data origins" | As quatro categorias e as regras de transparência |
| "Data and model" > "Real datasets" | Selo `REAL_PUBLIC`, proveniência completa e o aviso "Historical public research data. Not live telemetry and not this crew." |

## Modelo de proveniência

A proveniência é registrada em dois níveis.

**Por observação.** Cada `HealthObservation` tem `data_origin` e um `source_reference` com repositório, accession, arquivo e registro de origem. Em dados simulados esses campos ficam `null`. O contrato completo está em [Modelo de dados e contratos](/pt/architecture/data-model).

**Por dataset.** Cada importação real gera um `DatasetRecord` (seção 6.5 do documento mestre) e um manifesto em `data/manifests/<ACCESSION>.json`, com:

| Grupo | Campos |
| --- | --- |
| Identificação | `source_name`, `source_url`, `dataset_accession`, `dataset_version`, `title` |
| Arquivo | `file_name`, `sha256`, `downloaded_at`, `parser_version` |
| Acesso | `license`, `access_classification` |
| Estudo | `study_population`, `mission`, `study_design`, `collection_phase` |
| Notas | `notes`, `data_origin` (`REAL_PUBLIC` ou `DERIVED`) |

Campos sem informação na fonte ficam `null` com a nota "not stated". **Nunca são preenchidos por suposição.** Os valores de cada dataset estão no [Catálogo de datasets](/pt/data/dataset-catalog).

## Regras de transparência

1. **Dado público não é telemetria ao vivo.** Dado real histórico aparece como referência, nunca como "a tripulação agora".
2. **Dado ausente não vira zero nem "normal".** Ausência é `null`, com qualidade `MISSING`, e o app mostra `NO_DATA`.
3. **Dados de outras pessoas nunca são misturados à tripulação mostrada.**
4. **Dado análogo ou animal nunca é rotulado como astronauta.** A proposta de padronização usa `metadata.population_type`: `ISS_ASTRONAUT`, `COMMERCIAL_ASTRONAUT`, `ANALOG_PARTICIPANT`, `GROUND_CONTROL`, `NOT_APPLICABLE`.
5. **Efeitos de intervenção são hipotéticos.** "Mark done" e a comparação "e se" usam parâmetros do simulador, rotulados como simulação.

## Próximos passos

- [Fontes de dados da NASA](/pt/data/sources): o que foi investigado e o status de cada fonte.
- [Catálogo de datasets](/pt/data/dataset-catalog): OSD-569 e OSD-575 em detalhe.
- [Governança e privacidade](/pt/data/governance-and-privacy).
