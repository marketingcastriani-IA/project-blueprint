-- Habilitar RLS na tabela (caso não esteja)
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas conflitantes se existirem
DROP POLICY IF EXISTS "Users can update own simulation count" ON public.user_access;
DROP POLICY IF EXISTS "Users can view own access" ON public.user_access;

-- Política para visualização
CREATE POLICY "Users can view own access" ON public.user_access
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Política para atualização (necessária para o contador)
CREATE POLICY "Users can update own simulation count" ON public.user_access
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);