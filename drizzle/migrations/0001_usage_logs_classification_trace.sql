ALTER TABLE public.usage_logs
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS candidates text[],
  ADD COLUMN IF NOT EXISTS classification_status text,
  ADD COLUMN IF NOT EXISTS clarify_trail jsonb;