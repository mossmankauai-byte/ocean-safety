# Maui + Oʻahu POI Freshness Audit — resolution

2026-06-27, firm run (8 verify buckets + 5 adversarial closure-confirm agents; all 261 POIs).
Same standard as `KAUAI-POI-AUDIT.md`. Staged on the `maui` branch — NOT deployed.

## Verdict: 250 of 261 open · pulls and fixes applied

### Pulled (each adversarially confirmed or unverifiable per approved auto-pull policy)
- **Whalers Village Museum (Maui act)** — confirmed CLOSED (Yelp May 2026). Notably: this was added in
  this week's acts top-up and passed its fact-check then; the freshness audit caught it. Maui acts → 24.
- **Ola Brew / Leeward taproom (Oʻahu)** — does not exist; Ola Brew has no Oʻahu taproom.
- **Fumi's Kahuku truck (ft_fumis_kahuku)** — original roadside truck closed; brand relocated (see below).
- **Minit Stop Kahuku** — phantom listing; chain has zero Oʻahu stores.
- **76 Haleʻiwa** — marked CLOSED Feb 2026.
- **Texaco Waiʻanae** — no such station in Waiʻanae.

### Moved venues (updated, not pulled — businesses are alive)
- **Fumi's Kahuku Shrimp (foods)** → now Ala Moana Center Makai Market Food Court (Spring 2025);
  tip rewritten, official site added.
- **Haleʻiwa Farmers' Market** → left Waimea Valley for the Historic Haleʻiwa Gym (March 2025, HNN);
  name/address/coords/tip updated + farmloversmarkets.com/haleiwa added.
- **Nohea Gallery** → Kahala Mall (Ward Warehouse demolished); tip + coords updated.

### Websites
+100 Maui / +96 Oʻahu total coverage (was 49/45) — every added URL curl- or agent-verified; two adds
REJECTED at verification (a dead .ngo domain, a 404 deep link) and excluded. Agent explicitly declined
a fake Geste Shrimp domain (gesteshrimp.com is hijacked → unrelated site) — left blank on purpose.

### Notable open-status findings (no action needed)
- Star Noodle: reopened post-fire but RELOCATED on Front St with drastically reduced (weekend) hours.
- Pāʻia Fish Market: Lahaina location permanently closed; Pāʻia flagship + Kīhei open.
- Aloha Mixed Plate: reopened at original Front St site.
- Lahaina Pali Trail (west): conflicting temp-closure signals — entry already carries a
  TEMP-CLOSED/verify warning, left as-is.

## Validation
Both data files parse; category counts consistent (pulls accounted); page serves. Kauaʻi untouched
by this step. Hours spot-corrections folded in only where definitive; hedged reports logged here, not applied.
