CREATE TABLE public.farmer_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content TEXT NOT NULL,
  age_group TEXT,
  farming_years TEXT,
  gender TEXT,
  region TEXT,
  source TEXT
);

GRANT INSERT ON public.farmer_voices TO anon;
GRANT INSERT ON public.farmer_voices TO authenticated;
GRANT ALL ON public.farmer_voices TO service_role;

ALTER TABLE public.farmer_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can leave a voice" ON public.farmer_voices
  FOR INSERT TO anon, authenticated WITH CHECK (true);