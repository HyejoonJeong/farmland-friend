-- Private consultation review queue. All access passes through the server API.
CREATE TABLE public.consultation_answers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 domain text NOT NULL CHECK(domain IN ('farmland','survey')),
 category text NOT NULL, intent text NOT NULL,
 original_question text NOT NULL CHECK(length(original_question) BETWEEN 1 AND 2000),
 original_answer text NOT NULL CHECK(length(original_answer) BETWEEN 1 AND 6000),
 conversation_context jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(conversation_context)='array' AND jsonb_array_length(conversation_context)<=6 AND length(conversation_context::text)<=30000),
 question text NOT NULL CHECK(length(question) BETWEEN 1 AND 2000),
 answer text NOT NULL CHECK(length(answer) BETWEEN 1 AND 6000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','retired')),
 source_reference text NOT NULL DEFAULT '', reviewer text NOT NULL DEFAULT '',
 reviewed_at timestamptz, valid_until timestamptz,
 knowledge_version text NOT NULL,
 reference_ids uuid[] NOT NULL DEFAULT '{}',
 revision integer NOT NULL DEFAULT 1,
 CHECK ((intent,category) IN (('farmland_trade_sell','농지 팔기'),('public_reserve_purchase','농지 팔기'),('farmland_sale_trust','농지 팔기'),('management_recovery','농업경영 위기·부채'),('orchard_trade_sell','과원 관련'),('long_term_lease_out','농지 빌려주기'),('farmland_lease_trust_out','농지 빌려주기'),('orchard_lease_out','과원 관련'),('farmland_trade_buy','농지 구매하기'),('lease_then_sale','농지 구매하기'),('orchard_trade_buy','과원 관련'),('reserve_farmland_lease','농지 빌리기'),('long_term_lease_in','농지 빌리기'),('farmland_lease_trust_in','농지 빌리기'),('orchard_lease_in','과원 관련'),('reserve_smartfarm','스마트팜'),('land_exchange','농지 바꾸기·모으기'),('retirement_direct_payment','고령농 은퇴·농지이양'),('farmland_pension','농지연금'),('damaged_farmland','훼손농지'),('farming_tech','영농기술·재배·농기계'),('gap_certification','농업경영체·직불제·인증'),('farmland_survey','농지 전수조사'),('general_consult','기타 / 분류 불확실'))),
 CHECK(status <> 'approved' OR (length(answer)<=1200 AND length(trim(source_reference))>0 AND length(trim(reviewer))>0 AND reviewed_at IS NOT NULL AND valid_until>reviewed_at))
);
CREATE INDEX consultation_answers_queue ON public.consultation_answers(status,created_at DESC);
CREATE INDEX consultation_answers_retrieval ON public.consultation_answers(domain,knowledge_version,valid_until) WHERE status='approved';
CREATE TABLE public.consultation_answer_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 answer_id uuid NOT NULL REFERENCES public.consultation_answers(id),
 recorded_at timestamptz NOT NULL DEFAULT now(), snapshot jsonb NOT NULL
);
ALTER TABLE public.consultation_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_answer_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consultation_answers, public.consultation_answer_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.consultation_answers TO service_role;
GRANT SELECT, INSERT ON public.consultation_answer_audit TO service_role;
GRANT USAGE ON SEQUENCE public.consultation_answer_audit_id_seq TO service_role;

CREATE FUNCTION public.version_consultation_answer() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.original_question IS DISTINCT FROM OLD.original_question OR NEW.original_answer IS DISTINCT FROM OLD.original_answer OR NEW.domain IS DISTINCT FROM OLD.domain OR NEW.conversation_context IS DISTINCT FROM OLD.conversation_context THEN
   RAISE EXCEPTION 'Original consultation is immutable';
 END IF;
 NEW.revision := OLD.revision+1;
 NEW.updated_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER consultation_answer_version BEFORE UPDATE ON public.consultation_answers FOR EACH ROW EXECUTE FUNCTION public.version_consultation_answer();
CREATE FUNCTION public.audit_consultation_answer() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 INSERT INTO public.consultation_answer_audit(answer_id,snapshot) VALUES(NEW.id,to_jsonb(NEW));
 RETURN NEW;
END $$;
CREATE TRIGGER consultation_answer_history AFTER INSERT OR UPDATE ON public.consultation_answers FOR EACH ROW EXECUTE FUNCTION public.audit_consultation_answer();

-- Korean substrings avoid a language-specific tokenizer and require no embedding call.
-- The AI still checks category/intent and applicability before using a retrieved example.
CREATE FUNCTION public.search_approved_answers(search_text text,search_domain text,current_version text)
RETURNS TABLE(id uuid,intent text,category text,question text,answer text,source_reference text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH q AS (SELECT regexp_replace(lower(left(search_text,4000)),'[^가-힣a-z0-9]','','g') AS text),
 grams AS (SELECT DISTINCT substr(q.text,n,3) AS token FROM q,generate_series(1,greatest(length(q.text)-2,0)) n),
 ranked AS (
  SELECT a.*, (SELECT count(*) FROM grams WHERE strpos(regexp_replace(lower(a.question),'[^가-힣a-z0-9]','','g'),token)>0) AS matches
  FROM public.consultation_answers a
  WHERE a.status='approved' AND a.valid_until>now() AND a.reviewed_at IS NOT NULL
    AND a.domain=search_domain AND a.knowledge_version=current_version
 )
 SELECT id,intent,category,question,answer,source_reference FROM ranked
 WHERE matches>=2
 ORDER BY matches DESC,reviewed_at DESC,id LIMIT 3;
$$;
REVOKE ALL ON FUNCTION public.search_approved_answers(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.search_approved_answers(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.version_consultation_answer(),public.audit_consultation_answer() FROM PUBLIC,anon,authenticated;
