

## Plano de Implementação

### 1. Admin Panel — Campo editável de data de vencimento + mais informações

**Arquivo:** `src/pages/AdminPanel.tsx`

- Adicionar um **input de data** editável no card de cada usuário para o admin definir/alterar a `expires_at`
- Ao alterar a data, fazer `UPDATE` na tabela `user_access` com a nova `expires_at`
- Adicionar mais informações úteis no card:
  - **Plano atual** destacado visualmente
  - **Dias restantes** até o vencimento (calculado automaticamente)
  - **Última atualização** do registro
  - **Notas** (campo editável para o admin adicionar observações sobre o cliente)

### 2. Toggles "Aplicar IR" — Destaque amarelo

**Arquivo:** `src/components/CDIComparison.tsx`

- Estilizar os dois `Switch` ("Aplicar IR no CDI" e "Aplicar IR nas opções") com cor amarela/warning
- Adicionar background amarelo nos labels e um badge visual para que fiquem mais visíveis
- Usar classes como `bg-warning/20 border-warning/40 text-warning` para destacar

### 3. Botão "Analisar a Estrutura por IA" — Sticky no Header + Pulsando

**Arquivo:** `src/components/Header.tsx` e `src/pages/Dashboard.tsx`

- No **Header**, adicionar um botão fixo "Analisar a Estrutura por IA" que só aparece quando o usuário está na rota `/dashboard` e tem pernas adicionadas
- O botão terá animação `animate-pulse` e estilo destacado (cor primária com glow)
- Renomear o texto de "Sugestão IA" para **"Analisar a Estrutura por IA"** em todos os locais
- Para comunicação entre Dashboard e Header, usar um estado via **callback prop** ou um pequeno contexto/store

**Abordagem técnica para o botão sticky:** Em vez de modificar o Header (que não tem acesso ao estado de legs), criar uma **barra flutuante fixa** (`fixed bottom-0` ou `sticky top-14`) dentro do próprio Dashboard que aparece quando `legs.length > 0`, contendo o botão "Analisar a Estrutura por IA" pulsando. Isso é mais simples e evita prop drilling.

### Resumo das alterações

| Arquivo | Mudança |
|---|---|
| `src/pages/AdminPanel.tsx` | Input de data editável para vencimento, dias restantes, campo de notas |
| `src/components/CDIComparison.tsx` | Switches IR com destaque amarelo/warning |
| `src/pages/Dashboard.tsx` | Renomear botão IA, adicionar barra flutuante sticky com botão pulsando |

