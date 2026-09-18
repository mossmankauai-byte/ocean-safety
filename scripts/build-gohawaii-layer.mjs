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
const TODAY = new Date().toISOString().slice(0, 10);
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
  t = t.split(/(?<=[.!?])\s+/).filter(x => !/\$\d/.test(x)).join(' '); return t.length > 170 ? t.slice(0, 167).replace(/\s+\S*$/, '') + '.' : t; };
const has = (r, k, v) => (r.filters[k] || []).includes(v);

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
const cleanName = s => String(s || '').replace(/\$\s?\d+(?:\.\d+)?\s*/g, '').replace(/\s+/g, ' ').trim();   // a price in a title is still a price
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
    out[slug].push(row(slug, r.id, r.title, r.lat, r.lon, c, { tip: tip(r.teaser), website: r.websites.business || undefined, src_url: 'https://www.gohawaii.com' + r.link,
      address: [a.line_1, a.city].filter(Boolean).join(', ') || undefined, img: r.img || undefined, ...(c.facts || {}) }));
  }
}
// 2. Events (dated)
for (const r of E) {
  const slugs = [...new Set((r.filters.Region || []).map(norm).map(i => ISLAND[i]).filter(Boolean))];
  if (!slugs.length) { drop('event on an island not covered'); continue; }
  const next = (r.dates || []).map(d => d.start).filter(s => s && s.slice(0, 10) >= TODAY).sort()[0];
  if (!next) { drop('event with no upcoming date'); continue; }
  if (!(typeof r.lat === 'number' && r.lat)) { drop('event without coordinates'); continue; }
  report.gaps['Events'] = (report.gaps['Events'] || 0) + 1;
  for (const slug of slugs) {
    if (!inBox(slug, r.lat, r.lon)) { drop('coordinates outside the island box'); continue; }
    out[slug].push(row(slug, r.id, r.title, r.lat, r.lon, { target: 'ACTS', type: 'event', sub: (r.filters['Event Categories'] || [])[0] || 'Event' },
      { tip: tip(r.teaser), when: next.slice(0, 10), venue: r.event_venue || undefined, src_url: 'https://www.gohawaii.com' + r.link, img: r.img || undefined }));
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
    { tip: tip(p.teaser), src_url: 'https://www.gohawaii.com' + p.link, img: p.img || undefined, geocoded: true }));
}
// 4. Write one file per island + the report
for (const slug of Object.keys(out)) {
  const rows = out[slug]; const by = {}; rows.forEach(r => { by[r.target] = (by[r.target] || 0) + 1; });
  report.islands[slug] = { rows: rows.length, byTarget: by };
  const js = `// Build-ID: gohawaii-layer ${TODAY} ${slug} ${rows.length} rows\n// GoHawaii listings for ${slug}, mapped onto the app's own tabs. Review mock; each row links back to gohawaii.com.\nwindow.GH_LAYER = window.GH_LAYER || {};\nwindow.GH_LAYER['${slug}'] = ${JSON.stringify({ island: slug, built: TODAY, source: report.source, rows })};\n`;
  fs.writeFileSync(new URL(`../data/poi-gohawaii-${slug}.js`, import.meta.url), js);
}
fs.writeFileSync(new URL('report.json', D), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ islands: report.islands, dropped: report.dropped, skipped: report.skipped, gaps: report.gaps }, null, 1));
