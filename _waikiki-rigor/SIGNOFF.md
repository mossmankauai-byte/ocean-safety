# Waikīkī-Japanese Build — Integration Sign-Off

**Foreman:** os-foreman (Harbormaster) · **Date:** 2026-06-23 · **Mode:** PERSONA (integration gate)
**Scope:** non-deployed build artifact. No deploy, no commit, no merge executed. English rendering byte-identical. All artifacts under `_waikiki-rigor/` only.
**Gates applied:** R-010 (monotonic-up binding gate), R-013, R-009/PF-003 (UNSTAFFED human-native gate), R-015 (verdict vs independent ground-truth), P-002 (label every number), P-001/PF-005 (humanizer Kai/main only). R-004/R-005 correctly did NOT fire.

---

## TOP LINE
The build is **demo-ready internally, NOT guest-ready and NOT GM-demo-ready** until two things land: (1) a real human native-Japanese reviewer signs off the safety strings, and (2) the S1–S6 + F1–F3 strengthen-side redrafts are applied. The chrome merge is safe to apply now; the accuracy work is honest and usable with 3 named re-point items.

---

## 1. APPLY NOW (safe to apply this cycle)
- **Track C chrome merge** (`trackC-chrome-merge.js`): additive Object.assign, **39 net-new keys, 0 collisions** with the 856 live keys (no English regression), **node --check PASS**, **0 price/$ leaks** (grep $ = 0), **0 entity-decoding bugs**, **0 hazard strings** (clean B/C partition). Safe to merge into `data/i18n-ja.js` on owner authorization. NOTE: still INCOMPLETE — see caveats (detail-sheet CTAs).
- **Track A dataset corrections** drawn ONLY from VERIFIED rows: correct the inflated draft ratings DOWN where the red-team confirmed (e.g. Foodland ~1290→~897 reviews; Island Vintage 4.5→4.3). Coordinate nudges for the OFF rows (Ono Seafood → 747 Kapahulu Ave; Rainbow Drive-In) are owner-gated edits to `oahu.js`, NOT done here.
- **Track A curated TOP shortlist** for internal/demo use — defensibly verified subset only (see §3).

**Do NOT apply now:** the JA safety strings (gated on human native sign-off), the 3 SUSPECT POIs (closed/relocated — re-point or pull before featuring), any merge/commit/deploy (none authorized this cycle).

---

## 2. SAFETY GATE (HARD)
- **humanSignoffCleared: FALSE.** This was an LLM-grade adversarial pass (Kai + independent red-team). It produces the candidate defect list and strengthen-side redrafts; it does **NOT** clear the human native-Japanese gate. That reviewer is **UNSTAFFED (R-009/PF-003), routed to the user.** No agent self-certified native clearance.
- **criticalCount: 8** softened/wrong safety strings caught and flagged (Track B: S1 "not safe to swim"→"適していません" [critical]; S2 "Use Caution"→bare "注意"; S3 "No Safe Activities"→availability-state reading; S4 "shorebreak"→generic "砕け波"; S5 confident-outlook hedge-drop; plus red-team F1 broader hedge-drop family, F2 in-file inconsistency [critical], F3 No-Safe-Activities lacks do-not-enter cue). All have strengthen-side redrafts proposed.
- **Status:** `LLM REVIEW COMPLETE — HUMAN NATIVE GATE NOT CLEARED, UNSTAFFED, ROUTED TO USER. JA safety strings are NO-GO for guest-facing use until a native reviewer signs.`
- **R-010 rationale:** on a beach-SAFETY product, a JA warning that reads weaker than the English ("適していません", flat "良好") is a guest in the water on a softened all-clear — the single failure a safety product must never ship. Zero softened strings remain unflagged (coverage gap would itself be a NO-GO; 285 strings reviewed).

---

## 3. ACCURACY
- **topPicksCount: 14 curated top picks** verified to a named, dated source [measured] (red-team re-tested 10/10 with zero fabrications; ratings matched live Yelp pages or corroborating directories, ±0.1 caveat on Yelp-snippet-sourced stars). Inclusion rule: drawn only from VERIFIED rows with a resolving source URL.
- **needsManualVerify: 12 POIs** still need a human nudge: **3 SUSPECT** (Honolulu Coffee Experience Center — named venue CLOSED; Banán Diamond Head — truck CLOSED, live box = Waikiki Beach Shack; Nohea Gallery — relocated out-of-box to Kahala) MUST be re-pointed or pulled before featuring; **8** lack a numerically-pinned Yelp star (star [assumption] / count [measured]); **coordinate precision** — no POI was precision-geocoded, OFF flags estimated from street address.
- **Verification-coverage:** ~13/23 ≈ **57% VERIFIED [measured]**, ~3/23 ≈ 13% SUSPECT, ~7/23 ≈ 30% PLAUSIBLE-UNVERIFIED — honest status, not a fabricated 100%. Yelp blocks direct WebFetch (403), so stars are from search snippets/directories: treat each ±0.1.

---

## 4. GO / NO-GO BY AUDIENCE
- **internalDemo: GO.** Chrome translation is clean and merge-safe; the safety-string defects are documented and the prices stay USD. Fine to show the team as a work-in-progress, with the open native gate stated aloud.
- **guestFacing: NO-GO.** A real Japanese guest relying on this would meet softened safety verdicts (S1–S5) and English-only detail CTAs ("Get Directions" ~7x). On a safety product, a softened JA warning is a wrong all-clear. Blocks until native sign-off + S1–S6/F1–F3 strengthen redrafts applied.
- **hotelDemo: NO-GO** (showing a Japanese-speaking GM). The GM is a native reader and will immediately see the soft "適していません" verdict and the half-translated chrome; presenting an un-cleared safety translation to the exact persona who can spot it erodes the trust the pitch rests on. Re-attempt after the native gate clears.

---

## 5. CAVEATS (honest list)
- **Prices stay USD, verbatim** — no price/currency/amount was translated or converted (Track C grep $ = 0; hard carve-out honored). A JA guest sees dollar amounts.
- **Human native-Japanese reviewer is UNSTAFFED** — the hard gate. No LLM pass clears it. Routed to the user.
- **Track C chrome is INCOMPLETE** — primary detail-sheet CTAs still render in English to a JA user: "Get Directions" (~7x), "Directions to Trailhead", "Best time", "More Curated Tours", "Add to Home Screen", "Share", "Saved", "Why install?", "Close", "Plan your Kauaʻi trip", empty-state "No beaches match — try different filters", "Tap to view & book on Activities", and the browser location-permission help block. Add before calling Oʻahu chrome done. (Future keys carrying the ʻokina U+02BB / em-dash U+2014 must store the decoded glyph.)
- **3 SUSPECT POIs** (closed/relocated) must be re-pointed or pulled before featuring; **8 POIs** have a [measured] review count but an [assumption] star; no POI was precision-geocoded.
- **Yelp 403** — all stars from search snippets / third-party directories, not scraped live; treat each ±0.1 and re-confirm before publishing.
- **SEO/GEO not done this cycle** — hreflang annotations (en ↔ ja) and the `noindex` directive on the in-progress JA build are NOT yet in place. Until hreflang is set and the unfinished JA page is noindex'd, do not let it be crawled/indexed (duplicate-content + half-translated-safety-page discovery risk).
- **No deploy / merge / commit executed.** All edits proposed and owner-gated. `oahu.js`, `i18n-ja.js`, and the English rendering are byte-unchanged.
- **Recurring re-verification** of POI ratings/coords drift is UNSTAFFED (no scheduler) — routed to user.

---

## STOP CONDITIONS
- **HALT JA go-live (guest + GM):** TRIPPED — softened safety strings present AND human-native gate uncleared. Holds until native reviewer signs and strengthen redrafts applied.
- **HALT any merge/commit/deploy:** none authorized this cycle.
- No aggregation, no Kai hard *block* of the program (the strengthen redrafts are the path, not a veto), no irreversible action taken.
