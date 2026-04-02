

# Verificação do Plano — O que falta corrigir

## Status das melhorias

### ✅ Já implementado
- **A1**: Preço checkout corrigido para R$ 14,90
- **B1**: "Esqueci minha senha" adicionado
- **B2**: Texto corrigido para "7 dias grátis com acesso total"
- **C1**: Meta tags OG corrigidas para "Opções PRO X"
- **C2**: FAQ inline na landing page
- **D2**: Loading state na Auth com spinner
- **E2**: Modal upgrade usando tokens de tema
- **G1**: Admin carrega preço do banco (fallback 149.90)
- **A4**: Página de celebração pós-pagamento
- Branding "OpçõesX" → "Opções PRO X" corrigido

### ❌ Pendente — 3 itens restantes

#### 1. Webhook sem idempotência (A3 — ALTO)
O `mercado-pago-webhook/index.ts` processa qualquer notificação de pagamento sem verificar se o mesmo `payment_id` já foi processado. Se o Mercado Pago enviar a mesma notificação duas vezes, o `expires_at` será estendido em +31 dias indevidamente.

**Correção**: Antes de fazer o upsert, verificar se já existe um registro com `purchased_at` recente (últimos 5 minutos) para o mesmo `user_id`, OU registrar o `payment_id` processado e checar duplicatas.

#### 2. text-white no DadosAoVivo — header strip (E1 — contextual)
O `DadosAoVivo.tsx` usa ~30x `text-white` nos cards de operações, MAS estas estão dentro de um header strip com fundo escuro hardcoded (`from-[hsl(222,47%,11%)]`). No modo claro, o **fundo** escuro permanece, então `text-white` funciona. Porém o fundo hardcoded não respeita o tema. A correção ideal é trocar o gradiente para `from-card/90 to-card` e os textos para `text-foreground`.

**Decisão**: Isso é uma escolha de design — o header escuro é intencional para dar contraste ao card. Pode ser mantido como está ou refatorado para usar tokens.

#### 3. Calculadora CDI sem controle de acesso (D4)
`CalculadoraRendaFixa.tsx` não usa `useAccessControl()`. Qualquer usuário com trial expirado pode acessar. Se for feature PRO, adicionar gate; se for livre, manter como está.

---

## Plano de implementação (itens pendentes)

### Arquivo 1: `supabase/functions/mercado-pago-webhook/index.ts`
- Antes do upsert (linha 109), buscar o registro atual de `user_access` para o `userId`
- Se `purchased_at` existir e for < 5 minutos atrás, retornar `{ received: true, skipped: 'duplicate' }` sem estender
- Logar `payment_id` no console para auditoria

### Arquivo 2: `src/pages/DadosAoVivo.tsx` (opcional)
- Substituir gradiente hardcoded `from-[hsl(222,47%,11%)]` por `from-muted to-muted/80`
- Trocar `text-white` por `text-foreground` nos ~30 pontos do header strip
- Trocar `text-white/40`, `text-white/50`, `text-white/60` por `text-muted-foreground`

### Arquivo 3: `src/pages/CalculadoraRendaFixa.tsx` (decisão necessária)
- Adicionar `useAccessControl()` e gate PRO, ou manter livre

---

## Detalhes técnicos

**Idempotência no webhook** — abordagem simples sem nova tabela:
```typescript
// Antes do upsert, checar se já processou recentemente
const { data: existing } = await supabaseAdmin
  .from('user_access')
  .select('purchased_at')
  .eq('user_id', userId)
  .single();

if (existing?.purchased_at) {
  const lastPurchase = new Date(existing.purchased_at).getTime();
  const now = Date.now();
  if (now - lastPurchase < 5 * 60 * 1000) {
    console.log("[webhook] Pagamento duplicado ignorado");
    return new Response(JSON.stringify({ received: true, skipped: 'duplicate' }), ...);
  }
}
```

