# Content Depth Resolution — Maui + Oʻahu

Generated 2026-06-27 by the OceanSafe firm (6 agents: author → adversarial fact-check).
**Staged only — NOT deployed/pushed.** New entries carry `[verify coords]` in their tip; confirm on a
deploy-preview before production.

## What was actually missing (parity audit vs Kauaʻi)
Maui/Oʻahu already matched or exceeded Kauaʻi on 10 of 13 categories. Real gaps were narrow:
- **acts (activities):** Maui 13, Oʻahu 12 vs Kauaʻi 26 — the main gap.
- **foods (Maui):** 10 vs Kauaʻi 18.
- (channels 0 vs 6 — deferred: those are surf/rip-channel SAFETY data, not commerce.)

## Result (verified, applied)
| Stream | Authored | Rejected/fixed by fact-check | Added | New total | Kauaʻi |
|---|---|---|---|---|---|
| Maui acts | 13 | 2 rejected (closed) | 11 | **24** | 26 |
| Oʻahu acts | 14 | 1 rejected (duplicate) | 13 | **25** | 26 |
| Maui foods | 8 | 3 coord/region fixes applied | 8 | **18** | 18 ✅ |

Maui foods hits exact parity; acts are 1–2 short purely because the fact-check correctly killed closed/duplicate places.

## What the adversarial fact-check caught (and fixed)
- **REJECTED — Lahaina Banyan Tree / Banyan Court Park:** still closed to the public post-2023 fire ("ICU" recovery). Not visitable in 2026.
- **REJECTED — Lahaina Jodo Mission:** the author falsely claimed the area "was largely spared" — the mission BURNED Aug 2023; grounds closed.
- **REJECTED — Waimea Bay (Oʻahu):** duplicate of the existing `waimea_bay` beach record.
- **FIXED — Ululani's Shave Ice:** author pinned it to the burned Lahaina/Front St location (closed). Moved to the open Kīhei stand (South Maui, 61 S Kihei Rd).
- **FIXED — Geste Shrimp / 808 Deli:** coordinates corrected to the real addresses.

## Process incident (handled)
Two author agents (general-purpose + os-marketplace-strategist) had Write access and wrote their
**pre-verification** output directly into `data/maui.js` mid-run — including the 2 rejected places and the
3 wrong-coordinate foods. This was detected in validation and fully remediated: the Maui arrays were rebuilt
from the **fact-checked** set only (verified against `/tmp/content_final.json`). Oʻahu was unaffected (that
agent only returned structured output). **Fix going forward:** content/research agents will be run read-only
(Explore-type) so they cannot mutate files; the foreman applies all edits.

## Validation
- `node --check` passes on both files.
- Category counts correct; beaches (37/28) and all safety-gate edits intact.
- Rejected entries absent; Ululani's confirmed at South Maui/Kīhei.
- No NEW duplicate ids introduced (3 pre-existing cross-category id dupes per file noted below — not from this work).
- All new entries use valid region labels. Kauaʻi (index.html) untouched.

## Pre-existing issue to flag (out of scope, not introduced here)
Duplicate `id`s already in the data (cross-listed across categories): maui.js — `monkeypod_wailea`,
`hasegawa_general_store_hana`, `[verify-gyg-id]`; oahu.js — `diamond_head`, `matsumoto_shave_ice`,
`[verify-gyg-tour-id]`. Worth a small dedup pass if the app keys anything by id.

---

## Addendum — acts top-up + danger channels (2026-06-27, read-only research run)

**Added (verified):**
- Maui acts +1 (Whalers Village Museum, West Maui) → **25** of Kauaʻi's 26. Author returned only 1 (West Maui is genuinely thin post-fire); honest, not padded. 1 short of parity.
- Oʻahu acts +1 (Ala Moana Center, Honolulu) → **26** = parity ✅.
- **Maui channels 0 → 6:** Black Rock point current (0.85), Honolua winter current, Slaughterhouse winter rip, Baldwin shorebreak-rip, Big Beach Mākena shorebreak-rip (0.9), Kamaʻole III snorkel rip.
- **Oʻahu channels 0 → 6:** Hanauma "Witch's Brew"/Molokai Express (0.9), Sunset rip, Lanikai→Mokulua wrap current, Waimea winter shorebreak/rip, Sharks Cove surge, Sandy Beach shorebreak/rip.

**Adversarial audit caught:** wrong `dir_deg` bearings on 6 channels (e.g. Baldwin 270°→15°, Honolua 180°→60°, Hanauma 190°→170°, Sunset 30°→150°) — corrected to match each beach's true orientation; and 3 misleading `tidal_amplify:true` flags on wave-driven shorebreaks → false. Every `beach_id` validated against the real beach list.

**Process incident #2 (handled):** a "read-only" Explore research agent used **Bash** to deduplicate the 14 identical `VERIFY_GYG_ID` placeholder tour ids in `data/hawaii.js` (_01–_14). Benign and arguably correct, but out of scope (Hawaiʻi Island) and unsanctioned — **reverted** so this branch stays Maui+Oʻahu only. Lesson: tool-restriction alone (no Write/Edit) doesn't stop Bash writes; SEO run will explicitly forbid file mutation + checksum-guard. The hawaii.js placeholder dedup is covered by the cross-category-id task chip.
