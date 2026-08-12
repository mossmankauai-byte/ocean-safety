-- Two things the bridge needed before it can safely replace a committed config.
--
-- 1. window_start / window_end. The guest app reads promo.window to drive the
--    timed pop-up (_promoPopSchedule) and the green "happening now" dot on the
--    offer chip. The promotions table never had these columns, so a partner whose
--    offers come from the database could not express a daily time window at all
--    and silently lost both behaviours. Config-fed partners had it; portal-fed
--    partners did not. That asymmetry is what this closes.
--
-- 2. The one row that would otherwise go dark. poipu-grill-demo has a partners
--    row, so get_partner_promotions reports managed:true, so the app REPLACES its
--    committed promotions with the table's. The table had none, so its offer
--    would have vanished on deploy. Backfilling it makes the table the true
--    source for that partner and the swap a no-op.
--
--    The committed partner-config JSON is intentionally left in place: the bridge
--    only replaces on a successful fetch, so that copy stays the offline fallback.

alter table public.promotions
  add column if not exists window_start time,
  add column if not exists window_end   time;

-- Both or neither. A half-open window is not a window, and the app's
-- _promoInWindow would read the missing side as undefined.
alter table public.promotions
  drop constraint if exists promotions_window_pair;
alter table public.promotions
  add constraint promotions_window_pair
    check ((window_start is null) = (window_end is null)) not valid;

-- Backfill, idempotent: re-running must not create a second copy.
insert into public.promotions
  (partner_id, title, pdf_url, starts_at, ends_at, status,
   trip_stage, window_start, window_end)
select p.id,
       -- Copy carried over from partner-config/poipu-grill-demo.json. The en dash
       -- and em dash in the original were replaced with a hyphen and a period per
       -- the house rule; wording is otherwise untouched.
       'Happy hour, 3-5pm. $8 house pours',
       'https://oceansafety.app/assets/promotions-default.pdf',
       null, date '2030-12-31', 'live',
       'any', time '00:00', time '23:59'
from public.partners p
where p.slug = 'poipu-grill-demo'
  and not exists (
    select 1 from public.promotions pr
    where pr.partner_id = p.id and pr.title like 'Happy hour%'
  );

-- Expose the window to the guest app, in the {start,end} shape it already parses.
create or replace function public.get_partner_promotions(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (select 1 from partners where slug = p_slug) then
      json_build_object('managed', false, 'promotions', '[]'::json)
    else
      json_build_object('managed', true, 'promotions', coalesce((
        select json_agg(json_build_object(
          'title',      pr.title,
          'pdf',        pr.pdf_url,
          'detail',     pr.detail,
          'expires',    pr.ends_at,
          'starts',     pr.starts_at,
          'stage',      pr.trip_stage,
          'book_ahead', pr.book_ahead,
          'request_to', coalesce(pr.request_to, pa.request_to),
          -- null, not an empty object, when there is no window: the app tests
          -- `p.window && _promoInWindow(...)`, so absent must be falsy.
          'window',     case when pr.window_start is null then null else
                          json_build_object('start', to_char(pr.window_start, 'HH24:MI'),
                                            'end',   to_char(pr.window_end,   'HH24:MI'))
                        end,
          'fit',        json_build_object(
                          'wx',   to_json(pr.fit_weather),
                          'time', to_json(pr.fit_time)
                        )
          -- fit_audience stays operator-facing only. The guest app never learns
          -- who the guest is, so it must not travel over this wire.
        ) order by pr.starts_at nulls first, pr.title)
        from promotions pr
        join partners pa on pa.id = pr.partner_id
        where pa.slug = p_slug
          and pr.status = 'live'
          and (pr.starts_at is null or pr.starts_at <= current_date)
          and (pr.ends_at   is null or pr.ends_at   >= current_date)
      ), '[]'::json))
  end;
$$;

revoke all on function public.get_partner_promotions(text) from public;
grant execute on function public.get_partner_promotions(text) to anon, authenticated;
