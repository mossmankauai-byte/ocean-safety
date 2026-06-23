# 4-Year Stress Test — OceanSafety Beach Safety
**Window:** 2022-01-01 → 2025-12-31 (Open-Meteo marine archive) + documented drowning/rescue records.
**Tested:** 113 beaches across 4 islands. **Result:** 39 FLAG · 9 REVIEW · 65 PASS. 37 flags backed by documented deaths.

> NOT a verdict that the app is wrong — a prioritized list of where the 4-year record disagrees with the current label, so a human reviewer looks at the handful that matter instead of all 113.

## How to read a FLAG — two very different kinds
- **Type A · Under-warned (16):** labeled swimmable/family-safe, but the history shows it is *frequently* dangerous in swell (≥25 dangerous-surf days/yr) AND/or has drownings. **Action:** add a seasonal/conditional warning or move to watch-from-shore. These are real gaps.
- **Type B · Calm-but-fatal (23):** genuinely calm by the wave data (few dangerous days), but with documented drownings — typically snorkel, medical, or older-visitor events, not surf. **Action:** add snorkel/medical/rip-awareness messaging — do NOT reclassify a calm guarded beach as dangerous. Over-warning erodes trust.
- **REVIEW (9):** minor inconsistency (borderline exposure, or stored facing looks off vs the dominant historical swell).
- **PASS (65):** the 4-year history matches the label — calm beaches stayed sheltered; danger beaches really do get hammered (including every existing warning_only beach, which validates those calls).

---

## ⚠ Priority: LIVE Kauaʻi (production data)
These are on the deployed app today. The Type-A ones are the ones to fix first.

### Type A — under-warned (fix first)
| Beach | Danger days | Max exposed surf | Dom. swell | Why flagged |
|---|---|---|---|---|
| ʻAnini Beach | 113/yr | 5.3 m | NE | Labeled family-safe (kid=true, not warning_only) but 4yr history shows ~113 danger-days/yr, maxExposed 5.3m, AND documented drownings — fails all three FLAG criteria; not a kids beach in N/NE swell. |
| Hanalei Bay | 115/yr | 5.4 m | NE | Not warning_only with documented deaths and 115 danger-days/yr, maxExposed 5.4m — data clearly contradicts the non-warning classification; FLAG per drowning + big-exposed-swell criteria. |
| Tunnels (Mākua) | 113/yr | 5.3 m | NE | Labeled family-safe (kid=true, not warning_only) yet 4yr data shows 113 danger-days/yr and maxExposed 5.3m (>=4.0 with dd>=10) — fails kid+danger and big-exposed-swell FLAG tests; only the summer lagoon is child-safe. |
| Lydgate Beach Park | 85/yr | 3.9 m | E | FLAG: labeled family-safe (kid=true, not warning_only) yet 85 danger-surf days/yr (>=25) AND a documented 2025 drowning death — two independent triggers. Protected lagoon shelters the pond, but exposed open-water area gets hammered (maxExposed 3.9m, 81% elevated days). |
| Keālia Beach | 78/yr | 3.9 m | E | FLAG: not warning_only, big exposed swell hits often (maxExposed 3.9m with 78 danger-days/yr) plus a documented near-fatal shorebreak injury. Data and danger reputation both contradict the plain classification; conservatively flag. |
| Wailua Beach | 85/yr | 3.9 m | E | FLAG: not warning_only with maxExposed 3.9m and 85 danger-surf days/yr (>=10), AND a documented drowning death. An unguarded open east-facing beach that gets pounded — multiple triggers, clear flag. |
| Donkey Beach (Paliku) | 78/yr | 3.9 m | E | FLAG: not warning_only with maxExposed 3.9m and 78 danger-surf days/yr (>=10) — big exposed swell hits often — plus a documented near-fatal swept-out rescue. Unguarded open beach mislabeled as non-warning. |

### Type B — calm but had a drowning (messaging, not reclassification)
| Beach | Danger days | Max exposed surf | Dom. swell | Why flagged |
|---|---|---|---|---|
| Kalapakī Beach | 7/yr | 2.6 m | E | FLAG: not warning_only AND a documented drowning death — triggers the incident rule regardless of surf stats. Bay is genuinely calm most days (only 7 danger-days/yr, maxExposed 2.6m), but a fatality occurred, so flag for human review. |
| Poʻipū Beach Park | 2/yr | 2.9 m | E | NOT warning_only + kid=true with documented drownings (3+ in 2023 alone) triggers FLAG; surf-exposure is low (dangerDays=2/yr, full-time guard) but the fatality record contradicts a clean family-safe label — human review of snorkel/medical risk messaging needed. |
| Māhāʻulepū Beach | 2/yr | 2.9 m | E | NOT warning_only at an unguarded (lg=none) beach with a documented drowning triggers FLAG; surf-exposure is moderate (maxExposed 2.9m) but the un-flagged label on a remote guard-less beach with a fatality record warrants review. |
| Shipwreck Beach (Keoneloa) | 2/yr | 2.5 m | E | NOT warning_only at an unguarded high-energy (sb=7) beach with a documented 2025 death and known rip/shorebreak hazard triggers FLAG; the clean label understates the cliff-jump and shorebreak risk and needs human review. |
| Salt Pond Beach | 2/yr | 3 m | SE | FLAG: NOT warning_only AND documented drownings found at this beach. Protected lagoon swim zone reads calm in the 4yr data (maxExposed 3.0m, only 2 danger-days/yr), but real deaths occurred at the rocky margins/off-shore — family-safe label needs a hazard caveat despite the sheltered swim area. |
| Kekaha Beach Park | 1/yr | 2.8 m | SE | FLAG: NOT warning_only AND documented drowning death at this beach (Diaz, Nov 2025, during high surf advisory). The exposed-wave model under-reads it (maxExposed only 2.8m, 1 danger-day/yr) because hazard comes from high-surf-advisory days and rescue scenarios, not steady exposure — the non-warning label is contradicted by a real fatality. |

## New islands — Maui / Oʻahu / Hawaiʻi Island flags

### Maui — 9 flags (2 under-warned, 7 calm-but-fatal)
**Type A:**
| Beach | Danger days | Max exposed surf | Dom. swell | Why flagged |
|---|---|---|---|---|
| Baby Beach (Pāʻia) | 54/yr | 4.4 m | NE | NOT warning_only + kid=true + dangerDaysPerYr 54 (>=25) trips the family-safe FLAG rule. Caveat: morph=lagoon and the open-meteo cell snapped to the exposed offshore NE point, likely overstating in-lagoon surf; needs human check of the data point vs the actual sheltered pool. |
| Sugar Cove Beach | 52/yr | 4.5 m | NE | NOT warning_only AND maxExposed 4.5m (>=4.0) with 52 danger days/yr (>=10) -> FLAG. Big NE swell (matches facing 15) hammers it often; label does not reflect this exposure. |

**Type B:**
| Beach | Danger days | Max exposed surf | Dom. swell | Why flagged |
|---|---|---|---|---|
| Kāʻanapali Beach | 0/yr | 1.6 m | E | Labeled family-safe (kid=true, not warning_only) but has documented drowning deaths and is a known Maui drowning hot-spot despite a calm 4yr backtest (maxExp 1.6m); calm-looking water masks strong currents off Black Rock end. |
| Kapalua Bay | 0/yr | 2.1 m | E | Labeled family-safe (kid=true, not warning_only) but has a documented drowning death and mass-rescue event when periodic SW/W swell wraps in (maxExp 2.1m) — data contradicts the calm-bay label. |
| Nāpili Bay | 0/yr | 2.1 m | E | Labeled family-safe (kid=true, not warning_only) but documented mass rescues and a near-drowning medevac during wrapping SW/W swell (maxExp 2.1m) — open pocket bay gets dangerous, label too benign. |
| D.T. Fleming Beach Park | 3/yr | 2.4 m | NE | Not warning_only and has a documented drowning death plus a notorious winter shorebreak (maxExp 2.4m, 3 danger days/yr, N/NE-exposed); has lifeguards but the no-warning label understates a deadly beach — flag for human review. |
| Kamaʻole Beach Park III | 0/yr | 2.3 m | S | Labeled family-safe (kid=true, NOT warning_only) yet has documented snorkeling drowning deaths; surf is calm (0 danger days) but the hazard is offshore snorkeling fatalities, which the family-safe label understates. |
| Kanahā Beach Park | 0/yr | 0.7 m | S | NOT warning_only + kid=true but 3+ documented drownings 2017-2021 -> FLAG. Grid cell reads sheltered (0.7m, domSwell S vs facing 15 = inconsistent bearing), so the calm data is a harbor-grid artifact; real-world fatalities contradict the family-safe label. |
| Spreckelsville Beach | 0/yr | 0.7 m | S | NOT warning_only AND documented 2017 drowning -> FLAG. Grid cell reads sheltered (0.7m, domSwell S vs facing 15 = inconsistent), so calm data is a harbor-grid artifact masking real shorebreak/rip-current deaths. |


### Oʻahu — 11 flags (3 under-warned, 8 calm-but-fatal)
**Type A:**
| Beach | Danger days | Max exposed surf | Dom. swell | Why flagged |
|---|---|---|---|---|
| Haleʻiwa Aliʻi Beach Park | 44/yr | 5.3 m | N | FLAG: labeled family-safe (kid=true, not warning_only) yet 44 danger days/yr (>=25) and maxExposed 5.3m (>=4.0 with dangerDays>=10) — two FLAG triggers. The protected south corner may be calm, but the stored open-coast point gets hammered; classification understates winter risk. |
| Kalama Beach | 39/yr | 3.5 m | E | NOT warning_only, kid=true, yet 39 danger-days/yr (>=25) plus an adjacent documented drowning — family-safe label contradicted by 4yr data, FLAG. |
| Kualoa Regional Park | 62/yr | 4.3 m | NE | NOT warning_only, kid=true, yet 62 danger-days/yr (>=25) and maxExposed 4.3m (>=4.0 with >=10 danger days) — by far the most exposed Windward beach; the 'family-safe' label is sharply contradicted by 4yr data, FLAG. |

**Type B:**
| Beach | Danger days | Max exposed surf | Dom. swell | Why flagged |
|---|---|---|---|---|
| Kailua Beach Park | 4/yr | 2.7 m | SE | NOT warning_only and labeled kid-safe, but a documented 2025 drowning occurred here — label vs reality disagree, FLAG. |
| Waimānalo Bay Beach Park | 8/yr | 2.9 m | SE | NOT warning_only and labeled kid-safe, but a documented 2026 drowning death occurred here — FLAG. |
| Bellows Field Beach Park | 8/yr | 2.9 m | SE | NOT warning_only and labeled kid-safe, but a documented drowning plus known rip currents contradict the family-safe call — FLAG. |
| Waikīkī Beach | 1/yr | 2.3 m | SE | FLAG (rule 2): NOT warning_only but documented drowning deaths. Surf data is calm (maxExposed 2.3m, 1 danger day/yr) — deaths are medical/in-water incapacitation, not shorebreak — but the family-safe label vs real fatalities warrants a human look. |
| Ala Moana Beach Park | 1/yr | 2.4 m | S | FLAG (rule 2): NOT warning_only + kid=true but a CHILD (14yo) drowned here plus multiple adult deaths. Surf is sheltered (maxExposed 2.4m, 1 danger day/yr; deep dredged channels are the real hazard, not surf), but a child fatality at a family-safe-labeled beach is the strongest contradiction. |
| Kaimana Beach (Sans Souci) | 1/yr | 2.4 m | SE | FLAG (rule 2): NOT warning_only but multiple documented drowning deaths. Surf calm (maxExposed 2.4m, 1 danger day/yr) — fatalities are snorkel/dive incapacitation offshore near the windsock channel, not surf — but family-safe label vs real deaths warrants review. |
| Ko Olina Lagoons | 2/yr | 2.5 m | SE | Labeled family-safe/non-warning (kid=true) yet has a 4-yr+ record of fatal still-water/medical drownings in unguarded lagoons; data calm (dd=2) but death history contradicts the calm-and-safe call — FLAG per drowning rule. |
| Pōkaʻī Bay Beach Park | 1/yr | 2.7 m | NW | Sheltered bay reads calm (dd=1) and is kid=true/non-warning, but a child drowning is documented here — NOT warning_only + documented drowning triggers FLAG; surf classification is right, the safe-for-kids framing needs a human look. |


### Hawaiʻi Island — 6 flags (4 under-warned, 2 calm-but-fatal)
**Type A:**
| Beach | Danger days | Max exposed surf | Dom. swell | Why flagged |
|---|---|---|---|---|
| Richardson Ocean Park | 102/yr | 4.3 m | E | kid=true, not warning_only, but maxExposed 4.3m (>=4.0) with 102 danger-days/yr (>=10): open-ocean model shows extreme exposure on a family-labeled beach. The calm swimmable area is the lava-pool behind reef; conservatively FLAG the family label given the modeled exposure. |
| Carlsmith Beach Park (Four Mile) | 99/yr | 4.3 m | E | kid=true, not warning_only, maxExposed 4.3m (>=4.0) with 99 danger-days/yr (>=10): heavy open-ocean exposure hits this family-labeled lagoon often. Protected lagoon stays calm but the modeled exposure on a kid beach warrants FLAG. |
| Leleiwi Beach Park (Waiʻuli) | 97/yr | 4.2 m | E | NOT warning_only AND documented drownings (recurring fatal location) -> FLAG. Reinforced by 4.2m maxExposed and 97 danger-days/yr; the safety label understates a beach with a real drowning history. |
| Onekahakaha Beach Park | 99/yr | 4.3 m | E | kid=true, not warning_only, maxExposed 4.3m (>=4.0) with 99 danger-days/yr (>=10) plus documented historical drownings behind the break. Inner cove is safe, but the family label paired with extreme outer exposure and drowning history warrants a FLAG. |

**Type B:**
| Beach | Danger days | Max exposed surf | Dom. swell | Why flagged |
|---|---|---|---|---|
| Hāpuna Beach | 1/yr | 2.5 m | W | Labeled family-safe (NOT warning_only, kid=true) but has a documented 2025 drowning death — FLAG per the documented-fatality rule. 4-yr surf is usually calm (1 danger-day/yr) which is exactly why guests underestimate the winter shorebreak that kills here. |
| Kaunaʻoa Beach (Mauna Kea) | 2/yr | 2.5 m | W | Labeled family-safe (NOT warning_only, kid=true) but has a documented 2022 drowning death — FLAG per the documented-fatality rule. Mostly calm 4-yr history (2 danger-days/yr) masks the real risk that already killed a swimmer here. |


## REVIEW (worth a glance)
| Beach | Danger days | Max exposed surf | Dom. swell | Why flagged |
|---|---|---|---|---|
| Polihale State Park | 16/yr | 4.3 m | SE | REVIEW: warning_only label is well-supported by the data (maxExposed 4.3m, 16 danger-days/yr) and real fatalities — classification is correct. Flagged only because domSwell 'SE' is inconsistent with stored facing 270 (W); possible wrong bearing in the dataset worth a human glance. |
| Pakala (Infinities) | 2/yr | 3 m | SE | REVIEW: NOT warning_only with maxExposed 3.0m (in the 3.0-4.0 REVIEW band). Low danger-day count (2/yr) and no documented incidents, but it is an expert-only surf break (channel_reef, not a swim beach) — the non-warning classification deserves a human glance. Also domSwell 'SE' vs facing 200 worth checking. |
| Kamaʻole Beach Park I | 0/yr | 2.3 m | S | Surf history is benign (0 danger days, 2.3m max), but kid=true + NOT warning_only on a strip with documented area snorkeling deaths (Kam III) warrants a human glance at snorkel-hazard messaging. |
| Kamaʻole Beach Park II | 0/yr | 2.3 m | S | Calm 4-yr surf (0 danger days), but kid=true + NOT warning_only adjacent to Kam III's documented snorkeling fatalities — worth a human review of snorkel-safety wording, not a surf FLAG. |
| Charley Young Beach | 0/yr | 2.3 m | S | Surf history benign (0 danger days), but kid=true + NOT warning_only + no lifeguard, contiguous with the Kamaʻole snorkeling-death strip — flag for a human glance at snorkel messaging. |
| Kahului Harbor Beaches (Hoʻaloha / Kanahā Pond) | 0/yr | 0.7 m | S | warning_only=true but maxExposed only 0.7m (<1.0), 0 danger days, no incidents -> possibly over-cautious. Also domSwell S vs facing 20 is inconsistent (harbor-sheltered grid cell). REVIEW the warning and the bearing. |
| Hāna Bay | 19/yr | 3.2 m | E | REVIEW: family-safe label (kid=true, not warning_only) but 4yr history shows ~19 dangerous-surf days/yr and maxExposed 3.2m — in the 10-24 REVIEW band, just under the FLAG threshold of 25. NE facing (40) consistent with dominant E swell wrapping in. Lifeguard presence mitigates, but worth a human glance. |
| Kahaluʻu Beach Park | 0/yr | 2.1 m | S | Modeled surf is low (maxExposed 2.1m, 0 danger-days/yr) but a documented 2026 bodysurfing fatality occurred here; already warning_only + full-time lifeguard, so not a FLAG, but human should confirm the in-app warning emphasizes the channel rip current that swell stats miss. |
| Kīholo Bay | 2/yr | 2.7 m | N | warning_only so no FLAG, but dominant historical swell is N (0deg) vs stored facing 260 (W) — a ~100deg bearing mismatch that may mean the stored facing/exposure window is wrong; maxExposed 2.7 m means it is NOT over-cautious. Worth a human glance on the facing value. |


## Method
For each beach: pulled 2022-2025 daily max wave height + dominant swell direction, computed **exposed surf** = wave height × how directly that day's swell hit the beach's stored `facing`; counted days/yr the exposed surf ≥ 2.0 m (≈6.5 ft); then cross-checked documented drownings/rescues. A FLAG means the label and the 4-year evidence disagree. Generated 2026-06-22 by the OceanSafe firm's stress-test workflow (16 agents).
