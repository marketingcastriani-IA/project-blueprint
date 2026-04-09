

# Plano: Rastreador de Estratégias PRO

## Visão Geral

Criar uma nova página **/strategy-tracker** com um rastreador em tempo real que, dado um ativo e uma estratégia selecionada, varre automaticamente todas as opções disponíveis (via B3OptionsContext + RTD Bridge) e apresenta as melhores combinações ranqueadas por lucro, risco e eficiência.

## Estratégias Suportadas

| Cenário | Estratégia | Composição |
|---------|-----------|------------|
| **Alta** | Venda Coberta (Covered Call) | Ação + Venda Call |
| **Alta** | Trava de Alta com Call | Compra Call K1 + Venda Call K2 |
| **Baixa** | Venda de Put (Cash-Secured Put) | Venda Put |
| **Baixa** | Trava de Baixa com Put | Compra Put K1 + Venda Put K2 |
| **Lateral** | Iron Condor | Trava de Alta Put + Trava de Baixa Call |
| **Lateral** | Borboleta (Butterfly) | Compra C1 + 2x Venda C2 + Compra C3 |
| **Proteção** | Collar (link para rastreador existente) | — |

## Arquitetura

Segue o mesmo padrão do BoxTrackerTab e CollarTrackerTab:

```text
src/pages/StrategyTracker.tsx        ← Página com guard PRO
src/components/StrategyTrackerTab.tsx ← Componente principal (~1500 linhas)
```

### Fluxo do Usuário

1. Seleciona ativo (Top 18 quick-select ou digitação)
2. Escolhe a estratégia (tabs ou dropdown por cenário)
3. Ajusta filtros: vencimento, moneyness (ITM/ATM/OTM), faixa de prêmio, quantidade
4. O sistema varre todas as combinações possíveis e rankeia por:
   - **Maior Lucro %** (retorno máximo percentual)
   - **Melhor Risco/Retorno** (quality score)
   - **Maior Prêmio Recebido** (para vendas)
5. Exibe Top 3 resultados com troféus (ouro/prata/bronze) — igual Box e Collar
6. Cards expandíveis com detalhes: breakeven, lucro máx/mín, payoff simplificado

### Integração com Ticker Opções B3

- Novo botão "Enviar ao Rastreador PRO" na página /ticker-opcoes
- Salva tickers no localStorage (`strategy-tracker-families`) no mesmo padrão SavedFamily
- Ao abrir o Strategy Tracker, carrega automaticamente os tickers importados

### Dados em Tempo Real

- Usa `useSharedRtdBridge()` para preços Bid/Ask/Último
- Subscreve automaticamente todos os tickers da família selecionada
- Recalcula rankings a cada atualização de preço

## Arquivos a Criar/Modificar

1. **`src/components/StrategyTrackerTab.tsx`** — Componente principal com:
   - Seletor de estratégia (tabs por cenário: Alta / Baixa / Lateral)
   - Motor de varredura que combina opções e calcula métricas
   - Tabela de resultados com ranking Top 3
   - Filtros (vencimento, moneyness, prêmio mínimo)
   - Painel de alertas (mesmo padrão Sonner do Box Tracker)

2. **`src/pages/StrategyTracker.tsx`** — Página com guard PRO (mesmo padrão BoxTracker.tsx)

3. **`src/App.tsx`** — Nova rota `/strategy-tracker` com lazy loading

4. **`src/pages/TickerOpcoes.tsx`** — Novo botão "Enviar ao Rastreador PRO" + função `sendSelectedToStrategy`

5. **`src/components/Header.tsx`** — Link de navegação para o novo rastreador

6. **`src/pages/Index.tsx`** — Adicionar feature na landing page e no plano PRO

## Lógica de Cálculo por Estratégia

- **Venda Coberta**: Para cada Call disponível, calcula prêmio recebido / preço do ativo = taxa de retorno. Rankeia por taxa.
- **Venda de Put**: Para cada Put, calcula prêmio / strike = taxa. Filtra por moneyness desejado.
- **Trava de Alta Call**: Combina pares (K1 < K2), calcula custo líquido, lucro máximo = K2-K1-custo, breakeven = K1+custo.
- **Trava de Baixa Put**: Combina pares (K1 > K2), calcula custo líquido, lucro máximo = K1-K2-custo.
- **Iron Condor**: Combina trava de Put (abaixo) + trava de Call (acima). Lucro = prêmios recebidos, risco = largura - prêmio.
- **Borboleta**: 3 strikes equidistantes, calcula custo e lucro máximo no strike central.

## Filtros Disponíveis

- Vencimento (dropdown com datas disponíveis do B3OptionsContext)
- Moneyness: ITM / ATM ±5% / OTM
- Prêmio mínimo (R$)
- Quantidade (lotes)
- Comparação CDI (%) — toggle com taxa editável

## Escopo PRO

Acesso exclusivo para `planType === "pro" || isAdmin`, com tela de bloqueio idêntica ao Box Tracker.

