---
title: Avaliação de risco
description: Regras combinadas, escore de risco de 0 a 100 por noisy-OR, confiança e frase de status da Astronaut Health Intelligence Platform.
status: IMPLEMENTED
origin: DERIVED
code:
  - frontend/web/src/engine/risk.ts
  - frontend/web/src/engine/config.ts
tests:
  - frontend/web/src/engine/risk.test.ts
  - frontend/web/src/engine/engine.test.ts
verified: 2026-11-14
---

# Avaliação de risco

## O que faz

Transforma as regras disparadas para uma pessoa em **um nível de atenção** (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`), um **escore de 0 a 100**, uma **confiança**, uma lista de **fatores** com peso e uma **frase de status** em linguagem simples.

::: warning ATENÇÃO
O nível é um **nível operacional de atenção do protótipo**, não uma classificação médica. Os pesos e as faixas são configuração de demo (`RISK` em `config.ts`) e nunca foram calibrados com desfechos reais.
:::

## Entradas

| Entrada | Origem |
| --- | --- |
| Achados por métrica (nível, regra, frase) | [Detecção de anomalias](/pt/intelligence/anomaly-detection) |
| Estado da cabine | Regras de ambiente; contam para todos os tripulantes |
| Resumo do autorrelato (sintomas do dia, sequência de fadiga alta) | [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link) |
| Disponibilidade e qualidade dos sinais-chave | FC, HRV, SpO₂, frequência respiratória e duração do sono |

## Método

### 1. Regras combinadas

Algumas mudanças importam mais quando aparecem juntas.

| Regra | Condição | Nível |
| --- | --- | --- |
| R-CARD-01 | Frequência cardíaca e SpO₂ ambos em HIGH ou pior ao mesmo tempo | CRITICAL |
| R-FAT-01 | Pelo menos dois de três componentes: sono curto ou pouco eficiente (MODERATE ou pior); HRV baixa (MODERATE ou pior, ou deriva de -1,2 ou menos); FC de repouso alta (deriva de 1,0 ou mais) | 2 de 3: MODERATE; 3 de 3: HIGH |
| R-ENV-CO2-02 | CO₂ da cabine em MODERATE ou pior enquanto a respiração deriva para cima (deriva de 0,8 ou mais) ou o tempo de reação piora (MODERATE ou pior, ou z de 2 ou mais) | MODERATE (coocorrência, não prova de causa) |

Regras combinadas **agrupam seus componentes** em alertas e recomendações (um alerta em vez de cinco). Enquanto R-FAT-01 está ativa, R-SLEEP-01, R-SLEEP-02, R-HRV-01, R-HR-02 e R-PSY-02 não geram itens separados; R-CARD-01 faz o mesmo com R-HR-01, R-HR-03, R-SPO2-01, R-SPO2-02, R-RR-01 e R-BP-01; R-ENV-CO2-02 com R-RR-01 e R-RT-01. Um componente CRITICAL nunca é escondido por uma regra combinada que não seja CRITICAL. O agrupamento vale para alertas e recomendações; o escore continua contando cada regra. Dado ausente nunca conta como componente normal (teste "missing data never counts as a normal component").

### 2. Escore por noisy-OR

```text
w(MODERATE) = 0,20     w(HIGH) = 0,45     w(CRITICAL) = 0,85

escore = round(100 x (1 - produto sobre as regras de (1 - w_i)))
```

| Variável | Significado |
| --- | --- |
| `w_i` | Peso da regra `i`, pelo **pior nível** que ela atingiu. Cada identificador de regra conta uma vez |
| `1 - w_i` | "Chance" de a regra não indicar problema, no raciocínio do noisy-OR |
| produto | As regras são tratadas como evidências independentes |

| Escore | Nível |
| --- | --- |
| abaixo de 20 | LOW |
| 20 a 44 | MODERATE |
| 45 a 79 | HIGH |
| 80 a 100 | CRITICAL |

Regras especiais:

- **Vários desvios moderados escalam por construção.** Uma regra MODERATE dá 20. Três regras MODERATE dão `100 x (1 - 0,8³) = 48,8`, arredondado para 49: HIGH.
- **CRITICAL exige pelo menos uma regra CRITICAL** (aguda). Sem ela, o escore fica limitado a 79. Padrões lentos de vários dias pedem revisão, não emergência.
- **Qualidade do dado** (R-DQ-01, R-DQ-02) tem peso máximo de 0,20.
- **Autorrelato compartilha um único peso**: todas as regras R-PSY entram como um grupo, com o maior peso entre elas. O check-in sozinho chega no máximo a MODERATE. Um sintoma relatado (R-PSY-04) pesa 0,05.
- **Regras da cabine** contam no escore de todos os tripulantes.

### 3. Fatores

Cada regra vira um fator com peso relativo: `peso_i / soma dos pesos`. O painel "Why" mostra esses pesos em porcentagem, do maior para o menor.

### 4. Confiança

```text
confiança = 0,95
          - 0,15 por sinal-chave ausente (FC, HRV, SpO₂, respiração, sono)
          - 0,07 por sinal questionável
          - 0,05 por baseline não pronta
limitada entre 0,15 e 0,95
```

Se os vitais principais estão ausentes, o painel diz "Core vitals missing. Status cannot be confirmed."

### 5. Frase de status

Uma frase calma, em inglês simples, a partir da regra mais relevante (maior nível; em empate, combinada antes de fisiológica, ambiental, qualidade e autorrelato). Exemplos de final: "keep an eye on it", "a flight surgeon review is suggested", "a sensor check is suggested". Sem achados: "All indicators are within your normal range."

### 6. Regiões do corpo

O status de cada região do 3D é o pior status entre as métricas da região. Uma região sem nenhuma métrica com dado fica `NO_DATA`, nunca `LOW`.

### Premissas

- As regras são tratadas como independentes (hipótese do noisy-OR). Na prática, sinais correlacionados (sono, HRV e FC de repouso, por exemplo) podem somar mais de uma vez no escore.
- Os pesos refletem urgência relativa, não probabilidade calibrada.

### Interpretação

O escore **não é uma probabilidade de evento clínico**. É uma forma transparente e monotônica de somar evidências: mais regras ou regras mais graves nunca diminuem o escore.

## Saídas

`RiskAssessment` (em `domain.ts`): nível, escore, fatores, regras disparadas, confiança, versão do modelo (`AHI transparent rules v2.0 (demo)`), momento da avaliação, limitações e frase de status. Origem: <OriginBadge origin="DERIVED" />. As limitações padrão incluídas em cada avaliação dizem, em inglês, que o dado é simulado, que não é diagnóstico, que os limiares são de demo e que correlação não prova causa.

## Limitações

- Pesos e faixas escolhidos à mão para o simulador.
- A independência entre regras é uma simplificação.
- Sem calibração com desfechos: não há dados rotulados. Um modelo como XGBoost só faria sentido com eles ([não implementado](/pt/intelligence/ai-and-analytics)).

## Status

<StatusBadge status="IMPLEMENTED" /> Coberto por `risk.test.ts` (14 testes: faixas, três MODERATE viram HIGH, teto sem CRITICAL, peso de qualidade, R-CARD-01, R-FAT-01, dado ausente, fatores e confiança, regiões, alertas e recomendações) e pelos cenários de `engine.test.ts`.

## Próximos passos

- [Recomendações, autonomia e what-if](/pt/intelligence/recommendations): o que fazer com o nível.
- [Alertas e escalonamento](/pt/intelligence/alerts).
- [Resultados e evidências](/pt/validation/results).
