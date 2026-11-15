---
title: Previsão
description: Projeção de curto prazo com suavização de Holt linear amortecida, intervalo de 80%, tempo até sair da faixa pessoal e regra de recuperação.
status: IMPLEMENTED
origin: DERIVED
code:
  - frontend/web/src/engine/forecast.ts
  - frontend/web/src/engine/config.ts
tests:
  - frontend/web/src/engine/forecast.test.ts
verified: 2026-11-14
---

# Previsão

## O que faz

Projeta algumas métricas para as próximas horas (ou dias) com **incerteza explícita** e estima **quando a projeção sai da faixa pessoal**. Na Astronaut Health Intelligence Platform (AHI) isso aparece no painel "Forecast" ("Projected to leave your normal range in ...") e como cone tracejado nos gráficos.

::: info
É uma **projeção estatística de dados simulados**, não uma previsão clínica. O aviso padrão: "Statistical projection from recent simulated data. Not a clinical prediction: uncertainty grows with the horizon and the projection assumes recent conditions continue."
:::

## Entradas

| Métrica | Dados usados | Passo |
| --- | --- | --- |
| Frequência cardíaca, HRV, SpO₂ | Médias de 30 min das últimas 24 h, ajustadas para o valor de repouso (exercício excluído) | 30 min |
| Duração do sono | Valores diários | 1 dia |
| Desempenho de exercício | Valores por sessão | 1 dia |
| CO₂ da cabine | Médias de 30 min | 30 min |

A faixa pessoal do contexto de repouso vem da [baseline pessoal](/pt/intelligence/personal-baseline).

## Método

### Holt linear amortecido

```text
nível_t     = alpha x y_t + (1 - alpha) x (nível_(t-1) + phi x tendência_(t-1))
tendência_t = beta x (nível_t - nível_(t-1)) + (1 - beta) x phi x tendência_(t-1)
previsão_(t+h) = nível_t + (phi + phi² + ... + phi^h) x tendência_t
```

| Parâmetro | Valor | Papel |
| --- | --- | --- |
| `alpha` | 0,4 | Quanto o nível segue o valor mais recente |
| `beta` | 0,15 | Quanto a tendência se atualiza |
| `phi` | 0,9 | Amortecimento: a tendência perde força a cada passo, então a projeção não dispara para o infinito |

### Intervalo de 80%

```text
sd_h = sd_1 x raiz(1 + soma de j = 1 até h - 1 de (alpha x (1 + beta x (phi + ... + phi^j)))²)
intervalo = previsão ± 1,2816 x sd_h
```

`sd_1` é o desvio do resíduo de um passo, calculado nos resíduos mais recentes (a série pode ter mudado de regime). O intervalo alarga com o horizonte, como o teste "interval widens with the horizon" confirma.

### Horizontes só com dados suficientes

| Tipo | Horizonte curto | Horizonte longo |
| --- | --- | --- |
| Contínua (janelas de 30 min) | 6 h, com pelo menos 12 janelas | 24 h, com pelo menos 40 janelas |
| Diária | 1 dia, com pelo menos 5 valores | 3 dias, com pelo menos 10 valores |

Sem dados suficientes, a previsão fica **inelegível** e a interface diz "Not enough data to forecast yet". A previsão é recalculada a cada 10 minutos simulados.

### Saída da faixa (`hoursToBandExit`)

O primeiro momento em que a **projeção central** sai da faixa pessoal. Se o último valor observado já está fora, o valor é 0.

### Regra de recuperação

Uma série que acabou de voltar do lado oposto da faixa está se recuperando, não derivando. Se houve uma excursão recente (nas últimas 6 janelas) do outro lado e a tendência aponta de volta, a saída da faixa **não é anunciada** (teste "does not report a band exit while a metric is recovering from the opposite side").

### Premissas

- As condições recentes continuam. Uma intervenção, uma mudança de cronograma ou um evento novo invalidam a projeção.
- Os resíduos são aproximadamente normais e estáveis (base do fator 1,2816).

### Interpretação

| Texto na interface | Leitura |
| --- | --- |
| "Projected to leave your normal range in 6 h" | Se nada mudar, a linha central sai da faixa em cerca de 6 horas |
| "Stable over next N h" | A linha central fica dentro da faixa no horizonte |
| "Not enough data to forecast yet" | Não há dados para um horizonte confiável |

O intervalo de 80% não é uma garantia: em 1 a cada 5 casos, em média, o valor real cairia fora dele, mesmo se as premissas valessem.

## Saídas

`Prediction` (em `domain.ts`): pessoa, métrica, método (`Damped Holt linear smoothing v1`), horizonte, pontos com valor central e limites inferior e superior, tempo até sair da faixa, elegibilidade e aviso. Origem: <OriginBadge origin="DERIVED" />.

## Limitações

- Método univariado, sem sazonalidade explícita (o ajuste para repouso remove parte do ritmo diário).
- Parâmetros fixos, não ajustados por pessoa nem por métrica.
- A cobertura real do intervalo de 80% não foi medida.
- ARIMA e modelos mais ricos não estão implementados ([IA e análise](/pt/intelligence/ai-and-analytics)).

## Status

<StatusBadge status="IMPLEMENTED" /> Coberto por `forecast.test.ts` (9 testes: tendência amortecida, poucos pontos, intervalo crescente, janelas irregulares, inelegibilidade, horizontes de 6 h e 24 h, saída da faixa, métricas diárias, regra de recuperação).

## Próximos passos

- [Recomendações, autonomia e what-if](/pt/intelligence/recommendations): a projeção com e sem uma ação.
- [Tour do produto](/pt/product/product-tour): onde a previsão aparece na tela.
- [Limitações e problemas conhecidos](/pt/validation/limitations).
