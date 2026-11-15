---
title: Catálogo de datasets
description: Os datasets reais importados pela Astronaut Health Intelligence Platform (OSD-569 e OSD-575, Inspiration4), com proveniência, variáveis, qualidade e limitações.
status: IMPLEMENTED
origin: REAL_PUBLIC, DERIVED
code:
  - frontend/web/scripts/osdr/import.mjs
  - frontend/web/src/data/osdr.ts
  - frontend/web/src/data/OSD-569.json
  - frontend/web/src/data/OSD-575.json
  - frontend/web/src/features/datasources/RealDatasetsTab.tsx
verified: 2026-11-14
---

# Catálogo de datasets

Esta é a página canônica de proveniência dos datasets reais usados pela Astronaut Health Intelligence Platform (AHI). Hoje são dois, ambos do NASA Open Science Data Repository (OSDR) e da missão Inspiration4.

::: warning ATENÇÃO
Os datasets reais são **referência histórica**. Não são telemetria ao vivo, não são a tripulação mostrada, não calibram baselines, não treinam modelos e não definem limiares. Toda leitura de dispositivo da tripulação continua `SIMULATED`.
:::

## Resumo

| Accession | Conteúdo | Origem | Pontos de coleta | Sujeitos | Status na AHI |
| --- | --- | --- | --- | --- | --- |
| OSD-569 | Hemograma completo (CBC), 20 analitos | <OriginBadge origin="REAL_PUBLIC" /> | 7, todos em solo | 4 (C001 a C004) | <StatusBadge status="IMPLEMENTED" /> exibido como referência |
| OSD-575 | Painel metabólico completo (CMP), 19 analitos (17 exibidos) | <OriginBadge origin="REAL_PUBLIC" /> | 7, todos em solo | os mesmos 4 | <StatusBadge status="IMPLEMENTED" /> exibido como referência |
| Médias de grupo | Média aritmética por ponto de coleta, sexos agrupados | <OriginBadge origin="DERIVED" /> | | | <StatusBadge status="IMPLEMENTED" /> |

## Por que estes dois datasets

São os únicos arquivos de voo espacial humano encontrados que são pequenos, tabulares, clinicamente significativos, com unidades explícitas e faixas de referência do laboratório por linha, e que acompanham as mesmas pessoas antes e depois do voo. Ambos vêm do mesmo programa de biospecimens da Inspiration4 (protocolo IRB Weill Cornell 21-05023569; os metadados dizem que todos os tripulantes consentiram com o compartilhamento).

Foram preferidos os arquivos `SUBMITTED` aos `TRANSFORMED`: estão em formato longo com coluna `UNITS` explícita, enquanto o arquivo transformado do hemograma codifica a unidade no nome da coluna e rotula a hemoglobina como `hemoglobin_value_percent`, embora a unidade enviada seja g/dL.

## OSD-569: hemograma completo (CBC)

| Campo | Valor |
| --- | --- |
| Fonte | NASA Open Science Data Repository (OSDR) |
| Página do estudo | https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 |
| Versão dos metadados | OSDR metadata version 4; liberação pública em 14-May-2024 |
| Arquivo | `LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv` (26.138 bytes) |
| SHA-256 | `10a878b009eb…` (valor completo em `data/manifests/OSD-569.json`) |
| População | 4 sujeitos, C001 a C004 (2 mulheres e 2 homens segundo os metadados das amostras); a descrição diz "four private astronauts". Idade não informada |
| Desenho | Medidas repetidas, mesmos 4 sujeitos, 7 pontos em solo: L-92, L-44, L-3, R+1, R+45, R+82, R+194. Sem amostras em voo neste arquivo |
| Ensaio | Sangue total em tubo K2 EDTA, Quest Diagnostics código 6399, analisador Sysmex XN |
| Conteúdo | 553 linhas, 20 analitos (leucócitos, hemácias, hemoglobina, hematócrito, VCM, HCM, CHCM, RDW, plaquetas, VPM, 5 contagens diferenciais absolutas e 5 percentuais), com unidades e faixas de referência do laboratório |

## OSD-575: painel metabólico completo (CMP)

| Campo | Valor |
| --- | --- |
| Página do estudo | https://osdr.nasa.gov/bio/repo/data/studies/OSD-575 |
| Versão dos metadados | OSDR metadata version 3; liberação pública em 14-May-2024 |
| Arquivo | `LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv` (25.275 bytes) |
| SHA-256 | `dab247eb794e…` (valor completo em `data/manifests/OSD-575.json`) |
| População | Os mesmos 4 sujeitos C001 a C004 (2 mulheres e 2 homens); idade não informada |
| Desenho | Os mesmos 7 pontos no arquivo (L-92, L-44, L-3, R+1, R+45, R+82, R+194) |
| Ensaio | Soro fresco (tubo separador de soro), Quest Diagnostics código 10231, Beckman Coulter AU5800 |
| Conteúdo | 531 linhas, 19 analitos (glicose, ureia (BUN), creatinina, relação BUN/creatinina, sódio, potássio, cloreto, CO₂, cálcio, proteína total, albumina, globulina, relação A/G, bilirrubina total, fosfatase alcalina, AST, ALT e duas variantes de eGFR) |

Rótulos de tempo: `L-n` significa n dias antes do lançamento; `R+n`, n dias depois do retorno.

## Candidatos rejeitados (resumo)

| Accession | Motivo |
| --- | --- |
| OSD-656 (urina, NULISAseq) | Contagens relativas, sem unidade clínica |
| OSD-571, OSD-570, OSD-687, OSD-574 | Ômicas, fora do escopo de um painel |
| OSD-572, OSD-573, OSD-630 | Microbiota, não fisiologia humana |
| OSD-53, OSD-903, OSD-943, OSD-530, OSD-353, OSD-359, OSD-174 | Ômicas, sem tabela clínica |
| OSD-542, OSD-140, estudos de repouso no leito | Análogos de solo (exigiriam rótulo próprio) e ômicas |
| Diversos estudos de linhagens celulares e organoides | Não são pessoas |

Os painéis multiplex do OSD-575 (Eve e Alamar) não foram importados: os valores são normalizados pela média pré-voo da tripulação (relativos, sem unidade) e seriam difíceis de explicar em um painel.

## Importação e reprodutibilidade

```bash
# dentro de frontend/web, Node 20+, sem dependências extras
node scripts/osdr/discover.mjs   # busca e lista arquivos -> data/manifests/osdr-discovery.json
node scripts/osdr/import.mjs     # baixa, calcula hash, faz parse, grava manifestos e JSON processado
```

- Os scripts só acessam hosts `https://` de uma lista permitida (osdr.nasa.gov, visualization.osdr.nasa.gov, api.nasa.gov, science.nasa.gov, www.nasa.gov). O download do OSDR redireciona para o bucket `genelab-alsda-repo-prod.s3.amazonaws.com`, aceito **só** como destino de redirecionamento emitido pelo osdr.nasa.gov.
- Arquivos baixados são dados não confiáveis: são só hasheados e lidos como texto, nunca executados.

| Caminho | Conteúdo |
| --- | --- |
| `data/raw/<OSD>/` | CSV original byte a byte, mais as respostas da API |
| `data/manifests/<OSD>.json` | Registro de dataset, arquivos com URL, tamanho, SHA-256 e hora do download, protocolo, contagens de qualidade, divergências |
| `data/manifests/import-log.json` | Último job de importação e hashes |
| `data/processed/<OSD>.observations.json` | Formato longo, uma linha por linha da fonte, `data_origin: REAL_PUBLIC` |
| `frontend/web/src/data/<OSD>.json` | Painel compacto para a interface (cerca de 25 KB cada), com médias de grupo `DERIVED` |
| `frontend/web/src/data/osdr.ts` | Loader tipado (carregado sob demanda) e descrições simples dos analitos |

Regras do parser (`ahi-osdr-import 1.0.0`):

- valores mantidos exatamente como informados; células não numéricas (22: 21 `NA` na relação BUN/creatinina e 1 de bilirrubina total) ficam `null` com o texto bruto; **nada é imputado**;
- variantes de nome de analito (por exemplo `HEMOGLOBIN (FEMALE)`) só são unidas quando a unidade é idêntica; o script falha com unidades misturadas;
- o sexo no arquivo é conferido com os metadados ISA; a importação falha se divergirem ou se algum sujeito não for Homo sapiens;
- as duas linhas de eGFR (equações baseadas em raça) ficam nos arquivos brutos e longos, mas **não são exibidas**;
- médias de grupo são `DERIVED` (média aritmética de quem tem valor naquele ponto, sexos agrupados).

Qualidade: CBC com 553 de 560 células esperadas (7 linhas faltando, a maioria HCM e CHCM); CMP com 17 analitos exibidos, relação BUN/creatinina quase toda `NA` na fonte. A descrição do OSD-575 lista os pontos pós-voo R+1, R+45 e R+82, mas o arquivo e a lista de amostras também têm R+194: exibido como está no arquivo e sinalizado no manifesto.

## Licença e acesso

- Os metadados do estudo não têm campo de licença: **licença não informada**, registrada como `license: null`.
- Os dois arquivos foram baixados anonimamente pela API pública do OSDR. Segundo o FAQ do OSDR, a maior parte dos dados é acessível sem autenticação e estudos com dados de astronautas têm dados processados públicos, enquanto dados de sequenciamento são de acesso controlado. **Só arquivos tabulares processados foram usados**; nenhum dado de acesso controlado foi pedido ou tocado.
- Os códigos de sujeito são os pseudônimos da fonte. Nenhuma tentativa é feita de ligá-los a pessoas. Dados de outras pessoas nunca são misturados à tripulação simulada.

## Como o dado real aparece no app

![Hemograma real da Inspiration4 com proveniência, no diálogo Data and model](/screenshots/data-model.png)

Em "Tools" > "Data and model" > "Real datasets":

- um aviso fixo: "Historical public research data. Not live telemetry and not this crew.";
- o selo `REAL_PUBLIC` e a proveniência completa (fonte, missão, população, desenho, coleta, protocolo do ensaio, SHA-256 copiável, data de download, versão, liberação, licença, acesso, parser e completude);
- um gráfico por analito, com os 4 sujeitos e a média do grupo (`DERIVED`, "sexes pooled");
- o voo de 3 dias aparece como **lacuna**: não há amostras em voo nesses arquivos;
- as faixas de referência são as que o laboratório imprimiu no arquivo. **Não são limites da NASA** e a AHI não as usa para status nem alertas.

## Limitações dos datasets

- **Quatro pessoas** em um voo comercial de **3 dias**. Não representam tripulações de longa duração e não permitem afirmação estatística.
- **Sem amostras em voo** nesses arquivos: só antes do lançamento e depois do retorno.
- Idade dos sujeitos não informada; licença não informada.
- Faixas de referência são do laboratório que fez o exame, não limites da NASA.
- As duas linhas de eGFR usam equações baseadas em raça e não são exibidas.

## Próximos passos

- [Fontes de dados da NASA](/pt/data/sources): como a descoberta foi feita e o status das outras fontes.
- [Pipeline, normalização e qualidade](/pt/data/pipeline-and-quality): o processo para um dataset novo.
- [Governança e privacidade](/pt/data/governance-and-privacy).
