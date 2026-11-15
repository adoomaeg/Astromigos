---
title: Radiação e ambiente da cabine
description: Fontes de radiação espacial, dose e taxa de dose, CO2, temperatura e umidade da cabine, o que o NASA EDA e o RadLab oferecem, e como o Astronaut Health Intelligence Platform simula esses sinais com limiares de demonstração.
status: IMPLEMENTED
origin: SIMULATED
code:
  - frontend/web/src/engine/sim/cabin.ts
  - frontend/web/src/engine/config.ts
verified: 2026-11-14
---

# Radiação e ambiente da cabine

Dois dos cinco hazards de voos espaciais vêm de fora do corpo: a radiação espacial e o ambiente hostil ou fechado da nave.[^r1] Esta página explica a ciência por trás dos seis sinais ambientais do Astronaut Health Intelligence Platform (AHI) e deixa claro o que é simulado.

::: warning ATENÇÃO
Todos os valores de radiação e de cabine no AHI são simulados (`data_origin: SIMULATED`). Todo número fixo usado para status (níveis de CO₂, faixas de temperatura e umidade, níveis de observação de radiação) é **configuração de demonstração, não um limite oficial**. A lista completa está em [Limiares e limitações](/pt/intelligence/thresholds). Esta página é contexto educacional, não orientação de proteção radiológica nem orientação médica.
:::

## Radiação espacial

### Fontes

| Fonte | O que é | Quando importa |
| --- | --- | --- |
| Raios cósmicos galácticos (GCR) | Núcleos de alta energia vindos de fora do sistema solar, na maioria ferro ou mais leves; o fluxo é maior no mínimo solar[^r7] | Principal fonte de radiação diária para astronautas fora do campo geomagnético da Terra[^r7] |
| Eventos de partículas solares (SPE) | Rajadas de partículas energéticas do Sol, muitas vezes ligadas a erupções e ejeções de massa coronal rápidas; as partículas mais energéticas chegam em dezenas de minutos[^r7] | Pouco frequentes, mais comuns perto do máximo solar; podem causar efeitos agudos sem blindagem adequada[^r8] |
| Radiação aprisionada e Anomalia do Atlântico Sul (SAA) | Prótons e elétrons presos nos cinturões de Van Allen. Sobre o Atlântico Sul, o cinturão interno desce a cerca de 200 km, e voos em órbita baixa cruzam essa região seis ou sete vezes por dia[^r7] | Uma fração significativa da exposição em órbita baixa vem das passagens pela SAA[^r7] |

A NASA associa a radiação espacial a aumento do risco de câncer ao longo da vida, efeitos no sistema nervoso central e doenças degenerativas e, além da órbita baixa, a risco de doença da radiação.[^r9] O technical brief da NASA-STD-3001 descreve síndromes agudas da radiação causadas por SPEs (náusea, vômito, fadiga) e riscos de longo prazo como câncer e alterações de cognição, função motora e comportamento.[^r8]

### Dose e taxa de dose

- **Taxa de dose** é a velocidade com que a radiação está sendo recebida agora (por exemplo, micrograys por hora). É o que um monitor de área mostra durante uma passagem pela SAA ou um evento solar.
- **Dose acumulada** é o total recebido num período (por exemplo, miligrays desde o início da missão). É o que importa para o risco de longo prazo.
- **Dose absorvida** (gray, Gy) mede a energia depositada na matéria. Os limites de exposição da NASA são expressos em **dose efetiva** (sievert, Sv), que a NASA calcula com seus próprios fatores de qualidade e modelo de ponderação de tecidos.[^r8] As duas unidades não são intercambiáveis.

A NASA-STD-3001 define um limite de carreira: a dose efetiva total de um tripulante ao longo da carreira, por radiação de voo espacial, deve ser menor que 600 mSv. Ela também limita a exposição ao evento de partículas solares de referência de projeto a menos de 250 mSv de dose efetiva.[^r8] A mesma norma inclui requisitos de monitoramento pessoal e de área da radiação espacial e de alerta para taxas de exposição elevadas.[^r8] As tripulações usam dosímetros pessoais; exemplos são os dosímetros EVARM da CSA, para caminhadas espaciais, e o Active Dosimeter da ESA, que também voou na Artemis I.[^r31]

### O que o AHI simula

| Sinal | Código | Simulação | Limiar de demonstração (não é limite oficial) |
| --- | --- | --- | --- |
| Taxa de dose ambiental | `RADIATION_DOSE_RATE` (µGy/h) | Modulação orbital com período de 92,7 minutos, mais picos semelhantes à SAA em algumas órbitas | HIGH acima de 100 µGy/h ("demo particle event level") |
| Dose acumulada pessoal | `RADIATION_DOSE` (mGy) | Integrada por astronauta, com um fator pessoal de blindagem | MODERATE acima de 50 mGy ("demo mission dose watch level"); orçamento de missão de demonstração de 100 mGy em 180 dias |

::: info As unidades são de dose absorvida
O AHI mostra dose absorvida (mGy, µGy/h), enquanto os limites da NASA são de dose efetiva (mSv). Por isso, os níveis de observação da demonstração **não são comparáveis** com os limites de carreira ou de SPE da NASA, e o AHI não estima risco de saúde por radiação. A média simulada de 0,42 mGy por dia é descrita no código como da ordem de grandeza da ISS; ela não foi calibrada com nenhum dataset de dosimetria citado.
:::

## Dióxido de carbono na cabine

Na Terra, o ar de ambientes internos tem em média de 0,08% a 0,1% de CO₂. Numa nave não há remoção natural, então o CO₂ depende de equipamentos de remoção, como o Carbon Dioxide Removal Assembly (CDRA) da ISS.[^r10] O technical brief da NASA informa:[^r10]

- Num estudo das Expedições 2 a 31 da ISS, 19 de 49 astronautas (cerca de 38,7%) relataram dor de cabeça, e o nível de CO₂ estava entre os fatores significativamente associados a ela.
- A NASA-STD-3001 limita a pressão parcial média de CO₂ em uma hora, no volume habitável, a no máximo 3 mmHg, para manter a incidência de dor de cabeça abaixo de 1,4%.
- Desde uma regra de voo aprovada em 2016, o CO₂ da ISS tem ficado consistentemente igual ou abaixo de 3,00 mmHg na média de 24 horas, com breves picos ocasionais; os níveis variam entre os módulos da ISS.
- Vários estudos em solo não encontraram redução clara de cognição ou de tomada de decisão nos níveis de CO₂ mantidos hoje em naves e submarinos.

### Como o AHI trata o CO₂

O AHI simula o CO₂ da cabine em partes por milhão (ppm), com um ciclo diário em torno de cerca de 2.600 ppm. No cenário de CO₂ na cabine, uma degradação simulada do sistema de remoção eleva o CO₂, e a frequência respiratória e o tempo de reação simulados da tripulação se alteram.

| Nível de demonstração | Valor | Pressão parcial aproximada a 760 mmHg de pressão total |
| --- | --- | --- |
| MODERATE ("demo watch level") | acima de 4.000 ppm | cerca de 3,0 mmHg |
| HIGH ("demo warning level") | acima de 5.300 ppm | cerca de 4,0 mmHg |
| CRITICAL ("demo critical level") | acima de 7.500 ppm | cerca de 5,7 mmHg |

::: warning ATENÇÃO: os níveis de CO₂ da demonstração não seguem a NASA-STD-3001
A coluna de pressão parcial é uma conversão nossa (ppm x 760 / 1.000.000), assumindo uma atmosfera padrão; não é um número da NASA, e a pressão real da cabine pode ser diferente. Ela mostra que os níveis HIGH e CRITICAL da demonstração ficam acima da média de 3 mmHg em uma hora da NASA-STD-3001.[^r10] Eles foram escolhidos para deixar o cenário de demonstração legível, não para reproduzir a norma. Alinhá-los à norma publicada (e expressar o CO₂ como pressão parcial) é uma melhoria candidata; os valores atuais estão em [Limiares e limitações](/pt/intelligence/thresholds).
:::

## Temperatura e umidade da cabine

A temperatura é um dos fatores ambientais que a NASA lista para manter um ecossistema seguro dentro da nave.[^r1] O AHI simula a temperatura do ar da cabine (em torno de 22,6 °C) e a umidade relativa (em torno de 45%) com pequenos ciclos diários, e sinaliza valores fora de uma faixa de conforto de demonstração: 18 a 27 °C e 25% a 70% de umidade relativa. Essas faixas são configuração de demonstração; esta documentação não encontrou nem verificou uma fonte oficial para elas, por isso nenhuma faixa oficial é citada aqui.

## Fontes de dados ambientais da NASA

Os dois portais fazem parte do NASA Open Science Data Repository (OSDR), que reúne dados de ciências da vida espacial, incluindo telemetria ambiental.[^r13]

| Fonte | O que oferece | Situação em 2026-11-14 | Uso no AHI |
| --- | --- | --- | --- |
| [NASA Environmental Data App (EDA)](https://visualization.osdr.nasa.gov/eda/) | CO₂, temperatura e umidade relativa da cabine da ISS e doses de radiação separadas em GCR, SAA, total e acumulada, nos períodos de missões de pesquisa da ISS (Rodent Research, APEX e VEG). Tabelas brutas e resumidas podem ser baixadas na aba Data Tables[^r11] | No ar. A API lista 24 missões de payload, só com metadados; a telemetria é baixada em CSV pela interface | Ainda não. Trocar o simulador de cabine por um replay `REAL_PUBLIC` é prioridade máxima |
| [NASA RadLab](https://visualization.osdr.nasa.gov/radlab/gui/overview/) | Ponto único de acesso a telemetria de radiação de instrumentos de várias agências espaciais, na ISS e além da órbita baixa, com exportação e API[^r12] | Intermitente: a verificação de fontes do projeto registrou HTTP 500 nas rotas; a página de visão geral abriu numa verificação posterior no mesmo dia | Não |

Os dados do EDA vêm de períodos da ISS ligados a missões de pesquisa com roedores e plantas. São medidas reais da cabine, mas **não são dados de saúde da tripulação**, e os canais de controle em solo (como `CO2_ppm_Ground`) não devem ser lidos como valores da cabine. Mais detalhes em [Fontes de dados da NASA](/pt/data/sources) e no [Catálogo de datasets](/pt/data/dataset-catalog).

::: tip Como a plataforma usa isso
- Todos os níveis de demonstração de CO₂, temperatura, umidade e radiação: [Limiares e limitações](/pt/intelligence/thresholds).
- As métricas da cabine usam só limiares fixos de demonstração (um módulo não tem um normal "pessoal"); as métricas da tripulação usam a [Linha de base pessoal](/pt/intelligence/personal-baseline).
- O cenário de CO₂ e os dispositivos simulados: [Simulação de dispositivos e cenários](/pt/intelligence/scenario-simulation).
- Códigos, unidades e origens: [Dicionário de dados](/pt/data/data-dictionary).
:::

## Próximos passos

- [Monitoramento de saúde em missões](/pt/science/health-monitoring-in-missions): como tripulações reais são monitoradas.
- [Fontes de dados da NASA](/pt/data/sources): a situação do EDA, do RadLab e do OSDR em detalhe.
- [Referências científicas](/pt/science/references): citações completas.

[^r1]: NASA Human Research Program, *5 Hazards of Human Spaceflight*, página atualizada em 2026-06-12. Referência [R1](/pt/science/references#r1).
[^r7]: NASA JSC Space Radiation Analysis Group, *What is space radiation?*, atualizada em 2025-09-24. <https://srag.jsc.nasa.gov/spaceradiation/what/what.cfm>. Referência [R7](/pt/science/references#r7).
[^r8]: NASA Office of the Chief Health and Medical Officer, *NASA-STD-3001 Technical Brief: Design for Ionizing Radiation Protection*, OCHMO-TB-020 Rev G, 2025-06-06. Referência [R8](/pt/science/references#r8).
[^r9]: NASA, *Why Space Radiation Matters*, 2017-04-13 (atualizada em 2025-08-22). Referência [R9](/pt/science/references#r9).
[^r10]: NASA Office of the Chief Health and Medical Officer, *NASA-STD-3001 Medical Technical Brief: Carbon Dioxide (CO2)*, OCHMO-TB-004 Rev D, 2026-03-10. Referência [R10](/pt/science/references#r10).
[^r11]: NASA Open Science Data Repository, *Environmental Data App (EDA)*. <https://visualization.osdr.nasa.gov/eda/>. Referência [R11](/pt/science/references#r11).
[^r12]: NASA Open Science Data Repository, *RadLab: Overview*. <https://visualization.osdr.nasa.gov/radlab/gui/overview/>. Referência [R12](/pt/science/references#r12).
[^r13]: NASA Science, *About OSDR*, atualizada em 2026-10-23. Referência [R13](/pt/science/references#r13).
[^r31]: M. L. Gaskill, *Wearable Tech for Space Station Research*, NASA, 2024-11-13. Referência [R31](/pt/science/references#r31).
