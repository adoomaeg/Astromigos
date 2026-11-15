---
title: Riscos à saúde em voos espaciais
description: Os cinco hazards de voos espaciais humanos definidos pelo NASA Human Research Program e como cada um se relaciona com o que o Astronaut Health Intelligence Platform monitora ou simula.
verified: 2026-11-14
---

# Riscos à saúde em voos espaciais

O NASA Human Research Program (HRP) agrupa as ameaças à saúde em voos espaciais tripulados em cinco hazards (perigos): radiação espacial, isolamento e confinamento, distância da Terra, campos gravitacionais e ambientes hostis ou fechados.[^r1] O Astronaut Health Intelligence Platform (AHI) usa esse referencial para decidir quais sistemas do corpo e quais sinais da cabine merecem espaço no painel, e para deixar claro quais hazards ele não cobre.

::: info Apenas contexto educacional
Esta página resume material público da NASA para explicar o desenho da plataforma. Não é orientação médica. O AHI é um protótipo de apoio à decisão, não um dispositivo médico, e todos os dados de tripulação mostrados no app são simulados.
:::

## Os cinco hazards em resumo

A NASA observa que os hazards não agem isoladamente: eles se alimentam uns dos outros e agravam os efeitos sobre o corpo humano, e são estudados com análogos em solo, laboratórios e a Estação Espacial Internacional (ISS).[^r1]

| Hazard | O que a NASA descreve | Principais sistemas envolvidos |
| --- | --- | --- |
| **Radiação espacial** (*Space Radiation*) | Radiação ionizante invisível que a NASA considera um dos aspectos mais perigosos do voo espacial.[^r1] As fontes incluem raios cósmicos galácticos, eventos de partículas solares e partículas aprisionadas no campo magnético da Terra.[^r7] | Risco de câncer no longo prazo, sistema nervoso central, efeitos degenerativos; efeitos agudos em grandes eventos solares[^r8][^r9] |
| **Isolamento e confinamento** (*Isolation and Confinement*) | Respostas comportamentais aparecem em grupos pequenos, isolados e confinados longe da Terra; as tripulações precisam ser bem escolhidas, treinadas e apoiadas.[^r1] A NASA acompanha isso como o Behavioral Health Risk.[^r4] | Humor, estresse, cognição, sono, trabalho em equipe |
| **Distância da Terra** (*Distance from Earth*) | Instruções, suprimentos e atendimento médico ficam mais difíceis de receber à medida que a missão se afasta. Marte fica em média a 140 milhões de milhas, e o atraso de comunicação pode chegar a 20 minutos em cada sentido.[^r2] | Todos os sistemas: a tripulação precisa lidar com eventos médicos com apoio mínimo da Terra[^r2] |
| **Campos gravitacionais** (*Gravity Fields*) | Músculos, ossos, ouvido interno e órgãos precisam se ajustar a cada novo nível de gravidade.[^r1] Ossos que sustentam peso perdem em média de 1% a 1,5% de densidade mineral por mês no espaço, os fluidos se deslocam em direção à cabeça e a volta à gravidade pode causar tontura e desmaio.[^r3] | Musculoesquelético, cardiovascular, olhos, equilíbrio, rins |
| **Ambientes hostis ou fechados** (*Hostile/Closed Environments*) | A nave é ao mesmo tempo casa e máquina; temperatura, pressão, iluminação, ruído, micróbios e respostas imunes precisam ser controlados num ecossistema fechado.[^r1] | Respiratório (CO₂ da cabine), conforto térmico, sistema imune |

## Como cada hazard aparece na plataforma

A tabela abaixo mostra onde cada hazard aparece no AHI hoje. Todo sinal listado é **simulado** (`data_origin: SIMULATED`), salvo indicação; o check-in diário vira `MANUAL` quando alguém o preenche no app. Os códigos de métrica estão no [Dicionário de dados](/pt/data/data-dictionary), e o status de cada capacidade está na [Matriz de status das funcionalidades](/pt/overview/feature-status).

| Hazard | O que o AHI monitora ou simula | Códigos de métrica | Status no AHI |
| --- | --- | --- | --- |
| Radiação espacial | Taxa de dose ambiental com passagens simuladas pela Anomalia do Atlântico Sul e dose acumulada pessoal por astronauta | `RADIATION_DOSE_RATE`, `RADIATION_DOSE` | <StatusBadge status="IMPLEMENTED" /> simulado. Dosimetria real do NASA EDA ou do RadLab: <StatusBadge status="PLANNED" /> |
| Isolamento e confinamento | Autorrelato diário de humor, fadiga e estresse, mais um teste curto de tempo de reação | `MOOD`, `PERCEIVED_FATIGUE`, `STRESS`, `REACTION_TIME` | <StatusBadge status="IMPLEMENTED" /> simulado ou manual. O autorrelato sozinho fica limitado ao nível de atenção MODERATE |
| Distância da Terra | Perfis de link com a Terra (ISS, Lua, Marte mais próximo, Marte mais distante) com atrasos simulados, respostas atrasadas do flight surgeon e primeiros passos a bordo | não é métrica (perfil de comunicação) | <StatusBadge status="IMPLEMENTED" /> simulado. Os atrasos são valores públicos aproximados, configurados para a demonstração |
| Campos gravitacionais | Desempenho no exercício em relação à linha de base pessoal (sessões em CEVIS, ARED e T2), nível de atividade, pressão arterial e frequência cardíaca | `EXERCISE_LOAD`, `ACTIVITY_LEVEL`, `SYSTOLIC_BP`, `DIASTOLIC_BP`, `HEART_RATE` | <StatusBadge status="IMPLEMENTED" /> simulado. Densidade óssea, volume muscular e alterações oculares **não** são monitorados |
| Ambientes hostis ou fechados | CO₂, temperatura do ar e umidade relativa da cabine; efeito do CO₂ alto na frequência respiratória e no tempo de reação simulados | `CO2`, `CABIN_TEMPERATURE`, `RELATIVE_HUMIDITY` | <StatusBadge status="IMPLEMENTED" /> simulado. Telemetria real da cabine da ISS pelo NASA EDA: <StatusBadge status="PLANNED" /> |

::: warning ATENÇÃO
O AHI não modela risco de câncer, função imune, microbiologia, ruído, iluminação, densidade mineral óssea, volume muscular, função sensório-motora nem saúde ocular. Em missões reais, parte disso é medida apenas em exames periódicos ou amostras biológicas (veja [Monitoramento de saúde em missões](/pt/science/health-monitoring-in-missions)). A plataforma não estima risco de saúde por radiação; ela só exibe valores simulados de dose em comparação com níveis de observação de demonstração.
:::

## Hazard por hazard

### Radiação espacial

Fora da proteção da atmosfera e do campo magnético da Terra, as tripulações ficam expostas a raios cósmicos galácticos, eventos de partículas solares e partículas aprisionadas.[^r7][^r9] A NASA define um limite de exposição de carreira e um limite para eventos de partículas solares na norma NASA-STD-3001.[^r8] O AHI simula uma taxa de dose ambiental e uma dose acumulada pessoal, para que o painel mostre a radiação ao lado da fisiologia. Detalhes, unidades e a diferença entre dose e taxa de dose estão em [Radiação e ambiente da cabine](/pt/science/radiation-and-environment).

### Isolamento e confinamento

A NASA descreve um risco de alterações cognitivas ou comportamentais adversas e de transtornos psiquiátricos, e afirma que o isolamento e o confinamento do voo espacial podem reduzir o desempenho cognitivo e comportamental.[^r4] Na ISS, seleção, treinamento e contramedidas de saúde comportamental vêm mitigando esse risco, mas as contramedidas para missões de exploração ainda não foram desenvolvidas e validadas.[^r4] O AHI não faz nenhum diagnóstico nesse domínio: ele registra autorrelatos curtos e um teste de tempo de reação, e compara cada pessoa com as próprias respostas recentes.

### Distância da Terra

Para Marte, a NASA destaca atrasos de comunicação de até 20 minutos em cada sentido e a necessidade de a tripulação enfrentar situações com apoio mínimo da Terra.[^r2] Outro material da NASA situa o atraso com Marte entre cerca de 4 minutos na maior aproximação e cerca de 24 minutos na maior distância.[^r6] Por isso o AHI mostra primeiros passos a bordo e simula respostas atrasadas de um flight surgeon na Terra. Os atrasos no app são configuração de demonstração, baseados em valores públicos aproximados, e não valores de planejamento de missão.

### Campos gravitacionais

A microgravidade tira a carga de ossos e músculos e desloca os fluidos do corpo em direção à cabeça; a NASA também associa esse deslocamento a pressão sobre os olhos e problemas de visão.[^r3] O exercício em equipamentos dedicados é a principal contramedida a bordo para ossos e músculos (veja [Fisiologia monitorada](/pt/science/monitored-physiology)). O AHI acompanha desempenho simulado no exercício e sinais cardiovasculares, mas não tem fonte de dados para densidade óssea, volume muscular ou estrutura ocular.

### Ambientes hostis ou fechados

A nave precisa manter um ecossistema interno seguro.[^r1] O dióxido de carbono é um exemplo bem documentado: a NASA associa CO₂ mais alto na cabine a dores de cabeça e limita, na sua norma, a pressão parcial média de CO₂ em uma hora.[^r10] O AHI simula CO₂, temperatura e umidade da cabine e inclui um cenário em que o CO₂ sobe e a frequência respiratória e o tempo de reação da tripulação se alteram.

::: tip Como a plataforma usa isso
- Os hazards orientam as regiões do corpo no visualizador 3D e o catálogo de métricas: veja o [Dicionário de dados](/pt/data/data-dictionary).
- O status é definido primeiro pela faixa normal de cada astronauta: veja [Linha de base pessoal](/pt/intelligence/personal-baseline).
- Valores fixos (CO₂ da cabine, níveis de observação de radiação, piso de SpO₂) são configuração de demonstração, não limites oficiais: veja [Limiares e limitações](/pt/intelligence/thresholds).
- Quais capacidades estão implementadas, simuladas ou planejadas: veja a [Matriz de status das funcionalidades](/pt/overview/feature-status).
:::

## Próximos passos

- [Fisiologia monitorada](/pt/science/monitored-physiology): por que cada sistema do corpo importa e o que o AHI faz com ele.
- [Radiação e ambiente da cabine](/pt/science/radiation-and-environment): fontes de radiação, CO₂, temperatura e umidade.
- [Referências científicas](/pt/science/references): a lista completa de fontes desta seção.

[^r1]: NASA Human Research Program, *5 Hazards of Human Spaceflight*, página atualizada em 2026-06-12. <https://www.nasa.gov/hrp/hazards/>. Referência [R1](/pt/science/references#r1).
[^r2]: NASA Human Research Program, *Hazard: Distance From Earth*, página atualizada em 2024-08-01. <https://www.nasa.gov/hrp/hazard-distance-from-earth/>. Referência [R2](/pt/science/references#r2).
[^r3]: NASA Human Research Program, *Hazard: Gravity Fields*, página atualizada em 2024-08-01. <https://www.nasa.gov/hrp/hazard-gravity-fields/>. Referência [R3](/pt/science/references#r3).
[^r4]: NASA, *Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders Leading to In-mission Health and Performance and Long-term Health Effects (Behavioral Health Risk)*, publicada em 2025-03-11, atualizada em 2025-09-17. Referência [R4](/pt/science/references#r4).
[^r6]: K. Schauer, *Space Communications: 7 Things You Need to Know*, NASA Goddard, 2020 (atualizada em 2026-02-09). Referência [R6](/pt/science/references#r6).
[^r7]: NASA JSC Space Radiation Analysis Group, *What is space radiation?*, atualizada em 2025-09-24. Referência [R7](/pt/science/references#r7).
[^r8]: NASA OCHMO, *NASA-STD-3001 Technical Brief: Design for Ionizing Radiation Protection*, OCHMO-TB-020 Rev G, 2025-06-06. Referência [R8](/pt/science/references#r8).
[^r9]: NASA, *Why Space Radiation Matters*, 2017 (atualizada em 2025-08-22). Referência [R9](/pt/science/references#r9).
[^r10]: NASA OCHMO, *NASA-STD-3001 Medical Technical Brief: Carbon Dioxide (CO2)*, OCHMO-TB-004 Rev D, 2026-03-10. Referência [R10](/pt/science/references#r10).
