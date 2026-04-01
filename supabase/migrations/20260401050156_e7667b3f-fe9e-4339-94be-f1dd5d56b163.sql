
-- 1. Create security definer function to safely increment simulations
CREATE OR REPLACE FUNCTION public.increment_simulation_count(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_access
  SET simulations_count = COALESCE(simulations_count, 0) + 1
  WHERE user_id = _user_id;
END;
$$;

-- 2. Drop the overly permissive UPDATE policy on user_access
DROP POLICY IF EXISTS "Users can update own simulation count" ON public.user_access;

-- 3. Create restricted UPDATE policy - users can ONLY update simulations_count
CREATE POLICY "Users can increment own simulation count"
ON public.user_access
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status = (SELECT ua.status FROM public.user_access ua WHERE ua.user_id = auth.uid())
  AND plan_type = (SELECT ua.plan_type FROM public.user_access ua WHERE ua.user_id = auth.uid())
  AND expires_at IS NOT DISTINCT FROM (SELECT ua.expires_at FROM public.user_access ua WHERE ua.user_id = auth.uid())
  AND purchased_at IS NOT DISTINCT FROM (SELECT ua.purchased_at FROM public.user_access ua WHERE ua.user_id = auth.uid())
  AND trial_days IS NOT DISTINCT FROM (SELECT ua.trial_days FROM public.user_access ua WHERE ua.user_id = auth.uid())
);

-- 4. Restrict INSERT on user_roles to admins only (prevent self-role-assignment)
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
