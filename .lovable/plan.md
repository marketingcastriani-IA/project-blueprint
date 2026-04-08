

# Melhorias por Aba/Funcionalidade — Opções PRO X

## 1. Dashboard (Análise) — 813 linhas, arquivo monolítico

**Problemas:**
- Arquivo gigante (813 linhas) com `PortfolioSummary` embutido — dificulta manutenção
- `PortfolioSummary` faz fetch direto no `useEffect` sem TanStack Query (sem cache, sem retry, sem dedup)
- `aiAnalysis` tipado como `any` — viola as regras do projeto
- Botão "Analisar IA" com `animate-pulse` permanente é distrativo
- Barra flutuante inferior repete os mesmos botões que já existem acima — confuso
- Nenhum feedback de progresso na análise de IA (só spinner genérico)

**Melhorias:**
- Extrair `PortfolioSummary` para componente separado com `useQuery`
- Criar tipo `AIAnalysisResult` em `types.ts` e tipar corretamente
- Substituir `animate-pulse` no botão IA por destaque estático (glow) — pulsar só enquanto carrega
- Adicionar barra de progresso com etapas na análise IA ("Enviando estrutura → Processando → Gerando relatório")
- Barra flutuante: mostrar apenas quando o usuário scrollou para baixo (longe dos botões originais)

---

## 2. Operações (History) — 566 linhas

**Problemas:**
- Não tem paginação — carrega todas as análises de uma vez
- Busca é apenas por nome, não por ativo subjacente ou tipo de estratégia
- Sem confirmação ao deletar análise (ação irreversível)

**Melhorias:**
- Adicionar paginação (20 por página) ou scroll infinito
- Expandir busca para incluir `underlying_asset` e `ai_suggestion`
- Dialog de confirmação antes de deletar ("Tem certeza? Esta ação não pode ser desfeita")

---

## 3. Portfólio — 577 linhas

**Problemas:**
- Gráfico de evolução P&L usa gradiente fixo verde mesmo quando resultado é negativo
- Sem comparação direta com benchmark (CDI acumulado no mesmo período)

**Melhorias:**
- Gradiente do gráfico muda para vermelho quando P&L acumulado é negativo
- Adicionar linha CDI acumulada no gráfico de evolução para comparação visual

---

## 4. Rastrear Box — 1975 linhas (MUITO grande)

**Problemas:**
- Arquivo com quase 2000 linhas — extremamente difícil de manter
- Configurações salvas em localStorage (perdem-se ao trocar de dispositivo)
- Não há loading state ao importar tickers do banco B3

**Melhorias:**
- Refatorar em sub-componentes: `BoxFamilyManager`, `BoxResultsTable`, `BoxAlertPanel`
- Adicionar skeleton/spinner ao importar tickers
- Preparar migração de localStorage para Supabase (conforme roadmap)

---

## 5. Collar Tracker — 1788 linhas

**Mesmos problemas do Box Tracker:**
- Arquivo monolítico
- localStorage para persistência

**Melhorias adicionais:**
- Compartilhar componentes comuns com Box (tabela de resultados, painel de alertas, ranking com troféus)
- Criar componentes reutilizáveis: `TrackerAlertPanel`, `TrackerRanking`, `TrackerFamilyManager`

---

## 6. Tempo Real (DadosAoVivo) — 840 linhas

**Problemas:**
- Sem auto-save das pernas adicionadas (se recarregar a página, perde tudo)
- Gráfico de payoff recalcula a cada render sem debounce

**Melhorias:**
- Salvar estado das pernas no sessionStorage para persistir entre reloads
- Debounce no recalculo do payoff (300ms)

---

## 7. Opções B3 (TickerOpcoes) — 967 linhas

**Problemas:**
- Tabela renderiza todos os resultados filtrados sem virtualização (pode ficar lento com 5000+ opções)
- Sem indicador de "última atualização" dos dados

**Melhorias:**
- Implementar virtualização da tabela (react-window ou limitar exibição a 100 rows com "carregar mais")
- Mostrar timestamp da última atualização do banco de opções

---

## 8. Calculadora CDI x Opções — 651 linhas

**Problemas:**
- Sem validação: aceita datas de vencimento no passado sem aviso
- Gráfico de barras não mostra valores exatos nas barras

**Melhorias:**
- Validar que data de vencimento > data de início
- Adicionar labels com valores nas barras do gráfico

---

## 9. Diversificador — 1013 linhas

**Problemas:**
- Cores fixas hardcoded, sem preview visual antes de selecionar
- Percentuais podem somar mais de 100% sem aviso claro

**Melhorias:**
- Adicionar validação visual em tempo real quando soma > 100% (borda vermelha + aviso)
- Preview da cor selecionada no seletor

---

## 10. Header — 291 linhas

**Problemas:**
- Menu mobile não fecha ao navegar (precisa clicar X)
- Indicador RTD com `animate-pulse` constante consome recursos visuais

**Melhorias:**
- Fechar menu mobile automaticamente ao clicar em qualquer link
- RTD: pulsar apenas nos primeiros 3 segundos após conectar, depois ficar estático

---

## 11. Melhorias Gerais (Cross-cutting)

| Area | Melhoria |
|------|----------|
| Performance | Dashboard.tsx deve ser refatorado em 4-5 componentes menores |
| Segurança | Admin check via localStorage deve migrar para Supabase RLS (roadmap) |
| UX | Adicionar skeleton loading em TODAS as páginas (algumas só mostram tela branca) |
| Dados | Box/Collar: migrar de localStorage para Supabase para multi-dispositivo |
| Acessibilidade | Botões sem `aria-label`, tabelas sem `caption` |

---

## Prioridade Sugerida

1. **Refatorar Dashboard.tsx** em componentes menores (maior impacto em manutenção)
2. **Confirmação de delete** no History (previne perda de dados)
3. **Paginação** no History (performance)
4. **Virtualização** da tabela Opções B3 (performance com dados grandes)
5. **Validações** na Calculadora CDI (UX)
6. **Barra flutuante inteligente** no Dashboard (UX)
7. **Refatorar Box/Collar** em sub-componentes (manutenção)

---

## Detalhes Técnicos

- Refatoração do Dashboard: extrair `PortfolioSummary`, `InputModeSelector`, `AnalysisToolbar`, `FloatingBar` como componentes em `src/components/dashboard/`
- Paginação: usar `.range()` do Supabase com estado `page` e `pageSize`
- Virtualização: `react-window` com `FixedSizeList` na tabela de opções
- Tipo AI: criar `interface AIAnalysisResult { summary: string; risk_level: string; pros: string[]; cons: string[]; verdict: string; ... }` em `types.ts`

