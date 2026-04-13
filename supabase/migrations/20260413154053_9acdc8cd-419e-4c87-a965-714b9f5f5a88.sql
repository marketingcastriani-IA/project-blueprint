UPDATE public.user_access 
SET plan_type = 'pro', 
    status = 'approved', 
    purchased_at = now(), 
    expires_at = now() + interval '31 days'
WHERE user_id = '82ed8286-9d2d-4144-bae0-cabf032f1ea5';
