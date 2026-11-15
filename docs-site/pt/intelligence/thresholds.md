---
title: Limiares e limitações
description: A tabela canônica de limiares fixos e metas de demo da Astronaut Health Intelligence Platform. Configuração de demo, não limites oficiais da NASA.
status: IMPLEMENTED
origin: DERIVED
code:
  - frontend/web/src/engine/config.ts
tests:
  - frontend/web/src/engine/engine.test.ts
  - frontend/web/src/engine/missionDays.test.ts
verified: 2026-11-14
---

# Limiares e limitações

Esta é a **página canônica** dos limiares fixos da Astronaut Health Intelligence Platform (AHI). Todos vivem em `frontend/web/src/engine/config.ts`.

::: danger CONFIGURAÇÃO DE DEMO, NÃO LIMITES OFICIAIS
Os valores abaixo foram escolhidos para o protótipo se comportar de forma sensata com dados simulados. **Nenhum é limite oficial da NASA, regra de voo ou limiar clínico.** Precisam de fonte citável e revisão de um médico de voo antes de qualquer uso real.
:::

## Papel dos limiares

A **faixa pessoal define o status primeiro** ([Linha de base pessoal](/pt/intelligence/personal-baseline)). Os limiares fixos são uma **rede de segurança** para a demo: pegam valores que seriam preocupantes mesmo que a pessoa tivesse um normal incomum. Na cabine, que não tem normal pessoal, eles são a única regra de nível.

## Limiares fixos (`FIXED_THRESHOLDS`)

Aplicados sobre a mediana das 3 últimas leituras. Ordenados do mais grave para o menos grave em cada métrica.

| Regra | Métrica | Condição | Nível | Nome em `config.ts` | Observação |
| --- | --- | --- | --- | --- | --- |
| R-SPO2-02 | SpO₂ | abaixo de 90% | CRITICAL | demo safety floor | |
| R-SPO2-02 | SpO₂ | abaixo de 92% | HIGH | demo watch floor | |
| R-HR-03 | Frequência cardíaca | acima de 135 bpm | CRITICAL | demo resting ceiling | Só fora de exercício e recuperação |
| R-HR-03 | Frequência cardíaca | acima de 120 bpm | HIGH | demo resting watch level | Só fora de exercício e recuperação |
| R-ENV-CO2-01 | CO₂ da cabine | acima de 7500 ppm | CRITICAL | demo critical level | |
| R-ENV-CO2-01 | CO₂ da cabine | acima de 5300 ppm | HIGH | demo warning level | |
| R-ENV-CO2-01 | CO₂ da cabine | acima de 4000 ppm | MODERATE | demo watch level | |
| R-ENV-TEMP-01 | Temperatura da cabine | acima de 27 °C ou abaixo de 18 °C | MODERATE | demo comfort band | |
| R-ENV-RH-01 | Umidade relativa | acima de 70% ou abaixo de 25% | MODERATE | demo comfort band | |
| R-ENV-RAD-01 | Taxa de dose | acima de 100 µGy/h | HIGH | demo particle event level | |
| R-RAD-02 | Dose acumulada | acima de 50 mGy | MODERATE | demo mission dose watch level | |

## Metas e orçamento da missão (`MISSION_PLAN`)

| Item | Valor de demo | Onde aparece |
| --- | --- | --- |
| Duração planejada | 180 dias | "Mission overview" ("Day 44 of 180 planned") |
| Orçamento de radiação | 100 mGy em 180 dias | "Radiation vs demo budget" |
| Exercício planejado | 60 min por dia | Aderência semanal ao exercício |
| Meta de sono | 8 h por noite | Sono semanal |

A nota em `config.ts` diz: "Demo configuration, not official limits."

## Onde ficam os outros parâmetros

Outros números fixos de `config.ts` são **parâmetros de método**, não limiares de nível. Cada um é explicado na página do método:

| Parâmetro | Objeto em `config.ts` | Página |
| --- | --- | --- |
| Largura da faixa, mínimos de amostras, portões | `BASELINE` | [Linha de base pessoal](/pt/intelligence/personal-baseline) |
| Níveis de z, meia-vida e tempos de deriva, persistência | `ANOMALY` | [Detecção de anomalias](/pt/intelligence/anomaly-detection) |
| Pesos e faixas do escore | `RISK` | [Avaliação de risco](/pt/intelligence/risk-assessment) |
| Parâmetros da previsão e horizontes | `FORECAST` | [Previsão](/pt/intelligence/forecasting) |
| Tempos de escalonamento e resolução | `ESCALATION`, `ALERTS` | [Alertas e escalonamento](/pt/intelligence/alerts) |
| Atrasos, tempo de revisão em solo, reavaliação | `COMMS`, `COMM_PROFILES` | [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link) |
| Horário e histórico do check-in | `CHECKIN` | [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link) |
| Tempo até `NO_DATA` por métrica | `METRIC_RULES` | [Dicionário de dados](/pt/data/data-dictionary) |
| Métricas e horizontes do "e se" | `COMPARE` | [Recomendações](/pt/intelligence/recommendations) |
| Dose diária média dos dias sintetizados | `MISSION_DAYS` | [Recursos da missão](/pt/product/mission-features) |

## Referências que não são limites da AHI

- **Faixas de referência dos exames reais** (OSD-569, OSD-575) são as que o laboratório imprimiu no arquivo. Não são limites da NASA e não geram status nem alerta.
- **Faixas de exibição dos gráficos** (`displayRange` em `catalog.ts`) são só escala visual.

## Caminho para limiares fundamentados

| Passo | Status |
| --- | --- |
| Rotular todo limiar como configuração de demo | <StatusBadge status="IMPLEMENTED" /> |
| Para cada limiar, buscar fonte citável (documento, seção e versão), por exemplo na família de normas de habitabilidade NASA-STD-3001 | <StatusBadge status="PLANNED" /> |
| Revisão e aprovação por um médico de voo | <StatusBadge status="PLANNED" /> |
| Versionar limiares com unidade, fonte e responsável | <StatusBadge status="PLANNED" /> |

Enquanto não houver fonte, o rótulo de demo continua. Prioridades em [Pipeline e qualidade](/pt/data/pipeline-and-quality#prioridades).

## Limitações gerais do motor

As limitações completas do motor e do protótipo estão em [Limitações e problemas conhecidos](/pt/validation/limitations). As principais que tocam os limiares:

- Os limiares foram ajustados para o simulador, não para pessoas reais.
- A avaliação mostra 0 alertas falsos no cenário nominal **dentro do simulador**, o que não diz nada sobre falsos alarmes reais.
- Um limiar fixo ignora contexto individual; por isso ele é só rede de segurança.

## Próximos passos

- [Uso responsável](/pt/overview/responsible-use).
- [Detecção de anomalias](/pt/intelligence/anomaly-detection): como os limiares entram na detecção.
- [Resultados e evidências](/pt/validation/results).
