---
title: Estrutura do projeto
description: Pastas e arquivos do repositório da Astronaut Health Intelligence Platform, com o papel de cada um.
status: IMPLEMENTED
code:
  - frontend/web/src/types/domain.ts
  - frontend/web/src/engine/config.ts
  - frontend/web/src/state/store.ts
verified: 2026-11-14
---

# Estrutura do projeto

O repositório da Astronaut Health Intelligence Platform (AHI) tem três partes: o **app** (`frontend/web`), os **dados reais** com proveniência (`data/`) e a **documentação** (`docs/` e este portal em `docs-site/`).

## Árvore

```text
.
├── CLAUDE.md                 regras do projeto para agentes de código
├── PROJECT_MASTER.md         especificação completa de produto, dados e arquitetura (pt-BR)
├── README.md
├── LICENSE                   MIT
├── .github/workflows/
│   ├── ci.yml                lint, tipos, testes e build do app (só quando o app muda)
│   ├── docs-check.yml        build do portal em pull requests (links quebrados reprovam)
│   └── docs-deploy.yml       build e publicação do portal no GitHub Pages
├── data/
│   ├── raw/<OSD>/            arquivos originais do OSDR, byte a byte
│   ├── manifests/            proveniência (SHA-256, URLs, versões) e log de importação
│   └── processed/            formato longo canônico
├── docs/                     demo-script, model-card (gerado), inventário de fontes, guia de dados,
│                             guia dos assets de anatomia
├── docs-site/                portal VitePress (inglês na raiz, português em /pt/)
└── frontend/web/
    ├── index.html            página do app
    ├── anatomy-lab.html      página de desenvolvimento do corpo 3D
    ├── features-lab.html     página de desenvolvimento das telas v2
    ├── public/
    │   └── anatomy/          atlas 3D: nove *.glb (um por sistema anatômico), manifest.json e
    │                         LICENSE.md (CC BY-SA 4.0). Gerado, nunca editado à mão
    ├── scripts/
    │   ├── evaluate.ts       avaliação do motor (npm run evaluate)
    │   ├── anatomy/          pipeline de assets (npm run anatomy:build): build.mjs, fetch-source.mjs,
    │   │                     export_atlas.py (Blender), build-kidneys.ts, optimize.mjs, validate.mjs,
    │   │                     decode-for-preview.mjs, render_previews.py
    │   └── osdr/             descoberta e importação do NASA OSDR
    ├── .cache/anatomy/       pasta de trabalho do pipeline (fonte, exportação bruta, previews); ignorada pelo git
    └── src/
        ├── app/              App, atalhos, estado de interface
        ├── components/       componentes compartilhados (gráfico, status, sparkline, medidor)
        ├── data/             painéis OSDR compactos e loader tipado
        ├── engine/           simuladores, baseline, anomalia, risco, previsão, recomendações
        │   └── sim/          perfis, cronograma, fisiologia, cabine, cenários, adapters
        ├── features/         telas: anatomy, attention, alerts, timeline, comms, checkin,
        │                     mission, report, whatif, datasources, crewview, tour, topbar...
        ├── lib/              status (cores e rótulos), exportação FHIR
        ├── state/            store zustand e relógio da simulação
        └── types/domain.ts   contrato compartilhado
```

## Arquivos-chave

| Arquivo ou pasta | Papel | Regra |
| --- | --- | --- |
| `src/types/domain.ts` | Contrato único entre motor, store e interface | **Só mudanças aditivas** |
| `src/engine/config.ts` | Todo número ajustável, versões e limiares fixos | Limiares rotulados como "demo configuration, not an official limit" |
| `src/engine/catalog.ts` | Métricas, regiões, tripulação, missão, cenários, perfis de comunicação | Faixa de exibição não é limite clínico |
| `src/engine/engine.ts` | `HealthEngine`, o orquestrador | |
| `src/engine/evaluation.json` | Resultado da avaliação | Gerado por `npm run evaluate`, não editar à mão |
| `src/state/store.ts` | Implementa `AppState`; `startTicker()` move o relógio | API estável: `useAppStore`, `startTicker` |
| `src/lib/status.ts` | Cores e rótulos de status | Cor nunca sozinha |
| `src/features/anatomy/` | Corpo 3D: `atlas/` (contrato do manifesto, mapeamento de saúde), `viewer/` (visualizador do atlas), `procedural/` (modelo de fallback) | A ligação entre anatomia e saúde fica só em `atlas/health.ts` ([Anatomia 3D](/pt/architecture/anatomy-3d#component-map)) |
| `src/features/attention/` | Painel de atenção, detalhe do sistema, detalhe da estrutura, alertas e sinalizações | [Tour do produto](/pt/product/product-tour#selecting-a-structure) |
| `public/anatomy/` | Arquivos publicados do atlas | Licença CC BY-SA 4.0 (o código é MIT); gerados por `npm run anatomy:build` ([Assets de anatomia 3D](/pt/data/anatomy-assets)) |
| `scripts/anatomy/` | Pipeline de assets de anatomia | Precisa do Blender 4.5 LTS; `npm run anatomy:validate` confere o resultado |
| `docs/anatomy-assets.md` | Guia completo dos assets de anatomia (proveniência, regras, rebuild) | Versão de site em [Assets de anatomia 3D](/pt/data/anatomy-assets) |
| `docs/model-card.md` | Model card oficial | Gerado por `npm run evaluate` |
| `docs/data-guide.md` | Guia do time de dados (pt-BR) | Versão de site em [Pipeline e qualidade](/pt/data/pipeline-and-quality) |
| `docs/data-source-inventory.md` | Relatórios de adequação de cada fonte | |

## Testes

Os 17 arquivos de teste ficam ao lado do código que testam (`*.test.ts` em `src/engine/`, `src/lib/`, `src/state/` e `src/features/anatomy/atlas/`). Lista e cobertura em [Estratégia de testes](/pt/engineering/testing).

## Portal de documentação

```text
docs-site/
├── .vitepress/
│   ├── config.mts            navegação, barra lateral, idiomas, busca, Mermaid
│   └── theme/                tema, CSS e componentes (StatusBadge, OriginBadge, CodeLink, PageMeta)
├── public/                   logo, favicon e capturas de tela reais (screenshots/)
├── *.md, overview/, data/, intelligence/, architecture/, product/, engineering/,
│   validation/, resources/, science/        páginas em inglês
└── pt/                       as mesmas páginas em português, com os mesmos caminhos
```

Detalhes em [Documentação e deploy](/pt/engineering/deployment).

## Próximos passos

- [Padrões, contratos e extensões](/pt/engineering/contributing).
- [Visão geral da arquitetura](/pt/architecture/overview).
- [Estratégia de testes](/pt/engineering/testing).
