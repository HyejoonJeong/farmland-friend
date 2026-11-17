-- Extend the existing exact intent/category allowlist; keep every other constraint and RLS policy.
DO $$
DECLARE old_name text; old_count integer;
BEGIN
 SELECT count(*),min(conname) INTO old_count,old_name FROM pg_constraint
 WHERE conrelid='public.consultation_answers'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%farmland_trade_sell%'
 AND conname <> 'consultation_answers_intent_category_v2';
 IF old_count <> 1 THEN RAISE EXCEPTION 'Expected one original intent/category constraint, got %',old_count; END IF;
 ALTER TABLE public.consultation_answers ADD CONSTRAINT consultation_answers_intent_category_v2 CHECK ((intent,category) IN (('farmland_trade_sell','농지 팔기'),('public_reserve_purchase','농지 팔기'),('farmland_sale_trust','농지 팔기'),('long_term_lease_out','농지 빌려주기'),('farmland_lease_trust_out','농지 빌려주기'),('farmland_trade_buy','농지 구매하기'),('lease_then_sale','농지 구매하기'),('reserve_farmland_lease','농지 빌리기'),('long_term_lease_in','농지 빌리기'),('farmland_lease_trust_in','농지 빌리기'),('orchard_trade_sell','과원 관련'),('orchard_trade_buy','과원 관련'),('orchard_lease_out','과원 관련'),('orchard_lease_in','과원 관련'),('management_recovery','농업경영 위기·부채'),('reserve_smartfarm','스마트팜'),('land_exchange','농지 바꾸기·모으기'),('retirement_direct_payment','고령농 은퇴·농지이양'),('farmland_pension','농지연금'),('damaged_farmland','훼손농지'),('farming_tech','영농기술·재배·농기계'),('direct_payment_application','농업경영체·직불제·인증'),('gap_certification','농업경영체·직불제·인증'),('farmland_survey','농지 전수조사'),('general_consult','기타 / 분류 불확실')));
 EXECUTE format('ALTER TABLE public.consultation_answers DROP CONSTRAINT %I',old_name);
END $$;
