---
title: Documentação e deploy
description: Como o portal de documentação da Astronaut Health Intelligence Platform é construído com VitePress e publicado no GitHub Pages por GitHub Actions, e o que não é implantado.
status: IMPLEMENTED
code:
  - .github/workflows/docs-deploy.yml
  - .github/workflows/ci.yml
  - .github/workflows/docs-check.yml
  - docs-site/package.json
  - docs-site/.vitepress/config.mts
verified: 2026-11-14
---

# Documentação e deploy

## O que é publicado

| Artefato | Onde | Status |
| --- | --- | --- |
| Portal de documentação (este site) | GitHub Pages: https://lucaspalharesbarbosa.github.io/astronaut-health-intelligence-platform/ | <StatusBadge status="IMPLEMENTED" /> |
| App da Astronaut Health Intelligence Platform | Só local (`npm run dev` ou `npm run preview`) | <StatusBadge status="NOT_IMPLEMENTED" /> como implantação pública |
| Backend, API, banco | Não existem | <StatusBadge status="PLANNED" /> ([Arquitetura alvo](/pt/architecture/target-architecture)) |

O app gera um build estático (`npx vite build` em `frontend/web/dist`) que poderia ser servido por qualquer hospedagem estática, mas nenhuma implantação pública do app está configurada neste repositório.

## O portal

| Item | Detalhe |
| --- | --- |
| Gerador | VitePress 1.6.4, com `vitepress-plugin-mermaid` e Mermaid 11 |
| Pasta | `docs-site/` |
| Idiomas | Inglês na raiz; português do Brasil em `/pt/`, com os **mesmos caminhos** |
| Base | `/astronaut-health-intelligence-platform/` |
| URLs | Limpas (`cleanUrls`), sem `.html` |
| Busca | Local, com textos traduzidos para o português |
| Diagramas | Blocos de código com a linguagem `mermaid` |
| Notas de rodapé | `markdown-it-footnote`, para referências científicas |
| Links quebrados | O build falha com link interno quebrado (links para `localhost` são ignorados) |

### Componentes do tema

O tema estende o tema padrão do VitePress com componentes globais:

| Componente | Uso |
| --- | --- |
| `PageMeta` | Lê o frontmatter da página e mostra trilha de navegação, status, origem, arquivos de código, testes e data de verificação |
| `<StatusBadge status="..." />` | Selo de status: <StatusBadge status="IMPLEMENTED" /> <StatusBadge status="EXPERIMENTAL" /> <StatusBadge status="PLANNED" /> <StatusBadge status="CONCEPTUAL" /> <StatusBadge status="NOT_IMPLEMENTED" /> |
| `<OriginBadge origin="..." />` | Selo de origem: <OriginBadge origin="REAL_PUBLIC, DERIVED, SIMULATED, MANUAL" /> |
| `<CodeLink path="..." />` | Link para um arquivo do repositório no GitHub, por exemplo <CodeLink path="frontend/web/src/engine/risk.ts" /> |

### Contrato de frontmatter

```yaml
---
title: Baseline pessoal           # título (igual ao H1)
description: Uma frase para busca e SEO.
status: IMPLEMENTED               # IMPLEMENTED | EXPERIMENTAL | PLANNED | CONCEPTUAL | NOT_IMPLEMENTED | DEPRECATED
origin: SIMULATED                 # REAL_PUBLIC | DERIVED | SIMULATED | MANUAL (vários separados por vírgula)
code:
  - frontend/web/src/engine/baseline.ts
tests:
  - frontend/web/src/engine/baseline.test.ts
verified: 2026-11-14              # data da última conferência contra o código ou a fonte
---
```

## Rodar localmente

```bash
cd docs-site
npm install
npm run docs:dev       # servidor de desenvolvimento
npm run docs:build     # build em docs-site/.vitepress/dist
npm run docs:preview   # serve o build
```

## Publicação automática

```mermaid
flowchart LR
    PUSH[push em master<br/>alterando docs-site/] --> JOB[Job único Build and deploy<br/>npm ci, docs:build]
    JOB --> ART[Artefato do Pages<br/>.vitepress/dist]
    ART --> DEPLOY[actions/deploy-pages<br/>no mesmo job]
    DEPLOY --> SITE[GitHub Pages]
```

O workflow `docs-deploy.yml`:

- roda em push para `master` que altera `docs-site/**` ou o próprio workflow, e também manualmente (`workflow_dispatch`);
- usa permissões mínimas (`contents: read`, `pages: write`, `id-token: write`);
- faz uma implantação por vez, sem cancelar uma em andamento;
- usa Node 22 com cache do npm;
- faz build e publicação num único job ("Build and deploy"), em uma só máquina, com limite de 10 minutos.

Configuração necessária uma vez no repositório: **Settings > Pages > Build and deployment > Source = "GitHub Actions"**.

Os workflows só rodam quando mudam os arquivos que eles verificam (filtros de caminho), com limite de 10 minutos e cancelamento de execuções superadas:

| Workflow | Quando roda | O que faz |
| --- | --- | --- |
| `ci.yml` (app) | Push e pull request para `master` que alteram `frontend/web/**` | `npm ci`, `npm run lint` (oxlint: erro reprova, aviso só é reportado), `npx tsc -b`, `npm test`, `npx vite build` |
| `docs-check.yml` (portal) | Pull request para `master` que altera `docs-site/**` | `npm ci`, `npm run docs:build` (falha com link interno quebrado) |
| `docs-deploy.yml` | Push para `master` que altera `docs-site/**` | O mesmo build e, em seguida, a publicação; em `master` esse build é o portão, então o portal não é compilado duas vezes no mesmo push |

Um push que muda só o README, a especificação, `docs/` ou outros arquivos que não são código não dispara nenhum workflow.

::: info Proteção de branch
Workflows com filtro de caminho não reportam status quando não rodam. Se um dia a proteção de branch exigir essas checagens, adicione um job de resumo que sempre roda (ou um filtro de caminho dentro de um único workflow), para que pull requests sem alteração nesses caminhos não fiquem esperando.
:::

Detalhes dos testes em [Estratégia de testes](/pt/engineering/testing#ci).

## Regras de escrita do portal

- Nome oficial na primeira menção: **Astronaut Health Intelligence Platform**; depois, "AHI".
- Sem travessão nem meia-risca em nenhum texto.
- Cada página de funcionalidade declara status e, quando mostra dados, origem.
- Rótulos da interface ficam em inglês, entre aspas ou em código, com a explicação em português.
- Capturas de tela só reais (`docs-site/public/screenshots/`), nunca montagens.
- Diagramas conceituais levam a legenda "Conceitual (não implementado)".

## Próximos passos

- [Configuração, comandos e problemas](/pt/engineering/quick-start).
- [Padrões, contratos e extensões](/pt/engineering/contributing#documentacao).
- [Estrutura do projeto](/pt/engineering/project-structure).
