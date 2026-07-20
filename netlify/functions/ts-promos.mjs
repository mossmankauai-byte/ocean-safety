// OceanSafe stay-close active promotions — public same-origin proxy to the worker.
//
// GET /api/ts-promos/<slug>  -> { slug, today, promos:[{id,label,seg,boost,start,end}] }
// Returns only currently-active promos; the guest app reads this to surface timed offers.

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

  try {
    const r = await fetch(`${WORKER}/ts-promos/${slug}`, { headers: { 'User-Agent': 'OceanSafe-Netlify/1.0 (nick@oceansafety.app)' } });
    const out = await r.json().catch(() => null);
    if (!out) return json({ error: 'worker_bad_response' }, 502);
    return json(out, r.status);
  } catch {
    return json({ error: 'worker_unreachable' }, 502);
  }
};
