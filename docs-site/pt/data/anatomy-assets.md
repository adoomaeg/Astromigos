---
title: Assets de anatomia 3D
description: Proveniência do modelo anatômico 3D da Astronaut Health Intelligence Platform como asset de terceiros, o Z-Anatomy sob CC BY-SA 4.0, com atribuição obrigatória, checksum, modificações, exclusões, regras de nomes e passos de rebuild.
status: IMPLEMENTED
code:
  - frontend/web/public/anatomy/manifest.json
  - frontend/web/public/anatomy/LICENSE.md
  - frontend/web/scripts/anatomy/build.mjs
  - frontend/web/scripts/anatomy/fetch-source.mjs
  - frontend/web/scripts/anatomy/export_atlas.py
  - frontend/web/scripts/anatomy/build-kidneys.ts
  - frontend/web/scripts/anatomy/optimize.mjs
  - frontend/web/scripts/anatomy/validate.mjs
  - docs/anatomy-assets.md
tests:
  - frontend/web/src/features/anatomy/atlas/manifest.contract.test.ts
verified: 2026-11-14
---

# Assets de anatomia 3D

O corpo 3D da Astronaut Health Intelligence Platform (AHI) é construído a partir de um **modelo de terceiros**: o atlas Z-Anatomy. Esta página é o registro canônico de onde o modelo vem, sob qual licença é distribuído, o que foi alterado, o que ficou de fora e como reconstruí-lo. Como o visualizador usa os arquivos está em [Renderização da anatomia 3D](/pt/architecture/anatomy-3d).

::: warning Duas licenças no mesmo repositório
O **código da aplicação** é distribuído sob a licença MIT. Os **arquivos de anatomia** em `frontend/web/public/anatomy/` (`*.glb` e `manifest.json`) são obra derivada do Z-Anatomy e são distribuídos sob **CC BY-SA 4.0**. A licença MIT não se aplica a eles. Quem reutilizar ou modificar esses arquivos precisa manter a atribuição abaixo e compartilhar a sua versão sob a mesma licença.
:::

O atlas é anatomia de referência, não dado de saúde: não leva o selo `data_origin` e nada nele descreve um tripulante. As origens dos dados de saúde estão em [Origens e proveniência dos dados](/pt/data/data-origins).

## Fonte {#source}

| Item | Valor |
| --- | --- |
| Modelo | Z-Anatomy, "Human male model" (the libre 3D atlas of anatomy), baseado no BodyParts3D |
| Projeto | [z-anatomy.com](https://www.z-anatomy.com/) |
| Repositório | [github.com/Z-Anatomy/Models-of-human-anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) |
| Arquivo | `Z-Anatomy.zip` (86.734.957 bytes), que contém `Z-Anatomy/Startup.blend` |
| URL de download | `https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/master/Z-Anatomy.zip` |
| SHA-256 do zip | `e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736` |
| Data de obtenção | 14/11/2026 |
| Formato de origem | Arquivo do Blender (.blend): metros, Z para cima, cerca de 7.180 objetos, cores chapadas de material, sem texturas de imagem |
| Formato publicado | glTF 2.0 binário (GLB), um arquivo por sistema anatômico, com `EXT_meshopt_compression` e `KHR_mesh_quantization`, mais o `manifest.json` |
| Local publicado | `frontend/web/public/anatomy/` (nove arquivos GLB, `manifest.json`, `LICENSE.md`) |

Os mesmos fatos acompanham os arquivos: no `public/anatomy/LICENSE.md` e dentro do `manifest.json`, em `source`. O arquivo de origem não é versionado; o pipeline o baixa para uma pasta de cache ignorada pelo git e o rejeita quando o checksum não confere.

## Licença e atribuição {#license-and-attribution}

O Z-Anatomy é distribuído sob a licença **Creative Commons Atribuição-CompartilhaIgual 4.0 Internacional** ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)). Os arquivos GLB derivados e o manifesto são distribuídos sob a mesma licença.

Linhas de atribuição exigidas pelo arquivo de licença da fonte, exatamente como estão lá:

```text
Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0
BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan
```

| Autores listados na fonte | Papel |
| --- | --- |
| Kousaku Okubo | BodyParts3D |
| Gauthier Kervyn | Design, 3D, anatomia |
| Marcin Zielinski | Add-on do Blender |
| Lluis Vinent | Desenvolvimento em Unity |

O arquivo de licença da fonte também lista modelos que o Z-Anatomy usou como referência ou incluiu e adaptou:

| Modelo da fonte | Licença | Nos arquivos da AHI |
| --- | --- | --- |
| "Brainder" e "White matter", University of Washington | sem licença separada registrada nos arquivos da AHI | Parte do atlas de origem |
| "Cranial Nerves and Foramina", University of Dundee, CAHID | CC BY 4.0 | Parte do atlas de origem |
| "Anatomy of the Inner Ear", University of Dundee School of Medicine | CC BY-NC-SA 4.0 (não comercial) | **Excluído** |
| "Kidney", Lissie Cowley | CC BY-NC 4.0 (não comercial) | **Excluído**, substituído por rins procedurais da AHI |

Onde a atribuição aparece no app: uma legenda sob o corpo 3D ("Reference anatomy: Z-Anatomy atlas (CC BY-SA 4.0)"), sempre visível; um popover "About the reference anatomy" com os créditos; e um selo "Reference anatomy" em cada estrutura selecionada.

## Modificações feitas pela AHI {#modifications}

O modelo de origem foi alterado. Tudo é feito por scripts em `frontend/web/scripts/anatomy/`, sem interface, então o resultado é reproduzível.

No Blender (`export_atlas.py`):

1. **Classificação.** Cada objeto de malha ou curva das coleções usadas é associado, pelo nome e pelos rótulos ancestrais, a uma estrutura, ou descartado. Objetos sem regra são relatados.
2. **Modificadores** são avaliados em uma cena nova e vazia, com Subdivision Surface limitado a um nível.
3. **Curvas viram tubos.** Vasos, nervos, brônquios e ductos são curvas na fonte. Viram malhas de tubo com 4 a 8 lados. Tubos mais finos que 0,55 mm são alargados até esse raio, para vasos e nervos pequenos continuarem visíveis no corpo inteiro.
4. **União.** Todos os objetos de origem de uma estrutura viram uma única malha com o id da estrutura (cerca de 2.230 objetos de origem viram 250 estruturas).
5. **Limpeza.** Transformações aplicadas, objetos espelhados corrigidos para as normais apontarem para fora, vértices soldados, faces trianguladas, sombreamento suave.
6. **Pele.** Cerca de 250 retalhos de região são unidos em uma superfície de camada única, e as normais são suavizadas nas emendas entre regiões.
7. **Superfície neutra do corpo.** A região genital externa da pele é removida e fechada com uma superfície lisa e neutra, que se funde ao abdome inferior, ao períneo e à parte interna das coxas. A pele continua sendo uma única superfície (veja [O que foi excluído](#exclusions)).
8. **Decimação.** Cada sistema tem um orçamento de triângulos dividido entre suas estruturas. Cerca de quatro quintos dos triângulos de origem são removidos.
9. **Referencial.** O modelo é movido para os pés ficarem no chão e o corpo centrado, e exportado com Y para cima.
10. **Materiais.** Os materiais da fonte são trocados por um material neutro por classe de tecido. O visualizador atribui os seus próprios materiais pelo campo `tissue`.
11. **Exportação.** Um GLB por sistema: com normais; sem UVs, tangentes, cores de vértice, câmeras, luzes, animações ou skins.

No Node (`optimize.mjs`, com glTF Transform e meshoptimizer): os rins são adicionados; depois dedup, weld, prune, posições ajustadas a uma grade de 1/16384 m (0,06 mm), normais guardadas como inteiros de 8 bits e todos os buffers comprimidos com meshopt. Os nós de malha mantêm transformação identidade, então o visualizador pode escalar um nó livremente (batimento, respiração).

## O que foi excluído e por quê {#exclusions}

Os nomes exatos dos objetos dos três primeiros grupos ficam registrados no `manifest.json`, em `source.excluded`.

| Grupo | O quê | Por quê |
| --- | --- | --- |
| Ouvido | Ouvido interno, ossículos da audição, membrana timpânica, tuba auditiva, nervos coclear e vestibular | O modelo "Anatomy of the Inner Ear" da fonte tem licença **não comercial**. Na dúvida, o ouvido inteiro foi removido |
| Rim | Malhas do rim e da pelve renal, curvas dos vasos intrarrenais | O modelo "Kidney" da fonte tem licença **não comercial**. Substituído por geometria da AHI |
| Estruturas reprodutivas | 33 objetos de origem: órgãos genitais internos e externos, os vasos, nervos e ductos que só os atendem, e a uretra (no modelo de origem, o trajeto dela passa pela genitália externa). Os dois retalhos urogenitais da pele são removidos e a abertura é fechada com uma superfície lisa e neutra | **Decisão de produto**: o atlas representa todos os tripulantes e nenhuma métrica monitorada se relaciona a essas estruturas, então o modelo distribuído é um corpo de referência neutro |
| Não são corpos físicos | Rótulos de texto e suas linhas de chamada, títulos de grupo, mapas de origem e inserção muscular, linhas e planos de referência, planos de corte, objetos que só existem na "Bonus collection" da fonte | Objetos auxiliares do add-on do Z-Anatomy para o Blender, não anatomia |
| Deixados de fora por clareza | Linfonodos, tonsilas, fáscias, bursas, bainhas tendíneas, ligamentos, cápsulas e membranas articulares, meninges, pleura, peritônio e omentos, ventrículos e outras cavidades, cabelo, segmentos do fígado, pequenos núcleos do tronco encefálico, superfície interna da substância branca do cérebro | Envolvem ou escondem outras estruturas, ou custam draw calls sem ajudar a visão de saúde |

O `validate.mjs` reprova o build se um objeto de origem excluído (rim, ouvido ou reprodutivo) entrar em uma estrutura publicada.

## Rins procedurais {#procedural-kidneys}

As estruturas `kidney-left` e `kidney-right` **não** vêm do Z-Anatomy. O `build-kidneys.ts` as constrói com o código de campos de distância com sinal da própria AHI (o mesmo conjunto de ferramentas do visualizador procedural de fallback): um elipsoide inclinado com um entalhe suave no hilo. Depois o `optimize.mjs` ajusta cada rim à caixa envolvente (centro e tamanho) do rim correspondente do atlas. Só esses seis números por rim são lidos do atlas; nenhuma geometria de rim da fonte é usada.

No manifesto elas são marcadas com `"origin": "ahi-procedural"`, e o app mostra para elas o selo "AHI procedural". São distribuídas sob a mesma licença CC BY-SA 4.0 do resto da pasta.

## Regras de nomes das estruturas {#naming-rules}

Cada estrutura é um nó de malha no GLB do seu sistema, e o nome do nó é o id da estrutura. Os campos do manifesto estão em [Contrato do manifesto](/pt/architecture/anatomy-3d#manifest-contract).

| Regra | Exemplo |
| --- | --- |
| Ids são nomes anatômicos em inglês, em kebab-case, pensados para ficar estáveis entre builds | `rectus-abdominis` |
| Uma estrutura par isolada termina com o lado | `femur-left`, `lung-right`, `kidney-left` |
| Um grupo de estruturas pequenas leva o lado no meio do id | `bones-of-left-hand`, `arteries-of-left-upper-limb` |
| Estruturas medianas ou agrupadas não têm lado | `skull`, `heart`, `aorta` |
| `side` é `L`, `R` ou `null`; estruturas esquerdas ficam em x > 0 | |
| `parent` é usado em três estruturas | `coronary-arteries` e `cardiac-veins` (pai `heart`), `cerebrum-deep-structures` (pai `brain`) |
| Sete ids são exigidos pela aplicação | `skin`, `heart`, `lung-left`, `lung-right`, `brain`, `kidney-left`, `kidney-right` |

O agrupamento é uma escolha de projeto: músculos pequenos, ossos da mão e do pé, vasos e nervos são unidos por região para manter cerca de 250 estruturas selecionáveis. Estruturas, triângulos e tamanho por sistema: [Sistemas e arquivos](/pt/architecture/anatomy-3d#systems-and-files).

## Referencial de coordenadas {#coordinate-frame}

Metros, Y para cima, corpo voltado para +Z, pés em y = 0, centrado em x = 0 e z = 0. A esquerda anatômica é +X, então o coração fica em x > 0. Limites do modelo publicado: x de -0,340 a 0,340, y de 0 a 1,710, z de -0,147 a 0,147. Todos os nós de malha têm transformação identidade.

A fonte no Blender usa outro referencial (Z para cima, corpo voltado para -Y); o script de exportação faz a conversão.

## Rebuild {#rebuild}

Pré-requisitos:

| Requisito | Notas |
| --- | --- |
| Blender 4.5 LTS | Qualquer instalação ou build portátil. Informe o caminho com `BLENDER_BIN` ou `--blender` |
| Node.js 20 ou mais recente | Com as dependências de `frontend/web` instaladas (`npm ci`). O pipeline usa as dependências de desenvolvimento fixadas `@gltf-transform/*`, `meshoptimizer` e `tsx` |
| Disco e tempo | Cerca de 500 MB para o cache e cerca de 5 minutos |
| Rede | Um download de `raw.githubusercontent.com`, o único host que o script acessa |

Rode dentro de `frontend/web`:

```bash
# informe onde está o Blender (PowerShell: $env:BLENDER_BIN = "C:\caminho\para\blender.exe")
export BLENDER_BIN="/caminho/para/blender"

npm run anatomy:build      # download, exportação no Blender, rins, otimização, validação
npm run anatomy:validate   # só as checagens do contrato em public/anatomy
```

| Opção | Significado |
| --- | --- |
| `--blend <caminho>` (ou `ANATOMY_SOURCE_BLEND`) | Usa um `Startup.blend` já extraído; pula o download |
| `--skip-blender` | Reaproveita a exportação bruta da execução anterior (só rins, otimização e validação) |
| `--previews` | Também renderiza pranchas de pré-visualização dos arquivos publicados na pasta de cache |
| `--cache <dir>`, `--out <dir>` | Pasta de trabalho (padrão `frontend/web/.cache/anatomy`) e pasta de saída (padrão `public/anatomy`) |

Exemplo: `npm run anatomy:build -- --blend D:/models/Startup.blend --previews`

Segurança: a fonte é tratada como dado não confiável. O download é conferido contra o SHA-256 fixado, e o Blender inicia com `--factory-startup --disable-autoexec`, então scripts embutidos no arquivo blend nunca são executados.

## Procedimento de atualização {#update-procedure}

Quando o Z-Anatomy publicar uma versão nova:

1. Baixe o novo arquivo, calcule o SHA-256 e o tamanho, e leia de novo o `License.txt` da fonte: licença, texto de atribuição e lista de modelos de terceiros. Conteúdo novo com licença não comercial precisa entrar nas regras de exclusão.
2. Atualize o checksum e o tamanho fixados no `fetch-source.mjs`, e o registro da fonte (`sha256`, `retrievedAt`) no `optimize.mjs`.
3. Rode `npm run anatomy:build -- --previews` e leia o log: objetos sem regra são estruturas renomeadas ou novas, e estruturas descartadas perderam todos os objetos de origem. Ajuste as funções de regra no `export_atlas.py`.
4. Mantenha os ids das estruturas estáveis. Se um id precisar mudar, suba o `version` do manifesto e atualize o mapeamento de saúde ([Como adicionar ou renomear uma estrutura](/pt/engineering/contributing#add-or-rename-an-anatomical-structure)).
5. Confira as pranchas de pré-visualização, o relatório de tamanhos e a validação. Depois atualize os números e as datas: `public/anatomy/LICENSE.md`, o guia do repositório e a [tabela de sistemas](/pt/architecture/anatomy-3d#systems-and-files).

O guia completo, com cada regra de agrupamento, orçamento e opção de script, é o <CodeLink path="docs/anatomy-assets.md" /> no repositório.

## Limitações {#limitations}

- **Um único modelo de referência, tornado neutro.** A fonte é um modelo adulto masculino, usado como anatomia de referência para todos os tripulantes. Só a região da virilha foi neutralizada: as estruturas reprodutivas não são exportadas e essa parte da pele é uma superfície lisa. A constituição, as proporções e o tórax continuam os do modelo masculino de origem. Não é um exame de nenhum astronauta e não se adapta a sexo, altura ou composição corporal.
- **Superfície neutra da virilha.** É uma membrana gerada, não anatomia. A uretra não é exportada, então a bexiga urinária não tem saída no modelo.
- **Rins procedurais.** Superfícies simples em forma de feijão, colocadas onde ficam os rins do atlas, sem anatomia interna.
- **Estruturas ausentes.** Sem estruturas do ouvido, sem estruturas reprodutivas, sem linfonodos, fáscias, ligamentos ou meninges (veja [O que foi excluído](#exclusions)).
- **Sem texturas na fonte.** Todo o detalhe de superfície vem da geometria e dos materiais do visualizador.
- **Decimação.** Cerca de quatro quintos dos triângulos de origem são removidos. Lâminas finas e tubos longos são os mais simplificados; os menores vasos e nervos são desenhados mais grossos que na realidade.
- **Pele.** Construída a partir de retalhos de região, sem espessura; restam algumas emendas leves de sombreamento. Os olhos são estruturas separadas com um único material.
- **Agrupamento.** Vértebras, costelas e dentes não podem ser selecionados um a um.
- Isto é apoio à decisão e material educativo, não um dispositivo médico.

## Próximos passos

- [Renderização da anatomia 3D](/pt/architecture/anatomy-3d): como o visualizador carrega e desenha esses arquivos.
- [Mapeamento da anatomia para a saúde](/pt/architecture/data-model#anatomy-to-health-mapping): como as estruturas se relacionam às métricas monitoradas.
- [Governança e privacidade](/pt/data/governance-and-privacy#third-party-licenses): licenças de tudo o que é de terceiros.
