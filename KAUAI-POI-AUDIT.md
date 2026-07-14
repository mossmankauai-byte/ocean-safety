# Kauaʻi POI Freshness Audit — resolution

2026-06-27, firm run (5 research buckets + adversarial closure-confirmation, 7 agents, all 112 POIs).
**Staged on the `maui` branch — NOT deployed.** ⚠️ This intentionally edits the Kauaʻi section of
`index.html` (user-sanctioned), ending the branch's previous "Kauaʻi byte-identical" invariant.

## Verdict: 105 of 112 open · 2 confirmed closed · 5 unverifiable

### Fixed (applied)
- 🚨 **Bar Acuda (Hanalei)** — stored domain `restaurantbaracuda.com` was **hijacked → Czech casino spam**.
  Restaurant is OPEN (Tue–Sat 5:30–9:30pm, Resy); link replaced with the real site `cudahanalei.com`.
- **Banana Joe's Fruit Stand (Kīlauea)** — CLOSED (owner retired; Yelp marked CLOSED; Garden Island
  Chocolate now at that location; its domain also hijacked/parked). **Entry removed.** Adversarially confirmed.
- **Russian Fort Elizabeth** — CLOSED for construction per the live DLNR notice. Annotated
  (hours + tip now say CLOSED, check dlnr.hawaii.gov) rather than removed — it's a state park.
- **+29 verified official websites added** (previously blank): all food trucks with sites, Tahiti Nui,
  Java Kai, museums/gardens (Kauai Museum, Limahuli, Allerton, Grove Farm, Smith's), lighthouse (fws.gov),
  hotels (Grand Hyatt, 1 Hotel, Koa Kea, Kauaʻi Shores, Sheraton), DLNR pages for all 4 hikes,
  Hanalei Trading, Costco (both listings). Every URL curl- or agent-verified live
  (Hyatt/Marriott/kauai.gov/Costco 403 curl = bot-blocking; live in browsers).
- **Hours corrected** (definitive sources): JoJo's Shave Ice (→ 6pm close), Kauai Museum, Koloa Fish Market truck.

### Skipped deliberately
- Farmers-market entries use `day/start_min/end_min` (no hours/website fields); stored windows are within
  ~30 min of the audited county times — left alone.
- Hedged hours reports (The Spot, Beach House, Fish Express) — flagged below, not applied.

## For Nick to decide (unverifiable — may no longer exist)
Researchers found **no 2025–2026 trace** of these; on a visitor app that usually means gone:
1. **Aloha Mixplate** (food truck) 2. **Smokey's Smokery** (west-side truck) 3. **Puna Pizza** (truck)
4. **Kapaʻa Wednesday Food Truck Lot** (a daily Kapaʻa food-truck court exists instead)
5. **Aloha Wailua** (gas) — brand exists on-island; this specific station unconfirmed.
Recommend removing 1–3 unless you know them; I left all five in place.

## Hours worth a local glance (not applied)
The Spot (Princeville) ~7:30am–1:30pm closed Wed · Beach House possibly opens 3:30pm · Fish Express truck
~10am–4pm · Smith's now primarily evening luau + Fern Grotto boats · Kong Lung Mon–Sat 10–6, Sun 11–6.

## Validation
- All Kauaʻi arrays parse (111 POIs; websites 28 → 57); all 6 inline scripts pass syntax check; page serves.
- Hijacked/dead domains: 0 remaining. Maui/Oʻahu data untouched by this step.

---
**Addendum (same day):** Nick approved pulling the 5 unverifiable listings — removed
`ft_alohamixplate`, `ft_smokeystreatery`, `ft_kapaa_market`, `ft_punapizza`, `aloha_wailua`.
Kauaʻi now lists 106 POIs, every one verified open (or annotated closed) in 2026.
