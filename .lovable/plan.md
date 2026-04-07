

# Badge "Auto" + Sistema de Alertas CDI Moderno

## Resumo

Adicionar badge "Auto" nos tickers importados do Opções B3 e modernizar o sistema de alertas push para funcionar tanto no celular quanto no PC, com UI mais moderna e configurável.

---

## 1. Badge "Auto" nos tickers importados

**Arquivo**: `src/pages/TickerOpcoes.tsx`
- Ao salvar tickers no localStorage (`BOX_STORAGE_KEY`), adicionar um campo `autoImported: string[]` na estrutura `SavedFamily` com a lista de tickers que vieram do Opções B3

**Arquivo**: `src/components/BoxTrackerTab.tsx`
- Atualizar `SavedFamily` para incluir `autoImported?: string[]`
- Na renderização dos tickers (tanto nos pares quanto nos tickers avulsos), verificar se o ticker está na lista `autoImported` e exibir um badge compacto com ícone de Database e texto "Auto" em cor primária
- Tickers adicionados manualmente (paste/upload) não terão o badge

---

## 2. Modernizar o sistema de alertas CDI

**Arquivo**: `src/components/BoxTrackerTab.tsx`

### 2.1 Redesign do painel de alertas (Row 2)
- Substituir o botão simples "Alerta Push" por um **card moderno** com:
  - Animação de sino pulsante quando ativo
  - Slider visual para definir o threshold (% CDI) ao invés de input de texto
  - Preview do tipo de alerta: "Você será notificado quando um box superar X% do CDI"
  - Badge indicando "PC + Celular" quando PWA instalada, ou "Apenas PC" quando no navegador

### 2.2 Notificações mais ricas
- Melhorar o conteúdo da notificação push com mais dados: família, strike, lucro em R$, % CDI, e vencimento
- Adicionar som de alerta configurável (toggle já existe `NOTIF_SOUND_ENABLED_KEY` mas sem implementação visual)
- Implementar o toggle de som na UI com um botão ao lado do toggle de alertas

### 2.3 Guia de instalação PWA
- Quando o usuário ativa alertas e o app NÃO está instalado como PWA, mostrar um **mini-guia** explicando como instalar:
  - Chrome PC: "Clique no ícone de instalação na barra de URL"
  - Chrome Mobile: "Menu → Adicionar à tela inicial"
  - Safari iOS: "Compartilhar → Adicionar à Tela de Início"
- Detectar se o app está rodando como PWA via `window.matchMedia('(display-mode: standalone)')` e ocultar o guia quando já instalado

### 2.4 Múltiplos níveis de alerta
- Permitir configurar **2 níveis de alerta**: 
  - Nível 1 (padrão): threshold configurável (ex: 110% CDI) — notificação normal
  - Nível 2 (urgente): threshold mais alto (ex: 130% CDI) — notificação com vibração extra e visual diferente no histórico
- Armazenar ambos no localStorage

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/TickerOpcoes.tsx` | Salvar `autoImported` no localStorage ao enviar tickers |
| `src/components/BoxTrackerTab.tsx` | Badge "Auto", redesign alertas, slider threshold, guia PWA, níveis de alerta, toggle som |
| `public/sw.js` | Suporte a prioridade de notificação (urgente vs normal) |

