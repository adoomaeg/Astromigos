---
title: Fisiologia monitorada
description: Por que sinais cardiovasculares, respiratórios, de sono, musculoesqueléticos, comportamentais e de hidratação importam em voos espaciais, como são medidos em missões e o que o Astronaut Health Intelligence Platform faz com cada um hoje.
status: IMPLEMENTED
origin: SIMULATED, MANUAL
code:
  - frontend/web/src/engine/catalog.ts
  - frontend/web/src/engine/sim/adapters.ts
  - frontend/web/src/engine/sim/physiology.ts
  - frontend/web/src/engine/checkins.ts
verified: 2026-11-14
---

# Fisiologia monitorada

O Astronaut Health Intelligence Platform (AHI) acompanha 17 sinais por astronauta: 16 sinais fisiológicos ou de autorrelato, agrupados abaixo por sistema do corpo, mais a dose pessoal de radiação, tratada em [Radiação e ambiente da cabine](/pt/science/radiation-and-environment). Para cada sistema, esta página explica por que ele importa em voos espaciais, como é medido em missões reais, o que o AHI faz com ele hoje e quais são os limites.

::: warning ATENÇÃO
Todo valor fisiológico do AHI vem de um simulador (`data_origin: SIMULATED`). O check-in diário também é simulado e passa a ser `MANUAL` quando alguém o preenche no app. Nenhum sinal vem de um astronauta real ou da ISS. O contexto científico abaixo explica o desenho da plataforma; não é orientação médica nem evidência de que a plataforma detecte qualquer condição real.
:::

## Resumo

| Sistema do corpo | Códigos de métrica do AHI | Fonte simulada no AHI | Origem | Status |
| --- | --- | --- | --- | --- |
| Cardiovascular | `HEART_RATE`, `HRV_RMSSD`, `SYSTOLIC_BP`, `DIASTOLIC_BP` | "Bio-Monitor shirt (sim)" | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Respiratório | `SPO2`, `RESPIRATORY_RATE` | "Bio-Monitor shirt (sim)" | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Térmico | `SKIN_TEMPERATURE` | "Bio-Monitor shirt (sim)" | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Sono e ritmo circadiano | `SLEEP_DURATION`, `SLEEP_EFFICIENCY`, `ACTIVITY_LEVEL` | "Actigraphy watch (sim)" | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Musculoesquelético | `EXERCISE_LOAD` | Sessões em CEVIS, ARED e T2 (sim) | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Saúde comportamental e cognição | `MOOD`, `PERCEIVED_FATIGUE`, `STRESS`, `REACTION_TIME` | Check-in diário e "Reaction self-test (sim)" | SIMULATED ou MANUAL | <StatusBadge status="IMPLEMENTED" /> |
| Hidratação | `HYDRATION` | "Fluid intake log (sim)" | SIMULATED | <StatusBadge status="IMPLEMENTED" /> |
| Densidade óssea, volume muscular | nenhum | sem fonte | não se aplica | <StatusBadge status="NOT_IMPLEMENTED" /> |
| Olhos (SANS) | nenhum | sem fonte | não se aplica | <StatusBadge status="PLANNED" /> roadmap |

Unidade, cadência e região do corpo de cada código estão no [Dicionário de dados](/pt/data/data-dictionary). O status de cada métrica é calculado em relação à faixa normal do próprio astronauta ([Linha de base pessoal](/pt/intelligence/personal-baseline)); alguns valores fixos funcionam como rede de segurança da demonstração ([Limiares e limitações](/pt/intelligence/thresholds)).

## Cardiovascular

**Por que importa.** O sistema cardiovascular depende fortemente da gravidade, então a função do coração e dos vasos muda na ausência de peso, e essa alteração causa problemas depois do voo.[^r14] Na microgravidade, os fluidos do corpo se deslocam em direção à cabeça; ao voltar à gravidade, astronautas podem sentir tontura e desmaiar.[^r3] A radiação espacial acrescenta um possível risco tardio ao coração e aos vasos, que ainda está em estudo.[^r14] No NASA Twins Study, o gêmeo que voou apresentou distensão da artéria carótida e aumento da espessura íntima-média, entre outras alterações.[^r25]

**Como é medido em missões.** O Bio-Monitor da Agência Espacial Canadense (CSA), lançado para a ISS em dezembro de 2018, é composto por uma camiseta inteligente, uma faixa de cabeça e um aplicativo de tablet, e registra pulso e atividade elétrica do coração, pressão arterial, frequência e volume respiratórios, temperatura da pele, saturação de oxigênio no sangue e atividade física.[^r28] A variabilidade da frequência cardíaca (HRV) é uma estatística calculada a partir dos intervalos entre batimentos; o trabalho de contramedidas de exercício da NASA também lista monitoramento de pressão arterial, ECG e frequência cardíaca entre os itens de monitoramento de saúde na ISS.[^r32]

**O que o AHI faz hoje.** A camiseta Bio-Monitor simulada publica frequência cardíaca e HRV (RMSSD) a cada minuto, e pressão arterial a cada 5 minutos (marcada como estimativa). O motor compara cada valor com a linha de base da pessoa no mesmo contexto de atividade (sono, repouso, trabalho, exercício), detecta desvios agudos e derivas lentas, e aplica um teto de demonstração para a frequência cardíaca em repouso como rede de segurança.

**Limitações.** Não há forma de onda de ECG real, pressão medida com manguito, medida de volume de fluidos nem teste ortostático pós-voo. Uma frequência cardíaca subindo no AHI é um padrão para a tripulação e o flight surgeon revisarem, nunca um diagnóstico.

## Respiratório

**Por que importa.** Frequência respiratória e oxigênio no sangue são sinais rápidos de problemas agudos. Numa cabine fechada, eles também interagem com o ambiente: a NASA lista dor de cabeça, falta de ar (dispneia) e fadiga entre os sintomas do acúmulo de dióxido de carbono no corpo.[^r10]

**Como é medido em missões.** O Bio-Monitor registra frequência e volume respiratórios e saturação de oxigênio.[^r28] A NASA também testou um colete vestível que registra frequência cardíaca e respiração durante o sono.[^r31]

**O que o AHI faz hoje.** SpO₂ e frequência respiratória simulados a cada minuto. O SpO₂ tem pisos de demonstração (HIGH abaixo de 92%, CRITICAL abaixo de 90%) além da linha de base pessoal; no cenário de CO₂ na cabine, a frequência respiratória simulada sobe junto com o CO₂.

**Limitações.** Os pisos de SpO₂ são configuração de demonstração, não limites clínicos nem da NASA. Nenhum oxímetro ou sensor respiratório real alimenta a plataforma.

## Térmico

**Por que importa.** A regulação da temperatura do corpo é estudada em voo: a faixa de cabeça T-Mini, da ESA, mede a temperatura central do corpo por horas seguidas para estudar como fatores ambientais e fisiológicos a afetam.[^r31] A temperatura da cabine é um dos fatores ambientais que a NASA lista para habitats fechados.[^r1]

**Como é medido em missões.** O Bio-Monitor registra a temperatura da pele;[^r28] a temperatura central exige dispositivos dedicados, como a faixa T-Mini.[^r31]

**O que o AHI faz hoje.** Temperatura da pele simulada a cada minuto, comparada com a linha de base pessoal para o contexto de atividade.

**Limitações.** Temperatura da pele não é temperatura central, e o AHI não modela estresse térmico nem febre.

## Sono e ritmo circadiano

**Por que importa.** Num estudo com 64 astronautas do ônibus espacial e 21 da ISS, o sono medido por actigrafia de pulso foi curto durante o voo (cerca de 6,09 horas por noite nas missões da ISS) e também no treinamento pré-voo; os autores pedem contramedidas porque a perda crônica de sono leva a queda de desempenho.[^r15] A NASA usa dispositivos de pulso para estudar como a luz ambiente na estação afeta o ciclo sono-vigília e as alterações circadianas.[^r31]

**Como é medido em missões.** O Actiwatch Spectrum, um dispositivo de pulso com acelerômetro para movimento e fotodetectores para luz ambiente, atualiza a tecnologia usada antes na estação para acompanhar duração e qualidade do sono.[^r31] As NASA Standard Measures coletam atividade e exposição à luz com um sensor de pulso, além de relatos de sono.[^r26]

**O que o AHI faz hoje.** Um relógio de actigrafia simulado informa um índice contínuo de atividade e, a cada período de sono, duração e eficiência do sono (ambas marcadas como estimativa). Duas ou três noites seguidas fora da faixa pessoal elevam a atenção para MODERATE ou HIGH; o cenário de fadiga progressiva combina sono curto, HRV em queda e frequência cardíaca de repouso em alta.

**Limitações.** A actigrafia estima o sono pelo movimento; não é polissonografia. O AHI não tem sinal de exposição à luz nem estimativa de fase circadiana.

## Musculoesquelético e contramedidas de exercício

**Por que importa.** A NASA informa que ossos que sustentam peso perdem em média de 1% a 1,5% de densidade mineral por mês no espaço.[^r3] Um estudo com 14 tripulantes da ISS em voos de 4 a 6 meses mediu perdas de densidade mineral óssea areal de 0,9% por mês na coluna e de 1,4% a 1,5% por mês no quadril.[^r16] O músculo também é afetado: em 9 tripulantes da ISS, depois de cerca de 6 meses, o volume muscular da panturrilha caiu em média 13% apesar do programa de exercícios.[^r18] As alterações do esqueleto se relacionam com o deslocamento de fluidos, o sistema vascular e o metabolismo energético, e têm paralelos com imobilização e envelhecimento.[^r17]

**Como é medido em missões.** Em voo, as tripulações se exercitam no cicloergômetro (CEVIS), nas esteiras (T2 e COLBERT) e no Advanced Resistive Exercise Device (ARED);[^r32] no estudo muscular citado acima, o exercício aeróbico ocupava cerca de 5 horas por semana e o resistido de 3 a 6 dias por semana, e o regime variava entre os tripulantes.[^r18] Num estudo, tripulantes com acesso ao ARED, com ingestão adequada de energia e vitamina D, mantiveram a massa óssea na maioria das regiões em missões de 4 a 6 meses;[^r19] um estudo posterior concluiu que o ARED sozinho atenuou parcialmente a perda óssea, mas não evitou a perda de osso trabecular no quadril.[^r20] A densidade óssea em si é medida antes e depois do voo por densitometria (DXA e QCT), não de forma contínua.[^r16][^r20] As NASA Standard Measures incluem um teste de força corporal total.[^r26]

**O que o AHI faz hoje.** Um bloco simulado de 60 minutos de exercício por dia alterna entre CEVIS, ARED e T2. Cada sessão gera um valor de desempenho como porcentagem das sessões habituais da própria pessoa. Uma sequência de sessões abaixo da faixa pessoal eleva a atenção (cenário de queda de desempenho no exercício).

**Limitações.** O AHI não mede densidade óssea, volume muscular nem força, e não estima perda óssea. ARED, T2 e CEVIS são equipamentos de exercício, não monitores médicos; os dados que oferecem dependem da instrumentação de cada um.

## Saúde comportamental e cognição

**Por que importa.** O Behavioral Health Risk da NASA afirma que o isolamento e o confinamento podem reduzir o desempenho cognitivo e comportamental e afetar a saúde, o bem-estar e o desempenho de cada pessoa e da tripulação.[^r4]

**Como é medido em missões.** As NASA Standard Measures incluem testes cognitivos.[^r26] A bateria Cognition, desenhada para astronautas, tem 10 testes neuropsicológicos que cobrem domínios como atenção sustentada, orientação espacial, processamento de emoções e tomada de decisão sob risco; sua validação mostra que o efeito de prática varia entre os testes, o que torna importantes os dados normativos.[^r21] Questionários de autorrelato e diários de sono são complementos comuns; um estudo de sono usou diários ao lado da actigrafia.[^r15]

**O que o AHI faz hoje.** Um check-in diário registra humor, fadiga e estresse numa escala de 1 a 5, uma nota de qualidade do sono e marcações de sintomas. Um teste curto de reação gera um tempo de reação por dia. As respostas são comparadas com as respostas recentes da própria pessoa. O autorrelato sozinho chega no máximo a MODERATE: ele corrobora sinais objetivos e nunca escala sozinho. Veja [Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link).

**Limitações.** O teste de reação é simulado e não é a bateria Cognition. O check-in é um questionário simplificado, não um instrumento psicológico validado, e o AHI não faz avaliação psiquiátrica nem psicológica.

## Hidratação

**Por que importa.** A NASA observa que as tripulações podem ter risco maior de cálculo renal por desidratação.[^r3]

**Como é medido em missões.** As NASA Standard Measures usam amostras de fluidos para avaliar dieta e nutrição,[^r26] e as Artemis II Standard Measures usam amostras de sangue, saliva e urina para avaliar o estado nutricional.[^r27] São amostras periódicas, não um sensor contínuo de hidratação.

**O que o AHI faz hoje.** Um registro simulado de ingestão de líquidos gera um índice de hidratação (0 a 100, marcado como estimativa) a cada 30 minutos, comparado com a linha de base pessoal.

**Limitações.** O índice de hidratação é uma pontuação de demonstração, não uma medida fisiológica. O AHI não tem química de urina ou de sangue para a tripulação simulada.

## Olhos e SANS (não monitorados)

**Por que importa.** A Spaceflight Associated Neuro-ocular Syndrome (SANS) é um conjunto de achados nos olhos e no cérebro que surge em voos de longa duração: edema do disco óptico, dobras coriorretinianas, achatamento do globo ocular e desvio hipermetrópico da refração.[^r5][^r22] O Human Research Roadmap da NASA afirma que 70% dos tripulantes apresentam um ou mais desses sinais característicos e acompanha a SANS como risco ativo.[^r5] Uma atualização clínica de 2023 estimou que cerca de 66% dos astronautas de longa duração apresentam a indicação mais precoce de SANS.[^r23] A hipótese principal liga a SANS ao deslocamento de fluidos em direção à cabeça na microgravidade, que o estudo Fluid Shifts da NASA investigou com ferramentas não invasivas.[^r24]

**Como é medido em missões.** A vigilância médica inclui avaliação antes, durante e depois do voo com tomografia de coerência óptica (OCT), ultrassom ocular, imagens oftálmicas e testes de acuidade visual, além de ressonância magnética de cérebro e olhos antes do voo e logo após o retorno.[^r5] As Artemis II Standard Measures incluem ressonância magnética para avaliar a saúde dos olhos e do cérebro.[^r27]

**O que o AHI faz hoje.** Nada. Nenhum dispositivo de monitoramento ocular alimenta a plataforma. Os olhos do corpo 3D são anatomia de referência: podem ser selecionados, mas são "só contexto" e nunca mostram status. Incluir indicadores oculares derivados de imagem é trabalho de roadmap: veja o [Roadmap](/pt/resources/roadmap).

::: tip Como a plataforma usa isso
- Faixas normais pessoais por contexto de atividade: [Linha de base pessoal](/pt/intelligence/personal-baseline).
- Desvios agudos, derivas e regras de persistência: [Detecção de anomalias](/pt/intelligence/anomaly-detection).
- Pisos e tetos de demonstração (SpO₂, frequência cardíaca em repouso): [Limiares e limitações](/pt/intelligence/thresholds).
- Os cenários que exercitam esses sinais: [Simulação de dispositivos e cenários](/pt/intelligence/scenario-simulation).
- Todos os códigos de métrica, unidades e cadências: [Dicionário de dados](/pt/data/data-dictionary).
:::

## Próximos passos

- [Radiação e ambiente da cabine](/pt/science/radiation-and-environment): os sinais da cabine e de radiação.
- [Monitoramento de saúde em missões](/pt/science/health-monitoring-in-missions): como tripulações reais são monitoradas e por que o AHI usa linhas de base pessoais.
- [Referências científicas](/pt/science/references): citações completas.

[^r1]: NASA Human Research Program, *5 Hazards of Human Spaceflight*, página atualizada em 2026-06-12. Referência [R1](/pt/science/references#r1).
[^r3]: NASA Human Research Program, *Hazard: Gravity Fields*, página atualizada em 2024-08-01. Referência [R3](/pt/science/references#r3).
[^r4]: NASA, *Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders (Behavioral Health Risk)*, atualizada em 2025-09-17. Referência [R4](/pt/science/references#r4).
[^r5]: NASA Human Research Roadmap, *Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)*, publicada em 2025-05-13. Referência [R5](/pt/science/references#r5).
[^r10]: NASA OCHMO, *NASA-STD-3001 Medical Technical Brief: Carbon Dioxide (CO2)*, OCHMO-TB-004 Rev D, 2026-03-10. Referência [R10](/pt/science/references#r10).
[^r14]: Hughson RL, Helm A, Durante M. Heart in space: effect of the extraterrestrial environment on the cardiovascular system. *Nat Rev Cardiol*. 2018;15(3):167-180. doi:10.1038/nrcardio.2017.157. Referência [R14](/pt/science/references#r14).
[^r15]: Barger LK, Flynn-Evans EE, Kubey A, et al. Prevalence of sleep deficiency and use of hypnotic drugs in astronauts before, during, and after spaceflight: an observational study. *Lancet Neurol*. 2014;13(9):904-912. doi:10.1016/S1474-4422(14)70122-X. Referência [R15](/pt/science/references#r15).
[^r16]: Lang T, LeBlanc A, Evans H, et al. Cortical and trabecular bone mineral loss from the spine and hip in long-duration spaceflight. *J Bone Miner Res*. 2004;19(6):1006-1012. doi:10.1359/JBMR.040307. Referência [R16](/pt/science/references#r16).
[^r17]: Vico L, Hargens A. Skeletal changes during and after spaceflight. *Nat Rev Rheumatol*. 2018;14(4):229-245. doi:10.1038/nrrheum.2018.37. Referência [R17](/pt/science/references#r17).
[^r18]: Trappe S, Costill D, Gallagher P, et al. Exercise in space: human skeletal muscle after 6 months aboard the International Space Station. *J Appl Physiol*. 2009;106(4):1159-1168. doi:10.1152/japplphysiol.91578.2008. Referência [R18](/pt/science/references#r18).
[^r19]: Smith SM, Heer MA, Shackelford LC, et al. Benefits for bone from resistance exercise and nutrition in long-duration spaceflight. *J Bone Miner Res*. 2012;27(9):1896-1906. doi:10.1002/jbmr.1647. Referência [R19](/pt/science/references#r19).
[^r20]: Sibonga J, Matsumoto T, Jones J, et al. Resistive exercise in astronauts on prolonged spaceflights provides partial protection against spaceflight-induced bone loss. *Bone*. 2019;128:112037. doi:10.1016/j.bone.2019.07.013. Referência [R20](/pt/science/references#r20).
[^r21]: Basner M, Savitt A, Moore TM, et al. Development and validation of the Cognition test battery for spaceflight. *Aerosp Med Hum Perform*. 2015;86(11):942-952. doi:10.3357/AMHP.4343.2015. Referência [R21](/pt/science/references#r21).
[^r22]: Lee AG, Mader TH, Gibson CR, et al. Spaceflight associated neuro-ocular syndrome (SANS) and the neuro-ophthalmologic effects of microgravity: a review and an update. *npj Microgravity*. 2020;6:7. doi:10.1038/s41526-020-0097-9. Referência [R22](/pt/science/references#r22).
[^r23]: Brunstetter TJ, Mason SS, Taiym WF, et al. *Spaceflight Associated Neuro-ocular Syndrome (SANS): 2023 Clinical Update*. NASA Human Research Program Investigators' Workshop, 2023. NTRS 20220014606. Referência [R23](/pt/science/references#r23).
[^r24]: NASA, *NASA Fluid Shifts Study Advances Journey to Mars*, 2015-07-20. Referência [R24](/pt/science/references#r24).
[^r25]: Garrett-Bakelman FE, Darshi M, Green SJ, et al. The NASA Twins Study: a multidimensional analysis of a year-long human spaceflight. *Science*. 2019;364(6436):eaau8650. doi:10.1126/science.aau8650. Referência [R25](/pt/science/references#r25).
[^r26]: NASA, *Standard Measures*, página atualizada em 2025-06-04. Referência [R26](/pt/science/references#r26).
[^r27]: NASA, *Artemis II Standard Measures*, página atualizada em 2026-03-17. Referência [R27](/pt/science/references#r27).
[^r28]: Canadian Space Agency, *Bio-Monitor: Keeping an eye on astronauts' vital signs*, modificada em 2026-02-26. Referência [R28](/pt/science/references#r28).
[^r31]: M. L. Gaskill, *Wearable Tech for Space Station Research*, NASA, 2024-11-13. Referência [R31](/pt/science/references#r31).
[^r32]: NASA Johnson Space Center, *Exercise Countermeasures*, página atualizada em 2026-01-22. Referência [R32](/pt/science/references#r32).
