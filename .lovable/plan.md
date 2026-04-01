

# Plano: Rastreador de Collar (Collar Tracker)

## Objetivo
Criar uma nova aba "Collar Tracker" que rastreia em tempo real os melhores collars para uma ação escolhida, usando dados do RTD Bridge — similar ao Box Tracker, mas para a estratégia Collar (Ação comprada + Put comprada + Call vendida). Ativável/desativável pelo Admin Panel.

## Referência Visual (das imagens enviadas)
Cada card de collar mostra:
- **Ação**: ticker + preço atual + data
- **V Call**: ticker da call vendida, strike, vencimento, valor
- **C Put**: ticker da put comprada, strike, vencimento, valor
- **Coeficiente**: Preço Ação + Preço Put - Preço Call
- **Rentabilidade**: 3 cenários (↓ baixa, ↔ neutro, ↑ alta)
- **Meses**, **CDI Período**, **Rating** (estrelas), **Tipo**

## Arquivos a Criar/Modificar

### 1. Novo componente: `src/components/CollarTrackerTab.tsx`
- Estrutura similar ao BoxTrackerTab (usa `useSharedRtdBridge`)
- O usuário adiciona uma família de ativo (ex: PETR4) e os tickers de calls e puts
- Para cada par call/put com mesmo ou diferente vencimento, calcula:
  - **Coeficiente** = Preço Ação (Ask) + Preço Put (Ask) - Preço Call (Bid)
  - **Rent. Baixa** = (Strike Put - Coeficiente) / Coeficiente × 100
  - **Rent. Alta** = (Strike Call - Coeficiente) / Coeficiente × 100
  - **Rent. Neutra** = média ou cenário de preço mantido
- Ranking por melhor rentabilidade vs CDI do período
- Cards com estilo profissional (bordas, sombras, relevo) seguindo o padrão atual
- Filtro por código da ação
- Indicador de Rating baseado na eficiência vs CDI

### 2. Nova página: `src/pages/CollarTracker.tsx`
- Similar ao `BoxTracker.tsx`: verifica acesso PRO/Admin
- Renderiza `CollarTrackerTab` dentro do `ProfessionalLayout`

### 3. Modificar: `src/App.tsx`
- Adicionar rota `/collar-tracker`

### 4. Modificar: `src/components/Header.tsx`
- Adicionar item "Collar Tracker" na navegação primária (com ícone Shield ou similar)

### 5. Modificar: `src/pages/AdminPanel.tsx`
- Adicionar toggle para ativar/desativar a aba Collar Tracker (persistido no Supabase ou localStorage)
- Quando desativado, o item não aparece no menu e a rota redireciona

## Detalhes Técnicos

- **Dados RTD utilizados**: ULT (último preço), PEX (strike), VEN (vencimento), OCP (oferta compra), OVD (oferta venda)
- **Cálculo de dias úteis e CDI do período**: reutilizar funções do BoxTrackerTab
- **Persistência**: famílias de ativos salvas em localStorage (mesmo padrão do Box Tracker)
- **3 cenários de rentabilidade**:
  - ↓ = lucro se preço cai até strike da put
  - ↑ = lucro se preço sobe até strike da call  
  - ↔ = lucro se preço fica no coeficiente (neutro)
- **Rating**: ★★★ se rent. > CDI em todos cenários, ★★ se parcial, ★ se abaixo

