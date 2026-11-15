---
title: Dicionário de dados
description: Os 21 códigos de métrica da Astronaut Health Intelligence Platform, com unidade, cadência, região do corpo, fonte simulada, origem e regras associadas.
status: IMPLEMENTED
origin: SIMULATED, MANUAL
code:
  - frontend/web/src/engine/catalog.ts
  - frontend/web/src/engine/config.ts
  - frontend/web/src/types/domain.ts
verified: 2026-11-14
---

# Dicionário de dados

Esta é a tabela canônica das métricas da Astronaut Health Intelligence Platform (AHI). São **21 códigos** (`MetricCode`), definidos em `frontend/web/src/engine/catalog.ts` (rótulo, unidade, região, direção ruim) e `frontend/web/src/engine/config.ts` (cadência, tempo até `NO_DATA`, regras).

::: info
Hoje **todas as métricas vêm de simuladores ou do check-in digitado no app**. Nenhuma é telemetria real. Os exames laboratoriais reais do OSDR não são métricas do motor: aparecem só como referência no [Catálogo de datasets](/pt/data/dataset-catalog).
:::

## Como ler

| Coluna | Significado |
| --- | --- |
| `metric_code` | Código usado em `HealthObservation.metric_code` |
| Rótulo | Texto da interface (em inglês) |
| Unidade | Unidade canônica, depois da normalização |
| Cadência | Frequência esperada da leitura simulada |
| `NO_DATA` após | Tempo sem valor válido até a métrica virar `NO_DATA` (`staleMin` em `config.ts`) |
| Região | Sistema do corpo no 3D (ou `environment` para a cabine) |
| Direção ruim | Para que lado o desvio preocupa: para cima, para baixo ou ambas |
| Regras | Identificadores das regras de detecção (aguda e de deriva ou persistência) |

## Sinais vitais

Fonte simulada: camiseta inteligente do tipo Bio-Monitor (Agência Espacial Canadense). Origem: <OriginBadge origin="SIMULATED" />.

| `metric_code` | Rótulo | Unidade | Cadência | `NO_DATA` após | Região | Direção ruim | Regras |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `HEART_RATE` | Heart rate | bpm | 1 min | 10 min | coração | ambas | R-HR-01 (aguda), R-HR-02 (deriva), R-HR-03 (limiar de demo) |
| `HRV_RMSSD` | Heart rate variability | ms | 1 min | 10 min | coração | para baixo | R-HRV-01 (deriva) |
| `SPO2` | Blood oxygen | % | 1 min | 10 min | pulmões | para baixo | R-SPO2-01 (faixa pessoal), R-SPO2-02 (limiar de demo) |
| `RESPIRATORY_RATE` | Breathing rate | br/min | 1 min | 10 min | pulmões | ambas | R-RR-01 |
| `SYSTOLIC_BP` | Blood pressure (systolic) | mmHg | 5 min | 20 min | coração | ambas | R-BP-01 |
| `DIASTOLIC_BP` | Blood pressure (diastolic) | mmHg | 5 min | 20 min | coração | ambas | R-BP-01 |
| `SKIN_TEMPERATURE` | Skin temperature | °C | 1 min | 10 min | pele | ambas | R-TEMP-01 |

A pressão arterial é uma estimativa da camiseta simulada.

## Sono, atividade e exercício

| `metric_code` | Rótulo | Unidade | Cadência | `NO_DATA` após | Região | Direção ruim | Fonte simulada | Regras |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ACTIVITY_LEVEL` | Activity | score 0 a 100 | 1 min | 10 min | músculos | para baixo | Actigrafia | R-ACT-01 (deriva) |
| `SLEEP_DURATION` | Sleep duration | h | 1 por dia (às 06:00 UTC) | 36 h | cérebro | para baixo | Actigrafia | R-SLEEP-01 (persistência) |
| `SLEEP_EFFICIENCY` | Sleep efficiency | % | 1 por dia | 36 h | cérebro | para baixo | Actigrafia | R-SLEEP-02 (persistência) |
| `EXERCISE_LOAD` | Exercise performance | % da baseline | por sessão | 32 h | músculos | para baixo | CEVIS, ARED, T2 | R-EX-01 (persistência) |

CEVIS, ARED e T2 são **equipamentos de exercício**, não monitores médicos.

## Cognição, hidratação e autorrelato

| `metric_code` | Rótulo | Unidade | Cadência | `NO_DATA` após | Região | Direção ruim | Fonte | Origem | Regras |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `REACTION_TIME` | Reaction time | ms | 1 por dia | 18 h | cérebro | para cima | Teste de reação (app simulado) | <OriginBadge origin="SIMULATED" /> | R-RT-01 |
| `HYDRATION` | Hydration index | score 0 a 100 | 30 min | 90 min | rins | para baixo | Registro de ingestão (simulado) | <OriginBadge origin="SIMULATED" /> | R-HYD-01 (deriva) |
| `MOOD` | Mood (self report) | 1 a 5 | 1 por dia | 50 h | cérebro | para baixo | Check-in | <OriginBadge origin="SIMULATED, MANUAL" /> | R-PSY-01 |
| `PERCEIVED_FATIGUE` | Fatigue (self report) | 1 a 5 | 1 por dia | 50 h | cérebro | para cima | Check-in | <OriginBadge origin="SIMULATED, MANUAL" /> | R-PSY-02 |
| `STRESS` | Stress (self report) | 1 a 5 | 1 por dia | 50 h | cérebro | para cima | Check-in | <OriginBadge origin="SIMULATED, MANUAL" /> | R-PSY-03 |

As métricas de autorrelato ficam limitadas a MODERATE e nunca criam alertas. Veja [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link).

## Radiação e cabine

A cabine usa `subject_id = "CABIN"`. Origem: <OriginBadge origin="SIMULATED" />.

| `metric_code` | Rótulo | Unidade | Cadência | `NO_DATA` após | Região | Direção ruim | Fonte simulada | Regras |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `RADIATION_DOSE` | Accumulated dose | mGy | 15 min | 45 min | esqueleto | para cima | Dosímetro pessoal | R-RAD-02 (limiar de demo) |
| `RADIATION_DOSE_RATE` | Radiation dose rate | µGy/h | 1 min | 10 min | ambiente | para cima | Monitor de radiação de área | R-ENV-RAD-01 (limiar de demo) |
| `CO2` | Cabin CO₂ | ppm | 1 min | 10 min | ambiente | para cima | Sensor ambiental da cabine | R-ENV-CO2-01 (limiar de demo), R-ENV-CO2-02 (coocorrência) |
| `CABIN_TEMPERATURE` | Cabin temperature | °C | 1 min | 10 min | ambiente | ambas | Sensor ambiental da cabine | R-ENV-TEMP-01 (limiar de demo) |
| `RELATIVE_HUMIDITY` | Humidity | % | 1 min | 10 min | ambiente | ambas | Sensor ambiental da cabine | R-ENV-RH-01 (limiar de demo) |

As métricas da cabine não têm baseline pessoal: um módulo não tem "normal pessoal". Elas usam só limiares de demo, listados em [Limiares e limitações](/pt/intelligence/thresholds).

## Regiões do corpo

| Região (`BodyRegionId`) | Rótulo | Sistema (interface) | Métricas |
| --- | --- | --- | --- |
| `brain` | Brain | Neuro and sleep | sono, tempo de reação, humor, fadiga, estresse |
| `heart` | Heart | Cardiovascular | frequência cardíaca, HRV, pressão arterial |
| `lungs` | Lungs | Respiratory | SpO₂, frequência respiratória |
| `kidneys` | Kidneys | Renal and hydration | hidratação |
| `muscles` | Muscles | Musculoskeletal | atividade, desempenho de exercício |
| `bones` | Skeleton | Bone and radiation | dose acumulada |
| `skin` | Skin | Thermal | temperatura da pele |

Os olhos não são região monitorada: no corpo 3D são estruturas só de contexto.

Quais estruturas anatômicas do atlas 3D pertencem a cada região, e quais são só de contexto, está em [Mapeamento da anatomia para a saúde](/pt/architecture/data-model#anatomy-to-health-mapping).

## Frases em linguagem simples

Cada métrica tem uma frase curta para a interface, em `plainLanguage`. Exemplos:

| Métrica | Frase |
| --- | --- |
| `HRV_RMSSD` | "Beat-to-beat variation. Lower than your normal often means stress or poor recovery." |
| `EXERCISE_LOAD` | "Workout output compared to your own usual sessions." |
| `REACTION_TIME` | "Speed on the short cognitive test. Higher means slower." |

A faixa de exibição de cada gráfico (`displayRange`) **é só escala visual, não limite clínico**.

## Dados fora do catálogo de métricas

| Dado | Onde vive | Observação |
| --- | --- | --- |
| Minutos de exercício por dia | `MissionDaySummary.exerciseMinutes` | Visão de longo prazo da missão |
| Sintomas do check-in | `CheckIn.symptoms` | Fatores informativos (R-PSY-04), nunca diagnóstico |
| Qualidade do sono relatada | `CheckIn.sleepQuality` | Escala de 1 a 5 |
| Exames laboratoriais reais | `frontend/web/src/data/OSD-*.json` | Referência histórica `REAL_PUBLIC`, fora do motor |

O documento mestre também prevê `CORTISOL` e `WBC` como métricas de amostra. Não existem no código hoje.

## Próximos passos

- [Modelo de dados e contratos](/pt/architecture/data-model): o formato `HealthObservation`.
- [Pipeline, normalização e qualidade](/pt/data/pipeline-and-quality): como trocar simulação por dado real.
- [Detecção de anomalias](/pt/intelligence/anomaly-detection): o que cada regra faz.
