-- Sincroniza o repo com o schema já existente em produção:
-- a tabela site_settings foi criada pelo painel e nunca entrou nas migrações.
-- Idempotente (IF NOT EXISTS / DROP POLICY IF EXISTS) para não conflitar ao aplicar.

CREATE TABLE IF NOT EXISTS public.site_settings (
  id text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read site_settings" ON public.site_settings;
CREATE POLICY "Allow public read site_settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow admin manage site_settings" ON public.site_settings;
CREATE POLICY "Allow admin manage site_settings"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
