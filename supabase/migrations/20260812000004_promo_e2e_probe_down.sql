-- Removes everything 20260812000003_promo_e2e_probe.sql inserted.
-- Matches on the 'E2E PROBE ' title prefix, which only the probe rows carry, and
-- restores the property-level request_to to the null it was before the probe set it.

delete from public.promotions where title like 'E2E PROBE %';

update public.partners set request_to = null
where slug = 'poipu-grill-demo' and request_to = 'desk@example.com';
