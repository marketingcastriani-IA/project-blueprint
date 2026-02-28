
-- Fix constraint to allow 'stock' option type
ALTER TABLE public.legs DROP CONSTRAINT IF EXISTS legs_option_type_check;
ALTER TABLE public.legs ADD CONSTRAINT legs_option_type_check CHECK (option_type IN ('call', 'put', 'stock'));

-- Add current_price column for tracking market prices
ALTER TABLE public.legs ADD COLUMN IF NOT EXISTS current_price numeric;
