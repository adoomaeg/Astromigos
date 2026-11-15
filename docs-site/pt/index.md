---
layout: home
title: Astronaut Health Intelligence Platform
description: Monitoramento de saúde de astronautas e apoio à decisão, com baseline pessoal, risco explicável e corpo 3D. NASA Space Apps Challenge 2026.

hero:
  name: "Astronaut Health Intelligence Platform"
  text: "Saúde da tripulação, explicada em um olhar"
  tagline: "Cada sinal é comparado com o normal da própria pessoa, explicado em linguagem simples e mostrado em um corpo 3D. Apoio à decisão para missões longas, com dados simulados claramente identificados."
  image:
    src: /logo.svg
    alt: Logo da Astronaut Health Intelligence Platform
  actions:
    - theme: brand
      text: Começar
      link: /pt/overview/introduction
    - theme: alt
      text: Tour do produto
      link: /pt/product/product-tour
    - theme: alt
      text: Status das funcionalidades
      link: /pt/overview/feature-status
    - theme: alt
      text: GitHub
      link: https://github.com/lucaspalharesbarbosa/astronaut-health-intelligence-platform

features:
  - title: Anatomia 3D ao vivo
    details: "Um atlas anatômico realista (Z-Anatomy), com 250 estruturas selecionáveis em camadas por sistema. Um sistema que pede atenção acende na cor do seu status, o coração bate na frequência cardíaca atual e os pulmões respiram na frequência respiratória atual."
    link: /pt/architecture/anatomy-3d
  - title: Baseline pessoal
    details: "Ninguém é comparado com uma média populacional. A faixa normal de cada métrica é aprendida com os dados da própria pessoa (mediana e MAD), separada por contexto: sono, repouso, trabalho e exercício."
    link: /pt/intelligence/personal-baseline
  - title: Risco explicável
    details: "Regras transparentes, cada uma com identificador, motivo em linguagem simples e peso no escore de 0 a 100. Sem caixa-preta e sem LLM em tempo de execução."
    link: /pt/intelligence/risk-assessment
  - title: Decisões com atraso de comunicação
    details: "Perfis ISS, Lua e Marte. Mensagens viajam com o atraso da luz, e a plataforma separa o que a tripulação pode fazer a bordo do que precisa do médico de voo na Terra."
    link: /pt/intelligence/self-report-and-earth-link
  - title: Dados reais da NASA com proveniência
    details: "Dois datasets públicos do NASA OSDR (hemograma e painel metabólico da Inspiration4) aparecem como referência histórica, com arquivo, SHA-256 e data de download."
    link: /pt/data/dataset-catalog
  - title: Validação transparente
    details: "143 testes automatizados e uma avaliação reproduzível do motor em 5 sementes. Cada número publicado aponta para o código e para o teste que o sustenta."
    link: /pt/validation/results
---

<div class="ahi-home">

<h2>A plataforma em uma tela</h2>
<p class="lead">A "Ground view" responde três perguntas, nesta ordem: quem precisa de atenção, o que está acontecendo e o que fazer. Tudo roda no navegador, sem backend.</p>

<figure>

![Ground view da plataforma: tripulação, corpo 3D, painel What needs attention, linha do tempo de status e vitais ao vivo](/screenshots/ground-view.png)

<figcaption>"Ground view" durante um cenário simulado. Todos os dados de dispositivos deste protótipo são simulados e identificados com <code>SIMULATED</code>.</figcaption>
</figure>

<h2>Links rápidos</h2>

| Quero... | Comece por |
| --- | --- |
| Entender o problema e o escopo | [Introdução](/pt/overview/introduction) |
| Ver o que está pronto e o que é plano | [Matriz de status das funcionalidades](/pt/overview/feature-status) |
| Rodar o app em 2 minutos | [Configuração, comandos e problemas](/pt/engineering/quick-start) |
| Apresentar a demo | [Cenários e demo guiada](/pt/product/demo-scenarios) |
| Entender como o risco é calculado | [Visão geral dos métodos](/pt/intelligence/overview) |
| Saber se há IA ou LLM | [Abordagem de IA e análise de dados](/pt/intelligence/ai-and-analytics) |
| Conferir de onde vêm os dados | [Origens e proveniência dos dados](/pt/data/data-origins) |
| Ver a base científica | [Riscos à saúde em voos espaciais](/pt/science/spaceflight-hazards) |
| Avaliar as evidências | [Resultados e evidências](/pt/validation/results) |
| Contribuir com código | [Padrões, contratos e extensões](/pt/engineering/contributing) |

<div class="ahi-disclaimer">

**Apoio à decisão, não dispositivo médico.** A Astronaut Health Intelligence Platform (AHI) não faz diagnóstico, não recomenda medicamentos e não substitui o médico de voo (flight surgeon) nem o Mission Control. Os limiares são configuração de demo, não limites oficiais da NASA. Todos os dados de dispositivos são simulados e não são evidência clínica. Leia [Uso responsável](/pt/overview/responsible-use).

</div>

</div>
