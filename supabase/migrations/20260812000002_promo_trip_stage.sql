-- Trip stage + the guest-side read path for promotions.
--
-- TWO separate problems, one migration, because neither is useful alone:
--
--  1. trip_stage: when in a guest's trip an offer is worth showing. This is a
--     different question from when the offer is VALID (starts_at/ends_at) and
--     from when it is HAPPENING (window_start/window_end).
--
--  2. get_partner_promotions: until now nothing connected this table to the
--     guest app at all. The portal wrote rows to `promotions` and the app read
--     `window._partnerCfg.promotions` out of a committed JSON file. An operator
--     could fill in the whole form and no guest would ever see the result.
--
-- Apply with: psql "$SUPABASE_DB_URL" -f 2026-08-12-promo-trip-stage.sql
-- Depends on 2026-08-12-promo-fit.sql having run first.

-- ── 1. trip_stage ───────────────────────────────────────────────────────────
-- Scalar, not an array, unlike the fit_* columns. Weather and audience are
-- genuinely multi-select ("this suits rain OR high surf"); a trip stage is not.
-- 'any' is the DEFAULT and the resting state, and here it IS stored literally
-- rather than as an empty array, because there is no "no trip stage" state the
-- way there is a "no weather constraint" state.
alter table public.promotions
  add column if not exists trip_stage text not null default 'any';

alter table public.promotions
  drop constraint if exists promotions_trip_stage_vocab,
  add constraint promotions_trip_stage_vocab
    check (trip_stage in ('any','pre-arrival','on-island'));

-- 'post-departure' is deliberately NOT in the vocabulary. It is a state the guest
-- app detects so it can STOP showing offers, never one an operator can target.
-- Selling to a guest who has already flown home is how a property's numbers get
-- inflated with taps that cannot convert.

-- ── 1b. What a pre-arrival offer actually needs ─────────────────────────────
-- A PDF flyer is the wrong artifact for a pre-arrival upsell. The approved design
-- is a text card: a title and one line, read on a phone in another timezone. A
-- guest is not going to open a PDF to find out about an airport transfer.
--
-- So pdf_url stops being mandatory. It was never NOT NULL in the table, only
-- enforced by a throw in the portal's save(); the constraint below replaces that
-- with the real rule, which is that an offer must carry SOMETHING to show.
alter table public.promotions
  add column if not exists detail      text,
  add column if not exists book_ahead  boolean not null default false,
  add column if not exists request_to  text;

-- NOT VALID on purpose. The rule is right for every row written from here on, but
-- it must not be able to abort this migration over legacy data nobody has looked
-- at. NOT VALID enforces it on inserts and updates and skips the backfill scan.
-- Promote it with `validate constraint` once the existing rows are known clean.
alter table public.promotions
  drop constraint if exists promotions_has_content;
alter table public.promotions
  add constraint promotions_has_content
    check (pdf_url is not null or detail is not null) not valid;

-- The property-level default, set once at onboarding. get_partner_promotions
-- coalesces the per-offer override onto this, so a new offer is never a dead end.
alter table public.partners
  add column if not exists request_to text;

-- request_to is where a tap GOES: front-desk email, phone, or booking-engine URL.
-- Without it the pre-arrival tab is decoration, because a tap has nowhere to land.
-- Nullable here because the property-level default lives on `partners` and is
-- applied at read time below; this column is the per-offer override, since
-- transfers usually route to a different vendor than upgrades.

-- ── 2. The guest read path ──────────────────────────────────────────────────
-- SECURITY DEFINER and a narrow column list, mirroring get_town_listings: the
-- anon/publishable key never gets a table grant, only this function's output.
--
-- Returns a JSON OBJECT, not a set of rows, so the caller can tell
--   "this partner is managed in the portal and currently has no live offers"
-- from
--   "this slug has no portal account at all".
-- The difference matters: the first must clear whatever the committed config
-- file carries (an operator deleted their offers and expects them gone), and the
-- second must leave it alone (demo and hand-built configs have no DB row).
--
-- Field names are the GUEST-side names (pdf, expires, fit.wx), not the column
-- names, so the app's existing promo renderer consumes these unchanged.
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
          -- Per-offer destination, falling back to the property default so every
          -- offer works the moment it is created. A tap with nowhere to go is the
          -- failure this coalesce exists to prevent.
          'request_to', coalesce(pr.request_to, pa.request_to),
          'fit',     json_build_object(
                       'wx',   to_json(pr.fit_weather),
                       'time', to_json(pr.fit_time)
                     )
          -- fit_audience is INTENTIONALLY not exposed. It is operator-facing
          -- reporting only; the guest app never learns who the guest is, so
          -- shipping it here would only invite someone to filter on it.
        ) order by pr.starts_at nulls first, pr.title)
        from promotions pr
        join partners pa on pa.id = pr.partner_id
        where pa.slug = p_slug
          and pr.status = 'live'
          -- Date validity is enforced HERE as well as in the app. The app filter
          -- stays (an offline/cached render still has to be correct), but an
          -- expired flyer should not travel over the wire at all.
          and (pr.starts_at is null or pr.starts_at <= current_date)
          and (pr.ends_at   is null or pr.ends_at   >= current_date)
      ), '[]'::json))
  end;
$$;

revoke all on function public.get_partner_promotions(text) from public;
grant execute on function public.get_partner_promotions(text) to anon, authenticated;
