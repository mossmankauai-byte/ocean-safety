// OceanSafe stay-close operator onboarding — thin same-origin proxy to the worker.
//
// POST { admin, name, email, rooms } -> { ok, slug, key, portal_url, dashboard_url, guest_urls, ... }
// Admin-gated by the worker. Provisions a Free-tier operator + returns links for QR generation.

const WORKER = (globalThis.Netlify?.env?.get?.('TELEMETRY_URL')
  || process.env.TELEMETRY_URL || 'https://concierge-guide-api.oceansafe-hi.workers.dev').replace(/\/+$/, '');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: HEADERS });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'method' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, reason: 'bad_json' }, 400); }
  if (!body.admin || !body.name) return json({ ok: false, reason: 'missing_fields' }, 400);

  try {
    const r = await fetch(`${WORKER}/ts-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'OceanSafe-Netlify/1.0 (nick@oceansafety.app)' },
      body: JSON.stringify(body),
    });
    const out = await r.json().catch(() => null);
    if (!out) return json({ ok: false, reason: 'worker_bad_response' }, 502);
    return json(out, r.status);
  } catch {
    return json({ ok: false, reason: 'worker_unreachable' }, 502);
  }
};
