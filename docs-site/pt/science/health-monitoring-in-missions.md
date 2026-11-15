---
title: Monitoramento de saúde em missões
description: Como a saúde da tripulação é monitorada em missões reais (vestíveis, equipamentos de exercício, exames periódicos, amostras biológicas, NASA Standard Measures e Artemis II Standard Measures), por que linhas de base pessoais fazem sentido e como isso orientou o Astronaut Health Intelligence Platform.
verified: 2026-11-14
---

# Monitoramento de saúde em missões

O monitoramento real da saúde da tripulação combina vestíveis contínuos, sessões programadas de exercício, exames periódicos e amostras biológicas coletadas antes, durante e depois do voo. Esta página resume descrições públicas dessa prática e explica quais partes inspiraram o desenho do Astronaut Health Intelligence Platform (AHI).

::: warning ATENÇÃO: sem integração com missões reais
O AHI **não** está conectado à ISS, a nenhuma nave, a nenhum dos dispositivos abaixo nem a nenhum sistema da NASA ou da CSA. Os dispositivos desta página são a referência do mundo real para os adapters **simulados** do AHI. Tudo o que o painel da tripulação mostra é simulado (`SIMULATED`) ou digitado no app (`MANUAL`).
:::

## Modalidades de monitoramento

| Modalidade | Exemplo em missões | O que registra | Contínuo ou periódico | Equivalente no AHI |
| --- | --- | --- | --- | --- |
| Sinais vitais por vestível | **Bio-Monitor** da CSA: camiseta inteligente, faixa de cabeça e aplicativo de tablet, lançado para a ISS em dezembro de 2018[^r28] | Pulso e atividade elétrica do coração, pressão arterial, frequência e volume respiratórios, temperatura da pele, saturação de oxigênio, atividade física[^r28] | Contínuo durante o uso, inclusive no sono e no exercício[^r28] | "Bio-Monitor shirt (sim)" |
| Actigrafia de pulso | **Actiwatch Spectrum**: acelerômetro para movimento e fotodetectores para luz ambiente[^r31] | Estimativas de duração e qualidade do sono, atividade, exposição à luz[^r31] | Contínuo | "Actigraphy watch (sim)" |
| Equipamentos de exercício | Cicloergômetro **CEVIS**, equipamento resistido **ARED**, esteiras **T2** e **COLBERT**[^r32] | Dados de sessão que dependem da instrumentação de cada equipamento | Por sessão | "CEVIS cycle ergometer (sim)", "ARED resistive exercise device (sim)", "T2 treadmill (sim)" |
| Dosímetros | Dosímetros pessoais como o EVARM da CSA (caminhadas espaciais) e o Active Dosimeter da ESA[^r31] | Exposição à radiação | Contínuo | "Personal dosimeter (sim)", "Area radiation monitor (sim)" |
| Ambiente da cabine | Telemetria ambiental da ISS, publicada para períodos de pesquisa no NASA EDA[^r11]; monitores pessoais de CO₂ também foram testados[^r31] | CO₂, temperatura, umidade, doses de radiação | Contínuo | "Cabin environment sensor (sim)" |
| Imagens dos olhos e do cérebro | OCT, ultrassom ocular, imagens oftálmicas, acuidade visual; ressonância magnética antes do voo e após o retorno[^r5] | Alterações estruturais de olhos e cérebro ligadas à SANS | Periódico | Nenhum (roadmap) |
| Amostras biológicas | Amostras de sangue, saliva, urina e fezes nas Standard Measures[^r26][^r27] | Nutrição, função imune, microbioma, marcadores cardiovasculares | Periódico | Nenhuma para a tripulação simulada. Painéis de sangue reais e públicos da Inspiration4 aparecem só como referência histórica |
| Cognição e autorrelato | Testes cognitivos e relatos de sono nas Standard Measures[^r26] | Desempenho cognitivo, sono, bem-estar | Periódico (diário ou por sessão) | Check-in diário e "Reaction self-test (sim)" |

::: info Astroskin e Bio-Monitor
O Astroskin é uma camiseta inteligente de biomonitoramento desenvolvida pela Hexoskin (Carré Technologies, Montreal) a partir de contratos anteriores com a CSA.[^r29] Um sistema Astroskin de camiseta e faixa de cabeça foi testado pela NASA e pela CSA no Human Exploration Research Analog (HERA), onde 16 tripulantes o usaram para monitoramento contínuo de 24 horas; os autores relataram lições sobre perda de dados, comunicação Bluetooth e conforto, e observaram que os dados não foram comparados com dispositivos de padrão laboratorial.[^r30] O sistema de voo Bio-Monitor foi desenvolvido para a CSA pela Carré Technologies.[^r28] A camiseta simulada do AHI se inspira nessa família de dispositivos, não em nenhum formato de dados proprietário.
:::

## NASA Standard Measures

O Spaceflight Standard Measures é um estudo de voo da NASA que coleta um conjunto padronizado de medidas de vários sistemas do corpo, antes, durante e depois de uma missão, para mostrar como o voo espacial, o isolamento, o confinamento e a ausência de peso afetam a saúde e o desempenho.[^r26] Ele inclui:[^r26]

- atividade e exposição à luz por um sensor de pulso;
- relatos de sono;
- amostras de fluidos para avaliar dieta e nutrição;
- saliva para medir a função do sistema imune;
- testes cognitivos;
- testes sensório-motores de equilíbrio e de função do ouvido interno;
- um teste de força corporal total;
- amostras fecais para estudar mudanças nos microrganismos.

### Artemis II Standard Measures

O Artemis II Standard Measures é um ramo do mesmo experimento para os astronautas participantes da Artemis II; segundo a NASA, o Spaceflight Standard Measures coletou dados de mais de 30 astronautas em missões da ISS desde 2018.[^r27] Na Artemis II, ele inclui amostras de sangue, saliva e urina (estado nutricional, saúde cardiovascular e função imune), ressonância magnética da saúde dos olhos e do cérebro, testes de equilíbrio e vestibulares com questionários de enjoo de movimento, testes de desempenho muscular, mudanças no microbioma e testes de função física, como sair de uma cápsula e simular caminhadas lunares com traje pressurizado logo após o retorno.[^r27]

::: warning ATENÇÃO: referência, não fonte de dados
O Standard Measures e o Artemis II Standard Measures são usados no AHI como **referências de domínio** que justificam quais sinais vale a pena monitorar. O AHI não guarda nem exibe nenhum dado do Standard Measures, e esta documentação não assume que esses dados estejam abertos.
:::

## Por que linhas de base pessoais fazem sentido

A pesquisa em voos espaciais compara cada pessoa com as próprias medidas anteriores de forma consistente:

- O Standard Measures coleta as mesmas medidas antes, durante e depois do voo, o que torna os valores pré-voo de cada astronauta a referência natural.[^r26]
- O estudo de sono com tripulações do ônibus espacial e da ISS comparou o sono em voo com os intervalos pré e pós-voo de cada astronauta.[^r15]
- O NASA Twins Study acompanhou um astronauta antes, durante e depois de uma missão de um ano, com o irmão gêmeo idêntico em solo como controle geneticamente pareado.[^r25]
- Na bateria Cognition, o efeito de prática e a variabilidade teste-reteste mudam de um teste para outro, e por isso os autores destacam dados normativos da população de interesse.[^r21]
- No estudo muscular da ISS, o programa de exercícios variou entre os tripulantes.[^r18]

Esses desenhos sugerem que um valor normal para um astronauta pode ser incomum para outro. O AHI aplica a mesma ideia em software: o status é definido primeiro pela faixa normal móvel de cada astronauta (mediana e dispersão robusta por contexto de atividade), e apenas alguns valores fixos de demonstração funcionam como rede de segurança. É uma escolha de desenho inspirada na pesquisa acima; ela não foi validada clinicamente.

## Como isso orienta o desenho da plataforma

| Prática em missões | Decisão de desenho no AHI |
| --- | --- |
| Vários dispositivos com cadências diferentes (vestíveis contínuos, exercício por sessão, relatos diários) | Os device adapters normalizam toda fonte para um único modelo de observação, com origem, qualidade e contexto de atividade |
| Monitoramento antes, durante e depois do voo com referências pessoais | [Linha de base pessoal](/pt/intelligence/personal-baseline) por astronauta e por contexto |
| Vestíveis perdem dados e conexão (como relatado nos testes no HERA)[^r30] | Dado ausente nunca é tratado como normal: vira `NO_DATA` ou `DATA_STALE`, e existe um cenário de falha de sensor |
| Tripulações longe da Terra precisam agir com apoio mínimo do solo[^r2] | Atrasos simulados no link com a Terra, primeiros passos a bordo e respostas atrasadas do flight surgeon ([Autorrelato e link com a Terra](/pt/intelligence/self-report-and-earth-link)) |
| Exames periódicos e amostras biológicas não são sinais contínuos | Dados de laboratório aparecem só como referência histórica datada (painéis da Inspiration4 do NASA OSDR), nunca misturados a dados simulados ao vivo ([Catálogo de datasets](/pt/data/dataset-catalog)) |
| Decisões médicas são do flight surgeon | O AHI é apenas apoio à decisão: veja [Uso responsável](/pt/overview/responsible-use) |

::: tip Como a plataforma usa isso
- Onde cada dispositivo simulado entra no fluxo de dados: [Simulação de dispositivos e cenários](/pt/intelligence/scenario-simulation).
- Como as origens são rotuladas (`REAL_PUBLIC`, `DERIVED`, `SIMULATED`, `MANUAL`): [Origens e proveniência dos dados](/pt/data/data-origins).
- O que está implementado e o que está planejado: [Matriz de status das funcionalidades](/pt/overview/feature-status).
:::

## Próximos passos

- [Fisiologia monitorada](/pt/science/monitored-physiology): sistema por sistema do corpo.
- [Fontes de dados da NASA](/pt/data/sources): situação do OSDR, EDA, RadLab, NLSP e Standard Measures.
- [Referências científicas](/pt/science/references): citações completas.

[^r2]: NASA Human Research Program, *Hazard: Distance From Earth*, página atualizada em 2024-08-01. Referência [R2](/pt/science/references#r2).
[^r5]: NASA Human Research Roadmap, *Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)*, publicada em 2025-05-13. Referência [R5](/pt/science/references#r5).
[^r11]: NASA Open Science Data Repository, *Environmental Data App (EDA)*. Referência [R11](/pt/science/references#r11).
[^r15]: Barger LK, Flynn-Evans EE, Kubey A, et al. Prevalence of sleep deficiency and use of hypnotic drugs in astronauts before, during, and after spaceflight: an observational study. *Lancet Neurol*. 2014;13(9):904-912. doi:10.1016/S1474-4422(14)70122-X. Referência [R15](/pt/science/references#r15).
[^r18]: Trappe S, Costill D, Gallagher P, et al. Exercise in space: human skeletal muscle after 6 months aboard the International Space Station. *J Appl Physiol*. 2009;106(4):1159-1168. doi:10.1152/japplphysiol.91578.2008. Referência [R18](/pt/science/references#r18).
[^r21]: Basner M, Savitt A, Moore TM, et al. Development and validation of the Cognition test battery for spaceflight. *Aerosp Med Hum Perform*. 2015;86(11):942-952. doi:10.3357/AMHP.4343.2015. Referência [R21](/pt/science/references#r21).
[^r25]: Garrett-Bakelman FE, Darshi M, Green SJ, et al. The NASA Twins Study: a multidimensional analysis of a year-long human spaceflight. *Science*. 2019;364(6436):eaau8650. doi:10.1126/science.aau8650. Referência [R25](/pt/science/references#r25).
[^r26]: NASA, *Standard Measures*, página atualizada em 2025-06-04. <https://www.nasa.gov/reference/standard-measures/>. Referência [R26](/pt/science/references#r26).
[^r27]: NASA, *Artemis II Standard Measures*, página atualizada em 2026-03-17. <https://www.nasa.gov/reference/artemis-ii-standard-measures/>. Referência [R27](/pt/science/references#r27).
[^r28]: Canadian Space Agency, *Bio-Monitor: Keeping an eye on astronauts' vital signs*, modificada em 2026-02-26. Referência [R28](/pt/science/references#r28).
[^r29]: Canadian Space Agency, *Wireless body sensors for medical care in space*, 2015-12-23. Referência [R29](/pt/science/references#r29).
[^r30]: Toscano W, Cowings P, Sullivan P, et al. *Wearable Biosensor Monitor to Support Autonomous Crew Health and Readiness to Perform*. NASA Human Research Program Investigators' Workshop, 2017. NTRS 20190001996. Referência [R30](/pt/science/references#r30).
[^r31]: M. L. Gaskill, *Wearable Tech for Space Station Research*, NASA, 2024-11-13. Referência [R31](/pt/science/references#r31).
[^r32]: NASA Johnson Space Center, *Exercise Countermeasures*, página atualizada em 2026-01-22. Referência [R32](/pt/science/references#r32).
