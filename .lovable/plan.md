

# Análise Completa do OpçõesX — Melhorias e Correções

## RESUMO EXECUTIVO

Analisei 100% do código: páginas, componentes, lógica financeira, banco de dados, segurança e UX. Encontrei **4 vulnerabilidades de segurança** (1 crítica), **3 bugs ativos**, e identifiquei **12 melhorias** organizadas por prioridade.

---

## 1. VULNERABILIDADES DE SEGURANÇA (CRÍTICO)

### 1.1 Escalação de Privilégios no `user_access` (CRÍTICO)
A RLS policy "Users can update own simulation count" permite que qualquer usuário autenticado altere **todos os campos** da sua linha — incluindo `status`, `plan_type`, `expires_at`. Um usuário pode se dar plano PRO gratuito com um simples `UPDATE` no console do navegador.

**Correção**: Criar uma função `SECURITY DEFINER` que só permite atualizar `simulations_count`, ou restringir a policy com `WITH CHECK` limitado a colunas específicas.

### 1.2 Falta de restrição de INSERT na `user_roles`
A policy "Admins can manage roles" usa o role `public` ao invés de `authenticated`. Sem uma policy de INSERT restritiva, há risco de auto-atribuição de admin.

**Correção**: Adicionar policy explícita que bloqueia INSERT para não-admins.

### 1.3 Upload irrestrito no bucket `email-images`
Qualquer usuário autenticado pode fazer upload. Deveria ser restrito a admins.

### 1.4 Leaked Password Protection desativado
Ativar nas configurações do Supabase Auth.

---

## 2. BUGS ATIVOS

### 2.1 `"use client"` desnecessário (Dashboard.tsx, AnalysisDetail.tsx)
`"use client"` é diretiva do Next.js. No Vite/React puro não faz nada, mas indica confusão de framework. Remover.

### 2.2 Warning: Function components cannot be given refs (Dashboard.tsx)
O console mostra erro de ref no `Dialog`. O componente `DialogContent` está tentando passar ref para um componente funcional sem `forwardRef`. Provavelmente causado pela versão do Radix UI ou por um wrapper customizado.

### 2.3 Uso excessivo de `as any` (145 ocorrências)
Tabelas como `site_settings` existem nos types mas são acessadas com `as any`, perdendo toda a type-safety. Também em `user_access`, `legs`, e `analyses` — campos como `status`, `closed_at` são forçados com `as any` nos updates.

**Correção**: Remover os casts `as any` e usar os tipos gerados do Supabase corretamente. A tabela `site_settings` já está tipada — não precisa de `from('site_settings' as any)`.

---

## 3. MELHORIAS DE PERFORMANCE

### 3.1 Dashboard.tsx — Arquivo monolítico (774 linhas)
O `PortfolioSummary` é um componente inteiro dentro do mesmo arquivo. O Dashboard mistura lógica de fetch, UI, estado e side effects.

**Melhoria**: Extrair `PortfolioSummary` para seu próprio arquivo. Extrair a lógica de save/AI para custom hooks (`useSaveAnalysis`, `useAIAnalysis`).

### 3.2 CollarTrackerTab.tsx — 1391 linhas
Arquivo gigante com tudo inline. Funções utilitárias (`calcDiasUteis`, `formatBRL`, `extractStrikeFromTicker`) duplicadas entre BoxTracker e CollarTracker.

**Melhoria**: Mover funções compartilhadas para `src/lib/b3-utils.ts`. Extrair sub-componentes (CollarResultCard, CollarPayoffChart).

### 3.3 `calculateMetrics` chama `generatePayoffCurve` internamente
Em `payoff.ts`, `calculateMetrics` gera uma curva de 1000 pontos para encontrar max/min. Depois o Dashboard gera outra curva de 200 pontos para o gráfico. Isso duplica o cálculo.

**Melhoria**: Calcular métricas a partir da curva já gerada, ou cachear.

### 3.4 `PortfolioSummary` faz fetch sem React Query
Usa `useEffect` + `useState` direto, sem cache nem stale-while-revalidate. Se o usuário navega e volta, refaz o fetch.

**Melhoria**: Migrar para `useQuery` do TanStack Query.

---

## 4. MELHORIAS DE UX

### 4.1 Sem feedback de loading na landing page (Index.tsx)
A página busca `proPrice` do Supabase mas não mostra skeleton/loader enquanto carrega.

### 4.2 Sem tratamento de erro no `PortfolioSummary`
Se o fetch falha, o componente simplesmente não renderiza nada — sem mensagem de erro.

### 4.3 Botão "Analisar IA" aparece 3 vezes
O mesmo botão está no topo, no fundo e na sticky bar. Poluição visual.

**Melhoria**: Manter apenas na sticky bar (que já é fixa e sempre visível).

### 4.4 Feature flag do Collar via localStorage
O toggle do Admin Panel usa `localStorage`, que é local ao navegador. Outro admin ou outro dispositivo não verá a mudança.

**Melhoria**: Mover feature flags para a tabela `site_settings` no Supabase.

---

## 5. MELHORIAS DE CÓDIGO

### 5.1 Função `incrementSimulations` está vazia
```typescript
const incrementSimulations = async () => {
  // No longer counting simulations - trial is time-based
};
```
Código morto. A contagem de simulações ainda é feita no `saveAnalysis`, mas a função está abandonada. Limpar.

### 5.2 Duplicação de lógica de fetch de preço PRO
`Index.tsx`, `Settings.tsx`, `AccessBlocked.tsx` e `AdminPanel.tsx` todos fazem o mesmo fetch de `site_settings` para o preço PRO. 

**Melhoria**: Criar hook `useProPrice()`.

### 5.3 Falta de error boundaries
Nenhum Error Boundary no app. Se um componente filho crashar (ex: gráfico com dados inválidos), o app inteiro cai.

**Melhoria**: Adicionar `ErrorBoundary` ao redor das rotas principais.

---

## 6. PLANO DE IMPLEMENTAÇÃO RECOMENDADO

```text
PRIORIDADE 1 — Segurança (URGENTE)
├── Corrigir RLS do user_access (restrição de colunas)
├── Adicionar policy de INSERT restritiva no user_roles
├── Restringir upload do bucket email-images a admins
└── Ativar Leaked Password Protection

PRIORIDADE 2 — Bugs
├── Remover "use client" dos arquivos Vite
├── Corrigir warning de ref no Dialog
└── Eliminar casts "as any" desnecessários

PRIORIDADE 3 — Performance & Código
├── Extrair PortfolioSummary + migrar para useQuery
├── Criar hook useProPrice()
├── Mover utils compartilhados (extractStrike, formatBRL)
├── Remover código morto (incrementSimulations)
└── Reduzir botões duplicados de "Analisar IA"

PRIORIDADE 4 — Arquitetura
├── Quebrar Dashboard.tsx em componentes menores
├── Quebrar CollarTrackerTab.tsx em sub-componentes
├── Adicionar ErrorBoundary global
└── Migrar feature flags para Supabase
```

---

## NOTAS POSITIVAS

- Arquitetura de autenticação bem feita com Supabase Auth + roles separados
- Cálculos financeiros (Black-Scholes, CDI, payoff) robustos e corretos
- UI/UX profissional com temas, responsividade e animações
- Sistema de detecção de estratégias (Collar, Covered Call, Spreads) bem implementado
- Integração RTD Bridge para dados em tempo real é diferencial competitivo

