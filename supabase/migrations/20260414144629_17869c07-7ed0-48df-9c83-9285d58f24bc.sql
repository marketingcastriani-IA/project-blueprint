
-- Add resolved flag and reply history to sugestoes
ALTER TABLE public.sugestoes 
ADD COLUMN resolved boolean NOT NULL DEFAULT false,
ADD COLUMN reply_history jsonb DEFAULT '[]'::jsonb;

-- Allow admins to update sugestoes (for resolved flag and reply_history)
CREATE POLICY "Admins can update suggestions"
ON public.sugestoes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete suggestions
CREATE POLICY "Admins can delete suggestions"
ON public.sugestoes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
