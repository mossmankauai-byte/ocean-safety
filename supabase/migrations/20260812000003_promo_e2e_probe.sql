-- TEMPORARY end-to-end probe. Inserts three promotions against a DEMO partner so the
-- get_partner_promotions read path can be exercised with real rows: field renames,
-- the fit object, the request_to coalesce, and both filters (status and date).
-- Removed immediately after by 20260812000004_promo_e2e_probe_down.sql.
-- Every row is tagged 'E2E PROBE' in the title so it is unmistakable if one survives.

insert into public.promotions
  (partner_id, title, pdf_url, detail, starts_at, ends_at, status,
   trip_stage, book_ahead, request_to, fit_weather, fit_time, fit_audience)
select p.id, v.title, v.pdf_url, v.detail, v.starts_at, v.ends_at, v.status,
       v.trip_stage, v.book_ahead, v.request_to, v.fw, v.ft, v.fa
from public.partners p
cross join (values
  -- 1. pre-arrival text card: no PDF, carries detail + badge + its own destination
  ('E2E PROBE pre-arrival transfer', null::text,
   'Private transfer from the airport, arranged before you land.',
   null::date, null::date, 'live', 'pre-arrival', true,
   'frontdesk@example.com', '{}'::text[], '{}'::text[], '{}'::text[]),
  -- 2. on-island flyer with fit tags, and NO request_to so the partner default applies
  ('E2E PROBE rainy midday flyer', 'https://example.com/flyer.pdf',
   null, null, null, 'live', 'on-island', false,
   null, '{rain}'::text[], '{midday}'::text[], '{couples}'::text[]),
  -- 3. must NOT come back: ended yesterday
  ('E2E PROBE expired', 'https://example.com/old.pdf',
   null, null, (current_date - 1), 'live', 'any', false,
   null, '{}'::text[], '{}'::text[], '{}'::text[]),
  -- 4. must NOT come back: draft, not live
  ('E2E PROBE draft', 'https://example.com/draft.pdf',
   null, null, null, 'draft', 'any', false,
   null, '{}'::text[], '{}'::text[], '{}'::text[])
) as v(title, pdf_url, detail, starts_at, ends_at, status,
       trip_stage, book_ahead, request_to, fw, ft, fa)
where p.slug = 'poipu-grill-demo';

-- Property-level default, so probe 2 can prove the coalesce works.
update public.partners set request_to = 'desk@example.com' where slug = 'poipu-grill-demo';
