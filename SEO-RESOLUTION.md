# SEO Tree Resolution — Maui + Oʻahu

Generated 2026-06-27. **Staged only — NOT deployed/pushed.**

## Meta audit: already clean (0 issues)
Programmatic audit of all 65 beach pages (37 Maui + 28 Oʻahu) — every page passed:
island-qualified `<title>`, self-referential `<link rel="canonical">` (no cross-island
canonicals → no `/hawaii/` cannibalization), single island-qualified `<h1>`, all four
JSON-LD types (WebPage, BreadcrumbList, TouristAttraction, FAQPage), og:title/description,
correct `?island=&beach=` CTA deep links, no stray `noindex`. The step-7 build was solid;
the literal "tighten meta" ask needed no work.

## The real gap: pages baked safety verdicts at gen-time (now fixed)
The per-beach pages embed the safety verdict (`var B.category`, the "one thing to know"
hazard, FAQ Q1) at generation time and only fetch *weather* live. So my safety-gate edits
weren't reflected — most notably **sugar_cove** (newly `warning_only`) still read "good walk
on calm days," i.e. the SEO surface **under-warned a beach the app now flags.**

### Durable fix: `scripts/sync_today_pages.mjs`
A reusable, idempotent generator that re-derives the data-driven safety fields from
`data/<island>.js` using the original (reverse-engineered) rules:
- `category` = `warning_only ? 'noswim' : (unchanged)` — `noswim` triggers the hard-floor banner.
- "one thing to know" = `warning_only ? danger : tip`.
- FAQ Q1 (visible + JSON-LD) regenerated for any beach **newly** `warning_only`.

Verified **faithful**: dry-run flagged only the 14 edited beaches; zero unchanged pages
touched (proves it reproduces originals byte-identically). After `--write`: meta audit
still 0 issues, sugar_cove now `noswim` with correct hazard framing, no under-warnings remain.

**14 pages updated:** sugar_cove (full escalation), baby_beach_paia, kamaole_i, kamaole_ii,
charley_young, hana_bay (Maui tip refreshes); kailua_beach_park, waimanalo_bay, bellows,
waikiki, ala_moana, kaimana, ko_olina_lagoon, pokai_bay (Oʻahu Type-B messaging surfaced).

### Hub fixed
`/maui/today/dangerous-beaches` listed 19 warning beaches but was missing the newly-flagged
sugar_cove — added (North Shore group) and the count bumped 19 → 20. All 20 Maui
`warning_only` beaches now listed.

## Known limitation (noted, not a defect)
7 calm beaches got a *conditional* `danger` string in the safety gate (kapalua, napili,
dt_fleming, kamaole_iii, kanaha, kalama, kualoa). The original page design surfaces `danger`
only for `warning_only` beaches (calm beaches show `tip`), so these conditional hazards live
in the data + app but not the lighter SEO page. Defensible (they're calm-most-days, the page
shows live surf + the app link). If you want them surfaced, extend the generator to append
`danger` as a caveat on swim-beach pages — a one-line rule change.

## Validation
- All data files parse + eval; every category intact (Maui beaches 37 / acts 25 / channels 6 / tours 10; Oʻahu beaches 28 / acts 26 / channels 6 / tours 12).
- Meta audit 0 issues; staleness audit clean; sugar_cove JSON-LD valid.
- Only `maui/today/*` + `oahu/today/*` + the Maui hub changed. Kauaʻi (index.html) byte-identical; Big Island pages untouched.

## Note: parallel dedup task (user-started chip)
A separate sanctioned task deduplicated the shared placeholder tour ids across all three
islands (they all shared one id, which made "More Curated Tours" render empty via
`t.id !== featured.id`). That touched `data/hawaii.js` + the tours arrays in maui/oahu and is
recorded in `ID-DEDUP-RESOLUTION.md`. My safety/content/channel edits survived its
re-serialization intact (verified).
