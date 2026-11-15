---
title: Roadmap
description: O que a Astronaut Health Intelligence Platform já entrega, o que vem a seguir em dados, plataforma, fluxo clínico, análise e anatomia 3D, e o que está mais longe.
status: PLANNED
verified: 2026-11-14
---

# Roadmap

O que a Astronaut Health Intelligence Platform (AHI) já entrega, o que vem a seguir e o que está mais longe. Os itens futuros vêm do `README.md`, do `PROJECT_MASTER.md` e de [Pipeline e qualidade](/pt/data/pipeline-and-quality). **São planos, não promessas de data.**

## Já entregue (MVP e v2)

<StatusBadge status="IMPLEMENTED" />
| Área | Entrega |
| --- | --- |
| Simulação | Tripulação de 4 pessoas, adapters de dispositivos simulados, 6 cenários, semeada e reproduzível |
| Motor | Baseline pessoal robusta, detecção aguda, deriva e persistência, regras combinadas, escore de risco explicável, previsão com incerteza, recomendações com autonomia, alertas com escalonamento |
| Interface | "Ground view" e "Crew view", linha do tempo, gaveta de alertas, modo apresentação, atalhos de teclado, demo guiada de 10 passos |
| Anatomia 3D | Corpo 3D sobre um atlas anatômico real (Z-Anatomy): 250 estruturas selecionáveis, camadas por sistema, painel da estrutura, mapeamento de saúde, pipeline de assets reproduzível e fallback procedural |
| Missão | Perfis de comunicação ISS, Lua e Marte; check-in diário; visão de longo prazo; relatório de passagem de turno com exportação FHIR R4; comparação "e se" |
| Dados reais | OSD-569 e OSD-575 (Inspiration4) importados como `REAL_PUBLIC`, com proveniência completa |
| Qualidade | 143 testes unitários e de cenário (vitest), avaliação reproduzível (`npm run evaluate`) e model card gerado |
| Documentação | Portal bilíngue (VitePress) publicado no GitHub Pages, com CI |

## Próximo: dados reais e fundamentação

<StatusBadge status="PLANNED" />
Prioridades do time de dados:

| Prioridade | Item |
| --- | --- |
| P0 | **Replay real do ambiente da ISS** (CO₂, temperatura, umidade) a partir do NASA EDA, como `REAL_PUBLIC`, substituindo o simulador de cabine |
| P0 | **Série real de dose de radiação** (EDA; RadLab quando voltar do erro HTTP 500) |
| P0 | **Justificativa científica do catálogo**: tabela métrica x NASA Standard Measure x perigo do HRP |
| P1 | **Fundamentação dos limiares**: cada limiar de demo com fonte citável (documento, seção, versão) ou o rótulo de demo mantido |
| P1 | **Calibração do simulador** de vitais e sono com faixas publicadas (com DOI) |
| P1 | **Dados de sono ou cognição de análogos** (NLSP, OSDR), rotulados como análogos |
| P1 | **Ampliar laboratório**: cortisol ou marcadores imunes com unidade clínica |
| P2 | Faixas de desempenho de exercício da literatura de contramedidas; datas reais de missão nos replays |

## Plataforma: backend

<StatusBadge status="PLANNED" />
A arquitetura alvo do `PROJECT_MASTER.md` é um monólito modular:

- **API de ingestão em FastAPI** atrás do **mesmo contrato de adapters** usado hoje no navegador;
- persistência em PostgreSQL (TimescaleDB opcional), migrações com Alembic, Redis para cache e filas leves;
- **controle de acesso por perfil** (tripulação, médico de voo, Mission Control, pesquisador);
- importação de datasets como jobs, com idempotência e nova tentativa;
- observabilidade com logs estruturados e endpoints de saúde;
- Docker Compose para rodar tudo localmente;
- testes de integração e ponta a ponta (pytest, httpx, Playwright).

Detalhes em [Arquitetura alvo](/pt/architecture/target-architecture).

## Fluxo clínico

<StatusBadge status="PLANNED" />
- **Fluxo de revisão do médico de voo**: hoje as respostas de solo são simuladas e padronizadas; o próximo passo é um fluxo real de revisão, com registro de decisão.
- Integração com HL7 FHIR R4 além da exportação (por exemplo, `DiagnosticReport` e `QuestionnaireResponse`).

## Análise

<StatusBadge status="PLANNED" />
Do plano de modelos do documento mestre, sempre "estatística explicável primeiro, depois aprendizado de máquina":

| Método | Prioridade no plano |
| --- | --- |
| Isolation Forest (anomalia multivariada) | P1 |
| ARIMA para séries adequadas | P2 |
| XGBoost para risco, só com dataset rotulado suficiente | P2 |
| Análise de sobrevivência (tempo até evento) | Futuro |
| Explicação em linguagem natural (LLM) de uma recomendação já escolhida pelas regras (US-024) | P2, com humano no circuito e fallback sem LLM |

Reconhecimento de atividade por sensor (hoje o contexto vem do cronograma) também melhoraria as baselines por contexto. Regras e limites desses métodos em [Abordagem de IA e análise de dados](/pt/intelligence/ai-and-analytics).

## Saúde ocular: SANS

<StatusBadge status="PLANNED" />
Hoje os olhos são estruturas só de contexto do atlas 3D: podem ser selecionados, mas **nenhum aparelho de medição ocular alimenta o MVP**, então não mostram status. A extensão planejada é acompanhar a **SANS** (síndrome neuro-ocular associada ao voo espacial) a partir de **exames periódicos**, como OCT e ultrassom ocular. Seriam medidas pontuais (não um sinal contínuo), que entrariam no mesmo modelo canônico como observações de exame.

## Anatomia 3D: próximos passos {#anatomy-next-steps}

<StatusBadge status="PLANNED" />
O visualizador do atlas está pronto ([Renderização da anatomia 3D](/pt/architecture/anatomy-3d)). O que vem a seguir:

| Item | Por quê |
| --- | --- |
| **Modelo feminino de referência** | Hoje um único modelo de referência (fonte adulta masculina, com a virilha neutra) representa todos os tripulantes. Um segundo modelo deixaria o corpo acompanhar o sexo do tripulante. Precisa de uma fonte com licença compatível e dos mesmos ids de estrutura |
| **Texturas** | A fonte só tem cores chapadas, então todo o detalhe vem da geometria e dos materiais. Texturas dariam detalhe de superfície, ao custo de mais download |
| **Alternativa de rim do BodyParts3D** | Os rins são formas procedurais simples porque o modelo de rim dentro do Z-Anatomy tem licença não comercial. O BodyParts3D, a base em que o Z-Anatomy se apoia, é uma fonte candidata de geometria real de rim, sob uma licença do tipo "compartilha igual"; os termos precisam ser conferidos antes |
| **Monitoramento ocular (SANS)** | Veja a seção acima: as estruturas dos olhos já existem e só precisam de dados |
| **Seleção de estruturas pelo teclado e testes visuais automatizados** | As estruturas só podem ser selecionadas com o ponteiro, e a renderização é conferida à mão |

Fora dos planos: anatomia por astronauta (exames ou tamanho do corpo). O corpo é anatomia de referência por decisão de projeto.

## Engenharia

<StatusBadge status="PLANNED" />
- Testes de componente React e de acessibilidade automatizada.
- Testes ponta a ponta no navegador (Playwright).
- Avaliação do motor rodando no CI.
- Testes vitest para os scripts de importação do OSDR.

## Próximos passos

- [Padrões, contratos e extensões](/pt/engineering/contributing): como pegar um item.
- [Limitações e problemas conhecidos](/pt/validation/limitations): o que cada item resolve.
- [Uso responsável](/pt/overview/responsible-use): regras que continuam valendo em cada item.
