

# Sugestões de Integração: Opções B3 → Tempo Real e Rastreador Box

## Contexto Atual

- **Opções B3** (`/ticker-opcoes`): banco de ~99k opções com filtros por família, vencimento, tipo e distância de strike. Exibe tabela read-only.
- **Tempo Real** (`/dados-ao-vivo`): tickers adicionados manualmente, monitoramento de P&L.
- **Rastreador Box** (`/box-tracker`): famílias com tickers digitados manualmente, busca pares Call/Put por strike.

Hoje esses módulos são silos — o usuário precisa copiar tickers manualmente entre eles.

---

## Sugestões de Integração

### 1. Botão "Enviar ao Tempo Real" na tabela de Opções B3

Na tabela de resultados do Ticker Opções, adicionar um ícone/botão por linha (ou ação em lote para linhas selecionadas) que insere o ticker diretamente no Tempo Real via `addTicker` do RTD Bridge. O usuário seleciona as opções que quer monitorar e clica uma vez — sem copiar/colar.

**Implementação**: Botão na coluna de ações da tabela em `TickerOpcoes.tsx` que chama `addTicker(ticker)` e exibe toast de confirmação.

### 2. Botão "Enviar ao Box Tracker" com auto-montagem

Permitir selecionar um par Call + Put (mesmo strike e vencimento) na tabela de Opções B3 e enviar diretamente para o Box Tracker como uma nova família pré-configurada. O sistema preencheria automaticamente:
- Nome da família (ex: PETR)
- Tickers da Call e Put
- Strike e vencimento já resolvidos

**Implementação**: Botão que aparece quando o usuário seleciona exatamente 1 Call + 1 Put do mesmo strike. Salva no localStorage do Box Tracker e navega para `/box-tracker`.

### 3. Sugestão automática de Box no Opções B3

Dentro da própria página de Opções B3, adicionar uma seção "Oportunidades de Box" que cruza automaticamente pares Call/Put do mesmo strike e vencimento, calcula Custo e Lucro estimado (usando preço ao vivo do ativo), e exibe um mini-ranking. Clicando, envia direto ao Box Tracker.

**Implementação**: `useMemo` que agrupa opções filtradas por strike+vencimento, calcula arbitragem usando `precoBase` ao vivo, e renderiza cards resumidos.

### 4. Pré-popular tickers no Tempo Real ao selecionar família

Quando o usuário seleciona uma família no Opções B3 (ex: PETR), oferecer botão "Monitorar todas as opções desta família" que adiciona automaticamente os tickers filtrados ao Tempo Real (com limite de, por exemplo, 20 mais líquidos por proximidade de strike).

---

## Recomendação

A **sugestão 1** (Enviar ao Tempo Real) é a mais simples e de alto impacto — elimina o copy/paste. A **sugestão 2** (Enviar ao Box) é o segundo passo natural. A **sugestão 3** (Oportunidades de Box automáticas) é a mais poderosa mas também a mais complexa.

### Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/TickerOpcoes.tsx` | Botões de ação por linha/lote, seção de oportunidades |
| `src/components/BoxTrackerTab.tsx` | Função para receber família pré-configurada via estado/localStorage |
| `src/pages/DadosAoVivo.tsx` | Nenhuma — já aceita tickers via `addTicker` |
| `src/contexts/RtdBridgeContext.tsx` | Nenhuma — já expõe `addTicker` globalmente |

