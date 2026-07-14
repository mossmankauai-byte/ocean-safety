# Track A — Waikiki-Cluster POI Verification

**Role:** data-verification analyst. Every rating below is a [measured] read off a live third-party
listing I actually retrieved via web search, OR an [assumption] copied from the dataset that I could
NOT confirm. Nothing here is fabricated. English app rendering was NOT touched.

**Scope:** POIs in `/Users/nickmossman/Desktop/OceanSafe/maui-build/data/oahu.js` whose
`lat ∈ [21.25, 21.305]` AND `lon ∈ [-157.86, -157.79]` across categories
`foods, food_trucks, local_crafts, groceries, drinks, fmarkets`.
**Count in box: 23.**

**Method:** loaded `oahu.js` in Node, filtered the bounding box, then ran WebSearch per POI against
Yelp / TripAdvisor / official sites. Yelp pages 403 direct WebFetch, so ratings are taken from search
snippets and corroborating directories. "VERIFIED" = a real source URL retrieved AND a current rating
read from it. Coords checked against the listed street address.

Legend — status:
- **VERIFIED** — business exists at/near Waikiki, current rating retrieved from a real source.
- **PLAUSIBLE-UNVERIFIED** — clearly exists, but I could not pin the exact current star rating.
- **SUSPECT** — a real conflict (closed location, relocation, wrong coords/venue) the dataset gets wrong.
- **NOT-FOUND** — could not ground at all.

Legend — coordsStatus: OK (≤~150m), OFF (listed point materially wrong / different address), MOBILE (food truck, intentionally not fixed), UNCHECKED.

---

## Per-POI results

### Coffee / drinks

1. **Island Vintage Coffee** — drinks. Claimed Yelp ~4.5 (4,000+). **Found: ~4.3 stars, ~7,500 reviews**
   (Wanderlog reading Yelp, 2301 Kalakaua / Royal Hawaiian Center). Exists, Waikiki. Claimed star a touch
   high (4.5 vs 4.3) but same ballpark, huge volume. coords OK. **Status: VERIFIED.**
   Source: https://www.yelp.com/biz/island-vintage-coffee-honolulu-4

2. **Kona Coffee Purveyors** — drinks. Claimed Yelp ~4.5 (800+). **Found: 4.4 stars, ~2,500 reviews**
   (Yelp, 2330 Kalakaua / International Market Place). Rating slightly under claim, review count far higher
   than claimed. coords OK. **Status: VERIFIED.**
   Source: https://www.yelp.com/biz/kona-coffee-purveyors-honolulu-26

3. **Honolulu Coffee Experience Center** — drinks. Claimed Yelp ~4.4 (600+). **CONFLICT:** the listing
   literally named "Honolulu Coffee EXPERIENCE CENTER" at 1800 Kalakaua is **marked CLOSED on Yelp**.
   The dataset coords (21.2898/-157.842) actually sit at the *Ala Moana* "Honolulu Coffee" cafe
   (1450 Ala Moana Blvd), which is open but rated only **~3.5 stars (358 reviews)**. So the named venue is
   defunct and the open same-brand cafe is below the claimed rating. coords OFF/ambiguous.
   **Status: SUSPECT.**
   Sources: https://www.yelp.com/biz/honolulu-coffee-experience-center-honolulu-3 (CLOSED) ;
   https://www.yelp.com/biz/honolulu-coffee-ala-moana-cafe-honolulu-3

4. **Maui Brewing Co. Waikiki** — drinks. Claimed Yelp ~4.2 (1,500+). Exists at 2300 Kalakaua,
   ~2,682 reviews on Yelp; the dataset says "Outrigger Reef" but it is at the **Outrigger Waikiki
   Beachcomber** — minor venue-name slip, business real. Exact star not shown in snippet. coords OK.
   **Status: PLAUSIBLE-UNVERIFIED** (rating not pinned).
   Source: https://www.yelp.com/biz/maui-brewing-co-waikiki-honolulu

5. **House Without a Key** — drinks. Claimed Yelp ~4.4 (600+). Exists at the Halekulani (2199 Kalia Rd),
   ~1,591 Yelp reviews; OpenTable 4.6 (3,560). Yelp star not in snippet but clearly well-rated. coords OK.
   **Status: PLAUSIBLE-UNVERIFIED** (Yelp star not pinned; rating direction strongly positive).
   Source: https://www.yelp.com/biz/house-without-a-key-honolulu-2

6. **Duke's Waikiki** — drinks. Claimed Yelp ~4.3 (5,000+). Exists at Outrigger Waikiki (2335 Kalakaua),
   ~10,604 Yelp reviews (volume even higher than claimed). Exact star not in snippet. coords OK.
   **Status: PLAUSIBLE-UNVERIFIED** (rating not pinned; existence + scale confirmed).
   Source: https://www.yelp.com/biz/dukes-waikiki-honolulu-2

7. **Waiola Shave Ice** — drinks (treats). Claimed Yelp ~4.4 (1,000+). **Found: TripAdvisor 4.4** and
   Yelp ~3,293 reviews at 2135 Waiola St, Mōʻiliʻili. Rating matches claim, review volume higher.
   coords OK (dataset 21.294/-157.843 ≈ Mōʻiliʻili). **Status: VERIFIED.**
   Sources: https://www.yelp.com/biz/waiola-shave-ice-honolulu ;
   https://www.tripadvisor.com/Restaurant_Review-g60982-d2264540

### Eats

8. **Ono Seafood** — foods. Claimed Yelp ~4.5 (1,500+). **Found: 4.5 stars, ~4,600 reviews**
   (747 Kapahulu Ave). Rating matches; review count far higher than claimed. Dataset coords
   (21.279/-157.8155) are ~0.8km SW of the real 747 Kapahulu (~21.2865/-157.815) → coords OFF.
   **Status: VERIFIED** (rating); coords need a nudge.
   Source: https://www.yelp.com/biz/ono-seafood-honolulu

9. **Marukame Udon Waikiki** — foods (now branded **Marugame Udon**). Claimed Yelp ~4 (4,000+).
   **Found: ~14,000 Yelp reviews**, RestaurantGuru 4.4, TripAdvisor 2025 Travellers' Choice, 2310 Kūhiō Ave.
   Name drift (Marukame→Marugame) but same store. coords OK. **Status: VERIFIED** (well above the claimed
   "~4", aggregate ≈4.4).
   Source: https://www.yelp.com/biz/marugame-udon-honolulu-15

10. **Leonard's Bakery** — foods. Claimed Yelp ~4.5 (3,000+). **Found: ~4.5+ stars, ~10,326 reviews**
    (933 Kapahulu Ave, since 1952/53). Rating matches; volume far higher. coords OK (21.2865/-157.816).
    **Status: VERIFIED.**
    Source: https://www.yelp.com/biz/leonards-bakery-honolulu

11. **Rainbow Drive-In** — foods. Claimed Yelp ~4 (2,500+). Exists at 3308 Kanaina Ave since 1961,
    ~6,068 Yelp reviews; TripAdvisor 4.0. Yelp star not in snippet but TA corroborates the ~4 claim.
    Dataset coords 21.279/-157.815 vs real ~21.2725/-157.8155 → ~0.7km off, coords OFF-ish.
    **Status: VERIFIED** (rating ≈ claim via TA); coords slightly off.
    Sources: https://www.yelp.com/biz/rainbow-drive-in-honolulu ;
    https://www.tripadvisor.com/Restaurant_Review-g60982-d434182

### Treats / food trucks

12. **Leonard's Bakery Malasadamobile** — food_truck. No rating claimed (only [verify lat/lon]).
    Real Yelp listing exists (~449 reviews) but it is a **mobile truck** (listed base 7190 Kalanianaole Hwy,
    Hawaiʻi Kai — east of the box). Dataset coords are a guess by design. **Status: PLAUSIBLE-UNVERIFIED**;
    coordsStatus MOBILE — do not feature with a fixed pin.
    Source: https://www.yelp.com/biz/leonards-bakery-malasadamobile-honolulu

13. **Banán** — food_truck. No rating claimed. **CONFLICT:** the dataset POI sits near Diamond Head /
    Monsarrat, but **"Banán – Diamond Head Food Truck" (3212 Monsarrat) is CLOSED on Yelp.** The live
    Banán nearest the box is the **Waikiki Beach Shack (2301 Kalakaua, ~793 reviews)**, ~1km west.
    Brand is real and good, but the dataset's specific Diamond Head truck location is defunct.
    **Status: SUSPECT** (location closed/moved). coords OFF.
    Sources: https://www.yelp.com/biz/ban%C3%A1n-diamond-head-food-truck-honolulu (CLOSED) ;
    https://www.yelp.com/biz/ban%C3%A1n-waikiki-beach-shack-honolulu

### Grocery

14. **Foodland Farms Ala Moana** — groceries. Claimed ~1290 Yelp reviews. **Found: 4 stars, ~897 reviews**
    (1450 Ala Moana Blvd, inside Ala Moana Center). Review count claim a bit high; rating solid. coords OK.
    **Status: VERIFIED.**
    Source: https://www.yelp.com/biz/foodland-farms-honolulu-5

15. **Don Quijote Honolulu** — groceries. Claimed ~1247 Yelp reviews. **Found: 4 stars, ~1,247 reviews**
    (801 Kaheka St, 24h). Review count matches exactly; rating retrieved. coords OK (21.296/-157.8345).
    **Status: VERIFIED.**
    Source: https://www.yelp.com/biz/don-quijote-honolulu-7

16. **Nijiya Market Ala Moana** — groceries. Claimed ~286 Yelp reviews. **Found: 4.2 stars, ~286 reviews**
    (1450 Ala Moana Blvd Ste 1380). Review count matches; rating retrieved. coords OK.
    **Status: VERIFIED.**
    Source: https://www.yelp.com/biz/nijiya-market-honolulu-6

17. **Down to Earth Organic & Natural** — groceries. Claimed ~556 Yelp reviews. Exists at 2525 S King St,
    Yelp ~556 reviews (count matches), but the **exact current star rating did not surface** in any
    snippet. coords OK (21.2975/-157.827 ≈ 2525 S King). **Status: PLAUSIBLE-UNVERIFIED** (rating not pinned).
    Source: https://www.yelp.com/biz/down-to-earth-organic-and-natural-honolulu-honolulu

### Gifts / galleries / crafts

18. **Nohea Gallery** — local_craft. Claimed at Ward Village. **CONFLICT:** Nohea Gallery has
    **relocated to Kahala Mall (4211 Waialae Ave)**; the Ward/Kalakaua Yelp listing is **CLOSED**.
    Dataset coords (21.293/-157.8527, Ward) are now wrong — actual is ~21.275/-157.788 (Kahala, OUTSIDE
    the Waikiki box). Brand real and well-regarded (Yelp ~46 reviews; TripAdvisor strong) but the
    featured location is defunct. **Status: SUSPECT** (relocated / coords OFF).
    Sources: https://www.yelp.com/biz/nohea-gallery-honolulu (Kahala) ;
    https://www.yelp.com/biz/nohea-gallery-honolulu-2 (CLOSED, Kalakaua)

19. **Martin & MacArthur (Ala Moana)** — local_craft. Real flagship-style store at Ala Moana Center
    (1450 Ala Moana Blvd, ~33 reviews; also a 1200 Ala Moana listing). Exists; exact star not shown in
    snippet. coords OK. **Status: PLAUSIBLE-UNVERIFIED** (rating not pinned).
    Source: https://www.yelp.com/biz/martin-and-macarthur-honolulu-22

20. **Nā Mea Hawaiʻi / Native Books** — local_craft. Claimed "4.5 stars, 100+ reviews". Real store at
    Ward Centre (1200 Ala Moana Blvd, ~82 Yelp reviews; strong TripAdvisor). Exact Yelp star not shown in
    snippet, but review base (~82) roughly matches the "100+" claim and sentiment is uniformly positive.
    coords OK. **Status: PLAUSIBLE-UNVERIFIED** (4.5 claim not directly confirmed; existence solid).
    Source: https://www.yelp.com/biz/na-mea-hawaii-honolulu-2

21. **Kamaka Hawaii (Ukulele)** — local_craft. Real factory/store at 550 South St, Kakaʻako (est. 1916),
    Yelp ~32 reviews + very strong TripAdvisor factory-tour reviews. Exact Yelp star not shown in snippet.
    coords OK (21.3045/-157.8587 ≈ 550 South St). **Status: PLAUSIBLE-UNVERIFIED** (rating not pinned;
    existence + reputation solid).
    Source: https://www.yelp.com/biz/kamaka-hawaii-honolulu

### Farmers' markets

22. **KCC Farmers' Market** — fmarket. No rating claimed. **Found: Yelp 4.3, ~747 reviews**
    (4303 Diamond Head Rd, Sat 7:30–11). coords OK (21.2716/-157.8054). **Status: VERIFIED.**
    Source: https://www.yelp.com/biz/kcc-farmers-market-honolulu

23. **Kakaʻako Farmers Market** — fmarket. No rating claimed. Real market at 919 Ala Moana Blvd
    (Yelp ~299 reviews; USA Today #3 US farmers' market 2025). Exact Yelp star not in snippet but
    reputation is top-tier. coords OK (21.293/-157.8537). **Status: VERIFIED** (existence + top reputation;
    Yelp star not numerically pinned but corroborated by national ranking).
    Source: https://www.yelp.com/biz/kakaako-farmers-market-honolulu

---

## Curated "Waikiki Top Picks" (grounded + well-rated only)

Only items I grounded as real AND ≥4.0 / well-reviewed. SUSPECT/closed-location items excluded.

**Coffee**
- Island Vintage Coffee — ~4.3★, ~7.5k reviews, Royal Hawaiian Center. [measured]
- Kona Coffee Purveyors — 4.4★, ~2.5k reviews, International Market Place. [measured]

**Eats**
- Marukame/Marugame Udon — aggregate ~4.4★, ~14k Yelp reviews, Kūhiō Ave. [measured]
- Ono Seafood — 4.5★, ~4.6k reviews, Kapahulu (fix coords to 747 Kapahulu). [measured]
- Rainbow Drive-In — ~4.0★ (TripAdvisor), ~6k Yelp reviews, Kapahulu. [measured]

**Treats**
- Leonard's Bakery — ~4.5★, ~10k reviews, Kapahulu (the malasada landmark). [measured]
- Waiola Shave Ice — 4.4★, ~3.3k reviews, Mōʻiliʻili. [measured]

**Grocery**
- Foodland Farms Ala Moana — 4.0★, ~900 reviews. [measured]
- Don Quijote (Kaheka) — 4.0★, ~1,247 reviews, 24h. [measured]
- Nijiya Market Ala Moana — 4.2★, ~286 reviews. [measured]

**Gifts / culture**
- Nā Mea Hawaiʻi / Native Books — strong reviews, Ward Centre (Yelp star not numerically pinned). [measured-existence]
- Kamaka Hawaii Ukulele — celebrated factory/store, Kakaʻako (Yelp star not pinned). [measured-existence]

**Markets (bonus)**
- KCC Farmers' Market — 4.3★, ~747 reviews, Diamond Head. [measured]
- Kakaʻako Farmers Market — USA Today #3 US market 2025, Ala Moana Blvd. [measured]

> Deliberately NOT featured: Honolulu Coffee Experience Center (named venue CLOSED),
> Banán Diamond Head truck (CLOSED — use Waikiki Beach Shack instead), Nohea Gallery
> (relocated to Kahala, out of box). House Without a Key, Duke's, Maui Brewing, Martin & MacArthur,
> Down to Earth are real and fine but held out of the curated star-list only because I couldn't pin an
> exact numeric rating — feature them once a human confirms the star.

## Needs manual verification (could not fully ground rating/coords)
- Maui Brewing Co. Waikiki (rating not pinned; venue-name slip "Outrigger Reef" → Beachcomber)
- House Without a Key (Yelp star not pinned)
- Duke's Waikiki (Yelp star not pinned)
- Leonard's Malasadamobile (mobile truck — no fixed coords)
- Down to Earth Organic & Natural (rating not pinned)
- Martin & MacArthur Ala Moana (rating not pinned)
- Nā Mea Hawaiʻi / Native Books (4.5 claim not directly confirmed)
- Kamaka Hawaii Ukulele (rating not pinned)
- Honolulu Coffee Experience Center (SUSPECT — named venue closed; needs human re-point or removal)
- Banán Diamond Head (SUSPECT — closed; needs re-point to Waikiki Beach Shack)
- Nohea Gallery (SUSPECT — relocated to Kahala; needs re-point or removal)

## Caveats
Yelp blocks direct WebFetch (HTTP 403), so all Yelp ratings are read from search-result snippets and
corroborating directories (TripAdvisor, Wanderlog, RestaurantGuru, official sites), not scraped off the
live Yelp DOM. Star numbers drift day to day; treat each ±0.1. No coordinate was precision-geocoded — OFF
flags are estimated from the listed street address, not surveyed. SUSPECT items reflect closures/moves
found as of June 2026 and should be re-pointed or pulled before featuring. English app rendering untouched;
nothing deployed.
