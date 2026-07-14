# Track B — Japanese Safety-String Review (i18n-ja.js)

**Reviewer:** LLM Japanese-native-grade safety reviewer (OceanSafe).
**Source:** `/Users/nickmossman/Desktop/OceanSafe/maui-build/data/i18n-ja.js` — `window.I18N.ja` (855 EN→JA pairs; the file header self-labels "LLM-translated — NEEDS-NATIVE-REVIEW").
**Scope:** Every safety-MEANING string (hazard names, imperatives, safe/not-safe verdicts, mortality phrasing, advisory labels, uncertainty/stale-data warnings). Non-safety UI/marketing strings were not graded.
**Date:** 2026-06-23.
**Method:** Parsed the object to JSON, regex-filtered 285 safety-candidate pairs, read all imperative/mortality strings in full, hand-judged each for SOFTENING / WRONG / AWKWARD vs the English.

> **HARD-GATE CAVEAT (read first):** This is an LLM native-grade review. It does NOT clear the human native-speaker hard gate. A real ja-native ocean-literate reviewer must sign off on the `humanGateShortlist` items below before any Japanese safety string ships. English rendering must stay byte-identical; no JA fix here has been applied to the live file.

---

## Headline read

The translation is, on the whole, **unusually strong for an LLM pass** — the long mortality/imperative beach descriptions (Mākena spinal-injury, Sandy Beach, Hālona, South Point, Wailea father/son drowning, Hanakāpīʻai-class cliff trails) are translated with **equal-or-stronger urgency** and correct hazard vocabulary (離岸流, ショアブレイク, 溺死, 死亡事故, カツオノエボシ, イタチザメ). Most "stay out" / "do not enter" / "never alone" imperatives land at full force (入らないでください / 絶対に / 決して〜ないでください).

The risk is **NOT in the long prose. It is concentrated in the short reusable UI verdict labels** — the words a worried parent reads in one glance. A handful of these are SOFTENED: they render a safety verdict as "not suitable / please note" instead of "dangerous / required." On a glanceable safety chip, that softening is the whole ballgame.

**Overall residual risk: MEDIUM.** Long-form prose LOW; short verdict/label chips MEDIUM-HIGH until a native sign-off. No fabricated sources were introduced by the translation (mortality counts/years mirror the English).

---

## CRITICAL — SOFTENED (JA weaker / more tentative than EN). Fix before ship.

### S1. "not safe to swim" rendered as "not suitable for swimming"
- **EN:** `The water between the two beaches is not safe to swim.`
- **JA (current):** `…2つのビーチの間の海は遊泳に適していません。`
- **Why it costs trust:** 「遊泳に適していません」 = "not suited for swimming" — the standard SOFTENING. It reads like a comfort/recommendation note, not a danger verdict. EN says **not safe**.
- **JA (fixed):** `…2つのビーチの間の海で泳ぐのは危険です。絶対に泳がないでください。`
- **Severity: critical** (verdict-level meaning inversion of register).

### S2. "Use Caution" reduced to a bare noun
- **EN:** `Use Caution` (a status-chip verdict, one of the app's three-ish safety tiers)
- **JA (current):** `注意`
- **Why it costs trust:** 「注意」 alone = "note / attention," signage-flat and weaker than the English imperative. On a safety tier chip it under-warns. (Note the inconsistency: the lowercase variant `Use caution` → `注意が必要` is already stronger.)
- **JA (fixed):** `要注意` (compact, signage-grade) or `注意してください`. Use one consistently for both `Use Caution` and `Use caution`.
- **Severity: high** (reusable tier label, appears app-wide).

### S3. "No Safe Activities" reads as a neutral availability state
- **EN:** `No Safe Activities`
- **JA (current):** `安全なアクティビティなし`
- **Why it costs trust:** Literally "no safe activities," but phrased like an out-of-stock/availability note rather than a do-not-go-in-the-water verdict. The English is a hard red-tier signal.
- **JA (fixed):** `今日は安全に楽しめる海のアクティビティはありません` or, if space-bound, keep `安全なアクティビティなし` but ensure it is paired with the red tier color + an explicit 入水は危険 line. Flag for human: register may be too soft for a top-tier verdict.
- **Severity: high.**

### S4. "shorebreak" term is INCONSISTENT across the app
- Two renderings coexist:
  - `ショアブレイク（岸際で崩れる波）` / `磯波（…）` (good — gives the loanword + a gloss)
  - `砕け波` (e.g. "Spectacular cliffs… the shorebreak injures…", "壮大な断崖…砕け波が…")
- **Why it costs trust:** 「砕け波」 just means "breaking wave" and **loses the specific killer mechanism** (a wave that dumps onto sand and breaks necks). Shorebreak is the single most lethal hazard in this dataset (Sandy Beach, Mākena, Hālona, Hāpuna). It must read as the named, specific hazard every time, not a generic "breaking wave."
- **JA (fixed):** Standardize on `ショアブレイク（岸際で崩れる激しい波）` on first use per description, `ショアブレイク` thereafter. Replace bare `砕け波`.
- **Severity: high** (consistency of the deadliest hazard name).

### S5. "Conditions look fine" / "Conditions are good now" as safety verdicts
- **EN:** `Conditions look fine` → **JA:** `海況は良好`; `Conditions are good now` → `今は良好な状態`
- **Why it costs trust:** EN hedges ("look fine," "good *now*") — honest uncertainty. The JA `良好` is a flat, confident "good," dropping the temporal/uncertainty hedge. On a safety app, a more confident "safe" reading than the English is exactly the failure mode to avoid.
- **JA (fixed):** `海況は今のところ良好に見えます` (mirrors "look") / `今は良好です（変化することがあります）`.
- **Severity: medium** (verdict over-confidence; small words, big stakes).

### S6. "Treat conditions as unknown and use extra caution" — caution verb softened
- **EN:** `Treat conditions as unknown and use extra caution.`
- **JA (current):** `状況は不明として扱い、十分に注意してください。`
- Borderline OK. 「十分に注意してください」 is acceptable but is the soft end of the caution scale for a *no-lifeguard + no-data* state. Consider `細心の注意を払ってください` or appending `無理をせず入水を控えてください`.
- **Severity: low-medium.** Flag for human.

---

## WRONG / accuracy risks

### W1. (none material in the mortality numbers) — counts, years, and place facts mirror the English; no fabricated source detected. Good.

### W2. ROPE gloss — verify the medical term
- **EN:** `ROPE deaths in 2023-2024`
- **JA:** `遊泳者起因性肺水腫（ROPE）による死亡事故`
- "遊泳者起因性肺水腫" is a plausible coinage for *swimming/diving-induced pulmonary edema* but is **not a settled Japanese medical term** and may read as opaque to a layperson. The safety meaning ("people have died here doing exactly this") survives, so not a softening — but flag for a native + medical check. A clearer lay rendering: `（シュノーケリング・ダイビング中に起こりうる肺水腫が原因の）死亡事故`.
- **Severity: low** (meaning intact; clarity/terminology).

### W3. "exposure/cut hazards" → "けがの危険"
- **EN:** sharp reef and exposed rock are `exposure/cut hazards`
- **JA:** `けがの危険`
- "exposure" here is the app's term for cut/abrasion exposure on reef, so `けが` (injury) is acceptable shorthand, but it drops the specificity. Minor. Severity: low.

---

## AWKWARD (understood, but a native would phrase differently)

- **A1.** `オフショア（沖向き）の流れ` for "offshore current" — readable, but a JA reader may parse オフショア as "offshore wind." `沖へ向かう離岸性の流れ` is clearer. Severity: low.
- **A2.** `衣服着用任意` for "clothing-optional" — literal/clinical but clear. Acceptable. Severity: low.
- **A3.** `見るだけ・触れない` / `見るだけ、触れない` for "look-don't-touch" — both variants appear; pick one. Minor. Severity: low.
- **A4.** Unit handling is GOOD: ft values are consistently kept and many add a metric gloss (`3メートル（10フィート）`, `波高7.5m`). Keep this pattern; do not strip the ft original.

---

## OK — confirmed equal-or-stronger (representative, not exhaustive)

These carry full urgency and are clear; no change needed:
- `do not enter` → `入水禁止` (strong, signage-grade). OK.
- `No swim entry` → `遊泳不可`. OK.
- `Using last-known conditions, verify before you enter the water` → `最後に取得した海況を表示中。入水前に必ず確認してください` — uncertainty + 必ず. **Strong. OK.** (One of the most important strings; lands correctly.)
- `<b>Surf data unavailable</b> · no lifeguard on duty…` → `…状況は不明として扱い…` — see S6 for the only nit.
- All `[verify]` / `【要確認】` / `［要確認］` unguarded-tower strings — uncertainty preserved, "do not count on a lifeguard" → `ライフガードを当てにしないでください` / `監視なしとして扱ってください`. **Strong. OK.** (Note cosmetic inconsistency: `［要確認］` half-width vs `【要確認】` full-width brackets — harmless, but normalize.)
- Mortality phrasing: `people have died here` → `死者も出ています`; `Multiple fatalities` → `複数の死者が出ています`; `breaks necks` → `首を折る` / `首の骨を折る`; `deadly` → `命にかかわる` / `致命的`. **All strong. OK.**
- `stay out of the water entirely` → `海には絶対に入らないでください`. **Stronger than EN. OK.**
- `do not jump` → `岩からは絶対に飛び込まないでください`. OK.
- `swim at your own risk` → `自己責任で泳ぐこと` / `自己責任で…遊泳`. OK.
- Hazard names: rip current → `離岸流` (consistently, often `リップカレント（離岸流）`); strong current → `強い流れ`; brown water → `濁り水`; sharp rocks → `鋭い岩`; Portuguese man o' war → `カツオノエボシ（ポルトガル軍艦）`; tiger shark → `イタチザメ`. **All correct. OK.**

---

## Human-gate shortlist (MUST get a real ja-native ocean-literate sign-off)

Priority order — these are verdict-level, high-frequency, or terminology-sensitive:
1. **S1** `not safe to swim` → must NOT be `適していません`. (verdict softening)
2. **S2** `Use Caution` / `Use caution` → unify to a strong imperative; `注意` alone is too weak. (app-wide tier chip)
3. **S3** `No Safe Activities` → confirm register is hard enough for a red-tier verdict.
4. **S4** `shorebreak` → standardize the term; eliminate bare `砕け波` for the deadliest hazard.
5. **S5** `Conditions look fine` / `good now` → restore the EN uncertainty hedge; don't render a more confident "safe."
6. **W2** `遊泳者起因性肺水腫（ROPE）` → medical-term/clarity check.
7. **S6** the `no-data + no-lifeguard` caution line — confirm `十分に注意` is strong enough.
8. Bracket/term **consistency sweep**: `［要確認］`↔`【要確認】`, `ショアブレイク`↔`磯波`↔`砕け波`, `見るだけ・触れない` variants. (cosmetic but trust-signaling)

---

## Residual-risk statement

After the S1–S6 fixes, residual risk on the Japanese safety layer drops from **MEDIUM to LOW-MEDIUM**, gated entirely on the human native sign-off of the shortlist. The long-form hazard prose is already at or above English urgency. The remaining exposure is the short reusable verdict chips, where a single softened word ("適していません," bare "注意," flat "良好") can read as a more reassuring answer than the English — the one thing a safety product must never do. Do not treat this LLM review as clearing that gate.
