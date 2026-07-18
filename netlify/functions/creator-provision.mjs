// OceanSafe creator auto-onboarding — thin proxy to the telemetry worker.
//
// The worker owns creator provisioning now (POST /creator-signup — public, cr-* slugs only,
// per-IP rate-limited, capacity-capped, issue-once keys). This function just forwards the
// signup so the page keeps its same-origin /api/creator-provision endpoint. No secrets needed:
// the MINT_KEY dependency is gone (2026-07-18) — the worker route is self-serve by design.
//
// POST { name, email, handle, platform, island } -> { ok, slug, key, cleanHandle } | { ok:false, reason }

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

  const clean = String(body.handle || '').toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9]+/g, '').slice(0, 29);
  if (clean.length < 1) return json({ ok: false, reason: 'bad_handle' }, 400);

  try {
    const r = await fetch(`${WORKER}/creator-signup`, {
      method: 'POST',
      // text/plain avoids a CORS preflight at the worker and dodges bot-fight UA heuristics;
      // identify ourselves the same way the geocoder does.
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'OceanSafe-Netlify/1.0 (nick@oceansafety.app)' },
      body: JSON.stringify({
        handle: clean, island: String(body.island || 'kauai').toLowerCase(),
        name: String(body.name || '').slice(0, 80), email: String(body.email || '').slice(0, 120),
        platform: String(body.platform || '').slice(0, 24),
        rawHandle: String(body.handle || '').replace(/^@+/, '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 30),
      }),
    });
    const out = await r.json().catch(() => null);
    if (!out) return json({ ok: false, reason: 'worker_bad_response' }, 502);
    if (out.ok && out.existing) return json({ ok: false, reason: 'handle_taken', slug: out.slug, cleanHandle: clean });
    if (out.ok) return json({ ok: true, slug: out.slug, key: out.key, cleanHandle: clean });
    return json({ ok: false, reason: out.reason || ('worker_' + r.status), cleanHandle: clean });
  } catch {
    return json({ ok: false, reason: 'worker_unreachable', cleanHandle: clean });
  }
};
