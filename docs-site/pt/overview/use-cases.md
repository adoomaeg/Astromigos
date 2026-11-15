---
title: Casos de uso e partes interessadas
description: Quem usa a Astronaut Health Intelligence Platform, para quê, e quais casos de uso o protótipo atende hoje.
verified: 2026-11-14
---

# Casos de uso e partes interessadas

A Astronaut Health Intelligence Platform (AHI) atende pessoas com necessidades diferentes sobre o mesmo estado ao vivo. Esta página lista as partes interessadas, o que cada uma precisa e onde o protótipo ajuda. As personas vêm do documento mestre do projeto (`PROJECT_MASTER.md`, seção 2.5).

## Partes interessadas

| Persona | Necessidade | Onde a AHI ajuda hoje | Status |
| --- | --- | --- | --- |
| Tripulação (astronauta) | Entender o próprio estado e hábitos | "Crew view": linguagem simples, as duas ações principais, vitais contra o próprio normal, check-in diário de 30 segundos | <StatusBadge status="IMPLEMENTED" /> |
| Oficial médico de bordo (crew medical officer) | Agir a bordo quando a Terra está longe | Ações marcadas "Can act on board now" e primeiro passo a bordo nos perfis de Marte | <StatusBadge status="IMPLEMENTED" /> |
| Médico de voo (flight surgeon) | Acompanhar sinais e investigar alterações | "Ground view", gráficos com faixa pessoal, motivos, previsões, relatório de passagem de turno, pedidos de consulta pelo "Earth link" | <StatusBadge status="IMPLEMENTED" /> |
| Mission Control | Entender riscos operacionais | Alertas priorizados com escalonamento, ambiente da cabine, estado dos dispositivos, linha do tempo da tripulação | <StatusBadge status="IMPLEMENTED" /> |
| Pesquisador | Explorar dados históricos e proveniência | Diálogo "Data and model": datasets reais da NASA, origem de cada dado, model card | <StatusBadge status="IMPLEMENTED" /> |
| Admin / engenheiro de dados | Gerenciar fontes, ingestão e qualidade | Scripts de importação do OSDR e o [pipeline de dados](/pt/data/pipeline-and-quality). Não há tela de administração | <StatusBadge status="PLANNED" /> |
| Avaliador do hackathon | Entender o valor rapidamente | Demo guiada de 10 passos, modo apresentação, esta documentação | <StatusBadge status="IMPLEMENTED" /> |

::: info
O **médico de voo** (flight surgeon) é o médico responsável pela saúde da tripulação, em solo. Na demo, as respostas dele são **simuladas e padronizadas**. Não há fluxo real de revisão médica: ele está no [roadmap](/pt/resources/roadmap).
:::

## Casos de uso

| ID | Caso de uso | Ator principal | Onde está | Status |
| --- | --- | --- | --- | --- |
| UC-01 | Ver em segundos quem da tripulação precisa de atenção | Médico de voo, Mission Control | Lista da tripulação e corpo 3D | <StatusBadge status="IMPLEMENTED" /> |
| UC-02 | Entender por que o status mudou | Médico de voo | Painel "What needs attention", seção "Why" | <StatusBadge status="IMPLEMENTED" /> |
| UC-03 | Comparar uma métrica com o normal da pessoa | Médico de voo, tripulação | Detalhe do sistema do corpo, gráfico com faixa pessoal | <StatusBadge status="IMPLEMENTED" /> |
| UC-04 | Antecipar uma saída da faixa normal | Médico de voo | Previsão com intervalo de 80% | <StatusBadge status="IMPLEMENTED" /> |
| UC-05 | Decidir o que fazer e quem pode agir | Tripulação, oficial médico de bordo | Ações recomendadas com selo de autonomia | <StatusBadge status="IMPLEMENTED" /> |
| UC-06 | Reconhecer e acompanhar alertas | Mission Control | Gaveta de alertas, escalonamento, auditoria | <StatusBadge status="IMPLEMENTED" /> |
| UC-07 | Pedir revisão à Terra com atraso realista | Tripulação | "Earth link" | <StatusBadge status="IMPLEMENTED" /> <OriginBadge origin="SIMULATED" /> |
| UC-08 | Relatar humor, fadiga, estresse e sintomas | Tripulação | Check-in diário | <StatusBadge status="IMPLEMENTED" /> <OriginBadge origin="MANUAL" /> |
| UC-09 | Passar o turno com um resumo das últimas 24 h | Médico de voo | "Shift handover" com exportação FHIR R4 | <StatusBadge status="IMPLEMENTED" /> |
| UC-10 | Discutir o efeito hipotético de uma ação | Médico de voo, tripulação | Comparação "e se" | <StatusBadge status="IMPLEMENTED" /> <OriginBadge origin="SIMULATED" /> |
| UC-11 | Ver tendências de longo prazo da missão | Mission Control | "Mission overview" | <StatusBadge status="IMPLEMENTED" /> |
| UC-12 | Conferir a origem de cada número | Pesquisador | Selo `SIMULATED`, diálogo "Data and model" | <StatusBadge status="IMPLEMENTED" /> |
| UC-13 | Ingerir observações reais por API | Engenheiro de dados | API de ingestão | <StatusBadge status="PLANNED" /> |
| UC-14 | Controlar acesso por perfil | Admin | RBAC (controle de acesso por papel) | <StatusBadge status="PLANNED" /> |
| UC-15 | Receber explicação em linguagem natural de uma recomendação | Tripulação | Camada de explicação com LLM | <StatusBadge status="PLANNED" /> |

Como cada persona percorre a interface está em [Jornadas de usuário e papéis](/pt/product/user-journeys).

## Fora do uso pretendido

- Decisões clínicas, resposta a emergências reais ou uso com pacientes.
- Uso com dados reais de astronautas sem revisão de um médico de voo e sem as garantias de [Governança e privacidade](/pt/data/governance-and-privacy).
- Qualquer leitura dos limiares de demo como limites oficiais da NASA.

## Próximos passos

- [Jornadas de usuário e papéis](/pt/product/user-journeys): o caminho de cada persona na tela.
- [Matriz de status das funcionalidades](/pt/overview/feature-status): o que existe e o que é plano.
- [Uso responsável](/pt/overview/responsible-use): os limites do apoio à decisão.
