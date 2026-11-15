---
title: Linha de base pessoal
description: Como a Astronaut Health Intelligence Platform aprende o normal de cada pessoa com estatística robusta (mediana, MAD), por contexto de atividade.
status: IMPLEMENTED
origin: DERIVED
code:
  - frontend/web/src/engine/baseline.ts
  - frontend/web/src/engine/stats.ts
  - frontend/web/src/engine/anomaly.ts
  - frontend/web/src/engine/config.ts
tests:
  - frontend/web/src/engine/baseline.test.ts
  - frontend/web/src/engine/stats.test.ts
  - frontend/web/src/engine/anomaly.test.ts
verified: 2026-11-14
---

# Linha de base pessoal

## O que faz

A linha de base pessoal (baseline, termo usado no código e no resto desta documentação) é a **faixa normal de cada pessoa para cada métrica**, aprendida a partir dos dados da própria pessoa. Na Astronaut Health Intelligence Platform (AHI), ninguém é comparado com uma média populacional: o status sai da distância entre o valor atual e esse normal pessoal.

Na interface, a faixa aparece como "Your normal" (faixa sombreada nos gráficos), e o ícone (i) explica: "Status compares you with yourself, not with a population average."

## Entradas

| Entrada | Detalhe |
| --- | --- |
| Valores recentes da pessoa | Observações válidas da métrica, guardadas em um reservatório circular por contexto |
| Contexto de atividade | `SLEEP`, `REST`, `WORK`, `EXERCISE` (exercício, EVA e os 20 minutos de recuperação contam como exercício). Vem do cronograma simulado |
| Qualidade | Amostras `QUESTIONABLE` não entram na baseline |
| Configuração por métrica | Piso de escala (`minScale`), limites físicos, se a métrica é separada por contexto (`METRIC_RULES` em `config.ts`) |

Métricas da cabine não têm baseline pessoal: um módulo não tem "normal pessoal" e usa só [limiares de demo](/pt/intelligence/thresholds).

## Método

### Estatística robusta

Para cada pessoa, métrica e contexto, com os valores aceitos x₁, x₂, ..., xₙ:

```text
mediana   m   = mediana(x)
MAD           = mediana(|x_i - m|)
escala    s   = max(1,4826 x MAD, minScale)
faixa         = [m - k x s, m + k x s], com k = 2, recortada aos limites físicos
também guardados: média, desvio padrão, p05 e p95
```

| Variável | Significado |
| --- | --- |
| `m` | Valor típico da pessoa naquele contexto |
| `MAD` | Desvio absoluto mediano: quanto a pessoa costuma variar, ignorando picos isolados |
| `1,4826` | Fator que torna o MAD comparável a um desvio padrão quando os dados são aproximadamente normais |
| `minScale` | Piso por métrica, para que um sinal muito estável não faça mudanças pequenas parecerem enormes (por exemplo 3,5 bpm na frequência cardíaca e 0,7 ponto no SpO₂) |
| `k = 2` | Largura da faixa em desvios robustos (`BASELINE.bandK`) |

**Por que mediana e MAD.** Média e desvio padrão se deslocam com um único pico. Mediana e MAD quase não se movem com valores extremos, o que um teste confirma ("is robust to outliers").

### Contextos

A frequência cardíaca de um treino não deve ser comparada com a do sono. Métricas fisiológicas contínuas têm uma baseline por contexto. Um treino é comparado com treinos anteriores e não gera alarme. Métricas diárias (sono, exercício, tempo de reação, autorrelato) usam uma baseline única.

### Quantidade mínima de dados

| Tipo | Mínimo para `READY` |
| --- | --- |
| Contínua, contexto comum | 72 amostras |
| Contínua, contexto de exercício | 36 amostras |
| Diária (evento) | 5 valores |

Abaixo do mínimo, a baseline fica `INSUFFICIENT_DATA`, nenhuma regra de desvio a usa e a interface diz "Still learning your normal".

### Portão contra deriva

Uma amostra contínua só entra na baseline se:

- o valor não é questionável;
- `|z|` da amostra é menor que 3,5 (portão de outlier);
- o indicador de deriva EWMA está abaixo de 1,0 em módulo;
- o horário cai na grade de 5 minutos (resolução do reservatório).

Em métricas diárias, o valor entra se `|z|` for menor que 2,5. Assim, **um declínio lento não vira o novo normal**: enquanto a pessoa está derivando, as amostras novas ficam de fora.

### Recálculo e memória

- Reservatório por contexto: 5 dias com resolução de 5 minutos (1440 valores). Métricas diárias guardam 28 valores.
- Recálculo a cada 24 amostras aceitas (2 horas simuladas), nunca a cada tick. Durante a geração do histórico inicial, a cada 144.
- Na inicialização são gerados 5 dias de histórico por minuto e 14 dias de métricas diárias, para as baselines estarem prontas ao abrir o app.

### Premissas

- O passado recente da pessoa, fora de derivas, representa o normal dela.
- O contexto de atividade do cronograma está correto.
- Os dados simulados têm variação parecida com a real. Isso não foi validado com dados de astronautas.

### Interpretação

Estar fora da faixa **não é diagnóstico**. Significa só que o valor está longe do que é típico para aquela pessoa, naquele contexto. O que acontece depois (nível, alerta) depende das regras de [detecção de anomalias](/pt/intelligence/anomaly-detection).

## Saídas

O tipo `Baseline` (em `domain.ts`): métrica, status (`READY` ou `INSUFFICIENT_DATA`), n, média, mediana, desvio padrão, MAD, p05, p95, limite baixo e alto, rótulo da janela e versão `robust-baseline v1 (median/MAD)`. Origem: <OriginBadge origin="DERIVED" />.

## Limitações

- O contexto vem do cronograma, não de reconhecimento de atividade por sensor.
- Com respostas inteiras (autorrelato de 1 a 5), o MAD costuma ser 0 e o piso de escala define a faixa (mediana ± 1,5).
- Uma pessoa que já começa a missão fora do seu normal histórico teria esse estado aprendido como normal.
- Os parâmetros (k, mínimos, portões) foram ajustados no simulador, não com dados reais.

## Status

<StatusBadge status="IMPLEMENTED" /> Coberto por `baseline.test.ts` (tamanho mínimo, faixa de ± 2 desvios robustos, robustez a outliers, limites físicos, reservatório), `stats.test.ts` (mediana, MAD, z robusto com piso) e `anomaly.test.ts` (baseline por contexto).

## Próximos passos

- [Detecção de anomalias](/pt/intelligence/anomaly-detection): como o desvio vira nível.
- [Dicionário de dados](/pt/data/data-dictionary): métricas, unidades e contextos.
- [Resultados e evidências](/pt/validation/results).
