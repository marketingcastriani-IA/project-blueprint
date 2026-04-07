

# Tema Claro Padrão + Rodapé Global + Melhorias Gerais

## 1. Iniciar o app sempre em modo claro

**Arquivo**: `src/contexts/ThemeContext.tsx`
- Alterar o fallback padrão de `'dark'` para `'light'` na inicialização do estado (linha 16)
- Na primeira visita (sem localStorage), o app abrirá em modo claro

## 2. Rodapé global com logo e email

**Novo arquivo**: `src/components/Footer.tsx`
- Criar um componente `Footer` reutilizável com:
  - Logo (`/assets/logo.png`) + nome "Opções PRO X"
  - Email de contato (ex: contato@opcoesprox.com.br) com link `mailto:`
  - Aviso legal compacto
  - Ano dinâmico (2025)
  - Estilo: `border-t`, `bg-muted/20`, responsivo, compacto

**Arquivo**: `src/App.tsx`
- Importar o `Footer` e renderizá-lo dentro do `BrowserRouter`, logo após o `ErrorBoundary` com as rotas
- Exibir o footer em **todas as páginas** (landing + autenticadas)

**Arquivo**: `src/pages/Index.tsx`
- Remover o footer inline da landing page (linhas 551-562) para usar o global

## 3. Varredura de melhorias identificadas

Abaixo as melhorias que identifiquei ao analisar o app inteiro. Estas **não serão implementadas agora** — são sugestões para próximas iterações:

| Area | Melhoria |
|---|---|
| **Performance** | Dashboard.tsx tem 812 linhas — extrair PortfolioSummary e AnalysisWizard em componentes separados |
| **Performance** | Lazy load de rotas com `React.lazy()` + `Suspense` para reduzir o bundle inicial (17 páginas carregadas de uma vez) |
| **UX** | History.tsx e Portfolio.tsx não têm estado vazio com CTA — adicionar ilustração + botão "Criar primeira análise" |
| **UX** | Diversificador não tem skeleton loading (as outras páginas principais já têm) |
| **Acessibilidade** | Vários botões de ícone sem `aria-label` no Header e nas páginas |
| **SEO** | Páginas autenticadas sem `<title>` dinâmico — usar `document.title` ou react-helmet |
| **Segurança** | AdminLogin.tsx usa credenciais hardcoded no client-side — migrar para validação server-side |
| **Mobile** | Header com muitos itens no desktop row 1 pode sobrecarregar em telas 1024px — considerar agrupar em dropdown |
| **Dados** | Box Tracker e Collar Tracker não persistem configurações no Supabase — apenas localStorage (perde ao trocar device) |
| **Código** | Duplicação de lógica de preço PRO (`useProPrice`) entre Index.tsx e Settings.tsx — já está extraído mas os componentes de plano são duplicados |

---

## Arquivos afetados nesta implementação

| Arquivo | Mudança |
|---|---|
| `src/contexts/ThemeContext.tsx` | Default `'light'` ao invés de `'dark'` |
| `src/components/Footer.tsx` | **Novo** — componente de rodapé global |
| `src/App.tsx` | Adicionar `<Footer />` global |
| `src/pages/Index.tsx` | Remover footer inline duplicado |

