#!/usr/bin/env node
// Pull the GoHawaii listing inventory from the public search API that gohawaii.com's own
// listing pages call (MilesAI, client "hawaii"). Plain GETs, no key, no login. Writes raw JSON
// per content type under scripts/data/gohawaii/. Review mock only; not a production feed.
//   node scripts/pull-gohawaii.mjs
import fs from 'node:fs';
const BASE = 'https://api-search.milesai.net/api/listings';
const OUT = new URL('./data/gohawaii/', import.meta.url);
async function pull(type){
  const rows = []; let offset = 0;
  for (let p = 0; p < 12; p++) {
    const q = new URLSearchParams({ client: 'hawaii', limit: '500', offset: String(offset), hide_expired: 'true', type });
    const r = await fetch(BASE + '?' + q, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(type + ' HTTP ' + r.status);
    const j = await r.json(); const got = j.results || [];
    got.forEach(x => { const g = x.json || {}, e = g.extras || {};
      rows.push({ id: g.id, type: g.type, title: g.title, teaser: g.teaser || '', link: (g.link || '').replace(/^https?:\/\/[^/]+/, ''),
        filters: g.filters || {}, lat: e.lat, lon: e.lon, tier: e.tier || '', dates: e.dates || null, event_venue: e.event_venue || null,
        websites: e.websites || {}, address: e.address || {}, islands: e.islands || [], city: (e.city && e.city.name) || '', img: (g.image && g.image.src) || '' });
    });
    offset += 500; if (got.length < 500) break;
    await new Promise(r => setTimeout(r, 400));
  }
  return rows;
}
const out = {};
for (const type of ['listing', 'event', 'article']) {
  const rows = await pull(type);
  fs.writeFileSync(new URL('raw-' + type + '.json', OUT), JSON.stringify(rows));
  out[type] = rows.length;
}
fs.writeFileSync(new URL('pulled-at.txt', OUT), new Date().toISOString() + '\n');
console.log(JSON.stringify(out));
