

# Melhorar Filtros — Opções B3

## Problemas Atuais
1. **Sem filtro por faixa de strike absoluto** — só filtra por % do preço base, mas usuário pode querer definir strike mínimo/máximo direto
2. **Sem filtro por preço da opção** — não filtra por faixa de prêmio (ex: opções entre R$0.50 e R$5.00)
3. **Sem filtro "Apenas com PAR"** — não tem toggle para mostrar só opções que possuem Call+Put no mesmo strike
4. **Sem filtro por moneyness** — ITM/ATM/OTM não é selecionável
5. **Filtro de strike por % não mostra os valores do slider claramente** — sliders sem indicação visual do range selecionado
6. **Sem "chips" de filtros ativos** — difícil ver quais filtros estão aplicados e removê-los individualmente
7. **Limite fixo de 200 rows** sem botão "Carregar mais"
8. **Sem contador de filtros ativos** no badge

## Melhorias Planejadas

### A. Novo filtro: "Apenas com PAR (Call+Put)"
- Toggle/switch no painel de filtros que, quando ativo, mostra apenas opções que têm par Call+Put no mesmo strike/vencimento
- Útil para quem quer montar Box Spread rapidamente

### B. Novo filtro: Moneyness (ITM / ATM / OTM)
- Dropdown com opções: Todos, ITM, ATM (±5%), OTM
- Usa o `precoBaseNum` para calcular: strike < preço = ITM para CALL, OTM para PUT, e vice-versa

### C. Novo filtro: Faixa de Prêmio (preço da opção)
- Dois inputs (min/max) para filtrar por preço último da opção
- Ex: mostrar apenas opções com prêmio entre R$0.10 e R$3.00

### D. Chips de filtros ativos
- Abaixo dos filtros, mostrar badges/chips com cada filtro ativo (ex: "VALE", "CALL", "Venc: 16/05/2025")
- Cada chip tem um X para remover aquele filtro individualmente
- Mais intuitivo que o botão "Limpar" genérico

### E. Botão "Carregar mais" na tabela
- Em vez do limite fixo de 200, começar com 100 e mostrar botão "Carregar mais 100" no final
- Mostra quantos faltam: "Carregar mais 100 (restam 1.578)"

### F. Melhorar visual dos sliders de %
- Adicionar labels dinâmicos nos extremos dos sliders mostrando o valor em R$ calculado
- Ex: slider "Abaixo: 20%" mostra "R$ 68,35" à esquerda

## Arquivos Modificados
- `src/pages/TickerOpcoes.tsx` — adicionar novos estados de filtro, lógica de filtragem, chips ativos, botão carregar mais, filtro moneyness/par/prêmio

## Implementação Técnica
- Novos estados: `onlyPaired`, `moneyness`, `precoMin`, `precoMax`, `displayLimit`
- Filtro `onlyPaired`: reutiliza o `pairedStrikeKeys` já existente
- Filtro `moneyness`: calcula com base no `precoBaseNum` e tipo da opção
- Chips: array derivado dos filtros ativos, cada um com handler de reset individual
- "Carregar mais": incrementa `displayLimit` em 100

