ALTER TABLE public.legs DROP CONSTRAINT legs_option_type_check;
ALTER TABLE public.legs ADD CONSTRAINT legs_option_type_check CHECK (option_type IN ('call', 'put', 'stock'));