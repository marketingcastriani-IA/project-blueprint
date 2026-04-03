# Auditoria Completa + Plano de Melhorias — Opções PRO X

## Auditoria por Seção

### 1. Dashboard (Nova Análise)

- **OK**: Formulário de pernas, payoff chart, métricas, IA, OCR, salvamento
- **Problema**: CDI hardcoded em 14.9% na History (linha 199) mas 14.65 no Dashboard
- **Falta**: Botão de limpar/resetar todas as pernas de uma vez; duplicar análise existente

### 2. Histórico (Operações)

- **OK**: Filtros por mês/ano, cards com métricas, PDF, encerrar/reabrir
- **Problema**: CDI hardcoded `0.149` na linha 199 (deveria usar `a.cdi_rate` ou 14.65% padrão)
- **Falta**: Busca por nome de análise/ativo; ordenação (mais recente/mais antigo/maior lucro)

### 3. Portfólio

- **OK**: Stats consolidados, filtros, PDF, vs CDI
- **Falta**: Gráfico de evolução do P&L ao longo do tempo (como o do Dashboard summary); exportação CSV

### 5. Rastreador de Box

- **OK**: Componente robusto com 1777 linhas, RTD bridge, ranking
- **Falta**: Nenhuma melhoria crítica identificada

### 6. Dados ao Vivo

- **OK**: RTD bridge, payoff, save para análise
- **Falta**: Nenhuma melhoria crítica

### 7. Diversificador

- **OK**: Estratégias, cores, risco, gráfico
- **Falta**: Nenhuma melhoria crítica

### 8. Analysis Detail

- **Problema**: Usa WebSocket próprio duplicado (linhas 39-78) em vez do `useSharedRtdBridge`
- **Falta**: Nenhuma funcional

### 9. Painel Administrativo

- **OK**: Users, filtros, email em massa, templates, feature flags, config API
- **Problemas encontrados**:
  - Só mostra 6 dos 11 templates de email por usuário (linha 686: `slice(0, 6)`)
  - Feature Flags tem só Collar Tracker — falta toggles para outras features
  - Falta: dashboard de receita (MRR, churn, conversão trial->PRO)
  - Falta: log de ações admin (quem aprovou, bloqueou, enviou email)
  - Falta: botão "Enviar Boas-vindas PRO" direto no card do usuário ao registrar compra
  - Falta: contagem de análises/pernas por usuário para entender engajamento
  - Falta: aba de "Métricas" com gráficos de crescimento de usuários

---

## Plano de Implementação

### Fase 1 — Correções e Melhorias Rápidas

1. **Corrigir CDI hardcoded na History** — usar `a.cdi_rate || 14.65` em vez de `0.149`
2. **Mostrar TODOS os 11 templates de email** no card do usuário (remover `slice(0, 6)`)
3. **Adicionar botão "Limpar Tudo"** no Dashboard para resetar pernas de uma vez
4. **Adicionar busca por nome/ativo** no Histórico

### Fase 2 — Painel Admin Avançado

5. **Aba "Métricas"** no Admin com:
  - Gráfico de crescimento de usuários (cadastros por semana/mês)
  - Receita estimada (PROs ativos × preço)
  - Taxa de conversão Trial → PRO
  - Churn rate (vencidos que não renovaram)
  - Engajamento médio (simulações por usuário)
6. **Auto-envio de Boas-vindas PRO** ao registrar compra manualmente (botão integrado)
7. **Mais Feature Flags**: Box Tracker, Calculadora CDI, Diversificador (para lançamentos graduais)
8. **Contagem de análises por usuário** visível no card admin

### Fase 3 — Melhorias de UX

9. **Gráfico de evolução P&L** no Portfólio (reutilizar o AreaChart do Dashboard)
10. **Ordenação no Histórico** (por data, lucro, nome)
11. **AnalysisDetail usar `useSharedRtdBridge**` em vez de WebSocket duplicado

### Detalhes Técnicos

**Correção CDI History (linha 199)**:

```typescript
// DE: absInvestido * (Math.pow(1 + 0.149, bizDays / 252) - 1)
// PARA: absInvestido * (Math.pow(1 + (a.cdi_rate || 14.65) / 100, bizDays / 252) - 1)
```

**Admin Métricas**: Novo `TabsTrigger value="metrics"` com queries ao Supabase para agregação de dados de `user_access` e `analyses`. Sem necessidade de novas tabelas — tudo calculado em runtime a partir dos dados existentes.

**Feature Flags**: Expandir o pattern existente de `localStorage` + `storage event` para novas flags, mantendo a sincronização cross-tab.