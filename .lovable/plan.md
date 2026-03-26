

## Limitacao Tecnica Importante

O RTD (Real-Time Data) do Profit Pro e uma tecnologia **COM/OLE do Windows** que funciona exclusivamente dentro do Excel via `RTD("rtdtrading.rtdserver"...)`. **Nao e possivel acessar o servidor RTD diretamente de um navegador web** -- ele so funciona em aplicacoes Windows nativas.

## Solucao Proposta: Aba "Dados ao Vivo" com Integracao Indireta

Como alternativa viavel, criarei uma nova aba que permite ao usuario:
1. **Importar dados do Profit via copiar/colar** de uma planilha Excel que ja usa as formulas RTD
2. **Digitar tickers manualmente** e montar pernas com os campos equivalentes aos do RTD
3. **Gerar o grafico Payoff automaticamente** com as pernas montadas

### Campos por ticker (equivalentes ao RTD)
- Ticker (input manual)
- Ultimo (ULT)
- Strike (PEX)
- Negocios (NEG)
- Of. Compra (OCP)
- Of. Venda (OVD)
- Valor Intrinseco (VINT)
- Valor Extrinseco (VEXT)

### Arquivos a criar/modificar

1. **`src/pages/DadosAoVivo.tsx`** (novo)
   - Campo para digitar ticker e tipo (call/put/stock) + lado (compra/venda)
   - Tabela com colunas: Ticker, Ultimo, Strike, Negocios, Of.Compra, Of.Venda, V.Intrinseco, V.Extrinseco
   - Botao "Colar do Excel" que parseia dados tabulares copiados da planilha com RTD
   - Botao para converter linhas selecionadas em pernas
   - Grafico Payoff integrado usando os componentes existentes (PayoffChart, MetricsCards)
   - Instrucoes visuais mostrando as formulas RTD para o usuario configurar no Excel/Profit

2. **`src/App.tsx`** -- adicionar rota `/dados-ao-vivo`

3. **`src/components/Header.tsx`** -- adicionar item de navegacao "Dados ao Vivo" com icone `Radio`

### Fluxo do usuario
1. Usuario abre o Profit Pro e Excel lado a lado
2. Configura as formulas RTD no Excel (instrucoes na tela)
3. Copia as celulas com dados atualizados
4. Cola na aba "Dados ao Vivo" do app
5. Seleciona lado (compra/venda) e converte em pernas
6. Grafico Payoff e metricas sao gerados automaticamente

### Alternativa futura
Incluirei uma nota na interface sobre a possibilidade futura de usar um **servidor local bridge** (um pequeno executavel Windows que le o RTD e envia via WebSocket para o app), mas isso requer desenvolvimento nativo separado.

