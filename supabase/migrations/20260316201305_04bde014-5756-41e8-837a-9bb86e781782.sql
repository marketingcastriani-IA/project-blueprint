
-- Table for saved diversification portfolios
CREATE TABLE public.diversificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  patrimonio numeric NOT NULL DEFAULT 100000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table for strategies within a diversification
CREATE TABLE public.diversificacao_estrategias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diversificacao_id uuid NOT NULL REFERENCES public.diversificacoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text DEFAULT '',
  cor_texto text DEFAULT '#a78bfa',
  risco text NOT NULL DEFAULT 'Baixo',
  ativo boolean NOT NULL DEFAULT true,
  percentual numeric NOT NULL DEFAULT 10,
  frequencia text NOT NULL DEFAULT 'Mensal',
  vezes integer NOT NULL DEFAULT 1,
  min_acoes integer NOT NULL DEFAULT 2,
  alavancagem numeric NOT NULL DEFAULT 1,
  obs text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for diversificacoes
ALTER TABLE public.diversificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own diversificacoes" ON public.diversificacoes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diversificacoes" ON public.diversificacoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own diversificacoes" ON public.diversificacoes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own diversificacoes" ON public.diversificacoes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS for diversificacao_estrategias
ALTER TABLE public.diversificacao_estrategias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own estrategias" ON public.diversificacao_estrategias
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diversificacoes WHERE id = diversificacao_id AND user_id = auth.uid()));

CREATE POLICY "Users can insert own estrategias" ON public.diversificacao_estrategias
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.diversificacoes WHERE id = diversificacao_id AND user_id = auth.uid()));

CREATE POLICY "Users can update own estrategias" ON public.diversificacao_estrategias
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diversificacoes WHERE id = diversificacao_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete own estrategias" ON public.diversificacao_estrategias
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diversificacoes WHERE id = diversificacao_id AND user_id = auth.uid()));

-- Trigger for updated_at on diversificacoes
CREATE TRIGGER update_diversificacoes_updated_at
  BEFORE UPDATE ON public.diversificacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
