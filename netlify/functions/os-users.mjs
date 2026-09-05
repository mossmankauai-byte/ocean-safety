// OceanSafe visitor counts for the /sales dashboard — server-side PostHog proxy.
//
// GET /api/os-users -> { ok, today, week, month, total, prevWeek, asOf }
//
// The PostHog personal API key can query the whole project, so it never reaches
// the browser: it lives only in the POSTHOG_API_KEY environment variable.
// Unset key = { ok:false, reason:'unconfigured' } so the dashboard tile can say
// so plainly instead of showing a wrong number or breaking the page.

const HOST = (globalThis.Netlify?.env?.get?.('POSTHOG_HOST')
  || process.env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/+$/, '');
const KEY = globalThis.Netlify?.env?.get?.('POSTHOG_API_KEY') || process.env.POSTHOG_API_KEY || '';
const PID = globalThis.Netlify?.env?.get?.('POSTHOG_PROJECT_ID') || process.env.POSTHOG_PROJECT_ID || '482151';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // PostHog rate-limits HogQL, and these numbers move slowly. Serve from the
  // CDN for 5 minutes; keep a stale copy usable while the next one is fetched.
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  'Netlify-CDN-Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: HEADERS });

// Only real production traffic. Localhost and preview deploys would inflate every number.
const PROD = `properties.$host IN ('oceansafety.app', 'ocean-safety.netlify.app')`;
const HST = (t) => `toDate(toTimeZone(${t}, 'Pacific/Honolulu'))`;

// Every window is a Hawaii CALENDAR window, never `now() - INTERVAL n DAY`.
// A rolling 24h window slides its start with the clock, so yesterday's visitors
// drop off the back faster than today adds them and "Today" counts DOWN through
// the afternoon. Calendar windows only grow within a day and step at HST midnight.
const CAL = (n) => n <= 1
  ? `${HST('timestamp')} = ${HST('now()')}`
  : `${HST('timestamp')} >= ${HST('now()')} - ${n - 1}`;
const CAL_PRIOR = (n) =>
  `${HST('timestamp')} >= ${HST('now()')} - ${2 * n - 1} AND ${HST('timestamp')} < ${HST('now()')} - ${n - 1}`;

const QUERY = `
SELECT
  count(DISTINCT if(${CAL(1)}, distinct_id, NULL))        AS today,
  count(DISTINCT if(${CAL(7)}, distinct_id, NULL))        AS week,
  count(DISTINCT if(${CAL(30)}, distinct_id, NULL))       AS month,
  count(DISTINCT distinct_id)                             AS total,
  count(DISTINCT if(${CAL_PRIOR(7)}, distinct_id, NULL))  AS prevWeek
FROM events WHERE ${PROD}`;

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
  if (req.method !== 'GET') return json({ ok: false, reason: 'method' }, 405);
  if (!KEY) return json({ ok: false, reason: 'unconfigured' }, 200);

  try {
    const r = await fetch(`${HOST}/api/projects/${PID}/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: QUERY } }),
    });
    if (!r.ok) return json({ ok: false, reason: 'posthog_' + r.status }, 502);
    const row = (await r.json())?.results?.[0];
    if (!row) return json({ ok: false, reason: 'empty' }, 502);
    const [today, week, month, total, prevWeek] = row.map(Number);
    return json({ ok: true, today, week, month, total, prevWeek, asOf: new Date().toISOString() });
  } catch {
    return json({ ok: false, reason: 'unreachable' }, 502);
  }
};
