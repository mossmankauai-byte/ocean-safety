# Safety Flag Resolution — Maui + Oʻahu (stress-test gate)

Generated 2026-06-27 by the OceanSafe firm (8 agents: os-product-trust audit → adversarial verify).
Resolves the FLAG/REVIEW items in `STRESS-TEST-4YR.md` for Maui + Oʻahu.
**Staged only — NOT deployed/pushed.** Every edited beach still carries `NEEDS-HUMAN-VERIFY`; a local
reviewer should sign off before these go to production.

Rule applied: Type-A under-warned → add seasonal/conditional warning or reclassify; Type-B calm-but-fatal
→ add snorkel/medical/rip messaging WITHOUT reclassifying a calm guarded beach; grid/facing artifacts →
document/correct exposure, do not scare-warn a sheltered lagoon/harbor.

## Maui (data/maui.js)
| Beach | Flag | Action taken | Verify ruling |
|---|---|---|---|
| Kāʻanapali | B | **No change** — already had a sharp snorkel/Black-Rock danger string | accept (no-change) |
| Kapalua Bay | B | Added `danger` (S/W swell wraps in; Oct 2022 drowning + mass rescue) | accept |
| Nāpili Bay | B | Added `danger` (wrapping swell shorebreak; Oct 2022 rescues/near-drowning) | accept |
| D.T. Fleming | B | Added `danger` (north shorebreak/undertow) — **stripped a fabricated "Maui Ocean Safety rates…" attribution** | modify (applied) |
| Kamaʻole III | B | Added `danger` (2018 snorkel deaths; Maui snorkel-fatality context) | accept |
| Kamaʻole I | REVIEW | Tip +1 line snorkel-awareness (calmest beach, no reclassification) | accept |
| Kamaʻole II | REVIEW | Tip +1 line snorkel-awareness | accept |
| Charley Young | REVIEW | Tip +1 line snorkel-awareness (unguarded) | accept |
| Kanahā | B (grid artifact) | Added `danger` (offshore current; 2019 windsurfer drowning); documented facing 15 is correct (0.7m/S = harbor-grid artifact, **not** changed) | accept |
| Baby Beach (Pāʻia) | A (lagoon artifact) | Sharpened tip swell caveat; documented that 54 dd/yr is a lagoon-cell artifact — **did NOT** add warning_only or drop kid | accept |
| Spreckelsville | B (grid artifact) | Added `danger` — **"drowned" softened to "pulled unresponsive"** to match the only source (2017 Camp One) | modify (applied) |
| Sugar Cove | A (genuine) | **Set `warning_only:true` + `danger`** (real NE exposure: 4.5m, ~52 dd/yr; facing 15 matches) | accept |
| Kahului Harbor | REVIEW | `source_notes` only — documented why warning_only is correct (harbor hazard, not surf); no user-facing change | accept |
| Hāna Bay | REVIEW | Tip +1 line conditional E/NE-swell note (guarded, kid retained) | accept |

## Oʻahu (data/oahu.js)
| Beach | Flag | Action taken | Verify ruling |
|---|---|---|---|
| Haleʻiwa Aliʻi | A | **No change** — already had a winter-swell/channel danger string scoped to the guarded pocket | accept (no-change) |
| Kalama | A | Added `danger` (trade-swell shorebreak/current; May 2025 "Flag Poles" drowning); kid + guard retained. source_notes substring-replaced to preserve Tower 8C provenance | modify (applied) |
| Kualoa Regional Park | A (grid artifact) | Added honest tide/reef `danger`; documented 62 dd/yr is an open-cell artifact outside the barrier reef — **dropped a no-op facing 45→45 edit**, kept facing | modify (applied) |
| Kailua Beach Park | B | Tip + 2025 waist-deep drowning + never-swim-alone | accept |
| Waimānalo Bay | B | Tip + 2026 drowning + swim-with-others | accept (⚠ see caveats) |
| Bellows Field | B | Tip + rip-current hazard (leaned on verified rip, **not** the unconfirmed drowning) | accept |
| Waikīkī | B | Tip + medical-incapacitation-offshore / never-swim-alone (no scare) | accept |
| Ala Moana | B | Tip + 2022 child drowning in the dredged channel (existing channel warning given weight) | accept |
| Kaimana (Sans Souci) | B | Tip + offshore snorkel/free-dive fatalities (buddy + stay-near-shore) | accept |
| Ko Olina Lagoons | B | Tip + "calm water still drowns" (unguarded lagoons, all ages) | accept |
| Pōkaʻī Bay | B | Tip — **"a child drowned" softened to "children have nearly drowned"** to match source (near-drowning); removed the over-safe "genuinely safe for kids" phrasing | modify (applied) |

## Reviewer caveats (verified weak spots to confirm before deploy)
1. **Waimānalo 2026 drowning** — corroborated by the internal stress-test record, but the agent's link was a
   low-quality aggregator (Hoodline) + a *rescue* (not death) KHON2 story. Confirm with a primary outlet
   (HNN / Star-Advertiser) or soften the year claim.
2. **Bellows** — the user-facing copy intentionally claims only rip currents (verified), not the
   stress-test's unconfirmed drowning. Fine as-is.
3. **D.T. Fleming** — the specific fatality could not be independently confirmed this pass; copy now speaks to
   the documented shorebreak/undertow, not a named death.
4. All other death/incident claims are cited in each beach's `source_notes`.
