---
title: Governança e privacidade
description: Pseudonimização, licenças, acesso controlado, dados análogos, armazenamento local e regras de governança da Astronaut Health Intelligence Platform.
status: IMPLEMENTED
origin: SIMULATED, REAL_PUBLIC
code:
  - frontend/web/src/lib/fhir.ts
  - frontend/web/src/engine/catalog.ts
  - frontend/web/scripts/osdr/import.mjs
tests:
  - frontend/web/src/lib/fhir.test.ts
verified: 2026-11-14
---

# Governança e privacidade

Esta página reúne as regras de governança de dados da Astronaut Health Intelligence Platform (AHI). Elas vêm do `PROJECT_MASTER.md` (seção 17) e valem para código, dados, interface e documentação.

## As 12 regras do documento mestre

| # | Regra | Como a AHI cumpre hoje |
| --- | --- | --- |
| 1 | Não importar dados pessoais identificáveis sem autorização | Só pseudônimos: `AST-01` a `AST-04` na tripulação simulada, C001 a C004 nos datasets reais |
| 2 | Respeitar termos, licenças e restrições | Licença registrada no manifesto; quando a fonte não informa, fica `null` com "not stated". A anatomia 3D mantém a licença CC BY-SA 4.0 e a atribuição ([Licenças de terceiros](#third-party-licenses)) |
| 3 | Não contornar controles de acesso do OSDR | Só arquivos tabulares processados e públicos; nenhum dado de acesso controlado foi pedido |
| 4 | Usar pseudônimos nos dados de demonstração | Callsigns fictícios (ORION, LYRA, VEGA, ATLAS) |
| 5 | Não registrar informação sensível desnecessária em logs | Não há backend nem logs de servidor; a auditoria vive na memória do navegador |
| 6 | Não tratar dados de animais como humanos | Missões de roedores e plantas do EDA são tratadas como dado de **ambiente**, nunca de tripulação |
| 7 | Não apresentar estudos análogos como astronautas | Proposta de `metadata.population_type` com `ANALOG_PARTICIPANT` |
| 8 | Versionar modelos, parâmetros e regras | Versões do motor, do modelo de risco, da baseline, da previsão e do catálogo de recomendações em `config.ts` |
| 9 | Permitir rastrear de qual dado veio cada alerta | Cada alerta guarda regra, métrica e pessoa; a auditoria registra cada passo |
| 10 | Exibir limitações e incerteza | Confiança no status, intervalo de 80% na previsão, limitações no model card |
| 11 | Exigir validação humana para decisões de saúde | Itens HIGH e CRITICAL exigem revisão humana |
| 12 | Usar IA generativa só para explicação controlada | Não há IA generativa hoje; a camada planejada segue as regras de [IA e análise](/pt/intelligence/ai-and-analytics) |

## Pseudonimização

- A tripulação usa só identificadores pseudonimizados (`AST-01` a `AST-04`) e callsigns fictícios. Idade e sexo de cada perfil são valores de simulação.
- Os datasets reais usam os pseudônimos da fonte (C001 a C004). Nenhuma tentativa é feita de ligá-los a pessoas reais.
- O corpo 3D é um único modelo de referência, mostrado para todos os tripulantes. Não é um exame de ninguém e não contém dado pessoal.
- A exportação FHIR gera recursos `Patient` **só com identificadores pseudonimizados**: sem nome, data de nascimento, gênero ou outro dado pessoal. Isso é coberto por teste ("pseudonymizes patients (no PII fields)").

## Licenças e acesso

- Os metadados do OSDR para OSD-569 e OSD-575 **não informam licença**. A AHI registra `license: null` e não presume nenhuma.
- Os arquivos foram baixados anonimamente pela API pública do OSDR. Detalhes em [Catálogo de datasets](/pt/data/dataset-catalog#licenca-e-acesso).
- O código do projeto usa a licença MIT (arquivo `LICENSE` na raiz). A licença do código não se aplica aos dados nem aos assets de terceiros.

### Licenças de terceiros {#third-party-licenses}

| Material | Licença | Obrigação |
| --- | --- | --- |
| Código da aplicação | MIT (`LICENSE` na raiz do repositório) | Manter o aviso de licença |
| Arquivos de anatomia 3D (`frontend/web/public/anatomy/*.glb`, `manifest.json`) | **CC BY-SA 4.0**, derivados do Z-Anatomy, que se baseia no BodyParts3D (CC BY-SA 2.1 Japan) | Manter a atribuição, indicar as alterações e compartilhar os derivados sob a mesma licença. A licença MIT não cobre esses arquivos |
| Datasets do NASA OSDR (OSD-569, OSD-575) | Não informada pela fonte | Registrada como "not stated"; nenhuma licença é presumida |

Os arquivos de anatomia levam o seu próprio `LICENSE.md`, o app mostra a atribuição sob o corpo 3D, e o conteúdo da fonte com licença não comercial (ouvido, rim) fica fora dos arquivos. Registro completo: [Assets de anatomia 3D](/pt/data/anatomy-assets#license-and-attribution).

## Onde os dados ficam

| Dado | Onde fica | Sai do navegador? |
| --- | --- | --- |
| Estado da simulação, alertas, auditoria, check-ins, mensagens | Memória do navegador (store zustand) | Não. Some ao recarregar |
| Preferências (visão, modo apresentação, som de alerta) | `localStorage` | Não |
| Atlas de anatomia 3D | Arquivos estáticos do app (`public/anatomy/`); geometria em cache na memória durante a sessão | Não. É anatomia de referência, sem dado pessoal |
| Geometria do modelo procedural de fallback (só no build de produção, e só se o atlas falhar) | IndexedDB (`ahi-anatomy`) | Não |
| Bundle FHIR exportado | Arquivo baixado pela pessoa | Só se a pessoa enviar o arquivo |
| Painéis do OSDR | Empacotados no app (`src/data/`) | Não |

O app não envia dados para servidor algum. As fontes tipográficas são carregadas do Google Fonts no `index.html`, o que gera uma requisição externa sem dados de saúde. Todo o resto, inclusive os arquivos de anatomia 3D, vem do próprio app (sem CDN).

## Dados análogos, animais e astronautas

Estudos em solo que imitam o voo (HERA, repouso no leito, confinamento) são valiosos, mas **não são dados de astronautas**.

- Nunca apresentar resultados de estudos análogos como resultados de astronautas.
- Nunca tratar dados de animais (as missões de roedores do EDA) ou de culturas de células como dados humanos.
- Os dados de cabine do EDA são do **ambiente** da ISS em missões de payload, não da tripulação.
- Os datasets reais atuais vêm de **quatro pessoas em um voo comercial de 3 dias** (Inspiration4): não representam tripulações de longa duração.

## Lacunas de governança

| Item | Status |
| --- | --- |
| Autenticação e controle de acesso por papel | <StatusBadge status="PLANNED" /> |
| Auditoria persistente e imutável | <StatusBadge status="PLANNED" /> |
| TLS e gestão de segredos em ambiente publicado (não há backend) | <StatusBadge status="PLANNED" /> |
| Política de retenção de dados | <StatusBadge status="PLANNED" /> |
| Revisão ética ou clínica formal | Não realizada |

## Próximos passos

- [Uso responsável](/pt/overview/responsible-use): os limites do apoio à decisão.
- [Origens e proveniência](/pt/data/data-origins).
- [Arquitetura alvo](/pt/architecture/target-architecture): autenticação, RBAC e persistência planejados.
