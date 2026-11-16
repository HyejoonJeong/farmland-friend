-- Includes the schema originally managed by Drizzle, which supabase db push does not apply.
CREATE TABLE IF NOT EXISTS public.farmer_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  content text NOT NULL,
  age_group text,
  farming_years text,
  gender text,
  region text,
  source text
);
ALTER TABLE public.farmer_voices ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.farmer_voices TO anon, authenticated;
GRANT ALL ON public.farmer_voices TO service_role;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'farmer_voices' AND policyname = 'Anyone can leave a voice') THEN
    CREATE POLICY "Anyone can leave a voice" ON public.farmer_voices FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;
ALTER TABLE public.usage_logs
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS candidates text[],
  ADD COLUMN IF NOT EXISTS classification_status text,
  ADD COLUMN IF NOT EXISTS clarify_trail jsonb;
CREATE INDEX IF NOT EXISTS farmer_voices_created_at_idx ON public.farmer_voices (created_at DESC);

-- A durable, atomic limiter shared across Edge Function instances. Raw IP addresses are not stored.
CREATE TABLE IF NOT EXISTS public.ai_request_limits (
  bucket text PRIMARY KEY,
  window_started timestamptz NOT NULL,
  hits bigint NOT NULL DEFAULT 1
);
ALTER TABLE public.ai_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_request_limits FROM anon, authenticated;
GRANT ALL ON public.ai_request_limits TO service_role;
CREATE INDEX IF NOT EXISTS ai_request_limits_window_idx ON public.ai_request_limits (window_started);
CREATE OR REPLACE FUNCTION public.consume_ai_request(client_hash text, per_minute integer, per_day integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  minute_start timestamptz := date_trunc('minute', now());
  day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  minute_hits bigint;
  daily_hits bigint;
BEGIN
  IF length(client_hash) <> 64 OR per_minute < 1 OR per_day < 1 THEN RETURN false; END IF;
  INSERT INTO public.ai_request_limits(bucket, window_started) VALUES ('minute:' || client_hash || ':' || minute_start::text, minute_start)
    ON CONFLICT(bucket) DO UPDATE SET hits = public.ai_request_limits.hits + 1 RETURNING hits INTO minute_hits;
  IF minute_hits > per_minute THEN RETURN false; END IF;
  INSERT INTO public.ai_request_limits(bucket, window_started) VALUES ('day:' || day_start::text, day_start)
    ON CONFLICT(bucket) DO UPDATE SET hits = public.ai_request_limits.hits + 1 RETURNING hits INTO daily_hits;
  DELETE FROM public.ai_request_limits WHERE window_started < now() - interval '2 days';
  RETURN daily_hits <= per_day;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_request(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_request(text, integer, integer) TO service_role;
