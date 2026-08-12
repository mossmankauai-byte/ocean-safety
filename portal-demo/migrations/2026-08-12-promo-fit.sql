-- Promotion "fit" columns. When an offer is worth recommending, as distinct
-- from when it is valid (starts_at/ends_at) or happening (window_start/end).
--
-- Empty array = no constraint. The portal's "Any weather" and "All day" pills
-- are the resting state and store {}, never the literal 'any'. No constraint
-- is the absence of one, and a stored 'any' would need special-casing at every
-- read site (portal, config build, guest app).
--
-- Vocabulary is closed and shared by three places: this check constraint, the
-- pill data-v attributes in portal-demo/promotions.html, and _promoWxTags /
-- _promoTimeTag in index.html. Changing a token means changing all three.
--
-- fit_audience is operator-facing only. The guest app never learns who the
-- guest is, so it must not filter on this column.

alter table public.promotions
  add column if not exists fit_weather  text[] not null default '{}',
  add column if not exists fit_time     text[] not null default '{}',
  add column if not exists fit_audience text[] not null default '{}';

alter table public.promotions
  drop constraint if exists promotions_fit_weather_vocab,
  add constraint promotions_fit_weather_vocab
    check (fit_weather <@ array['rain','clear','surf','wind']::text[]);

alter table public.promotions
  drop constraint if exists promotions_fit_time_vocab,
  add constraint promotions_fit_time_vocab
    check (fit_time <@ array['morning','midday','evening']::text[]);

alter table public.promotions
  drop constraint if exists promotions_fit_audience_vocab,
  add constraint promotions_fit_audience_vocab
    check (fit_audience <@ array['families','couples','groups','solo']::text[]);
