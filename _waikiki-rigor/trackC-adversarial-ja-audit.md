# Track C — Adversarial JA Safety Audit (independent of Track B)

Scope: data/i18n-ja.js, 856 key→value pairs parsed via window shim, 231 safety-relevant pairs scanned.
Constraint honored: no edits to live file; English byte-identical; artifacts under _waikiki-rigor only.

## Verdict
AGREE with Track B's direction and its overall MEDIUM-gated-on-human-native risk. All 5 critical softenings (S1–S5) independently reproduced. Long-form mortality/imperative prose is strong (equal-or-stronger than EN). Softening is concentrated in short reusable UI chips — same conclusion as Track B. I add several items Track B under-weighted or missed, all in the same chip/short-string class.

## Confirmed (Track B was right)
- S1 "not safe to swim" → 遊泳に適していません — softened (suitability note, not danger). CRITICAL.
- S2 "Use Caution" → 注意 — weak. NEW DETAIL: file has BOTH 注意 ("Use Caution") and 注意が必要 ("Use caution") for near-identical EN — in-file inconsistency proves the unify-on-strong-imperative point concretely.
- S3 "No Safe Activities" → 安全なアクティビティなし — reads like out-of-stock, not a red-tier do-not-enter. HIGH.
- S4 shorebreak vocab inconsistent (砕け波 / ショアブレイク / 磯波). HIGH.
- S5 "Conditions look fine"/"good now" → 良好 flat — EN hedge dropped. MEDIUM.

## Findings Track B missed / under-scoped
- F1 (HIGH): S5 is BROADER than the two examples cited. The whole confident-verdict family drops EN hedges: "Conditions are good now"→今は良好な状態, "Beach conditions are good"→ビーチの状態は良好, "Conditions are good for an adrenaline day"→…最適な状況, "Early morning was best — still good now"→今もまだ良好. Fix must sweep ALL "good/fine/now" outlook chips, not just 2.
- F2 (MEDIUM): In-file SEMANTIC INCONSISTENCY for the same danger concept. "not safe to swim"→適していません (weak) while "No safe entry"/"no safe ocean entry"/"NO safe swim entry" are rendered strongly as 安全に入れる場所はありません / 安全に入水できる場所はありません / 安全な遊泳エントリーのない. The strong model already exists in the file; S1 should be aligned to it (e.g. 泳ぐのは危険です。絶対に泳がないでください).
- F3 (LOW-MED): "No Safe Activities" red-tier chip (S3) is the ONLY verdict-tier label that doesn't itself carry a do-not-enter cue, while siblings do (遊泳不可 for "No swim entry", 入水禁止 for "do not enter"). Strengthen to e.g. 安全に楽しめる海のアクティビティはありません（入水は危険）。
- F4 (LOW): "OK today"→本日まずまず ("so-so/passable"). Slightly more negative-neutral than EN "OK"; acceptable, but worth native eyes for register consistency with 本日最適 / 今日は控えて.

## Rated OK on independent read (agree with Track B)
- "do not enter"→入水禁止; stale-data line "…入水前に必ず確認してください" (uncertainty + 必ず, strong); "do not count on a lifeguard […verify]"→ライフガードを当てにしないでください［要確認］; all death/neck/imperative long-form prose (絶対に泳がないでください / 海には入らないでください / 水に入らないでください / 首を折る / 命にかかわる / 致命的 / 溺死 / カツオノエボシ / イタチザメ). No fabricated sources, dates, or tower confirmations spotted; bracket-tagged [verify]/［要確認］/【要確認】 preserved (style inconsistency only — cosmetic).
- S6 no-data line "状況は不明として扱い、十分に注意してください" — slightly soft (十分に caution but no "avoid entry"); MEDIUM, agree with Track B's restore suggestion.

## Residual risk after S1–S6 + F1–F3 fixes
LOW-MEDIUM. The remaining risk is entirely in high-frequency reusable chips, where one soft word reads as more reassuring than EN. Does NOT clear the human native hard gate. Coverage note (separate from softening): several gate/disclaimer keys ("You assume all risk", "I Understand — Continue", "A general guide, not a safety guarantee.", "Treat conditions as unknown and use extra caution.", "No safe entry", "No data", "Conditions change rapidly", "Warning:", "Heads up:") have NO JA value and will render in English — that is task #6 coverage, not a softening, but it means the consent/risk gate currently shows mixed-language to a JA user.
