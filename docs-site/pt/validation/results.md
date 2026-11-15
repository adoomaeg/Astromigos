---
title: Resultados e evidências
description: Resultados medidos da Astronaut Health Intelligence Platform. Avaliação do motor (evaluation.json), testes, desempenho observado e checagens de fontes, com o que cada número significa.
status: IMPLEMENTED
origin: SIMULATED
code:
  - frontend/web/src/engine/evaluation.json
  - frontend/web/scripts/evaluate.ts
tests:
  - frontend/web/src/engine/engine.test.ts
verified: 2026-11-14
---

# Resultados e evidências

Esta é a página canônica dos números medidos da Astronaut Health Intelligence Platform (AHI). Cada número indica de onde veio.

::: warning ATENÇÃO
Todos os resultados do motor vêm de **dados simulados** e medem as regras do protótipo contra o **mesmo simulador** que gerou os dados. Mostram consistência interna, **não desempenho clínico**. Veja [Estratégia de validação](/pt/validation/strategy).
:::

## Resumo

| Evidência | Resultado | Fonte |
| --- | --- | --- |
| Testes automatizados | 143 testes em 17 arquivos, todos passando | `npm test` em 14/11/2026 |
| Validação do atlas de anatomia | Passa nos arquivos publicados: 250 estruturas em 9 arquivos GLB, 880.356 triângulos, 4,64 MB | `npm run anatomy:validate` em 14/11/2026 |
| Checagem de tipos | Limpa | `npx tsc -b` |
| Build de produção | Ok | `npx vite build` |
| Alertas falsos no cenário nominal | 0 por dia-tripulante, em 60 dias-tripulante | `evaluation.json` |
| Detecção dos 5 cenários anormais | Todos detectados, com o nível de pico esperado | `evaluation.json` |

## Avaliação do motor

Gerada por `npm run evaluate` (`frontend/web/scripts/evaluate.ts`) em `2026-11-14T12:17:47.455Z`, motor `ahi-engine 2.0.0`. Grava `src/engine/evaluation.json` e `docs/model-card.md`.

### Alertas falsos no cenário nominal

No cenário nominal não há problema simulado, então **todo alerta seria falso**.

| Medida | Valor |
| --- | --- |
| Sementes | 5 (`20261114` a `20261118`) |
| Tempo simulado | 72 h por semente, 4 pessoas: 1440 horas-tripulante, ou 60 dias-tripulante |
| Grade da análise | A cada 15 min simulados |
| Alertas da tripulação em HIGH ou acima por dia-tripulante | **0** |
| Alertas da tripulação em MODERATE ou acima por dia-tripulante | **0** |
| Alertas por regra | nenhum |
| Alertas da cabine | 0 |
| Maior nível de atenção atingido | MODERATE |
| Tempo em LOW / MODERATE / HIGH / CRITICAL | 99,97% / 0,03% / 0% / 0% |

O model card gerado arredonda o tempo para 100,0% e 0,0%. O nível MODERATE de 0,03% do tempo vem de status, não de alerta.

### Detecção por cenário

Minutos a partir do início do cenário (08:00 UTC simulado), medidos na grade da avaliação.

| Cenário | Alvo | Grade | Primeiro alerta (regra) | HIGH | CRITICAL | Pico (escore) | Duração simulada |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ACUTE_CARDIO` | AST-01 | 1 min | 7 min (R-HR-01) | 7 min | 7 min | CRITICAL (100) | 3 h |
| `SENSOR_FAILURE` | AST-03 | 1 min | 14 min (R-DQ-02) | não atinge | não atinge | MODERATE (20) | 3 h |
| `ENVIRONMENTAL_CO2` | cabine | 5 min | 90 min (R-ENV-CO2-01) | 140 min (2,3 h) | não atinge | HIGH (77) | 12 h |
| `PROGRESSIVE_FATIGUE` | AST-02 | 15 min | 1905 min (31,8 h, R-FAT-01) | 2010 min (33,5 h) | não atinge | HIGH (79) | 96 h |
| `PERFORMANCE_DECLINE` | AST-04 | 15 min | 1650 min (27,5 h, R-EX-01) | 4530 min (75,5 h) | não atinge | HIGH (45) | 120 h |

No cenário de cabine, o nível é o pior entre o status da cabine e o da tripulação.

### Como ler

- **Padrões lentos ficam em HIGH por projeto.** CRITICAL exige uma regra aguda CRITICAL; fadiga e queda de desempenho pedem revisão, não emergência.
- **A falha de sensor deve parar em MODERATE.** É um caso de qualidade do dado: status desconhecido, nunca "normal".
- **Autorrelato nunca dispara alerta**, então não aparece nesta tabela.
- **A grade importa.** Um tempo de 7 min numa grade de 1 min é mais preciso que 1905 min numa grade de 15 min.

## Testes automatizados

143 testes em 17 arquivos, todos passando em 14/11/2026. A lista arquivo por arquivo está em [Estratégia de testes](/pt/engineering/testing).

## Desempenho observado

Medidas observadas pela equipe em um único notebook de desenvolvimento (AMD Ryzen 5 3500U, gráficos integrados Radeon Vega 8). **Não são benchmarks formais** nem foram repetidas em outras máquinas.

**Visualizador do atlas 3D** (Chrome sem interface, taxa de quadros limitada a 60 pelo vsync). A tabela completa, com draw calls e triângulos por quadro, está em [Renderização da anatomia 3D](/pt/architecture/anatomy-3d#performance-observations).

| Medida | Valor |
| --- | --- |
| Quadros por segundo, sistemas padrão | 58 a 60 fps |
| Quadros por segundo, os nove sistemas | 56 a 59 fps |
| Quadros por segundo, "Ground view" em 1440x900 | 55 a 57 fps |
| Quadros por segundo, "Ground view" com o detalhe de um sistema aberto | 39 a 42 fps (o limite é o painel de detalhe: o visualizador procedural anterior mediu 38 no mesmo estado) |
| Picking de hover | 0,4 a 2,8 ms por raio |
| Atlas na tela depois da navegação, com cache do navegador aquecido | 2,4 a 3,6 s |
| Tamanho do atlas | 4,64 MB em 9 arquivos (880.356 triângulos); a vista padrão baixa 8 arquivos, cerca de 3,0 MB |

**Motor e app.** As três primeiras linhas foram medidas antes de o visualizador do atlas substituir o corpo procedural e não foram medidas de novo.

| Medida | Valor |
| --- | --- |
| Quadros por segundo a 60x (corpo procedural) | 58 a 60 fps |
| Quadros por segundo a 3600x (corpo procedural) | cerca de 45 fps |
| Altura do corpo 3D com alerta CRITICAL em 1280x720 (corpo procedural) | de 247 para 359 px depois da faixa sobreposta |
| Geração do histórico inicial | cerca de 1,2 s com cache aquecido; 2 a 3 s a frio |
| Projeção "e se" | menos de 5 ms por chamada |

## Checagem das fontes da NASA

Consultas ao vivo em 14/11/2026, sem chave de API:

| Fonte | Resultado |
| --- | --- |
| NASA OSDR | APIs acessíveis; OSD-569 e OSD-575 importados com SHA-256 |
| NASA EDA | API lista 24 missões de payload (só metadados); telemetria em CSV pela aba "Data Tables", com campos como `CO2_ppm_ISS` e `CO2_ppm_Ground` e doses GCR e SAA |
| NASA RadLab | HTTP 500 em todas as rotas testadas |
| NLSP, Standard Measures, Artemis II Standard Measures, perigos do HRP | Páginas acessíveis |

Detalhes em [Fontes de dados da NASA](/pt/data/sources).

## O que não foi medido

- Sensibilidade e especificidade em dados reais.
- Cobertura real do intervalo de 80% da previsão.
- Usabilidade com tripulantes ou médicos de voo.
- Desempenho em outras máquinas, navegadores ou telas.
- Revisão anatômica do atlas 3D por especialista: o modelo é usado como publicado pelo Z-Anatomy, simplificado pelo pipeline de assets.

## Próximos passos

- [Model card](/pt/validation/model-card).
- [Limitações e problemas conhecidos](/pt/validation/limitations).
- [Matriz de rastreabilidade](/pt/validation/traceability).
