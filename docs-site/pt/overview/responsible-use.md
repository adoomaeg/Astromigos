---
title: Uso responsável
description: Aviso médico, limites do apoio à decisão, humano no circuito e regras de transparência da Astronaut Health Intelligence Platform.
verified: 2026-11-14
---

# Uso responsável

A Astronaut Health Intelligence Platform (AHI) lida com saúde, ainda que com dados simulados. Esta página reúne o que o sistema **faz**, o que **não faz** e as regras que valem para código, dados, interface e documentação. Elas vêm do `PROJECT_MASTER.md` (seções 1.1, 2.4, 9.7 e 17).

::: danger PERIGO: NÃO É UM DISPOSITIVO MÉDICO
A AHI é um protótipo de hackathon de **apoio à decisão**. Não é dispositivo médico certificado, não faz diagnóstico, não recomenda medicamentos ou tratamentos e **não substitui o médico de voo (flight surgeon) nem o Mission Control**. Não use em pacientes, em emergências reais ou com dados reais de saúde.
:::

## Limites do apoio à decisão

| A AHI faz | A AHI não faz |
| --- | --- |
| Mostra desvios em relação ao normal de cada pessoa | Diagnóstico |
| Explica o motivo em linguagem simples | Prescrição de medicamento ou tratamento |
| Sugere próximos passos não prescritivos de um catálogo versionado | Substituir o médico de voo ou o Mission Control |
| Projeta tendências com incerteza explícita | Garantir a previsão de eventos médicos |
| Registra alertas, ações e mensagens em auditoria | Controlar remotamente equipamentos |
| Simula efeitos hipotéticos para discussão | Afirmar eficácia clínica |

Os textos da interface reforçam isso: "Decision support only. Not a diagnosis. Simulated data." aparece no painel de atenção e na gaveta de alertas, e o relatório de turno traz um aviso equivalente.

## Três avisos que valem para toda a documentação

1. **Limiares são configuração de demo.** Todo número fixo vive em `frontend/web/src/engine/config.ts`, rotulado como "demo configuration, not an official limit". Nenhum é limite oficial da NASA, regra de voo ou limiar clínico. Veja [Limiares e limitações](/pt/intelligence/thresholds).
2. **Dado simulado não é evidência clínica.** Toda leitura de dispositivo da tripulação é `SIMULATED`. A avaliação do motor mede consistência interna contra o mesmo simulador, não desempenho clínico. Veja [Resultados e evidências](/pt/validation/results).
3. **Não há IA generativa em tempo de execução.** O motor é estatístico e baseado em regras. Uma camada de explicação com LLM está apenas planejada, com regras rígidas. Veja [Abordagem de IA e análise de dados](/pt/intelligence/ai-and-analytics).

## Humano no circuito

- Todo item **HIGH** ou **CRITICAL** e todo item endereçado ao médico de voo exige **revisão humana**.
- Cada recomendação diz **quem pode agir**: a tripulação a bordo ("Can act on board now") ou o médico de voo na Terra ("Needs flight surgeon").
- Com atraso de comunicação grande, a AHI mostra quanto tempo uma resposta da Terra leva e propõe primeiro um passo a bordo. A decisão continua humana.
- As respostas do "médico de voo" na demo são **simuladas e padronizadas**: confirmam o recebimento, pedem para seguir o protocolo de bordo e reavaliar, nunca prescrevem e dizem que são simuladas.
- "Mark done" e "Acknowledge" ficam na trilha de auditoria, junto com mudanças de cenário, escalonamentos, check-ins e mensagens.

## Correlação não é causalidade

A AHI mostra quando sinais mudam juntos, mas **não afirma causa**.

- A regra R-ENV-CO2-02 sinaliza que a respiração ou o tempo de reação mudaram **enquanto** o CO₂ estava elevado. O texto fala em coocorrência.
- O check-in pode corroborar um padrão (fadiga relatada junto com R-FAT-01), mas não sobe o nível sozinho.
- Sintomas relatados aparecem como fato relatado ("You reported a headache today"), nunca como conclusão.

## Transparência de origem

- Todo registro carrega `data_origin`, e o selo `SIMULATED` fica sempre visível na barra superior.
- **Dado público não é telemetria ao vivo.** Os datasets reais aparecem com o aviso "Historical public research data. Not live telemetry and not this crew."
- **Dado ausente nunca é normal:** vira `NO_DATA` (cinza, contorno tracejado, "Signal lost").
- Ter um equipamento a bordo da ISS não significa que exista API pública ou acesso. A AHI não alega conexão com a ISS.

Detalhes de origem e privacidade em [Origens e proveniência](/pt/data/data-origins) e [Governança e privacidade](/pt/data/governance-and-privacy).

## Antes de qualquer uso real

Para sair do protótipo, no mínimo:

1. Cada limiar precisa de fonte citável (documento, seção e versão) e aprovação de um médico de voo.
2. O motor precisa de validação com dados reais e rotulados, fora do simulador que gerou os dados.
3. A plataforma precisa de backend com autenticação, controle de acesso e auditoria persistente.
4. Os textos e as recomendações precisam de revisão clínica.

Esses itens estão em [Limitações](/pt/validation/limitations) e no [Roadmap](/pt/resources/roadmap).

## Próximos passos

- [Limiares e limitações](/pt/intelligence/thresholds): a tabela de configuração de demo.
- [Model card](/pt/validation/model-card): uso pretendido e limitações do motor.
- [Governança e privacidade](/pt/data/governance-and-privacy).
