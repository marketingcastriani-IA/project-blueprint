
CREATE TABLE public.sugestoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'sugestao',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sugestoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own suggestions"
ON public.sugestoes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own suggestions"
ON public.sugestoes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all suggestions"
ON public.sugestoes FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
