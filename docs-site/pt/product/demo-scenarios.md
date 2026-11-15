---
title: Cenários e demo guiada
description: Os seis cenários roteirizados da Astronaut Health Intelligence Platform, o que observar em cada um, a demo guiada de 10 passos e um roteiro de pitch de 4 minutos.
status: IMPLEMENTED
origin: SIMULATED
code:
  - frontend/web/src/engine/sim/scenarios.ts
  - frontend/web/src/engine/catalog.ts
  - frontend/web/src/features/tour/steps.ts
  - frontend/web/src/features/tour/Tour.tsx
  - frontend/web/src/features/topbar/ScenarioControl.tsx
tests:
  - frontend/web/src/engine/engine.test.ts
verified: 2026-11-14
---

# Cenários e demo guiada

A Astronaut Health Intelligence Platform (AHI) traz seis cenários roteirizados para mostrar o motor em ação. Escolha o cenário no player da barra superior ("Scenario"). Cada um pede uma velocidade diferente, porque alguns padrões levam minutos e outros levam dias.

::: info
Todos os cenários usam dados **simulados**. Como cada um é modelado está em [Simulação de dispositivos e cenários](/pt/intelligence/scenario-simulation). Os tempos de detecção medidos (primeiro alerta, HIGH, CRITICAL, pico) estão em [Resultados e evidências](/pt/validation/results#deteccao-por-cenario): medem as regras do protótipo em dados simulados, não desempenho clínico.
:::

## Qual cenário usar

| Cenário (interface) | Quem | Velocidade sugerida | Ritmo | O que demonstra |
| --- | --- | --- | --- | --- |
| "Nominal day" | Todos | qualquer | | Tela calma, sem alarme falso |
| "Acute cardio event" | ORION (AST-01) | "1 min/s" | minutos | Alerta rápido, CRITICAL, escalonamento |
| "Sensor failure" | VEGA (AST-03) | "1 min/s" | minutos | Dado ausente nunca é normal |
| "Cabin CO₂ rise" | Cabine (todos) | "10 min/s" | horas | Ambiente e coocorrência |
| "Progressive fatigue" | LYRA (AST-02) | "1 h/s" | dias | Deriva lenta contra o normal pessoal |
| "Exercise performance decline" | ATLAS (AST-04) | "1 h/s" | dias | Persistência em métricas diárias |

Padrões lentos ficam limitados a HIGH **por projeto**: pedem revisão, não resposta de emergência. Só o evento cardíaco agudo chega a CRITICAL.

## O que observar

### Nominal day

A tela calma é o ponto. Sem alarme falso, o painel diz "No actions needed right now." Na avaliação, o cenário nominal teve zero alertas da tripulação em 60 dias-tripulante simulados.

### Acute cardio event

![Alerta crítico durante o evento cardíaco agudo](/screenshots/critical-alert.png)

- a faixa vermelha CRITICAL sobre o cabeçalho do corpo;
- o coração e os pulmões acendendo em vermelho no 3D, visíveis através do tórax sem nenhum clique;
- as ações recomendadas, com revisão do médico de voo sinalizada;
- "Mark done" no protocolo de repouso: a intervenção vai para a auditoria e a simulação mostra uma recuperação hipotética;
- o escalonamento se ninguém reconhecer o alerta.

### Sensor failure

Os órgãos ficam cinza, o coração para de animar, o cartão diz "Signal lost" e a recomendação é checar o ajuste do sensor. O pico é MODERATE: status desconhecido, nunca "normal".

### Cabin CO₂ rise

A tripulação inteira se desloca um pouco ao mesmo tempo. A regra R-ENV-CO2-02 mostra a **coocorrência** entre CO₂ e sinais da tripulação e lembra que correlação não é causalidade. A ação sugerida é ventilar o módulo e checar o removedor de CO₂.

### Progressive fatigue

![Linha do tempo durante a fadiga progressiva](/screenshots/timeline-fatigue.png)

- cérebro e coração passando de âmbar a laranja;
- o gráfico de HRV saindo da faixa pessoal sombreada, com o cone de previsão;
- a linha do tempo mostrando a raia de LYRA mudando ao longo dos dias;
- a mensagem central: o sistema não espera um número cruzar uma linha arbitrária, ele observa padrão, persistência e contexto contra o normal de cada pessoa.

### Exercise performance decline

A região dos músculos ganha a cor do status e a camada muscular aparece sozinha no 3D. A ação sugere ajustar carga e recuperação com o treinador.

## Demo guiada ("Start demo")

![Demo guiada](/screenshots/guided-demo.png)

O botão **"Start demo"** inicia uma história de cerca de 2 minutos em 10 passos (no modo automático). Cada passo destaca uma área da tela e prepara a cena sozinho (cenário, velocidade, pessoa, região). Há reprodução automática, e as setas `←` e `→` navegam. `Esc` sai. Ao terminar, o app volta a "Nominal day", "1 min/s", perfil ISS e ORION selecionado.

| # | Título (interface) | O que mostra |
| --- | --- | --- |
| 1 | "Meet the crew" | Quatro astronautas, cada um comparado com o próprio normal |
| 2 | "The body at a glance" | A anatomia 3D ligada aos dados: o que pede atenção acende na cor do status, coração e pulmões ao vivo. Dica: clicar em qualquer estrutura (o painel mostra os dados dela, ou diz que é só referência) |
| 3 | "Acute cardio event" | ORION: frequência cardíaca sobe, oxigênio cai, faixa CRITICAL e escalonamento |
| 4 | "What to do, and who can do it" | Ações com motivo e autonomia; experimente "Mark done" no protocolo de repouso |
| 5 | "Far from Earth" | Perfil "Mars (farthest)": qualquer resposta da Terra leva pelo menos 44 minutos |
| 6 | "Slow drift: progressive fatigue" | LYRA em "1 h/s"; a demo avança a simulação para cerca de 48 h |
| 7 | "Her normal, not an average" | Gráfico de HRV com faixa pessoal, marcadores e cone de previsão |
| 8 | "What if she follows the advice?" | Comparação com e sem a ação, como projeção hipotética |
| 9 | "Crew view: for the astronaut" | A visão da tripulação e o check-in de 30 segundos |
| 10 | "Mission tools" | O menu "Tools": visão de missão, relatório de turno, origem dos dados |

::: tip DICA
Para avaliadores, a demo guiada é o caminho mais curto: não é preciso escolher cenário nem velocidade, e os padrões lentos já aparecem prontos.
:::

## Roteiro de pitch (cerca de 4 minutos)

Baseado em `docs/demo-script.md`.

**0. Preparação (antes de apresentar)**
1. `cd frontend/web` e `npm run dev`. Abra `http://localhost:5173` em tela cheia (1440x900 ou maior).
2. Cenário "Nominal day", velocidade "1 min/s". Considere o modo apresentação (`P`).

**1. Problema (30 s)**
Missões longas expõem a tripulação a cinco perigos (radiação, isolamento, distância da Terra, gravidade alterada, ambientes fechados). Os sinais vêm de muitos aparelhos em ritmos diferentes. O suporte médico está longe, então a tripulação precisa entender o próprio estado rápido.

**2. A tela em 10 segundos (40 s)**
- Esquerda: a tripulação, com status em palavras simples.
- Centro: o corpo 3D, um modelo anatômico realista. O que pede atenção acende na cor do status; coração e pulmões ao vivo.
- Direita: "What needs attention": status, por quê e o que fazer.
- Base: vitais, cabine e dispositivos. O selo `SIMULATED DATA` está sempre visível.

**3. Fadiga progressiva (60 s)**
1. Escolha "Progressive fatigue" (LYRA), velocidade "1 h/s".
2. O sono cai, a HRV sai da faixa de LYRA, a frequência de repouso sobe.
3. Cérebro e coração acendem em âmbar e depois em laranja. Clique no chip "Heart": faixa pessoal, histórico e cone de previsão.
4. Mensagem: padrão, persistência e contexto contra o normal de cada pessoa.

**4. Evento agudo e decisão rápida (50 s)**
1. Escolha "Acute cardio event" (ORION), velocidade "1 min/s".
2. Em minutos simulados: frequência cardíaca sobe, oxigênio cai, faixa CRITICAL.
3. Mostre as ações (revisão do médico de voo sinalizada). Clique em "Mark done" no protocolo de repouso: a intervenção vai para a auditoria e a simulação mostra uma recuperação hipotética (rotulada como simulação).
4. Reconheça o alerta.

**5. Falha de sensor (30 s)**
"Sensor failure" (VEGA): a camiseta perde sinal, os órgãos ficam cinza e o coração para de animar. Dado ausente nunca é normal. A recomendação é checar o sensor.

**6. Ambiente (20 s)**
"Cabin CO₂ rise": toda a tripulação muda um pouco (respiração, tempo de reação). O app mostra coocorrência e lembra que correlação não é causalidade.

**7. Impacto (20 s)**
Frase central do roteiro (no app e no pitch, em inglês): *"We turn physiological and environmental signals into one integrated, explainable view of each astronaut's health, spotting trends before they become operational problems."*

Próximos passos citados no pitch: datasets reais do NASA OSDR como `REAL_PUBLIC`, backend de ingestão (FastAPI) atrás do mesmo contrato de adapters e fluxo de revisão do médico de voo.

## Próximos passos

- [Resultados e evidências](/pt/validation/results): tempos de detecção medidos.
- [Tour do produto](/pt/product/product-tour): cada área da tela.
- [Configuração, comandos e problemas](/pt/engineering/quick-start): preparar a máquina da apresentação.
