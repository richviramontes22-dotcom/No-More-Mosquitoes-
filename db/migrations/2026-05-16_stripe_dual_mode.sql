-- ─── Dual-mode Stripe price support ──────────────────────────────────────────
-- Adds stripe_price_id_test column to service_plans.
-- Existing stripe_price_id column retains live price IDs (price_1TWX...).
-- New column holds test price IDs (price_1T9K...) for localhost/dev testing.
--
-- Source: dev-notes/LIVE_STRIPE_OBJECT_MAPPING.json
-- Safe to re-run — uses ADD COLUMN IF NOT EXISTS and UPDATE ... WHERE name = '...'

ALTER TABLE public.service_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id_test TEXT;

-- ─── Populate test price IDs ──────────────────────────────────────────────────

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku20zUTKY2M9th6O4e94a' WHERE name = 'tier_1_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku30zUTKY2M9t976B9cFU' WHERE name = 'tier_1_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku30zUTKY2M9tUd010LS9' WHERE name = 'tier_1_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku30zUTKY2M9tqQemuKOR' WHERE name = 'tier_1_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku30zUTKY2M9t2v6M2dQS' WHERE name = 'tier_2_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku40zUTKY2M9te6mCTAxR' WHERE name = 'tier_2_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku40zUTKY2M9t4uq79cvU' WHERE name = 'tier_2_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku40zUTKY2M9tdsSSOrNm' WHERE name = 'tier_2_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku40zUTKY2M9t4tJCVpaS' WHERE name = 'tier_3_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku40zUTKY2M9tPBc1ZXIy' WHERE name = 'tier_3_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku50zUTKY2M9tXZt2VGFl' WHERE name = 'tier_3_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku50zUTKY2M9tPq3yBCdf' WHERE name = 'tier_3_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku50zUTKY2M9tnXsbQZKW' WHERE name = 'tier_4_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku50zUTKY2M9tv69wcbPc' WHERE name = 'tier_4_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku50zUTKY2M9tyKhvo9WK' WHERE name = 'tier_4_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku60zUTKY2M9t0lJ5AStr' WHERE name = 'tier_4_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku60zUTKY2M9tL0soChej' WHERE name = 'tier_5_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku60zUTKY2M9tcvDffpf2' WHERE name = 'tier_5_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku60zUTKY2M9tY68TzT8Y' WHERE name = 'tier_5_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku60zUTKY2M9tNW9BC4Mj' WHERE name = 'tier_5_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku70zUTKY2M9tWohnTgcJ' WHERE name = 'tier_6_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku70zUTKY2M9tuVysJ2j2' WHERE name = 'tier_6_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku70zUTKY2M9tZhAY8o7d' WHERE name = 'tier_6_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku70zUTKY2M9tX77VfqRf' WHERE name = 'tier_6_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku80zUTKY2M9t6ya08gYV' WHERE name = 'tier_7_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku80zUTKY2M9tsUKBkr5l' WHERE name = 'tier_7_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku80zUTKY2M9trqJVl6LH' WHERE name = 'tier_7_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku80zUTKY2M9trVBjbqrH' WHERE name = 'tier_7_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku80zUTKY2M9tzGX6LM8F' WHERE name = 'tier_8_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku90zUTKY2M9tkIqGW6Ea' WHERE name = 'tier_8_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku90zUTKY2M9t9UmDpQUW' WHERE name = 'tier_8_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku90zUTKY2M9tFqLOB2pm' WHERE name = 'tier_8_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku90zUTKY2M9t4XwARynK' WHERE name = 'tier_9_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9Ku90zUTKY2M9tmeHXi5d4' WHERE name = 'tier_9_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuA0zUTKY2M9tq54rMCBb' WHERE name = 'tier_9_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuA0zUTKY2M9tfKZtZf6G' WHERE name = 'tier_9_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuA0zUTKY2M9tF7RndvWK' WHERE name = 'tier_10_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuA0zUTKY2M9teWBUA0gs' WHERE name = 'tier_10_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuA0zUTKY2M9tNL4DMpF3' WHERE name = 'tier_10_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuB0zUTKY2M9twKJYGhTr' WHERE name = 'tier_10_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuB0zUTKY2M9tJbc2tWib' WHERE name = 'tier_11_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuB0zUTKY2M9tPORnUd3l' WHERE name = 'tier_11_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuB0zUTKY2M9ttgkmG5FZ' WHERE name = 'tier_11_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuC0zUTKY2M9tgue2Nq0O' WHERE name = 'tier_11_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuC0zUTKY2M9tbvOHTwzv' WHERE name = 'tier_12_14d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuC0zUTKY2M9tIarGLxXX' WHERE name = 'tier_12_21d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuC0zUTKY2M9tRPPr94nO' WHERE name = 'tier_12_30d';
UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuC0zUTKY2M9tmPVCR8wo' WHERE name = 'tier_12_42d';

UPDATE public.service_plans SET stripe_price_id_test = 'price_1T9KuD0zUTKY2M9tDDuDwmCh' WHERE name = 'one_time';

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- Run this SELECT after the migration to confirm all rows have both columns populated:
-- SELECT name, stripe_price_id, stripe_price_id_test
-- FROM public.service_plans
-- WHERE stripe_price_id_test IS NULL AND active = true;
-- Expected: 0 rows
