

# Melhorias de UX: Instruções Claras + Melhorias em Opções B3 e Box Tracker

## O que será feito

Adicionar instruções visuais claras para guiar o usuário nos fluxos de Opções B3 → Box Tracker, e implementar melhorias de usabilidade em ambas as telas.

---

## 1. Instruções na tela — Opções B3

**Arquivo**: `src/pages/TickerOpcoes.tsx`

- Adicionar um **banner de instrução** abaixo do header com ícones e passos numerados:
  1. "Selecione uma família (ex: PETR) e filtre por vencimento"
  2. "Marque os tickers com checkbox — opções com PAR são ideais para Box"
  3. "Use os botões 'Tempo Real' ou 'Box Tracker' para enviar automaticamente"
- O banner terá um botão "Entendi" que salva no `localStorage` para não aparecer novamente
- Quando nenhuma opção está selecionada, mostrar **texto-guia** nos botões de ação: "Selecione opções na tabela para enviar"

## 2. Instruções na tela — Box Tracker

**Arquivo**: `src/components/BoxTrackerTab.tsx`

- Adicionar banner instrucional similar no topo:
  1. "Adicione uma família (ex: PETR) ou envie tickers automaticamente do Opções B3"
  2. "Os tickers são preenchidos automaticamente — basta conectar o Bridge para ver preços ao vivo"
  3. "Os melhores boxes aparecem no ranking com comparação ao CDI"
- O estado vazio (nenhuma família) será melhorado com instruções mais claras e um **botão direto "Ir ao Opções B3"** para facilitar o fluxo
- Destacar visualmente que tickers vindos do Opções B3 entram automaticamente

## 3. Melhorias adicionais — Opções B3

- **Tooltip nos badges PAR**: explicar "Este strike tem Call e Put disponíveis — ideal para montar Box"
- **Contador de pares** no header dos filtros: "X pares Call+Put disponíveis"
- **Highlight mais forte** nas linhas com PAR (borda esquerda colorida ao invés de apenas opacity)

## 4. Melhorias adicionais — Box Tracker

- **Botão "Ir ao Opções B3"** no card de família vazio e no estado vazio geral, para facilitar navegação
- **Badge "Auto"** nos tickers que vieram do Opções B3 (via localStorage flag)
- **Melhorar placeholder** do input de família: adicionar texto explicativo abaixo ("Digite apenas o nome base: PETR, VALE, BBDC — sem número")

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/TickerOpcoes.tsx` | Banner instrucional, tooltip PAR, highlight melhorado, contador de pares |
| `src/components/BoxTrackerTab.tsx` | Banner instrucional, botão "Ir ao Opções B3", placeholder melhorado, estado vazio aprimorado |

