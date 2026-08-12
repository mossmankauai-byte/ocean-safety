-- A real pre-arrival offer on the only managed demo partner, so the tab can be SHOWN
-- rather than described. poipu-grill-demo is the sole partner with a partners row, so it
-- is the only slug where get_partner_promotions returns managed:true and the guest rail
-- actually swaps to the table.
--
-- A restaurant is not the archetypal pre-arrival upsell, but "reserve before you land" is
-- a genuine one, so the card is honest about what it is rather than pretending to be a
-- room upgrade on a partner that is not a hotel.
--
-- No price, per the standing rule: every offer ends in a request, and the operator quotes
-- the live number. request_to is a deliberately non-routing example.com address: this is a
-- demo card on a public app and a stray guest tap must not reach a real person's inbox.
-- Swap it for a real destination the day this stops being a demo.
--
-- Idempotent: re-running must not create a second copy.

insert into public.promotions
  (partner_id, title, pdf_url, detail, starts_at, ends_at, status,
   trip_stage, book_ahead, request_to, fit_weather, fit_time, fit_audience)
select p.id,
       'Reserve your table before you land',
       null,
       'Sunset seating books out first. Tell us your dates and we will hold one.',
       null, null, 'live',
       'pre-arrival', true,
       'reservations@example.com',
       '{}'::text[], '{}'::text[], '{}'::text[]
from public.partners p
where p.slug = 'poipu-grill-demo'
  and not exists (
    select 1 from public.promotions x
    where x.partner_id = p.id
      and x.title = 'Reserve your table before you land'
  );
