-- Permite que usuários autenticados atualizem seu próprio registro na tabela user_access
-- Isso é necessário para que o contador de simulações funcione via client-side
CREATE POLICY "Users can update own simulation count" ON public.user_access
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);