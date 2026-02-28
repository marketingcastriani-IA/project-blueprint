
-- Add closed_at timestamp to track when operation was closed
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
