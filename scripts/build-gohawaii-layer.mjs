#!/usr/bin/env node
// Build the GoHawaii layer files from the raw pull: one /data/poi-gohawaii-<slug>.js per island
// we cover (Kauai, Maui, Oahu, Hawaii Island). Their listings, events and editorial places are
// mapped onto the tabs and subtabs the app already has; the injector in index.html pushes each
// row into the matching array at runtime for a public ref only. Review mock; not a production feed.
//   node scripts/build-gohawaii-layer.mjs        (geocodes editorial places via Nominatim, cached)
import fs from 'node:fs';
const D = new URL('./data/gohawaii/', import.meta.url);
const read = f => JSON.parse(fs.readFileSync(new URL(f, D), 'utf8'));
const L = read('raw-listing.json'), E = read('raw-event.json'), A = read('raw-article.json');
const TODAY = new Date(Date.now() - 10 * 3600e3).toISOString().slice(0, 10);   // Hawaiʻi date (UTC-10, no DST): a UTC date drops tonight's events from 2 pm on
const norm = s => String(s || '').replace(/[ʻ‘’]/g, "'");
const ISLAND = { "Kaua'i": 'kauai', "O'ahu": 'oahu', 'Maui': 'maui', "Island of Hawai'i": 'hawaii' };
const SLUG_FROM_PATH = { kauai: 'kauai', oahu: 'oahu', maui: 'maui', 'hawaii-big-island': 'hawaii' };
const REGIONS = {
  kauai: [['North Shore', 22.205, -159.503], ['East Side', 22.005, -159.337], ['South Shore', 21.880, -159.460], ['West Side', 21.970, -159.700]],
  maui: [['West Maui', 20.92, -156.69], ['South Maui', 20.71, -156.45], ['North Shore', 20.93, -156.36], ['East/Hāna', 20.76, -155.99]],
  oahu: [['North Shore', 21.65, -158.06], ['Windward', 21.40, -157.73], ['South Shore', 21.275, -157.82], ['Leeward', 21.40, -158.15]],
  hawaii: [['Kona', 19.60, -155.99], ['Kohala', 20.00, -155.82], ['Hilo/Puna', 19.70, -155.05], ['Kaʻū', 19.13, -155.50]],
};
const BBOX = { kauai: [21.85, 22.30, -159.85, -159.25], maui: [20.55, 21.05, -156.75, -155.95], oahu: [21.20, 21.75, -158.30, -157.60], hawaii: [18.90, 20.30, -156.10, -154.75] };
const region = (slug, lat, lon) => REGIONS[slug].map(([r, la, lo]) => [r, (la - lat) ** 2 + (lo - lon) ** 2]).sort((a, b) => a[1] - b[1])[0][0];
const inBox = (slug, lat, lon) => { const [a, b, c, d] = BBOX[slug]; return lat >= a && lat <= b && lon >= c && lon <= d; };
const short = s => { s = String(s || '').replace(/\s*[(|,:].*$/, '').trim(); if (s.length <= 18) return s; const cut = s.slice(0, 18).replace(/\s+\S*$/, ''); return (cut || s.slice(0, 18)).trim(); };
const tip = s => { let t = String(s || '').replace(/\s+/g, ' ').replace(/&#039;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim();
  // Their own deals, prices and booking lines stay: the GoHawaii build matches gohawaii.com on commerce
  // (Nick, 2026-09-18). The Malama hotel offers never reach a beach sheet: that block shows name and distance only.
  t = t.replace(/[\p{Extended_Pictographic}\u2728\uFE0F]/gu, '').replace(/\s{2,}/g, ' ').trim();   // their emoji are not our icons
  // Keep whole sentences up to 170 characters. Their teasers often stop mid-sentence, and cutting one and adding
  // a full stop printed fragments like "restaurants. Its." A text with no complete sentence ends in an ellipsis.
  const done = (t.match(/[^.!?]*[.!?]+["'”’)\]]*(?=\s|$)/g) || []).map(x => x.trim()).filter(Boolean);
  let out = ''; for (const x of done) { if ((out ? out.length + 1 : 0) + x.length > 170) break; out = out ? out + ' ' + x : x; }
  if (out) return out.replace(/\.{2,}$/, '.');
  if (!t) return t;
  return (t.length > 168 ? t.slice(0, 168).replace(/\s+\S*$/, '') : t).replace(/[\s,;:.]+$/, '') + '…'; };
const has = (r, k, v) => (r.filters[k] || []).includes(v);
// Venue names as their owners spell them. GoHawaii's feed has "Hawaii Theatre Centre"; the venue's
// own site and its nonprofit registration say Hawaii Theatre Center (hawaiitheatre.com).
const VENUE_FIX = { 'Hawaii Theatre Centre': 'Hawaii Theatre Center' };
// Every business link stays, offer and booking pages included, the way gohawaii.com shows them.
const site = u => u || undefined;
// Their deals stay on their own cards, but a Malama row that sells (a hotel offer in its teaser, an offer or
// booking link, or an Accommodations listing) is flagged `sales` so it never sits one tap from a red or yellow
// beach sheet: the app's "Give back instead" block skips it (ad wall, release brief 2026-09-18).
const SALES_TEXT = /\$\d|\bdollars?\b|buy tickets?|tickets? (are )?(available|on sale)|\bon sale\b|% off|\bdiscount|book (now|online|today)|reserve (now|online|today)|promo code|coupon|\bpric(e|es|ing)\b|nights? free|\bsave (you )?up to|resort (credit|fees?)|\bwaived\b|\bdeal\b|unbeatable value|available (for|to) purchase|\bbook (your|the)\b|\bbonus\b|\b(earn|redeem)\b[^.]*\bpoints\b|bonvoy|world of hyatt|minimum stay|sign up here/i;
const SALES_URL = /\btickets?\b|\/rooms?\b|ipoolside|resort-activities|book-?now|hotel-deals|\/deals?\b|\boffers?\b|special-offers|\/specials?\b|special-packages|\/packages?\b|promo=|\/shop\/|checkinDate|synxis\.com/i;
const sells = r => SALES_TEXT.test(r.teaser || '') || SALES_URL.test((r.websites || {}).business || '') || (r.filters['Accommodations'] || []).length > 0
  || /\b(resort|hotel|marriott|hyatt|hilton|sheraton|westin|suites|lodge)\b/i.test(r.title || '');   // a hotel's Malama row is its package
// Photos: their API hands out plain-http pantheonsite.io URLs (mixed content on our https page). The same
// path serves from https://www.gohawaii.com, so every image host is rewritten there.
const ghImg = u => u ? String(u).replace(/^https?:\/\/(?:live-gohawaii-com\.pantheonsite\.io|(?:www\.)?gohawaii\.com)(?=\/)/, 'https://www.gohawaii.com') : undefined;

// Their category -> our home. target names are the arrays index.html injects into.
function classify(r) {
  const f = r.filters;
  const act = f['Activities'] || [], dine = f['Dining and Drinks'] || [], shop = f['Shopping'] || [], acc = f['Accommodations'] || [], wed = f['Weddings and Honeymoons'] || [];
  if (dine.length) {
    if (dine.some(x => /Bars and Lounges|Pubs and Breweries/.test(x))) return { target: 'DRINKS', type: 'drinks', sub: dine[0] };
    if (dine.some(x => /Coffee and Tea/.test(x))) return { target: 'FOODS', type: 'coffee', tags: ['coffee'], sub: dine[0] };
    return { target: 'FOODS', type: dine[0].toLowerCase(), sub: dine[0] };
  }
  if (act.some(x => /Music and Nightlife/.test(x))) return { target: 'DRINKS', type: 'nightlife', sub: 'Music and Nightlife' };
  if (act.some(x => /Water Adventures|Land Adventures|Sky Adventures|Tours and Sight Seeing|Cruises|Culinary Experiences|Voluntourism|Distilleries/.test(x)))
    return { target: 'TOURS', type: 'tour', sub: act.find(x => /Water|Land|Sky|Tours|Cruises|Culinary|Voluntourism|Distilleries/.test(x)) };
  if (act.some(x => /Luau|Dinner Shows|Culture, History and the Arts/.test(x))) return { target: 'ACTS', type: 'cultural', sub: act[0] };
  if (act.some(x => /Attractions|Plantations, Farms and Gardens|Coffee Farms/.test(x))) return { target: 'ACTS', type: 'scenic', sub: act[0] };
  // Spas live in Town (a Wellness subtab we add for the public build); tagged indoor so Plan can offer them on wet afternoons.
  if (act.some(x => /Wellness and Rejuvenation/.test(x))) return { target: 'GHTOWN', type: 'wellness', tags: ['indoor', 'rain_ok'], sub: 'Wellness and Rejuvenation', gap: 'Spas and wellness' };
  // Golf courses are activities: they join the Tours directory as their own group, with course facts.
  if ((f['Golf'] || []).includes('Golf Courses')) return { target: 'TOURS', type: 'golf', sub: 'Golf', gap: 'Golf', facts: { yards: (f['Total Yards'] || [])[0], course_type: (f['Course Type'] || [])[0] } };
  if (shop.length) {
    if (shop.some(x => /Department Stores, Shopping Centers/.test(x))) return { target: 'VENUES', type: 'venue', sub: shop[0] };
    return { target: 'LOCAL_CRAFTS', type: 'shop', sub: shop[0] };
  }
  if (acc.some(x => /Hotels and Resorts|Vacation Rentals|Bed and Breakfasts|Camping|Hostels|Retreats/.test(x))) return { target: 'STAYS', type: 'stay', theme: 'hotel', sub: acc[0] };
  if (wed.some(x => /Caterers, Facilities and Venues/.test(x))) return { target: 'VENUES', type: 'venue', sub: 'Wedding venues' };
  if ((f['Malama Listing'] || []).length && !act.length) return { target: 'ACTS', type: 'malama', sub: f['Malama Listing'][0], gap: 'Mālama volunteer programs' };
  const why = f['Transportation'] ? 'transportation' : f['Services'] ? 'services' : f['Travel Professionals'] ? 'travel professionals' : acc.length ? 'booking service, not a place' : act.length ? 'booking or directory, not a place' : wed.length ? 'wedding services, not a place' : 'uncategorised';
  return { skip: why };
}

const out = {}; for (const s of Object.keys(REGIONS)) out[s] = [];
const report = { built: TODAY, source: 'gohawaii.com public listing API (MilesAI), pulled ' + fs.readFileSync(new URL('pulled-at.txt', D), 'utf8').trim(), islands: {}, dropped: {}, gaps: {}, skipped: {}, theirBeaches: {} };
const drop = (k) => { report.dropped[k] = (report.dropped[k] || 0) + 1; };
const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim();   // their titles as written, prices included
const row = (slug, id, name, lat, lon, c, extra) => (name = cleanName(name), { id: 'gh_' + id, name, n: short(name), r: region(slug, lat, lon), lat: +(+lat).toFixed(6), lon: +(+lon).toFixed(6),
  target: c.target, type: c.type, theme: c.theme, tags: ['gohawaii', ...(c.tags || [])], gh_sub: c.sub, src: 'gohawaii', ...extra });

// 1. Listings (businesses and operators)
for (const r of L) {
  const isl = [...new Set((r.islands.length ? r.islands : r.filters.Region || []).map(norm))];
  const slugs = isl.map(i => ISLAND[i]).filter(Boolean);
  if (!slugs.length) { drop('island not covered (Lānaʻi, Molokaʻi)'); continue; }
  const c = classify(r);
  if (c.skip) { report.skipped[c.skip] = (report.skipped[c.skip] || 0) + 1; continue; }
  if (!(typeof r.lat === 'number' && r.lat)) { drop('listing without coordinates'); continue; }
  for (const slug of slugs) {
    if (!inBox(slug, r.lat, r.lon)) { drop('coordinates outside the island box'); continue; }
    if (c.gap) report.gaps[c.gap] = (report.gaps[c.gap] || 0) + 1;
    const a = r.address || {};
    out[slug].push(row(slug, r.id, r.title, r.lat, r.lon, c, { tip: tip(r.teaser), website: site(r.websites.business), src_url: 'https://www.gohawaii.com' + r.link,
      address: [a.line_1, a.city].filter(Boolean).join(', ') || undefined, img: ghImg(r.img), ...(c.type === 'malama' && sells(r) ? { sales: true } : {}), ...(c.facts || {}) }));
  }
}
// 2. Events (dated). Their event ids share a number space with listings (1642 is both a condo and a craft
// fair), so events get their own prefix, gh_e<id>, the way editorial places get gh_p<id>.
for (const r of E) {
  const slugs = [...new Set((r.filters.Region || []).map(norm).map(i => ISLAND[i]).filter(Boolean))];
  if (!slugs.length) { drop('event on an island not covered'); continue; }
  const next = (r.dates || []).map(d => d.start).filter(s => s && s.slice(0, 10) >= TODAY).sort()[0];
  if (!next) { drop('event with no upcoming date'); continue; }
  if (!(typeof r.lat === 'number' && r.lat)) { drop('event without coordinates'); continue; }
  report.gaps['Events'] = (report.gaps['Events'] || 0) + 1;
  for (const slug of slugs) {
    if (!inBox(slug, r.lat, r.lon)) { drop('coordinates outside the island box'); continue; }
    out[slug].push(row(slug, 'e' + r.id, r.title, r.lat, r.lon, { target: 'ACTS', type: 'event', sub: (r.filters['Event Categories'] || [])[0] || 'Event' },
      { tip: tip(r.teaser), when: next.slice(0, 10), venue: (VENUE_FIX[r.event_venue] || r.event_venue) || undefined, src_url: 'https://www.gohawaii.com' + r.link, img: ghImg(r.img) }));
  }
}
// 3. Editorial places (waterfalls, towns, lookouts, museums): no coordinates in their data, geocoded once and cached.
const cachePath = new URL('geocache.json', D); const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
const placeType = t => /museum|palace|church|temple|heritage|historic|statue|mission|cultural|center|centre|plantation|homestead|estate|tower|memorial|harbor|pearl/i.test(t) ? 'cultural' : /town|village|downtown|city|kapaa|hanalei|koloa|waimea|lahaina|paia|hilo|kailua|haleiwa|makawao|hanapepe/i.test(t) ? 'town' : 'scenic';
const ISLAND_NAME = { kauai: 'Kauai', maui: 'Maui', oahu: 'Oahu', hawaii: 'Hawaii' };
const places = A.filter(a => /^\/islands\/[a-z-]+\/(regions\/[a-z-]+\/[a-z0-9-]+|things-to-do\/beaches\/[a-z0-9-]+)$/.test(a.link));
for (const p of places) {
  const slug = SLUG_FROM_PATH[p.link.split('/')[2]]; if (!slug) { drop('place on an island not covered'); continue; }
  if (/\/things-to-do\/beaches\//.test(p.link)) { (report.theirBeaches[slug] = report.theirBeaches[slug] || []).push(p.title); continue; }
  const key = slug + '|' + p.title;
  if (!(key in cache)) {
    const [a, b, c, d] = BBOX[slug];
    const q = new URLSearchParams({ q: p.title.replace(/\s*\(.*?\)\s*/g, ' ') + ', ' + ISLAND_NAME[slug] + ', Hawaii', format: 'json', limit: '1', viewbox: `${c},${b},${d},${a}`, bounded: '1' });
    try { const res = await fetch('https://nominatim.openstreetmap.org/search?' + q, { headers: { 'User-Agent': 'OceanSafety.app review mock (nick@oceansafety.app)' } }); const j = await res.json(); cache[key] = j[0] ? { lat: +j[0].lat, lon: +j[0].lon } : null; }
    catch (e) { cache[key] = null; }
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 1)); await new Promise(r => setTimeout(r, 1100));
  }
  const g = cache[key]; if (!g) { drop('place could not be geocoded'); continue; }
  out[slug].push(row(slug, 'p' + p.id, p.title, g.lat, g.lon, { target: 'ACTS', type: placeType(p.title), sub: 'GoHawaii place page', tags: ['place', 'geocoded'] },
    { tip: tip(p.teaser), src_url: 'https://www.gohawaii.com' + p.link, img: ghImg(p.img), geocoded: true }));
}
// 3a. The raw pull lists a few rows twice (same id, same place); keep the first.
for (const slug of Object.keys(out)) { const seen = new Set(); out[slug] = out[slug].filter(r => { if (seen.has(r.id)) { drop('duplicate row in their data'); return false; } seen.add(r.id); return true; }); }
// 3b. Rows the API gave no photo. Two sources, both gohawaii.com's own: (a) img-overrides.json, the hero photo on
// the row's own gohawaii.com page (read in a browser tab, since curl gets a Cloudflare 403); (b) the photo on
// another of their records with the same name within 1.5 km (a stay listed twice), never for a Malama row.
// Anything still bare keeps the gradient card; nothing is invented.
// Overrides must be a Drupal image-style derivative (/styles/); a raw original can run to several MB.
const overrides = Object.fromEntries(Object.entries(fs.existsSync(new URL('img-overrides.json', D)) ? read('img-overrides.json') : {})
  .filter(([, u]) => /\/sites\/default\/files\/styles\//.test(u)));
// Event images are mostly flyers that print prices, ticket lines and QR codes, which no text filter can see.
// An event shows a photo only if a person cleared that exact image (event-photo-ok.json).
const eventOk = new Set(fs.existsSync(new URL('event-photo-ok.json', D)) ? read('event-photo-ok.json').ok : []);
const nameKey = s => norm(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['®&]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos(a * Math.PI / 180));
const withPhoto = {}; for (const r of [...L, ...E]) if (r.img && typeof r.lat === 'number' && r.lat) (withPhoto[nameKey(r.title)] = withPhoto[nameKey(r.title)] || []).push(r);
const photos = { rows: 0, with: 0, without: 0, bySource: { api: 0, page_hero: 0, same_name_listing: 0 }, eventFlyersWithheld: 0, islands: {}, missing: {}, withheld: {} };
for (const slug of Object.keys(out)) {
  const P = photos.islands[slug] = { rows: 0, with: 0, without: 0 };
  for (const r of out[slug]) {
    let src = r.img ? 'api' : null;
    if (!r.img && overrides[r.id]) { r.img = ghImg(overrides[r.id]); src = 'page_hero'; }
    // A Malama row borrows no photo: the same-name listing is the hotel's own (rooms, pools), a sales image on a safety sheet.
    if (!r.img && r.type !== 'malama') { const sib = (withPhoto[nameKey(r.name)] || []).find(x => km(x.lat, x.lon, r.lat, r.lon) <= 1.5); if (sib) { r.img = ghImg(sib.img); src = 'same_name_listing'; } }
    const flyer = r.img && r.type === 'event' && !eventOk.has(r.img);
    if (flyer) { r.img = undefined; photos.eventFlyersWithheld++; (photos.withheld[slug] = photos.withheld[slug] || []).push(r.name); }
    P.rows++; photos.rows++;
    if (r.img) { P.with++; photos.with++; photos.bySource[src]++; }
    else { P.without++; photos.without++; if (!flyer) { const m = photos.missing[slug] = photos.missing[slug] || {}; (m[r.type] = m[r.type] || []).push(r.name); } }
  }
}
report.photos = photos;
// 4. Write one file per island + the report
for (const slug of Object.keys(out)) {
  const rows = out[slug]; const by = {}; rows.forEach(r => { by[r.target] = (by[r.target] || 0) + 1; });
  report.islands[slug] = { rows: rows.length, byTarget: by };
  const js = `// Build-ID: gohawaii-layer ${TODAY} ${slug} ${rows.length} rows\n// GoHawaii listings for ${slug}, mapped onto the app's own tabs. Review mock; each row links back to gohawaii.com.\nwindow.GH_LAYER = window.GH_LAYER || {};\nwindow.GH_LAYER['${slug}'] = ${JSON.stringify({ island: slug, built: TODAY, source: report.source, rows })};\n`;
  fs.writeFileSync(new URL(`../data/poi-gohawaii-${slug}.js`, import.meta.url), js);
}
fs.writeFileSync(new URL('report.json', D), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ islands: report.islands, dropped: report.dropped, skipped: report.skipped, gaps: report.gaps, photos: { ...photos, missing: undefined } }, null, 1));
