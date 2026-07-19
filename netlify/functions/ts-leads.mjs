// OceanSafe stay-close dashboard read — thin same-origin proxy to the worker.
//
// GET /api/ts-leads/<slug>?key=<dashboard key>&period=30
//   -> { slug, roll:{...real dollar rollups...}, recent:[...], model:{...} } | { error }
// The worker key-gates the read (leads carry sensitive qualifier answers).

const WORKER = (globalThis.Netlify?.env?.get?.('TELEMETRY_URL')
  || process.env.TELEMETRY_URL || 'https://concierge-guide-api.oceansafe-hi.workers.dev').replace(/\/+$/, '');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: HEADERS });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
  if (req.method !== 'GET') return json({ error: 'method' }, 405);

  const url = new URL(req.url);
  const slug = (url.pathname.split('/').pop() || '').toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return json({ error: 'bad_slug' }, 400);
  const qs = url.search || '';

  try {
    const r = await fetch(`${WORKER}/ts-leads/${slug}${qs}`, {
      headers: { 'User-Agent': 'OceanSafe-Netlify/1.0 (nick@oceansafety.app)' },
    });
    const out = await r.json().catch(() => null);
    if (!out) return json({ error: 'worker_bad_response' }, 502);
    return json(out, r.status);
  } catch {
    return json({ error: 'worker_unreachable' }, 502);
  }
};
