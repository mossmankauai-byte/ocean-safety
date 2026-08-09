// OceanSafe /join self-serve onboarding — thin same-origin proxy to the worker's
// PUBLIC /self-signup route (NO admin key). POST { segment, name, email, units }
// -> { ok, slug, key, portal_url, dashboard_url, guest_urls, ... }.
//
// The worker bounds openness with a per-IP daily cap + a global ceiling; nothing here
// is admin-gated. It reads CF-Connecting-IP, which on a proxied call would be Netlify's
// egress (one IP for everyone) — so we forward the real visitor IP as X-Client-IP and
// the worker prefers it, making the per-IP cap genuinely per-user.

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
  if (!body.segment || !body.name || !body.email) return json({ ok: false, reason: 'missing_fields' }, 400);

  const clientIp = req.headers.get('x-nf-client-connection-ip')
    || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || '';

  try {
    const r = await fetch(`${WORKER}/self-signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-Client-IP': clientIp,
        'User-Agent': 'OceanSafe-Netlify/1.0 (nick@oceansafety.app)',
      },
      body: JSON.stringify(body),
    });
    const out = await r.json().catch(() => null);
    if (!out) return json({ ok: false, reason: 'worker_bad_response' }, 502);
    return json(out, r.status);
  } catch {
    return json({ ok: false, reason: 'worker_unreachable' }, 502);
  }
};
