---
title: Recomendações, autonomia e what-if
description: Catálogo versionado de ações não prescritivas, quem pode agir (a bordo ou em solo), intervenções registradas e a projeção hipotética com e sem uma ação.
status: IMPLEMENTED
origin: DERIVED, SIMULATED, MANUAL
code:
  - frontend/web/src/engine/recommendations.ts
  - frontend/web/src/engine/intervention.ts
  - frontend/web/src/engine/sim/scenarios.ts
  - frontend/web/src/engine/config.ts
tests:
  - frontend/web/src/engine/risk.test.ts
  - frontend/web/src/engine/intervention.test.ts
  - frontend/web/src/engine/comms.test.ts
  - frontend/web/src/engine/engine.test.ts
verified: 2026-11-14
---

# Recomendações, autonomia e what-if

## O que faz

Para cada regra acionável, a Astronaut Health Intelligence Platform (AHI) sugere **uma ação não prescritiva** de um catálogo versionado, explica o motivo em linguagem simples e diz **quem pode agir**: a tripulação a bordo ou o médico de voo (flight surgeon) na Terra. A pessoa pode registrar a ação ("Mark done") e comparar, de forma hipotética, a trajetória com e sem ela ("Compare").

::: danger PERIGO
As recomendações **nunca** são diagnóstico, medicamento ou tratamento. Os efeitos aplicados ao registrar uma ação e as curvas do "e se" são **parâmetros do simulador**, não evidência de eficácia clínica.
:::

## Entradas

| Entrada | Origem |
| --- | --- |
| Regras acionáveis e já agrupadas | [Avaliação de risco](/pt/intelligence/risk-assessment) |
| Perfil de comunicação ativo | [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link) |
| Ação registrada pela pessoa | Interface (<OriginBadge origin="MANUAL" />) |
| Estado atual da simulação | Para o "e se" (<OriginBadge origin="SIMULATED" />) |

## Método

### 1. Quais regras geram recomendação

Uma regra é **acionável** se estiver em HIGH ou CRITICAL, ou em MODERATE quando for de tendência, combinada, de ambiente ou de qualidade do dado. Um pico agudo isolado em MODERATE (z robusto) só muda o status: não gera recomendação nem alerta.

### 2. Catálogo (`rec-catalog v2.0`)

Cada regra aponta para um modelo de ação. Exemplos:

| Regra | Ação (interface) | Público | Autonomia | Intervenção ligada |
| --- | --- | --- | --- | --- |
| R-SLEEP-01, R-SLEEP-02 | "Review sleep schedule and light exposure" | Tripulação | `ONBOARD` | `SLEEP_EXTENSION` |
| R-FAT-01 | "Request flight surgeon review of the recovery pattern" | Médico de voo | `GROUND_REVIEW` | `SLEEP_EXTENSION` |
| R-HR-01, R-HR-03 | "Pause activity, rest, and request flight surgeon review" | Médico de voo | `GROUND_REVIEW` | `REST_PROTOCOL` |
| R-CARD-01 | "Request flight surgeon review now" | Médico de voo | `GROUND_REVIEW` | `MEDICAL_CONSULT` |
| R-SPO2-01 | "Check sensor fit, then request review if it persists" | Médico de voo | `GROUND_REVIEW` | `MEDICAL_CONSULT` |
| R-EX-01 | "Adjust exercise load and recovery with the trainer" | Tripulação | `ONBOARD` | `EXERCISE_ADJUSTMENT` |
| R-HYD-01 | "Hydrate per protocol" | Tripulação | `ONBOARD` | `HYDRATION` |
| R-ENV-CO2-01 | "Ventilate the module and check the CO₂ scrubber" | Mission Control | `ONBOARD` | `CABIN_VENTILATION` |
| R-ENV-RAD-01 | "Follow the radiation shelter procedure from mission control" | Mission Control | `GROUND_REVIEW` | nenhuma |
| R-DQ-01 | "Check sensor fit and connection" | Tripulação | `ONBOARD` | `SENSOR_CHECK` |
| R-PSY-01 | "Check in with the crew medical officer and plan some recovery time" | Tripulação | `ONBOARD` | `REST_PROTOCOL` |

A lista completa está em `REC_CATALOG` (`recommendations.ts`). Cada item tem título, motivo, público, região e tipo de intervenção.

### 3. Autonomia: quem fecha o ciclo

```text
autonomia = valor explícito do modelo, se houver
          senão ONBOARD       se o público é a tripulação
          senão GROUND_REVIEW
```

| Valor | Selo na interface | Exemplos |
| --- | --- | --- |
| `ONBOARD` | "Can act on board now" | Autocuidado, oficial médico de bordo, checagem de sensor, ventilação da cabine |
| `GROUND_REVIEW` | "Needs flight surgeon" | Revisão do médico de voo, decisões de dose do Mission Control |

**Primeiro passo a bordo em espaço profundo.** Nos perfis "Mars (closest)" e "Mars (farthest)", um item HIGH ou CRITICAL com `GROUND_REVIEW` gera **um** passo a bordo por astronauta: "Crew medical officer: start the onboard assessment protocol now". O motivo informa a resposta mais cedo possível da Terra (`2 x atraso só de ida + 4 min de revisão mínima`, cerca de 48 min em "Mars (farthest)"). No perfil ISS esse passo não aparece.

### 4. Ciclo de vida

- **Uma recomendação por pessoa e regra por episódio.** Um episódio termina depois de 30 minutos simulados sem a regra.
- **Revisão humana obrigatória** quando o nível é HIGH ou CRITICAL, ou quando o público é o médico de voo.
- Itens da cabine usam `astronautId: 'CABIN'`.
- Estados: `PENDING`, `DONE` ("Mark done") ou `DISMISSED` ("Dismiss").

### 5. Intervenções registradas ("Mark done")

Registrar uma ação cria um `Intervention` na auditoria e aplica na simulação um **alívio hipotético**, registrado como simulação:

| Intervenção | Efeito simulado |
| --- | --- |
| `SLEEP_EXTENSION`, `REST_PROTOCOL` | Aliviam a fadiga progressiva |
| `REST_PROTOCOL`, `MEDICAL_CONSULT` | Aliviam o evento cardíaco agudo |
| `CABIN_VENTILATION` | Baixa o CO₂ da cabine |
| `SENSOR_CHECK` | Restaura o dispositivo após 3 minutos simulados |
| `EXERCISE_ADJUSTMENT` | Alivia a queda de desempenho |
| `HYDRATION` | Sobe o índice de hidratação |

### 6. Projeção "e se" (`compareIntervention`)

```text
compareIntervention({ astronautId, kind, metric?, horizonHours? })
  -> roda o modelo de simulação SEM RUÍDO duas vezes a partir do estado atual:
     1. sem a intervenção
     2. com a intervenção registrada agora
  -> devolve as duas trajetórias, a faixa pessoal de repouso, premissas e aviso
```

| Ação | Métrica padrão | Horizonte padrão |
| --- | --- | --- |
| `SLEEP_EXTENSION` | HRV | 48 h, a cada 30 min |
| `REST_PROTOCOL`, `MEDICAL_CONSULT` | Frequência cardíaca | 24 h; 2 h a cada 5 min durante um evento agudo |
| `CABIN_VENTILATION` | CO₂ da cabine | 8 h, a cada 15 min |
| `EXERCISE_ADJUSTMENT` | Desempenho de exercício | 120 h, um ponto por sessão planejada |
| `HYDRATION` | Índice de hidratação | 12 h, a cada 15 min |
| `SENSOR_CHECK` | sem comparação | |

O horizonte máximo é 168 h. Valores fisiológicos são equivalentes de repouso (atividade e ritmo diário removidos); o CO₂ mantém a oscilação diária. A função é **pura**: não muda o estado e leva menos de 5 ms por chamada. Aviso fixo: "Simulation for discussion only. Not evidence of clinical efficacy."

### Premissas

- O catálogo cobre as regras do motor. Uma regra sem modelo não gera recomendação.
- Os tamanhos de efeito das intervenções são parâmetros escolhidos para a demo.
- No "e se", nada além da intervenção muda no horizonte.

### Interpretação

O "e se" responde só a uma pergunta: **dentro do simulador**, como a curva se comportaria com e sem a ação. Uma diferença entre as linhas não prova que a ação funciona no mundo real. No cenário nominal, as duas linhas coincidem e as premissas dizem isso (teste "NOMINAL: both lines are the same").

## Saídas

`Recommendation` (título, motivo, prioridade, público, região, revisão humana, estado, intervenção ligada, autonomia, versão do catálogo), `Intervention` e `InterventionComparison` (trajetórias com e sem, faixa, premissas, aviso). Origem: <OriginBadge origin="DERIVED" /> para recomendações, <OriginBadge origin="MANUAL" /> para intervenções registradas, <OriginBadge origin="SIMULATED" /> para o "e se".

## Limitações

- As ações são genéricas e não foram revisadas por um médico de voo.
- Os efeitos são hipotéticos; não há validação clínica.
- A projeção ignora ruído e eventos futuros.

## Status

<StatusBadge status="IMPLEMENTED" /> para catálogo, autonomia e intervenções; <StatusBadge status="EXPERIMENTAL" /> para a projeção "e se", porque os efeitos são heurísticos. Cobertos por `risk.test.ts` (recomendação por pessoa e regra, revisão humana em HIGH), `comms.test.ts` (primeiro passo a bordo em Marte e ausência dele na ISS), `intervention.test.ts` (7 testes do "e se") e `engine.test.ts` ("ACUTE_CARDIO eases after a logged MEDICAL_CONSULT").

## Próximos passos

- [Alertas e escalonamento](/pt/intelligence/alerts).
- [Recursos da missão](/pt/product/mission-features#comparacao-e-se): como o "e se" aparece na tela.
- [Abordagem de IA e análise de dados](/pt/intelligence/ai-and-analytics): a camada de explicação com LLM planejada.
