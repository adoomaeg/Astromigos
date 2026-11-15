---
title: Model card
description: Ficha do motor de inteligência de saúde da Astronaut Health Intelligence Platform. Uso pretendido, usuários, dados, método, avaliação, limitações e considerações éticas.
status: IMPLEMENTED
origin: SIMULATED, MANUAL, DERIVED
code:
  - frontend/web/src/engine/config.ts
  - frontend/web/src/engine/evaluation.json
  - frontend/web/scripts/evaluate.ts
  - frontend/web/src/features/datasources/ModelCardTab.tsx
verified: 2026-11-14
---

# Model card

Ficha do motor de inteligência de saúde da Astronaut Health Intelligence Platform (AHI). A versão oficial é gerada por `npm run evaluate` (`frontend/web/scripts/evaluate.ts`) em `docs/model-card.md`; esta página traduz e organiza o mesmo conteúdo.

| Item | Valor |
| --- | --- |
| Motor | `ahi-engine 2.0.0` |
| Modelo de risco | `AHI transparent rules v2.0 (demo)` |
| Avaliação gerada em | 2026-11-14T12:17:47.455Z |
| Tipo | Regras estatísticas transparentes (sem aprendizado de máquina e sem LLM; veja [IA e análise](/pt/intelligence/ai-and-analytics)) |

## Uso pretendido

A AHI é um protótipo de hackathon de **apoio à decisão** para monitorar a saúde de tripulações em missões longas. Ela ajuda a tripulação, um oficial médico de bordo e um médico de voo a perceber quando um tripulante se afasta **do próprio normal**, explica o porquê em linguagem simples e sugere um próximo passo não prescritivo.

::: danger NÃO É UM DISPOSITIVO MÉDICO
Não diagnostica, não recomenda medicamentos e não usa limites oficiais da NASA. Todo número fixo é configuração de demo (`src/engine/config.ts`) e precisaria de revisão de um médico de voo antes de qualquer uso real.
:::

**Fora do escopo:** decisões clínicas, resposta a emergências, uso em pacientes reais ou com dados reais de astronautas.

## Usuários

| Usuário | Como usa |
| --- | --- |
| Tripulação | Entende o próprio estado na "Crew view" e faz o check-in diário |
| Oficial médico de bordo | Executa passos a bordo, sobretudo com atraso de comunicação grande |
| Médico de voo (flight surgeon) | Revisa itens HIGH e CRITICAL, responde pedidos de consulta |
| Mission Control | Acompanha ambiente, dose de radiação e alertas operacionais |

Todo item HIGH ou CRITICAL exige revisão humana.

## Dados

- Simulador semeado e reproduzível de uma tripulação de 4 pessoas, rodando no navegador:
  - camiseta inteligente (frequência cardíaca, HRV, SpO₂, frequência respiratória, temperatura da pele, estimativa de pressão arterial);
  - actigrafia (atividade, sono);
  - equipamentos de exercício (CEVIS, ARED, T2);
  - teste de reação, registro de ingestão de líquidos;
  - dosímetros pessoais e de área; CO₂, temperatura e umidade da cabine.
- Check-in diário (humor, fadiga, estresse e qualidade do sono de 1 a 5, sintomas), simulado a cada manhã ou digitado na interface.
- Na inicialização são gerados 5 dias de histórico por minuto e 14 dias de métricas diárias, para as baselines estarem prontas.
- Seis cenários: nominal, fadiga progressiva, aumento de CO₂ na cabine, queda de desempenho no exercício, falha de sensor e evento cardíaco agudo.
- Origem: todo dado de dispositivo é `SIMULATED`; check-ins digitados são `MANUAL`.

## Método

| Etapa | Resumo | Página |
| --- | --- | --- |
| Baseline pessoal | Mediana e MAD por métrica e contexto; faixa de mediana ± 2 desvios robustos; portão contra deriva | [Linha de base pessoal](/pt/intelligence/personal-baseline) |
| Detecção | z robusto da mediana de 3 leituras, deriva EWMA, persistência diária, limiares de demo, qualidade do dado | [Detecção de anomalias](/pt/intelligence/anomaly-detection) |
| Regras combinadas | R-CARD-01, R-FAT-01, R-ENV-CO2-02 | [Avaliação de risco](/pt/intelligence/risk-assessment) |
| Autorrelato | Comparado com as respostas da própria pessoa; teto em MODERATE; nunca alerta | [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link) |
| Escore de risco | Noisy-OR de um peso por regra; CRITICAL exige regra aguda | [Avaliação de risco](/pt/intelligence/risk-assessment) |
| Alertas | Um por pessoa e regra, resolução automática, escalonamento de demo | [Alertas e escalonamento](/pt/intelligence/alerts) |
| Comunicação | Atraso de luz por perfil; respostas simuladas; passo a bordo em Marte | [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link) |
| Previsão e "e se" | Holt amortecido com intervalo de 80%; simulação sem ruído com e sem intervenção | [Previsão](/pt/intelligence/forecasting), [Recomendações](/pt/intelligence/recommendations) |

## Avaliação (dados simulados)

| Medida | Resultado |
| --- | --- |
| Alertas falsos no cenário nominal | 0 por dia-tripulante em 60 dias-tripulante (5 sementes) |
| Evento cardíaco agudo | Detectado; único cenário que chega a CRITICAL |
| Falha de sensor | Detectada como qualidade do dado; pico em MODERATE, nunca normal |
| CO₂ da cabine, fadiga progressiva, queda de desempenho | Detectados; pico em HIGH, por projeto |

Os tempos de detecção, as grades e o detalhe por cenário estão em [Resultados e evidências](/pt/validation/results). A mesma avaliação aparece no app em "Tools" > "Data and model" > "Model card".

## Limitações

- Dados simulados e modelo fisiológico simplificado; nada foi validado com tripulações reais.
- A avaliação mede as regras contra o **mesmo simulador** que gerou os dados: mostra consistência interna, não sensibilidade ou especificidade no mundo real.
- Limiares, pesos, tempos de escalonamento, tempos de revisão e tamanhos de efeito das intervenções são configuração de demo.
- O contexto de atividade vem do cronograma, não de reconhecimento de atividade por sensor.
- Correlação entre sinais não prova causa (por exemplo, CO₂ e frequência respiratória).
- Autorrelato é subjetivo, e as respostas simuladas são um modelo de como pessoas poderiam responder.
- A visão de longo prazo da missão sintetiza dias antigos a partir de cada perfil; só os dias recentes vêm do histórico da simulação.
- As previsões assumem que as condições recentes continuam; não são previsões clínicas.
- Os datasets reais do OSDR são só referência histórica: não treinam nem ajustam o motor.

## Considerações éticas

- Apoio à decisão para humanos: todo item HIGH ou CRITICAL exige revisão humana.
- Linguagem simples primeiro, sem termos diagnósticos; dado ausente nunca aparece como normal.
- Identificadores pseudonimizados; nenhum dado pessoal real.

Mais em [Uso responsável](/pt/overview/responsible-use).

## Próximos passos

- [Uso responsável](/pt/overview/responsible-use).
- [Limitações e problemas conhecidos](/pt/validation/limitations).
- [Resultados e evidências](/pt/validation/results).
