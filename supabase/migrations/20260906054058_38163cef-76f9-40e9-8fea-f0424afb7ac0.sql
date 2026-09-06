CREATE TABLE public.usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  transcript TEXT NOT NULL,
  clarification TEXT,
  summary TEXT,
  intent TEXT,
  intent_label TEXT,
  confidence NUMERIC,
  region TEXT,
  branch TEXT,
  department TEXT,
  phone TEXT,
  source TEXT
);

GRANT INSERT ON public.usage_logs TO anon;
GRANT INSERT ON public.usage_logs TO authenticated;
GRANT ALL ON public.usage_logs TO service_role;

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log usage" ON public.usage_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX usage_logs_created_at_idx ON public.usage_logs (created_at DESC);