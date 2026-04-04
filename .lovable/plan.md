

# Plano: Onboarding Guiado + Plano Anual com Desconto

## 1. Onboarding Guiado (Tour Interativo)

**Novo componente**: `src/components/OnboardingTour.tsx`
- Tour de 5 passos usando tooltips posicionados sobre elementos reais do Dashboard:
  1. "Escolha como inserir suas pernas" (botoes de input mode)
  2. "Defina nome, data e CDI" (campos do formulario)
  3. "Clique aqui para a IA analisar" (botao de IA)
  4. "Salve para acompanhar no historico" (botao Salvar)
  5. "Explore o Portfolio e Rastreadores" (menu do Header)
- Overlay escuro com highlight no elemento ativo
- Botoes "Proximo" / "Pular Tour" / indicador de progresso (1/5)
- Persistencia via `localStorage('onboarding_completed')`
- Renderizado condicionalmente no Dashboard apenas para novos usuarios (primeira visita)

**Alteracoes em**: `src/pages/Dashboard.tsx`
- Importar e renderizar `<OnboardingTour />` quando `!localStorage.getItem('onboarding_completed')` e usuario logado com pernas vazias

**Alteracoes em**: `src/pages/Settings.tsx`
- Adicionar botao "Reiniciar Tour" que limpa o localStorage

---

## 2. Plano Anual com Desconto

**Logica de pricing**: Preco anual = preco mensal x 12 com 20% de desconto (ex: R$14,90/mes -> R$142,56/ano, equivalente a R$11,88/mes)

**Alteracoes na Edge Function**: `supabase/functions/mercado-pago-checkout/index.ts`
- Aceitar parametro `plan_period: 'monthly' | 'yearly'` no body do request
- Calcular preco conforme periodo (mensal = price, anual = price * 12 * 0.8)
- Ajustar titulo do item no MP ("Plano Mensal" vs "Plano Anual")

**Alteracoes no Webhook**: `supabase/functions/mercado-pago-webhook/index.ts`
- Detectar se pagamento foi anual (pelo valor ou external_reference) e definir `expires_at` para 365 dias em vez de 31

**Alteracoes na Landing Page**: `src/pages/Index.tsx`
- Adicionar toggle "Mensal / Anual" na secao de pricing
- Mostrar badge "-20%" e preco riscado no card PRO quando anual selecionado

**Alteracoes em**: `src/pages/Settings.tsx` e `src/pages/AccessBlocked.tsx`
- Toggle mensal/anual nos CTAs de upgrade
- Passar `plan_period` ao invocar `mercado-pago-checkout`

**Alteracoes em**: `src/hooks/useProPrice.ts`
- Retornar tambem `annualPrice` calculado (price * 12 * 0.8)

---

## Detalhes Tecnicos

**Onboarding Tour** - Implementacao pura com CSS (sem lib externa):
```typescript
// Estado: step atual (0-4), refs dos elementos-alvo
// Cada step: { targetSelector, title, description, position }
// Overlay: fixed inset-0 bg-black/60 z-50
// Tooltip: absolute posicionado via getBoundingClientRect()
```

**Checkout anual** - Formato do request:
```typescript
// Frontend
supabase.functions.invoke('mercado-pago-checkout', { 
  body: { plan_period: 'yearly' } 
})

// Edge Function: external_reference = `${user.id}:yearly`
// Webhook: parse external_reference para detectar periodo
```

**Nenhuma migracao de banco necessaria** - toda a logica usa campos existentes (expires_at com 365 dias para anual).

