---
title: Detecção de anomalias
description: z robusto, deriva EWMA, persistência diária e qualidade do dado, sempre contra a baseline pessoal, na Astronaut Health Intelligence Platform.
status: IMPLEMENTED
origin: DERIVED
code:
  - frontend/web/src/engine/anomaly.ts
  - frontend/web/src/engine/stats.ts
  - frontend/web/src/engine/engine.ts
  - frontend/web/src/engine/config.ts
tests:
  - frontend/web/src/engine/anomaly.test.ts
  - frontend/web/src/engine/stats.test.ts
  - frontend/web/src/engine/engine.test.ts
verified: 2026-11-14
---

# Detecção de anomalias

## O que faz

Decide, a cada leitura, se uma métrica está dentro do normal da pessoa, se mudou de repente, se está derivando devagar ou se o dado não é confiável. Cada achado vira um **nível** (`LOW`, `MODERATE`, `HIGH`, `CRITICAL` ou `NO_DATA`) com um **identificador de regra** e uma frase em linguagem simples.

Na Astronaut Health Intelligence Platform (AHI) a detecção roda em fluxo, com custo constante por amostra (`MetricTracker` em `anomaly.ts`).

## Entradas

| Entrada | Origem |
| --- | --- |
| Valor, horário, qualidade e dispositivo da observação | Adapters simulados (<OriginBadge origin="SIMULATED" />) ou check-in (<OriginBadge origin="MANUAL" />) |
| Baseline pessoal pronta do contexto atual | [Linha de base pessoal](/pt/intelligence/personal-baseline) |
| Direção ruim da métrica (para cima, para baixo, ambas) | [Dicionário de dados](/pt/data/data-dictionary) |
| Estado do dispositivo (`ONLINE`, `DEGRADED`, `DATA_STALE`, `OFFLINE`) | Adapters |
| Limiares fixos de demo | [Limiares e limitações](/pt/intelligence/thresholds) |

## Método

### 1. z robusto (mudança aguda)

```text
z     = (mediana das 3 últimas leituras - m) / s
z_mau = z          se a direção ruim é "para cima"
        -z         se é "para baixo"
        |z|        se são "ambas"
```

`m` e `s` são a mediana e a escala robusta da baseline do contexto atual. Usar a mediana de 3 leituras filtra um pico isolado (teste "a single spike is filtered by the 3 reading median").

| `z_mau` | Nível |
| --- | --- |
| 4 ou mais | MODERATE |
| 5,5 ou mais | HIGH |
| 7 ou mais | CRITICAL |

**Ajuste para exercício.** No contexto de exercício (incluindo aquecimento e os 20 minutos de recuperação), métricas de dois lados (frequência cardíaca, pressão, respiração, temperatura da pele) só sinalizam desvio **para cima**. Valores abaixo da mediana de exercício são esperados no aquecimento e no desaquecimento. Esse ajuste foi encontrado pela avaliação (`npm run evaluate`), que mostrou alertas falsos de pressão no cenário nominal.

### 2. Deriva EWMA (mudança lenta)

```text
alpha  = 1 - 0,5 ^ (dt / meia-vida),  meia-vida = 180 min simulados
D_t    = D_(t-1) + alpha x (clamp(z_t, -6, 6) - D_(t-1))
```

`z_t` é o z de cada leitura isolada. `D` é uma média móvel exponencial do z: sobe devagar quando a pessoa se afasta do normal e não se impressiona com um pico. O z é limitado a ± 6 para que uma leitura absurda não domine a média.

| Condição sobre `D` (na direção ruim) | Nível |
| --- | --- |
| 1,0 ou mais, sustentado por 3 h | MODERATE |
| 2,0 ou mais, sustentado por 12 h | HIGH |
| Abaixo de 0,8 | A contagem de tempo zera (histerese) |

A deriva detecta um deslocamento sustentado que nenhum valor isolado sinalizaria (teste "EWMA drift detects a sustained shift").

### 3. Persistência (métricas diárias)

Sono, desempenho de exercício, tempo de reação e autorrelato chegam uma vez por dia ou por sessão. Para eles conta a sequência de valores fora da faixa (`z_mau` de 2 ou mais):

| Condição | Nível |
| --- | --- |
| 1 valor com `z_mau` de 3 ou mais | MODERATE |
| 2 valores seguidos fora da faixa | MODERATE |
| 3 valores seguidos fora da faixa | HIGH |

A frase usa a unidade natural, por exemplo "2 nights" ou "3 sessions".

### 4. Limiares fixos de demo

Uma pequena lista de limiares fixos (`FIXED_THRESHOLDS`) é aplicada sobre a mediana das 3 últimas leituras, como rede de segurança. Alguns só valem fora do exercício. Os valores ficam só em [Limiares e limitações](/pt/intelligence/thresholds).

### 5. Qualidade do dado

| Regra | Condição | Resultado |
| --- | --- | --- |
| R-DQ-01 | Nenhum valor válido há mais de `staleMin` minutos, ou dispositivo `DATA_STALE` ou `OFFLINE` | Status `NO_DATA`; regra MODERATE |
| R-DQ-02 | 20% ou mais das últimas 15 leituras marcadas `QUESTIONABLE` | Regra MODERATE |
| Limite de nível | O valor atual é questionável | O nível da métrica fica limitado a MODERATE |

O tempo `staleMin` de cada métrica está no [Dicionário de dados](/pt/data/data-dictionary). **Dado ausente nunca é `LOW`** (teste "missing or stale data is NO_DATA, never LOW").

### Combinação por métrica

Para cada métrica fica o pior achado entre os detectores. Métricas de autorrelato têm teto em MODERATE. O resultado vira um `MetricState`: valor, status, z, deriva, persistência, regra e frase.

### Identificadores de regra

R-HR-01 (FC aguda), R-HR-02 (deriva da FC de repouso), R-HR-03 (teto de demo em repouso), R-HRV-01, R-SPO2-01 (contra a faixa pessoal), R-SPO2-02 (piso de demo), R-RR-01, R-BP-01, R-TEMP-01, R-ACT-01, R-HYD-01, R-SLEEP-01, R-SLEEP-02, R-EX-01, R-RT-01, R-RAD-02, R-ENV-CO2-01, R-ENV-TEMP-01, R-ENV-RH-01, R-ENV-RAD-01, R-DQ-01, R-DQ-02 e as regras de autorrelato R-PSY-01 a R-PSY-04. As regras combinadas estão em [Avaliação de risco](/pt/intelligence/risk-assessment). A relação métrica para regra está no [Dicionário de dados](/pt/data/data-dictionary).

### Premissas

- O desvio só tem sentido com uma baseline `READY`. Sem ela, só valem limiares de demo e qualidade.
- A direção ruim de cada métrica está correta.
- O ruído simulado se parece com ruído real de sensor.

### Interpretação

| Achado | Leitura |
| --- | --- |
| z alto, sem deriva | Algo mudou de repente. Pode ser real ou artefato; o painel pede checagem |
| Deriva sem z alto | Mudança pequena, mas persistente. É o padrão típico de fadiga |
| Persistência em métricas diárias | Várias noites ou sessões ruins seguidas |
| `NO_DATA` | O status é desconhecido. Não é bom nem ruim |

## Saídas

`MetricState` por pessoa e métrica, `Anomaly` registrada com método (`ROBUST_Z`, `EWMA`, `PERSISTENCE`, `COMBINED` ou `DATA_QUALITY`; limiares fixos são registrados como `PERSISTENCE`) e explicação não diagnóstica, e as regras disparadas que alimentam o [escore de risco](/pt/intelligence/risk-assessment). Origem: <OriginBadge origin="DERIVED" />.

## Limitações

- Detectores univariados: a relação entre métricas só entra pelas regras combinadas. Não há detecção multivariada (Isolation Forest está [planejado](/pt/intelligence/ai-and-analytics)).
- Os níveis de z e os tempos de deriva foram ajustados no simulador, não em dados reais.
- A regra IQR e o CUSUM, citados no plano do projeto, **não foram implementados**. A mediana com MAD e a deriva EWMA cumprem papéis equivalentes.

## Status

<StatusBadge status="IMPLEMENTED" /> Coberto por `anomaly.test.ts` (8 testes: baseline estável, salto agudo, pico isolado, deriva, `NO_DATA`, teto de dado questionável, contexto de exercício, noites curtas seguidas), `stats.test.ts` e pelos cenários de `engine.test.ts`.

## Próximos passos

- [Avaliação de risco](/pt/intelligence/risk-assessment): como os achados viram escore e nível.
- [Limiares e limitações](/pt/intelligence/thresholds).
- [Resultados e evidências](/pt/validation/results): tempos de detecção por cenário.
