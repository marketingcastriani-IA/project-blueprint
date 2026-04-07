

## Melhorias no Gráfico de Payoff 2D

### Problemas Identificados na Imagem

1. **Linha ZERO pouco visível** - apesar de já ter sido melhorada, o label "ZERO" fica cortado no canto direito
2. **Faixa verde/vermelha com gradiente fraco** - a zona de ganho é muito translúcida, difícil de distinguir
3. **Tooltip bloqueia visão do gráfico** - ocupa muito espaço na área central
4. **Linha CDI sem contexto** - mostra valor mas não destaca se a estratégia supera o CDI
5. **Curva T+0 (azul tracejada) na zona negativa sem explicação** - usuário pode não entender o que significa
6. **Falta de labels diretos no gráfico** - "ZONA DE LUCRO" e "ZONA DE PERDA" escritos nas faixas coloridas facilitariam leitura instantânea
7. **Eixo Y com poucas marcações** - dificulta leitura de valores intermediários

### Plano de Melhorias

**1. Labels "ZONA DE LUCRO" e "ZONA DE PERDA" no gráfico**
- Adicionar texto fixo semi-transparente dentro das áreas verde e vermelha usando `customized` prop ou `Label` do Recharts
- Posicionados no centro vertical de cada zona

**2. Faixas verde/vermelha mais intensas**
- Aumentar `stopOpacity` do gradiente de 0.45 para 0.55 (ganho) e 0.45 para 0.55 (perda)
- Adicionar borda sutil nas áreas (stroke leve verde/vermelho)

**3. Linha Zero melhorada**
- Mover label "ZERO" para `insideLeft` para não ser cortado
- Aumentar contraste com cor sólida e fundo

**4. Indicador CDI vs Estratégia**
- Adicionar uma anotação visual quando a curva de payoff cruza a linha CDI, indicando "Supera CDI" acima e "Abaixo CDI" abaixo
- Label "CDI" mais legível com fundo/badge

**5. Tooltip mais compacto**
- Reduzir padding e espaçamento
- Mover Greeks para um painel separado fixo (fora do tooltip) para não poluir

**6. Mini-legenda integrada no gráfico**
- Adicionar legenda compacta no canto superior esquerdo do chart (dentro do gráfico) ao invés de depender só do tooltip

### Arquivos Modificados

- `src/components/PayoffChart.tsx` - todas as melhorias visuais acima

### Detalhes Técnicos

- Labels de zona usarão `<text>` via `customized` no ComposedChart, posicionados com base no domínio Y
- Gradientes atualizados nos `<linearGradient>` existentes
- Legenda interna via componente `<foreignObject>` ou posicionamento absoluto sobre o chart container
- Tooltip simplificado movendo Greeks para exibição fixa abaixo das métricas

