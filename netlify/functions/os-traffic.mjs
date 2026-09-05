// OceanSafe traffic detail for the /sales dashboard Traffic tab.
//
// GET /api/os-traffic?days=7|30|90
//   -> { ok, days, totals, daily, hours, beaches, sources, islands, devices, asOf }
//
// ONE range controls every panel. Per-panel windows were the original design and
// they made the tab impossible to read as a whole: "beaches over 30 days" next to
// "sources over 90 days" invites comparisons that are not true.
//
// `totals` carries both the current window and the equal window immediately before
// it, so every headline number can show what it is changing from. A number with no
// comparison is the most common dashboard mistake and the easiest to fix.
//
// Same key rule as os-users: POSTHOG_API_KEY is server-side only.

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
// Hawaii calendar windows, never rolling 24h: a rolling window slides its start
// with the clock, so "today" counts down through the afternoon.
const CUR = (n) => `${HST('timestamp')} >= ${HST('now()')} - ${n - 1}`;
const PRI = (n) => `${HST('timestamp')} >= ${HST('now()')} - ${2 * n - 1} AND ${HST('timestamp')} < ${HST('now()')} - ${n - 1}`;
const TAGGED = `properties.utm_source IS NOT NULL AND properties.utm_source != ''`;

const buildQueries = (n) => ({
  // Both windows in one pass, so every panel can state what it changed from.
  totals: `SELECT
      count(DISTINCT if(${CUR(n)}, distinct_id, NULL))                                AS users,
      count(DISTINCT if(${PRI(n)}, distinct_id, NULL))                                AS prevUsers,
      countIf(event = 'poi_dwell' AND ${CUR(n)})                                      AS opens,
      countIf(event = 'poi_dwell' AND ${PRI(n)})                                      AS prevOpens,
      count(DISTINCT if(${CUR(n)} AND ${TAGGED}, distinct_id, NULL))                  AS tagged,
      count(DISTINCT if(${PRI(n)} AND ${TAGGED}, distinct_id, NULL))                  AS prevTagged,
      count(DISTINCT if(${CUR(n)} AND properties.$device_type = 'Mobile', distinct_id, NULL)) AS mobile,
      count(DISTINCT if(${PRI(n)} AND properties.$device_type = 'Mobile', distinct_id, NULL)) AS prevMobile
    FROM events WHERE (${CUR(n)} OR ${PRI(n)}) AND ${PROD}`,

  daily: `SELECT toString(${HST('timestamp')}) d, count(DISTINCT distinct_id) u
    FROM events WHERE ${CUR(n)} AND ${PROD} GROUP BY d ORDER BY d`,

  hours: `SELECT toHour(toTimeZone(timestamp,'Pacific/Honolulu')) h, count(DISTINCT distinct_id) u
    FROM events WHERE ${CUR(n)} AND ${PROD} GROUP BY h ORDER BY h`,

  // properties.name is the beach label the app sends with poi_dwell.
  beaches: `SELECT coalesce(nullIf(properties.name,''), nullIf(properties.id,''),'Unknown') n, count() c
    FROM events WHERE event='poi_dwell' AND ${CUR(n)} AND ${PROD}
    GROUP BY n ORDER BY c DESC LIMIT 8`,

  // utm_source is NULL on untagged traffic, and in HogQL NULL != '' is not true —
  // without the IS NOT NULL guard a phantom "Null" row outranks every real source.
  sources: `SELECT properties.utm_source s, count(DISTINCT distinct_id) u
    FROM events WHERE ${CUR(n)} AND ${PROD} AND ${TAGGED}
    GROUP BY s ORDER BY u DESC LIMIT 6`,

  islands: `SELECT multiIf(
      properties.$current_url ILIKE '%island=oahu%' OR properties.$pathname='/oahu','Oahu',
      properties.$current_url ILIKE '%island=maui%' OR properties.$pathname='/maui','Maui',
      properties.$current_url ILIKE '%island=hawaii%' OR properties.$pathname='/hawaii'
        OR properties.$pathname LIKE '/big-island%','Hawaii Island','Kauai') i,
      count(DISTINCT distinct_id) u
    FROM events WHERE ${CUR(n)} AND ${PROD} GROUP BY i ORDER BY u DESC`,

  devices: `SELECT coalesce(nullIf(properties.$device_type,''),'Unknown') d, count(DISTINCT distinct_id) u
    FROM events WHERE ${CUR(n)} AND ${PROD} GROUP BY d ORDER BY u DESC LIMIT 4`,
});

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

  // Only the three ranges the UI offers; anything else falls back to 30.
  const asked = Number(new URL(req.url).searchParams.get('days'));
  const days = [7, 30, 90].includes(asked) ? asked : 30;

  try {
    const Q = buildQueries(days);
    const keys = Object.keys(Q);
    const rows = await Promise.all(keys.map((k) => hog(Q[k])));
    const out = { ok: true, days, asOf: new Date().toISOString() };
    keys.forEach((k, i) => { out[k] = rows[i]; });

    // Flatten the single totals row into named numbers for the client.
    const t = (out.totals || [])[0] || [];
    const [users, prevUsers, opens, prevOpens, tagged, prevTagged, mobile, prevMobile] = t.map(Number);
    out.totals = { users, prevUsers, opens, prevOpens, tagged, prevTagged, mobile, prevMobile };

    return json(out);
  } catch (e) {
    return json({ ok: false, reason: String(e.message || 'unreachable') }, 502);
  }
};
