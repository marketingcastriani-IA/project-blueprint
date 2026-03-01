-- Garante que o RLS está ativo
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Users can update own simulation count" ON public.user_access;
DROP POLICY IF EXISTS "Users can view own access" ON public.user_access;

-- Política de leitura: Usuário vê apenas seus dados
CREATE POLICY "Users can view own access" ON public.user_access
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Política de atualização: Usuário pode atualizar seu próprio registro (necessário para o contador)
CREATE POLICY "Users can update own simulation count" ON public.user_access
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);