// OceanSafe events proxy for the Dashboard's Today tab.
// Kauaʻi's public events calendar is kauaifestivals.com, run by the Kauaʻi Visitors Bureau, the
// County of Kauaʻi and the Hawaiʻi Tourism Authority (gohawaii.com links to it). It runs The Events
// Calendar, whose REST feed is public. This function reads it once an hour for every desk, keeps
// only what the Today tab shows (no prices: the Dashboard carries no dollar figures), and caches
// at the edge. Link-out only: the desk sends people to the event's own page. Islands without a
// source return an empty list.
//
//   /api/events?island=kauai  -> { island, source, fetched, events:[{ id, title, start, end, allDay, free, url, website, venue:{name,address,city,lat,lon}, excerpt, cats }] }

const SRC = { kauai: { host: 'https://kauaifestivals.com', name: 'kauaifestivals.com' } };
const DAYS_AHEAD = 10;

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=300',
  // Netlify edge: fresh 1 h, then serve stale up to 6 h while it revalidates in the background.
  'netlify-cdn-cache-control': 'public, durable, s-maxage=3600, stale-while-revalidate=21600',
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: HEADERS });

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '-', mdash: ', ' };
function text(s) {
  return String(s == null ? '' : s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
    .replace(/&([a-z]+);/gi, (m, k) => NAMED[k.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ').trim();
}
const num = (v) => (Number.isFinite(+v) && v !== '' && v != null) ? +v : null;

function hstDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Honolulu', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function getJSON(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'OceanSafe desk (https://ocean-safety.netlify.app)', 'accept': 'application/json' } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
  finally { clearTimeout(t); }
}

export default async (req) => {
  const url = new URL(req.url);
  const isl = String(url.searchParams.get('island') || 'kauai').toLowerCase().replace(/[^a-z]/g, '');
  const src = SRC[isl];
  if (!src) return json({ island: isl, source: null, fetched: new Date().toISOString(), events: [] });

  const u = `${src.host}/wp-json/tribe/events/v1/events?per_page=50&start_date=${hstDate(0)}&end_date=${hstDate(DAYS_AHEAD)}&status=publish`;
  const data = await getJSON(u);
  if (!data || !Array.isArray(data.events)) return json({ island: isl, source: src.name, events: null, error: 'upstream' }, 502);

  const events = data.events.filter((e) => !e.hide_from_listings).map((e) => ({
    id: e.id,
    title: text(e.title),
    start: String(e.start_date || ''),
    end: String(e.end_date || ''),
    allDay: !!e.all_day,
    free: /^free$/i.test(String(e.cost || '').trim()),
    url: String(e.url || ''),
    website: String(e.website || ''),
    venue: e.venue && e.venue.venue ? { name: text(e.venue.venue), address: text(e.venue.address), city: text(e.venue.city), lat: num(e.venue.geo_lat), lon: num(e.venue.geo_lng) } : null,
    excerpt: text(e.excerpt).slice(0, 300),
    cats: (e.categories || []).map((c) => text(c.name)),
  }));
  return json({ island: isl, source: src.name, fetched: new Date().toISOString(), events });
};
