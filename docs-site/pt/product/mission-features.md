---
title: Recursos da missão
description: Earth link, check-in diário, visão de longo prazo, relatório de passagem de turno com exportação FHIR R4, comparação "e se" e o diálogo Data and model.
status: IMPLEMENTED
origin: SIMULATED, MANUAL, DERIVED, REAL_PUBLIC
code:
  - frontend/web/src/features/comms/index.tsx
  - frontend/web/src/features/checkin/index.tsx
  - frontend/web/src/features/mission/index.tsx
  - frontend/web/src/features/report/index.tsx
  - frontend/web/src/lib/fhir.ts
  - frontend/web/src/features/whatif/index.tsx
  - frontend/web/src/features/datasources/DataModelDialog.tsx
tests:
  - frontend/web/src/lib/fhir.test.ts
  - frontend/web/src/engine/missionDays.test.ts
  - frontend/web/src/engine/intervention.test.ts
verified: 2026-11-14
---

# Recursos da missão

Além do painel principal, a Astronaut Health Intelligence Platform (AHI) tem recursos pensados para a rotina de uma missão longa: comunicação com atraso, check-in diário, visão de longo prazo, relatório de passagem de turno, comparação "e se" e a transparência sobre dados e modelo.

::: info
Esta página mostra **como usar** cada recurso na tela. Como cada um funciona por dentro (fórmulas, tempos, regras) está na seção [Inteligência de saúde](/pt/intelligence/overview). Todos os números fixos são **configuração de demo, não limites oficiais** ([Limiares](/pt/intelligence/thresholds)).
:::

## Comunicação com a Terra ("Earth link")

![Earth link em perfil Marte](/screenshots/mars-comms.png)

Perigo tratado: **Distance from Earth**. Quanto mais longe, mais a tripulação precisa decidir a bordo.

### Perfis de comunicação

Escolha o perfil em "Distance from Earth", na gaveta "Earth link" (botão na barra superior): "ISS (low Earth orbit)", "Moon", "Mars (closest)" ou "Mars (farthest)". O selo mostra o atraso só de ida e quantas mensagens estão em trânsito. Os atrasos de cada perfil e o modelo de mensagens estão em [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link#earth-link).

### Botões e mensagens

- **"Send health packet"**: envia um resumo de saúde da pessoa selecionada (status, vitais, fatores).
- **"Request flight surgeon consult"**: pede revisão do médico de voo, com o status atual, a recomendação aberta e o alerta aberto.
- **Pacote automático**: quando um alerta chega a HIGH ou CRITICAL, a AHI envia um pacote de saúde sozinho (uma vez por alerta).
- **Resposta simulada**: um médico de voo simulado responde depois de um tempo de revisão mais o atraso. A resposta **nunca prescreve medicamento** e diz que é simulada.
- A gaveta separa **"In transit"** (com barra de progresso) e **"Delivered"**. As mensagens também aparecem como marcadores na linha do tempo.

### Passos a bordo primeiro

Cada recomendação tem um selo de **autonomia**: "Can act on board now" (a tripulação pode agir sem esperar a Terra) ou "Needs flight surgeon" (precisa de revisão em solo).

Nos perfis de Marte, um item HIGH ou CRITICAL que precisa de revisão em solo também gera **um primeiro passo a bordo**: "Crew medical officer: start the onboard assessment protocol now". O selo "Earth reply in ... +" mostra no cartão da ação o tempo mínimo até a resposta da Terra. Regras em [Recomendações, autonomia e what-if](/pt/intelligence/recommendations).

## Check-in diário

O check-in leva cerca de 30 segundos e complementa os sinais objetivos com autorrelato.

| Pergunta (interface) | Escala de 1 a 5 |
| --- | --- |
| "How is your mood?" | de "Very low" a "Very good" (5 é melhor) |
| "How tired do you feel?" | de "Rested" a "Exhausted" (5 é pior) |
| "How stressed do you feel?" | de "Calm" a "Very high" (5 é pior) |
| "How well did you sleep?" | de "Very poorly" a "Very well" (5 é melhor) |

Também há sintomas marcáveis em "Anything bothering you?" (headache, congestion, back pain, nausea, eye discomfort, trouble sleeping ou none) e uma nota opcional para o oficial médico de bordo.

O que acontece com as respostas:

- Humor, fadiga e estresse são comparados com **as respostas anteriores da própria pessoa**.
- **Autorrelato sozinho chega no máximo a MODERATE** e **nunca dispara alerta**.
- Sintomas aparecem como fato relatado, por exemplo "You reported a headache today". Nunca como diagnóstico.
- Um check-in digitado (`MANUAL`) substitui o simulado (`SIMULATED`) do mesmo dia.

Regras completas em [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link#check-in-diario).

## Visão de longo prazo da missão

![Mission overview](/screenshots/mission-overview.png)

Aberta em "Tools" > "Mission overview". Mostra o dia atual em relação ao plano ("Day 44 of 180 planned" no início da demo).

| Indicador | O que mostra |
| --- | --- |
| "Radiation vs demo budget" | Dose acumulada com projeção linear tracejada até o fim da missão, contra o orçamento de demo |
| "Exercise 7 d" e aderência semanal | Minutos de exercício em relação ao plano, em % por semana |
| "Sleep 7 d" e sono semanal | Média de horas por noite, contra a meta de demo |
| "Resting HR" e "HRV" | Valores diários ao longo da missão. Compare com a tendência, não com limites fixos |
| "Daily risk" | Nível de atenção de cada dia |

Os valores do orçamento e das metas estão em [Limiares e limitações](/pt/intelligence/thresholds#metas-e-orcamento-da-missao-mission-plan).

Há uma tabela da tripulação inteira e gráficos por pessoa (seletor de membro da tripulação).

::: warning ATENÇÃO
Os dias mais antigos da missão são **sintetizados** a partir do perfil de cada pessoa (semeados e reproduzíveis), marcados como resumo. Só os dias recentes vêm do histórico da simulação. O orçamento de radiação é configuração de demo, não limite oficial.
:::

## Relatório de passagem de turno

![Relatório de passagem de turno](/screenshots/handover-report.png)

Aberto em "Tools" > "Shift handover". Cobre as **últimas 24 horas simuladas** e traz o selo "SIMULATED DATA".

Seções:

- "Crew at a glance": status, resumo e alertas abertos de cada pessoa e da cabine;
- "Crew details (last 24 h)": principais fatores, previsões relevantes, alertas, ações registradas, check-ins e recomendações pendentes (com autonomia);
- "Cabin environment": resumo e alertas da cabine;
- "Earth link (last 24 h)": mensagens trocadas com a Terra.

Botões:

| Botão | O que faz |
| --- | --- |
| "Refresh" | Regenera o relatório a partir do estado atual |
| "Print" | Imprime (o layout tem estilo próprio de impressão) |
| "Export FHIR R4 Bundle (JSON)" | Baixa um Bundle FHIR R4 |
| "Send to ground" | Envia o relatório à Terra pelo "Earth link", com o atraso do perfil ativo |

### Exportação FHIR R4

O arquivo é um `Bundle` do tipo `collection`, gerado no navegador, com:

- recursos `Patient` só com **identificadores pseudonimizados** (sem nome, data de nascimento, gênero ou outro dado pessoal);
- recursos `Device` (os adapters simulados);
- recursos `Observation` com o valor atual de cada métrica acompanhada.

Códigos LOINC são usados **só onde são bem estabelecidos**: frequência cardíaca (8867-4), frequência respiratória (9279-1), pressão sistólica (8480-6), pressão diastólica (8462-4) e SpO₂ (59408-5). As demais métricas usam o sistema local `urn:ahi:metric`. Unidades seguem UCUM quando existe código limpo. A origem do dado (`SIMULATED`, `MANUAL` etc.) vai como tag em cada recurso.

::: info
É uma demonstração de interoperabilidade, não uma interface clínica validada. FHIR é usado só como formato de exportação.
:::

## Comparação "e se"

![Comparação e se](/screenshots/whatif.png)

O botão **"Compare"** em um cartão de ação abre "What if: ...". O gráfico mostra o histórico recente ("Recent"), a trajetória **sem a ação** ("Without action"), a trajetória **com a ação** ("With action") e a faixa pessoal ("Personal normal"), além das premissas da simulação.

A métrica e o horizonte padrão de cada ação, e o método, estão em [Recomendações, autonomia e what-if](/pt/intelligence/recommendations). Checagem de sensor não tem comparação.

::: warning ATENÇÃO
"Simulation for discussion only. Not evidence of clinical efficacy." Os tamanhos de efeito são parâmetros do simulador, não evidência. A comparação roda o modelo de simulação sem ruído duas vezes, a partir do estado atual, e não altera nada.
:::

## Diálogo "Data and model"

![Data and model](/screenshots/data-model.png)

Aberto em "Tools" > "Data and model": "Where every number comes from, and what the engine can and cannot do." Tem quatro abas:

| Aba | Conteúdo |
| --- | --- |
| "Real datasets" | OSD-569 (hemograma) e OSD-575 (painel metabólico) da Inspiration4, com fonte, missão, população, desenho, coleta, protocolo do ensaio, SHA-256 (copiável), data de download, versão, licença, acesso e completude. Aviso: "Historical public research data. Not live telemetry and not this crew." |
| "Simulated devices" | Cada adapter simulado, seu equivalente real e o caminho para dado real |
| "Model card" | Uso pretendido, método, limitações e a avaliação em dados simulados (alertas falsos e tempo de detecção por cenário) |
| "Data origins" | As quatro categorias de `data_origin` e as regras de transparência |

No gráfico dos datasets reais, o voo de 3 dias da Inspiration4 aparece como uma lacuna ("No samples in this file"), as médias de grupo são marcadas `DERIVED` e as faixas de referência são as do laboratório (não são limites da NASA nem usadas para alertas). A proveniência completa está no [Catálogo de datasets](/pt/data/dataset-catalog).

## Próximos passos

- [Cenários e demo guiada](/pt/product/demo-scenarios): use estes recursos dentro de uma história.
- [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link): comunicação e check-ins por dentro.
- [Catálogo de datasets](/pt/data/dataset-catalog): proveniência dos dados reais.
