---
title: Tour do produto
description: Cada área da tela da Astronaut Health Intelligence Platform explicada, da barra superior à gaveta de alertas.
status: IMPLEMENTED
origin: SIMULATED, DERIVED, MANUAL
code:
  - frontend/web/src/app/App.tsx
  - frontend/web/src/features/topbar/TopBar.tsx
  - frontend/web/src/features/crew/CrewRail.tsx
  - frontend/web/src/features/attention/AttentionPanel.tsx
  - frontend/web/src/features/attention/StructureDetail.tsx
  - frontend/web/src/features/attention/RegionEvents.tsx
  - frontend/web/src/features/timeline/index.tsx
  - frontend/web/src/features/alerts/Alerts.tsx
  - frontend/web/src/features/crewview/CrewView.tsx
verified: 2026-11-14
---

# Tour do produto

Esta página descreve cada área da tela da Astronaut Health Intelligence Platform (AHI). A interface é **somente em inglês** (o projeto é avaliado por um júri internacional), então os nomes de botões e painéis aparecem aqui em inglês, entre aspas ou em formatação de código, com a explicação em português.

::: info
Tudo o que aparece na tela usa dados **simulados**. O selo `SIMULATED` fica sempre visível ao lado do logo.
:::

## Duas visões sobre o mesmo estado

A AHI tem duas visões. Ambas leem o mesmo estado ao vivo; a diferença é o público.

| Visão | Para quem | O que prioriza |
| --- | --- | --- |
| "Ground view" | Médico de voo (flight surgeon) e Mission Control | Tripulação inteira, corpo 3D, motivos, previsões, linha do tempo, vitais, cabine e dispositivos |
| "Crew view" | O astronauta | Uma pessoa, linguagem simples, letras grandes, só as duas ações principais, check-in diário |

Troque de visão pelo seletor "Ground" / "Crew" na barra superior ou com a tecla `V`.

### Ground view

![Ground view](/screenshots/ground-view.png)

A ordem de leitura é intencional: **tripulação** (quem) à esquerda, **corpo e frase de status** (o quê) no centro, **"What needs attention"** (por quê e o que fazer) à direita, e embaixo a **linha do tempo** e os **vitais ao vivo**.

### Crew view

![Crew view](/screenshots/crew-view.png)

A "Crew view" mostra uma pessoa por vez:

- uma frase de status grande e o corpo 3D;
- o painel "What to do now" com no máximo **duas ações** (as demais ficam na "Ground view"). Os rótulos de prioridade são "Do this now", "Do this soon" e "When you can";
- o botão do check-in diário (30 segundos);
- "Your body vs your normal": frequência cardíaca, oxigênio no sangue, respiração e variabilidade cardíaca, cada uma contra a faixa pessoal ("Normal for you" ou "Check the sensor");
- uma frase sobre o "Earth link" que explica quanto tempo uma resposta da Terra leva.

## Barra superior

Da esquerda para a direita:

| Elemento | O que faz |
| --- | --- |
| Logo "AHI" e selo `SIMULATED` | O selo abre "Where this data comes from": explica que toda leitura é simulada e lista os adapters de dispositivos ativos |
| Nome da missão e `MET` | Missão ("Demo Expedition", fase "In flight") e o tempo decorrido de missão. A hora UTC simulada aparece no tooltip |
| Player de cenário | Escolha do cenário, play/pause, velocidade e reinício (detalhes abaixo) |
| "Earth link" | Perfil de comunicação (ISS, Moon, Mars near, Mars far), atraso só de ida e mensagens em trânsito. Abre a gaveta de comunicação |
| "Ground" / "Crew" | Alterna a visão |
| "Tools" | Menu de ferramentas da missão (detalhes abaixo) |
| "Start demo" | Inicia a demo guiada de 10 passos |
| Sino de alertas | Abre a gaveta de alertas. O contador mostra alertas não reconhecidos; fica vermelho e pulsando quando há CRITICAL |

### Player de cenário

- **"Scenario"**: abre a lista dos 6 cenários ("Nominal day", "Progressive fatigue", "Cabin CO₂ rise", "Exercise performance decline", "Sensor failure", "Acute cardio event"), cada um com descrição e quem é afetado. Há um botão "Restart" no rodapé.
- **Play/pause**: também pela barra de espaço.
- **Velocidade**: "Real time" (1 s por s), "1 min/s", "10 min/s" e "1 h/s".
- **Reiniciar**: volta ao começo do cenário atual.

Veja o que acontece em cada cenário em [Cenários e demo guiada](/pt/product/demo-scenarios).

### Menu Tools

| Item | O que abre |
| --- | --- |
| "Mission overview" | Visão de longo prazo: radiação, exercício e sono ao longo da missão |
| "Shift handover" | Relatório de passagem de turno: imprimir, exportar FHIR, enviar à Terra |
| "Data and model" | Datasets reais da NASA, dispositivos simulados, model card e origens dos dados |
| "Presentation mode" | Letras maiores e menos detalhes (tecla `P`) |
| "Keyboard shortcuts" | Lista de atalhos (tecla `?`) |

Esses recursos estão descritos em [Recursos da missão](/pt/product/mission-features).

### Barra adaptável

A barra mede a própria largura e, quando falta espaço, recolhe itens em uma ordem fixa de prioridade: primeiro os rótulos, depois alguns itens migram para o menu "Tools" (o botão de reiniciar e o seletor de visão). O último a encolher é o "Start demo", que vira "Demo" e, no limite, só um ícone. O sino de alertas nunca é cortado.

## Lista da tripulação

Quatro astronautas, todos com identificadores pseudonimizados:

| Callsign | ID | Função |
| --- | --- | --- |
| ORION | AST-01 | Commander (CDR) |
| LYRA | AST-02 | Flight Engineer (FE-1) |
| VEGA | AST-03 | Flight Engineer (FE-2) |
| ATLAS | AST-04 | Mission Specialist (MS) |

Cada cartão mostra o status em linguagem simples, a frequência cardíaca, o oxigênio no sangue e uma minicurva da frequência cardíaca das últimas 6 horas. Clique no cartão (ou aperte `1` a `4`) para selecionar a pessoa.

### Status em linguagem simples

O status nunca depende só da cor: sempre há cor, ícone e palavra. Os cinco estados aparecem para a tripulação como "All good", "Keep an eye", "Act soon", "Act now" e "Signal lost". A tabela completa (nível interno, rótulo técnico, cor e ícone) está em [Design system e acessibilidade](/pt/product/design-system#status-cor-icone-e-palavra).

## Corpo 3D e chips dos sistemas

![Corpo 3D com um sistema do corpo selecionado e o detalhe no painel da direita](/screenshots/body-detail.png)

No centro fica o nome da pessoa, o dia de missão, a atividade atual ("Sleeping", "Resting", "Working", "Exercising" ou "On spacewalk (EVA)") e uma **frase de status** em linguagem simples.

O corpo 3D é um modelo anatômico realista (o atlas Z-Anatomy), com as cores naturais dos tecidos sob uma pele translúcida. Um sistema que pede atenção acende na cor do seu status, o coração bate na frequência cardíaca ao vivo e os pulmões respiram na frequência respiratória ao vivo. Uma mudança de status dispara um pulso de varredura curto a partir daquela região. Quando falta dado, o órgão fica cinza e para de se mover.

Sob o corpo ficam a pílula de controles ("Layers", as vistas "Front", "Back", "Left" e "Right" e o botão de reset), a legenda de status e a **legenda de anatomia de referência**: "Reference anatomy: Z-Anatomy atlas (CC BY-SA 4.0)". O botão de informação dela explica que este é um único modelo adulto de referência, mostrado para todos os tripulantes, não um exame do astronauta, e lista os créditos.

Ao lado do corpo ficam os **chips dos sistemas**, como rótulos anatômicos. Um chip sempre significa o sistema inteiro:

| Coluna esquerda | Coluna direita |
| --- | --- |
| "Brain" (Neuro and sleep) | "Muscles" (Musculoskeletal) |
| "Lungs" (Respiratory) | "Skeleton" (Bone and radiation) |
| "Heart" (Cardiovascular) | "Skin" (Thermal) |
| "Kidneys" (Renal and hydration) | |

### Camadas, vistas e opacidade da pele

| Controle | O que faz |
| --- | --- |
| "Layers" | Uma chave por sistema anatômico: "Skin", "Muscular", "Skeletal", "Cardiovascular", "Respiratory", "Nervous", "Nerves", "Digestive", "Urinary", "Other". Os músculos são "auto": aparecem quando são selecionados ou pedem atenção. "Nerves" e "Other" começam escondidos |
| "Skin opacity" | Um controle deslizante de 0 a 100% (22% por padrão), para ver mais da superfície ou mais do interior |
| "Presets" | "Default", "Organs", "Skeleton", "Muscles", "All" |
| "Front" / "Back" / "Left" / "Right" | Giram o corpo para uma vista predefinida, com transição suave |
| Reset | Mostra o corpo inteiro de novo e limpa a seleção |

Também dá para arrastar para girar, rolar para dar zoom e deslocar a vista. O corpo gira devagar sozinho quando nada está selecionado. Um sistema que ainda está baixando mostra o progresso; o resto do corpo continua utilizável.

### Selecionar uma estrutura {#selecting-a-structure}

Passe o ponteiro sobre qualquer parte do corpo para ver o nome, o sistema anatômico e o status, ou "Not monitored". Clique para selecionar: a câmera vai até a estrutura, o resto do corpo esmaece em um contorno translúcido e o painel da direita vira "Anatomy detail".

| Parte do painel | Conteúdo |
| --- | --- |
| "Selected structure" | Nome, sistema anatômico e lado (por exemplo "Left femur", "Skeletal system", "Left side") |
| "Reference anatomy" | De onde vem a forma 3D: "Z-Anatomy atlas" ou "AHI procedural" (os rins) |
| Estruturas no atlas | Quantas estruturas aquele sistema anatômico tem, e "Part of" quando a estrutura pertence a uma maior (por exemplo, as artérias coronárias fazem parte do coração) |
| "Monitored with" | Para estruturas monitoradas: o sistema do corpo com o qual ela é monitorada, o status desse sistema, uma frase simples dizendo como os indicadores se relacionam à estrutura, e as mesmas métricas, gráficos, alertas e sinalizações do detalhe do sistema. "Whole region" passa para o sistema inteiro |
| "Context only: not monitored" | Para estruturas às quais nenhum aparelho ou métrica se relaciona (por exemplo o estômago, um nervo ou os olhos): um cartão calmo, sem status. "No status is shown here because nothing is measured. That is not the same as normal." |

Os indicadores descrevem um sistema do corpo como um todo. São **indicadores relacionados, não medidas da estrutura selecionada**: selecionar o fêmur esquerdo mostra a dose de radiação acumulada como contexto de saúde óssea, não uma medida daquele osso. Quais estruturas se relacionam a quais métricas: [Mapeamento da anatomia para a saúde](/pt/architecture/data-model#anatomy-to-health-mapping).

**Alertas nas estruturas.** Um alerta aberto pertence a um sistema do corpo. As estruturas dele mostram um contorno pulsante na cor de status do alerta, um órgão monitorado em alerta fica visível através da parede do corpo sem nenhum clique, e um rótulo flutuante dá o nome do sistema e o valor-chave. No painel, "Alerts and flags" lista o que disparou cada alerta, o valor observado no momento do alerta ao lado do normal pessoal, o selo de origem do dado e o identificador da regra.

Clique de novo na estrutura selecionada, clique no espaço vazio, aperte `Esc` ou use "Overview" para voltar. Se o atlas de referência não carregar, o app mostra um corpo simplificado com o aviso "Reference atlas unavailable. Showing simplified model."; os sistemas do corpo, os chips e os alertas continuam funcionando. Detalhes técnicos em [Renderização da anatomia 3D](/pt/architecture/anatomy-3d).

::: warning ATENÇÃO
Os olhos podem ser selecionados, mas são só de contexto: não existe aparelho de medição ocular no MVP, então eles nunca mostram status. O acompanhamento da SANS a partir de exames periódicos está no [roadmap](/pt/resources/roadmap).
:::

## Painel "What needs attention"

![Ações recomendadas](/screenshots/attention-actions.png)

O painel da direita explica o estado da pessoa selecionada.

### Status geral

"Overall status" mostra o nível, o escore de risco e a confiança ([como são calculados](/pt/intelligence/risk-assessment)). A confiança cai quando faltam sinais importantes ou quando a qualidade do dado é ruim. Se os vitais principais estão ausentes, o painel diz "Core vitals missing. Status cannot be confirmed."

### Motivos ("Why")

Lista dos fatores que contribuem para o status, cada um com seu peso relativo em porcentagem. Exemplo de fator: HRV abaixo da faixa pessoal há algumas horas. Sistemas sem dado ao vivo aparecem com o aviso de que dado ausente nunca é tratado como normal.

### Ações recomendadas ("Recommended actions")

Cada cartão de ação mostra:

- **Prioridade**: "Low priority", "Medium priority", "High priority" ou "Urgent";
- **Público**: "For crew", "Flight surgeon" ou "Mission control";
- **Selo de autonomia**: quem pode fechar o ciclo;
- **Título e motivo** em linguagem simples;
- botões **"Mark done"** (registra a intervenção na trilha de auditoria), **"Dismiss"** e **"Compare"** (abre a comparação "e se").

| Selo de autonomia | Significado |
| --- | --- |
| "Can act on board now" | A tripulação pode agir agora, sem esperar a Terra |
| "Needs flight surgeon" | Um médico de voo na Terra deve revisar |
| "Earth reply in ... +" | Aparece com atraso grande (Marte): o tempo mínimo até uma resposta da Terra |

Por padrão aparecem duas ações; "Show N more" expande a lista. Abaixo fica a última intervenção registrada ("Last logged").

::: tip DICA
"Mark done" aplica na simulação uma **recuperação hipotética**, registrada na auditoria como simulação. Não é evidência de eficácia clínica.
:::

### Previsão ("Forecast")

Para cada métrica com previsão, uma linha diz:

- "Projected to leave your normal range in ..." quando a projeção central sai da faixa pessoal;
- "Stable over next N h" quando não sai;
- "Not enough data to forecast yet" quando ainda não há dados suficientes.

Clique em uma linha para abrir o gráfico da métrica.

## Detalhe da região

Ao clicar em um chip de sistema, o painel vira "Body system detail" com o botão "Overview" para voltar (ou tecla `Esc`). Clicar em uma estrutura monitorada do corpo mostra os mesmos dados sob o cabeçalho da estrutura ([Selecionar uma estrutura](#selecting-a-structure)). Cada métrica do sistema tem:

- valor atual e diferença em relação ao normal;
- **"Your normal"**: a faixa pessoal (ou "Still learning your normal" enquanto não há dados suficientes);
- selos de **qualidade** e de **origem** (`SIMULATED`);
- um **gráfico** com janela de 6 h, 24 h ou 72 h.

Abaixo das métricas, "Alerts and flags" lista os alertas abertos daquele sistema (gravidade, hora, a métrica que disparou, o valor observado no momento do alerta contra o normal pessoal, a origem do dado e o identificador da regra) e as sinalizações estatísticas das últimas 24 horas. Uma linha acima das métricas diz quantos alertas estão abertos e leva até eles. O texto continua não diagnóstico: alertas e sinalizações pedem uma revisão.

### O gráfico

| Elemento | Significado |
| --- | --- |
| Faixa sombreada ("Your normal band") | Faixa pessoal ([Linha de base pessoal](/pt/intelligence/personal-baseline)) |
| Linha ("Measured") | Valores medidos |
| Cone tracejado ("Forecast (80% interval)") | Projeção com intervalo de 80% ([Previsão](/pt/intelligence/forecasting)) |
| Marcadores | Alertas ("Alert"), ações registradas ("Action logged") e check-ins ("Check-in") |
| Lacunas | "Gaps mean no data": falta de dado nunca é preenchida |

### "Why is this my normal?"

O ícone (i) ao lado de "Your normal" explica como a faixa foi aprendida: quantas leituras da própria pessoa, a mediana (valor típico) e o MAD (quanto a pessoa costuma variar, uma medida robusta que ignora picos isolados). A frase final resume a ideia: "Status compares you with yourself, not with a population average."

## Linha do tempo

![Linha do tempo durante fadiga progressiva](/screenshots/timeline-fatigue.png)

Faixa fina com **uma raia por astronauta e uma para a cabine**, colorida pelo status ao longo do tempo (um quadro a cada 15 minutos simulados). Os marcadores mostram:

- alertas;
- ações registradas;
- check-ins diários;
- mensagens com a Terra ("To Earth" ou "From Earth").

Escolha o intervalo "24 h", "72 h" ou "All". Clique em um marcador para ir à pessoa e ao sistema relacionados. Com a linha do tempo em foco, as setas percorrem os marcadores e Enter abre um deles. A legenda explica: "Lane color = status at that time".

## Vitais, cabine e dispositivos

Na base da "Ground view":

| Bloco | Conteúdo |
| --- | --- |
| "Live vitals" | Frequência cardíaca, variabilidade cardíaca ("Heart variability"), oxigênio no sangue, frequência respiratória, pressão arterial e temperatura da pele, com minicurva das últimas 6 h e faixa pessoal. Cada bloco diz "Normal for you", a diferença em relação ao normal, ou "Check the sensor" |
| "Cabin" | CO₂, temperatura, umidade e taxa de dose de radiação da cabine |
| "Devices" | Quantos dispositivos estão online ("All online" ou a contagem), menor bateria e acesso à lista. Estados: "Online", "Degraded", "Data stale", "Offline" |

## Gaveta de alertas

![Alerta crítico](/screenshots/critical-alert.png)

Aberta pelo sino ou pela tecla `A`.

- **Abas**: "Open (n)" com alertas não reconhecidos, agrupados por membro da tripulação e sistema do corpo, e "History".
- **Ações por alerta**: "Acknowledge" (reconhecer) e "View" (ir à pessoa e ao sistema). Há também "Acknowledge all".
- **Escalonamento**: alertas HIGH e CRITICAL não reconhecidos sobem de nível depois de tempos de demo ([Alertas e escalonamento](/pt/intelligence/alerts#escalonamento)). O cartão mostra o selo "Escalated" e o texto "Unacknowledged for ... Escalated". Reconhecer ou resolver o alerta interrompe o escalonamento.
- **Resolução automática**: o alerta se resolve sozinho quando a regra fica normal por alguns minutos simulados ("Resolved, back in normal range").
- **Som**: a opção "Sound for new critical alerts" toca um aviso curto de dois tons para novos alertas CRITICAL. Vem **desligada** por padrão e a preferência fica salva no navegador.
- **"Activity log"**: registro de auditoria, do mais novo para o mais antigo (alertas reconhecidos, ações, check-ins, mensagens com a Terra, mudanças de cenário).

Um alerta CRITICAL também aparece como **faixa sobre o cabeçalho** do corpo, sem encolher o 3D. Ela tem "View", "Acknowledge" e um botão para esconder a faixa ("Hide banner (alert stays open)"): o alerta continua aberto.

## Modo apresentação

"Presentation mode" (tecla `P` ou menu "Tools") aumenta as fontes, os rótulos do 3D e os eixos dos gráficos, e esconde detalhes secundários. Use em projetores e telas de palco. A preferência fica salva no navegador.

## Atalhos de teclado

| Tecla | Ação |
| --- | --- |
| `1` `2` `3` `4` | Selecionar membro da tripulação |
| `V` | Alternar "Ground view" e "Crew view" |
| `P` | Modo apresentação (também no "Tools") |
| `A` | Abrir ou fechar os alertas |
| `Space` | Play ou pause da simulação |
| `Esc` | Fechar um painel, ou voltar do detalhe do corpo ou da anatomia |
| `?` | Mostrar a ajuda de atalhos |
| `←` `→` | Passo anterior / próximo na demo guiada |

Os atalhos são ignorados enquanto você digita em um campo e quando Ctrl, Alt ou Cmd estão pressionados.

## Modo compacto

O layout se adapta à tela sem configuração:

- **Tela baixa** (largura de 1024 px ou mais e altura de até 820 px, por exemplo 1366x768 ou 1280x720 com escala de 150%): a linha do tempo vira uma **faixa fina** que se expande ao passar o mouse, ao receber foco ou ao toque; os vitais perdem a minicurva; os cartões da tripulação viram linhas compactas.
- **Tela grande** (1680x1000 ou mais): painel da direita mais largo, linha do tempo mais alta, previsões expandidas.
- **Barra superior**: recolhe itens conforme a largura (veja [Barra adaptável](#barra-adaptavel)).
- **Corpo 3D**: em painéis estreitos, os controles viram uma pílula compacta com o botão "Layers" e o reset; as vistas vão para dentro do popover.

## Próximos passos

- [Jornadas de usuário e papéis](/pt/product/user-journeys): o caminho de cada persona por estas telas.
- [Recursos da missão](/pt/product/mission-features): comunicação com a Terra, check-in, visão de missão, relatório e "e se".
- [Cenários e demo guiada](/pt/product/demo-scenarios): o que observar em cada cenário.
