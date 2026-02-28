
# Liberar Edição do Preço do Ativo (Stock)

## Problema Identificado
No arquivo `src/components/LegsTable.tsx`:
1. **Linha 134**: O campo "Preço" tem `disabled={isStock}` - isso bloqueia completamente a edição quando o tipo é "Ativo"
2. **Linha 106**: Quando o Strike do stock é editado, o código força `price: 0` automaticamente

## Solução

### Arquivo: `src/components/LegsTable.tsx`

1. **Remover `disabled={isStock}`** (linha 134) - liberar o campo Preço para edição em todos os tipos de perna, incluindo stock

2. **Remover `price: 0` forçado** (linha 106) - quando o strike do stock é editado, não zerar o preço automaticamente. Mudar de:
   ```
   onUpdate(i, { ...leg, strike: val, price: 0 });
   ```
   Para:
   ```
   onUpdate(i, { ...leg, strike: val });
   ```

3. **Atualizar estilo visual** do campo Preço para stock - trocar o estilo "desabilitado" (cinza/muted) para o mesmo estilo verde do Strike, indicando que o campo é editável:
   ```
   isStock && "border-primary/40 bg-gradient-to-r from-primary/20 to-primary/10 text-primary font-black"
   ```

Essas 3 mudanças são simples e pontuais, todas no mesmo arquivo `LegsTable.tsx`.
