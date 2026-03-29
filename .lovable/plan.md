

# Payoff Conjunto — Nova Página PRO

## Resumo
Criar uma nova página `/payoff-conjunto` acessível via menu principal, exclusiva para usuários PRO. A página permite selecionar múltiplas análises salvas do histórico e sobrepor seus gráficos de payoff num único chart, com uma curva consolidada (soma).

## O que o usuário verá

1. Nova aba no menu principal: **"Payoff Conjunto"** (ícone Layers)
2. Página com:
   - Lista de análises ativas do usuário (checkboxes para selecionar)
   - Gráfico Recharts com uma linha de payoff por estratégia selecionada (cores distintas)
   - Linha consolidada (soma de todos os payoffs) em destaque
   - Legenda com nome de cada estratégia e cor correspondente
   - Métricas consolidadas: Lucro Máx, Risco Máx, Breakevens
3. Bloqueio para usuários FREE com CTA para assinar PRO

## Arquivos a criar/editar

### 1. `src/pages/PayoffConjunto.tsx` (novo)
- Busca análises ativas do usuário no Supabase (analyses + legs)
- Checkboxes para selecionar quais estratégias sobrepor
- Gera payoff curve para cada análise selecionada via `generatePayoffCurve()`
- Calcula curva consolidada somando `profitAtExpiry` ponto a ponto
- Gráfico `ComposedChart` com:
  - Uma `<Line>` por estratégia (cores automáticas do array de cores)
  - Uma `<Line>` grossa tracejada para o consolidado
  - `<ReferenceLine y={0}>`
- Cards de métricas consolidadas
- Gate PRO: se `planType !== 'pro'`, mostra overlay com botão "Assine PRO"

### 2. `src/components/Header.tsx` (editar)
- Adicionar item no `navItems`: `{ label: 'Payoff Conjunto', path: '/payoff-conjunto', icon: Layers }`

### 3. `src/App.tsx` (editar)
- Importar e adicionar rota: `<Route path="/payoff-conjunto" element={<PayoffConjunto />} />`

### 4. `src/pages/Index.tsx` (editar)
- Adicionar "Payoff Conjunto de Estratégias" na lista de features PRO

## Detalhes Técnicos

- Reutiliza `generatePayoffCurve()` de `src/lib/payoff.ts` para cada análise
- Normaliza os pontos para o mesmo eixo X (range unificado baseado no min/max de todas as estratégias)
- Array de 8 cores para distinguir cada estratégia
- Consolidado = soma dos `profitAtExpiry` de todas as curvas no mesmo ponto X
- Controle de acesso via `useAccessControl()` — bloqueia se `planType === 'free'`

