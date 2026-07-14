# Track C — Oʻahu (Waikīkī) Japanese UI-chrome coverage

**Goal:** close the Japanese gap on UI chrome in `waikiki-ja.html` where strings
render in English because they are absent from `window.I18N.ja` in
`data/i18n-ja.js`.

**Deliverable:** `_waikiki-rigor/trackC-chrome-merge.js` — a ready-to-merge
`Object.assign` patch. NOT merged into the live dict.

## How the app translates (so keys match)
`waikiki-ja.html` lines 2258–2295 run a non-English-only DOM sweep:
a `TreeWalker` over text nodes plus `[placeholder][aria-label][title]`.
Lookup key = the node's **entire** text, HTML-entity-decoded by the browser and
whitespace-normalized (`/\s+/g → ' '`, trimmed). A `MutationObserver` re-sweeps
nodes added later (so JS-rendered chips and the service-worker toast are covered).
Because the match is on the *whole* text node, generic one-word keys like
`All` / `Family` / `Clear` only fire on standalone chip/tab labels — they cannot
hijack the same word inside an English sentence.

## Audit method
- Loaded the live dict via Node and dumped all 856 existing keys
  (`_waikiki-rigor/_keys.json`).
- Extracted chrome strings from source: bottom-nav labels (line 1854),
  shore-overlay pills (lines 1884–1887), the `SUBTABS` filter object
  (lines 5805–5844), the Live-Now chip values (`updateLiveNow`, lines 6670–6702),
  and the service-worker update toast (lines 7150–7171).
- Diffed each target against the dict; kept only confirmed misses.

## Newly covered: 39 strings

| Group | Keys |
|---|---|
| Nav tabs | Beaches, Trails, Family, Tours, Town |
| Map shore pills | North, South, East, West |
| Region chips | Windward, Leeward |
| Filter subtabs | Wildlife, Scenic, Towns, Cultural, Playgrounds, Hazards, All, Swim, Snorkel, Walk, Photo, Tidepools, Oceanfront, Surf, Hotels, Budget, Luxury, Food, Drinks, Coffee, Farmers, Crafts, Gas, Grocery |
| Live-Now values | Clear, Dry |
| Service-worker toast | New version available, Reload |

### Already covered (no action needed)
`North Shore`, `South Shore`, `Live Now`, `Beaches Now`, `Trails Now`,
`Family Now`, `Loading…`, `Brown water advisory`, `⚠ Brown water`, `Kid-safe`,
and the four shore-chip `aria-label`s (`North Shore conditions`, etc.) — these
were verified present in the live dict, so the "FAMILY NOW / NOW" and most
decision-point labels were already translated. The remaining gap was the static
nav/filter/region chrome above.

## Safety / constraint checks
- **`node --check`: PASS.** Loads cleanly; 39 keys parsed.
- **Prices:** `grep '$' → 0 matches`. No money/USD strings are translated or
  converted; none of these chrome strings contain a price. [measured]
- **Proper nouns / brands:** none translated (no brand names in this set).
- **No English-regression risk:** all 39 keys are **net-new** — 0 collisions with
  the 856 live keys [measured], so merging cannot overwrite an existing entry.
  The patch also never edits the English path (sweep is gated on
  `ACTIVE_LANG!=='en'`).
- **Safety register:** `Hazards → 危険・注意` keeps the warning explicit; no
  hazard wording was softened.

## Translation-register notes
- Loanword katakana used where it is the natural Japanese UI norm
  (ビーチ, ツアー, シュノーケル, ホテル, ラグジュアリー).
- `Windward`/`Leeward` glossed (`風上側（ウインドワード）`/`風下側（リーワード）`)
  so the directional meaning is clear to guests, since the bare katakana is not
  widely understood.
- Single-direction pills kept short (北/南/東/西) to fit the small map chips.
- LLM-translated, consistent with the file's existing `NEEDS-NATIVE-REVIEW`
  status — recommend a native pass before ship. [assumption: register choices]

## To merge (when approved — not done here)
Append the contents of `trackC-chrome-merge.js` to `data/i18n-ja.js`, or paste the
`Object.assign(...)` block after the existing `window.I18N.ja = {...}` literal.
