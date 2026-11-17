-- Preserve original review/audit history; new reuse is driven only by consented feedback.
ALTER TABLE public.consultation_answers
 ADD COLUMN reuse_question text NOT NULL DEFAULT '' CHECK(length(reuse_question)<=500),
 ADD COLUMN reuse_answer text NOT NULL DEFAULT '' CHECK(length(reuse_answer)<=1200),
 ADD COLUMN reuse_valid_until timestamptz,
 ADD COLUMN feedback_satisfaction integer CHECK(feedback_satisfaction BETWEEN 1 AND 5),
 ADD COLUMN feedback_accuracy text CHECK(feedback_accuracy IN ('accurate','partly','inaccurate','unsure')),
 ADD COLUMN feedback_contact_completed boolean NOT NULL DEFAULT false,
 ADD COLUMN feedback_reuse_consent boolean NOT NULL DEFAULT false,
 ADD COLUMN feedback_submitted_at timestamptz;
CREATE INDEX consultation_answers_feedback ON public.consultation_answers(feedback_submitted_at DESC) WHERE feedback_submitted_at IS NOT NULL;

CREATE FUNCTION public.submit_answer_feedback(answer_id uuid,satisfaction integer,accuracy text,reuse_consent boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a public.consultation_answers;
BEGIN
 IF satisfaction IS NULL OR satisfaction NOT BETWEEN 1 AND 5 OR accuracy IS NULL OR accuracy NOT IN ('accurate','partly','inaccurate','unsure') OR reuse_consent IS NULL THEN
   RAISE EXCEPTION 'Invalid feedback';
 END IF;
 SELECT * INTO a FROM public.consultation_answers WHERE id=answer_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','missing'); END IF;
 IF a.feedback_submitted_at IS NOT NULL THEN
   IF a.feedback_satisfaction=satisfaction AND a.feedback_accuracy=accuracy AND a.feedback_reuse_consent=reuse_consent THEN RETURN to_jsonb(a); END IF;
   RETURN jsonb_build_object('error','conflict');
 END IF;
 UPDATE public.consultation_answers SET feedback_satisfaction=satisfaction,feedback_accuracy=accuracy,
   feedback_contact_completed=true,feedback_reuse_consent=reuse_consent,feedback_submitted_at=now()
 WHERE id=answer_id RETURNING * INTO a;
 RETURN to_jsonb(a);
END $$;
REVOKE ALL ON FUNCTION public.submit_answer_feedback(uuid,integer,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_answer_feedback(uuid,integer,text,boolean) TO service_role;

CREATE FUNCTION public.search_satisfied_answers(search_text text,search_domain text,current_version text)
RETURNS TABLE(id uuid,intent text,category text,question text,answer text,source_reference text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH q AS (SELECT regexp_replace(lower(left(search_text,4000)),'[^가-힣a-z0-9]','','g') AS text),
 grams AS (SELECT DISTINCT substr(q.text,n,3) AS token FROM q,generate_series(1,greatest(length(q.text)-2,0)) n),
 ranked AS (
   SELECT a.*, (SELECT count(*) FROM grams WHERE strpos(regexp_replace(lower(a.reuse_question || ' ' || a.reuse_answer),'[^가-힣a-z0-9]','','g'),token)>0) AS matches
   FROM public.consultation_answers a WHERE a.status NOT IN ('rejected','retired')
    AND a.feedback_contact_completed AND a.feedback_reuse_consent AND a.feedback_satisfaction>=4 AND a.feedback_accuracy='accurate'
    AND a.feedback_submitted_at IS NOT NULL AND a.reuse_valid_until>now() AND length(a.reuse_question)>0 AND length(a.reuse_answer)>0
    AND a.domain=search_domain AND a.knowledge_version=current_version
 ), deduplicated AS (
  SELECT *, row_number() OVER(PARTITION BY intent,reuse_answer ORDER BY feedback_satisfaction DESC,feedback_submitted_at DESC,id) AS duplicate_rank
  FROM ranked WHERE matches>=2
 )
 SELECT id,intent,category,reuse_question,reuse_answer,'사용자 만족도 기반·현행 업무자료 발췌'::text FROM deduplicated
 WHERE duplicate_rank=1 ORDER BY matches DESC,feedback_satisfaction DESC,feedback_submitted_at DESC,id LIMIT 3;
$$;
REVOKE ALL ON FUNCTION public.search_satisfied_answers(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.search_satisfied_answers(text,text,text) TO service_role;
-- Keep old RPC signature for clients during deployment, but remove the approval-only path.
CREATE OR REPLACE FUNCTION public.search_approved_answers(search_text text,search_domain text,current_version text)
RETURNS TABLE(id uuid,intent text,category text,question text,answer text,source_reference text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT * FROM public.search_satisfied_answers(search_text,search_domain,current_version);
$$;
