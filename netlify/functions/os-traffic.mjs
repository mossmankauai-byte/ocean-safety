// OceanSafe traffic detail for the /sales dashboard Traffic tab.
//
// GET /api/os-traffic -> { ok, daily, hours, beaches, sources, islands, devices, asOf }
//
// Same server-side-key rule as os-users: POSTHOG_API_KEY never reaches the browser.
// Six independent aggregations, so six queries, fired in parallel and cached hard
// at the CDN. These numbers move slowly; nobody needs them fresher than 10 minutes.

const HOST = (globalThis.Netlify?.env?.get?.('POSTHOG_HOST')
  || process.env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/+$/, '');
const KEY = globalThis.Netlify?.env?.get?.('POSTHOG_API_KEY') || process.env.POSTHOG_API_KEY || '';
const PID = globalThis.Netlify?.env?.get?.('POSTHOG_PROJECT_ID') || process.env.POSTHOG_PROJECT_ID || '482151';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800',
  'Netlify-CDN-Cache-Control': 'public, max-age=600, stale-while-revalidate=1800',
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: HEADERS });

const PROD = `properties.$host IN ('oceansafety.app', 'ocean-safety.netlify.app')`;
const HST = (t) => `toDate(toTimeZone(${t}, 'Pacific/Honolulu'))`;
// Hawaii calendar windows, never rolling 24h. See os-users.mjs for why.
const CAL = (n) => `${HST('timestamp')} >= ${HST('now()')} - ${n - 1}`;

const QUERIES = {
  daily: `SELECT toString(${HST('timestamp')}) d, count(DISTINCT distinct_id) u
    FROM events WHERE ${CAL(60)} AND ${PROD} GROUP BY d ORDER BY d`,

  hours: `SELECT toHour(toTimeZone(timestamp,'Pacific/Honolulu')) h, count(DISTINCT distinct_id) u
    FROM events WHERE ${CAL(30)} AND ${PROD} GROUP BY h ORDER BY h`,

  // properties.name is the beach label the app sends with poi_dwell.
  beaches: `SELECT coalesce(nullIf(properties.name,''), nullIf(properties.id,''),'Unknown') n, count() c
    FROM events WHERE event='poi_dwell' AND ${CAL(30)} AND ${PROD}
    GROUP BY n ORDER BY c DESC LIMIT 8`,

  // utm_source is NULL on untagged traffic, and in HogQL NULL != '' is not true —
  // without the IS NOT NULL guard a phantom "Null" row outranks every real source.
  sources: `SELECT properties.utm_source s, count(DISTINCT distinct_id) u
    FROM events WHERE ${CAL(90)} AND ${PROD}
      AND properties.utm_source IS NOT NULL AND properties.utm_source != ''
    GROUP BY s ORDER BY u DESC LIMIT 6`,

  islands: `SELECT multiIf(
      properties.$current_url ILIKE '%island=oahu%' OR properties.$pathname='/oahu','Oahu',
      properties.$current_url ILIKE '%island=maui%' OR properties.$pathname='/maui','Maui',
      properties.$current_url ILIKE '%island=hawaii%' OR properties.$pathname='/hawaii'
        OR properties.$pathname LIKE '/big-island%','Hawaii Island','Kauai') i,
      count(DISTINCT distinct_id) u
    FROM events WHERE ${CAL(30)} AND ${PROD} GROUP BY i ORDER BY u DESC`,

  devices: `SELECT coalesce(nullIf(properties.$device_type,''),'Unknown') d, count(DISTINCT distinct_id) u
    FROM events WHERE ${CAL(30)} AND ${PROD} GROUP BY d ORDER BY u DESC LIMIT 4`,
};

async function hog(query) {
  const r = await fetch(`${HOST}/api/projects/${PID}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!r.ok) throw new Error('posthog_' + r.status);
  return (await r.json())?.results || [];
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
  if (req.method !== 'GET') return json({ ok: false, reason: 'method' }, 405);
  if (!KEY) return json({ ok: false, reason: 'unconfigured' }, 200);

  try {
    const keys = Object.keys(QUERIES);
    const rows = await Promise.all(keys.map((k) => hog(QUERIES[k])));
    const out = { ok: true, asOf: new Date().toISOString() };
    keys.forEach((k, i) => { out[k] = rows[i]; });
    return json(out);
  } catch (e) {
    return json({ ok: false, reason: String(e.message || 'unreachable') }, 502);
  }
};
