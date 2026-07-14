# Cross-category `id` audit & dedup — resolution

Scope: `data/maui.js`, `data/oahu.js`, `data/hawaii.js`. Kauaʻi (inline data in
`index.html`) was left byte-identical and is unaffected. Nothing deployed or pushed.

## Question

Some `id` values are reused across categories in the island datasets. Does the app
ever key off `id` in a way that lets a duplicate grab the wrong record (a saved
favorite, a deep-link, a cross-category lookup)?

## How the app uses `id` (index.html)

Every consumer of `id` is namespaced by category/kind, and there is **no global
"search all arrays for this id" lookup**:

| Consumer | Mechanism | Keyed by |
|---|---|---|
| Saved / favorites | `KBG_SAVED_KIND_META`; save key is `` `${kind}:${id}` `` | kind **and** id |
| Saved-sheet resolve | `meta.arr.find(x => x.id === id)` on the kind's own array | kind's array only |
| Per-item open | `openSheet`/`openActSheet`/… each `B.find` / `ACTS.find` / etc. | that category's array |
| Deep-link router | `_routeKinds` uses kind-named params (`?beach=`, `?act=`, `?hike=`…) | kind in the param name |
| Analytics | `OSA.item(kind, id, name)` | kind and id |

`KBG_SAVED_KIND_META` maps every saveable category to a **distinct** kind
(`beach, hike, act, food, grocery, gas, craft, market, drink`). So a place that is
listed as both a beach and a family activity is saved under two different keys
(`beach:napili_bay` vs `act:napili_bay`) and each resolves against its own array.

## Verdict

**Cross-category shared ids are harmless — left in place.** Because the kind always
travels with the id (in the save key, the open function called, and the deep-link
param name), two records in different categories that share an id never collide.

Cross-listed ids kept as-is:

- `data/maui.js`: `napili_bay` (beaches+acts), `big_beach_makena` (beaches+acts),
  `waianapanapa` (beaches+acts), `monkeypod_wailea` (foods+drinks),
  `hasegawa_general_store_hana` (gas_stations+groceries)
- `data/oahu.js`: `kailua_beach_park` (beaches+acts), `hanauma_bay` (beaches+acts),
  `diamond_head` (hikes+acts), `matsumoto_shave_ice` (foods+drinks)
- `data/hawaii.js`: `punaluu_bake_shop` (foods+local_crafts+groceries+drinks),
  `costco_kona` (gas_stations+groceries)

Latent risk to remember: if anyone later adds a lookup that merges categories and
searches by bare `id`, these would become ambiguous. Today nothing does that.

## The one real collision — fixed

The collision was **within** a single category, not across them. Every tour in
`data/maui.js`, `data/oahu.js`, and `data/hawaii.js` carried the **same** placeholder
GetYourGuide id (`[verify-gyg-id]` ×10, `[verify-gyg-tour-id]` ×12, `VERIFY_GYG_ID`
×14). The tours sheet picks a featured tour, then renders the rest with:

```js
const tourSections = TOURS_LIBRARY.filter(t => t.id !== featured.id) // index.html
```

With every tour sharing one id, `t.id !== featured.id` is false for all of them, so
**"More Curated Tours" rendered empty on all three islands** and every GetYourGuide
widget got the same dead `data-gyg-tour-id`.

Fix: each tour got a unique placeholder id, preserving each island's existing
convention:

- `data/maui.js`: `[verify-gyg-id-01]` … `[verify-gyg-id-10]`
- `data/oahu.js`: `[verify-gyg-tour-id-01]` … `[verify-gyg-tour-id-12]`
- `data/hawaii.js`: `VERIFY_GYG_ID_01` … `VERIFY_GYG_ID_14`

After the fix the filter keeps 9 / 11 / 13 cards respectively.

These stay **placeholders on purpose**. Real GetYourGuide tour ids are numeric and
specific to a product; the source notes on each tour already flag the id as `[verify]`
/ "NOT yet sourced". Fabricating numeric ids would point the affiliate widget at the
wrong tour, so the ids are kept obviously-fake (and the booking widget stays inert)
until real ones are sourced.

### TODO before these tours can book
Replace each unique placeholder with the actual GetYourGuide tour id (partner
`FV7E5LX`). The card content (title, price, rating, condition-match) already renders;
only the embedded availability widget needs the real id.

## Note on concurrent edits
While doing this, the hawaii.js dedup was reverted once by a process outside this
session (several Claude/`http.server` instances are running against this same
directory, and the data files carry uncommitted edits from the content-depth and
data-finalize workflows). It was re-applied and is holding. Before relying on these
ids, confirm no other session or `_*_workflow.js` run is mid-write on the data files.
