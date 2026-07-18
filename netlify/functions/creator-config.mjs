// OceanSafe creator co-brand config save — thin proxy to the telemetry worker.
//
// The worker owns the save now (POST /creator-cfg): it verifies the caller holds the slug's
// own dashboard key, sanitizes the config, forces banner_ok:false on any new banner (human
// approval gate), and carries an approved banner forward on picks-only saves. No secrets here:
// the MINT_KEY dependency is gone (2026-07-18).
//
// POST { slug, key, config } -> worker response passthrough

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
  if (!/^cr-[a-z0-9]{1,29}$/.test(String(body.slug || ''))) return json({ ok: false, reason: 'bad_slug' }, 400);
  if (String(body.key || '').length < 8) return json({ ok: false, reason: 'bad_key' }, 400);

  try {
    const r = await fetch(`${WORKER}/creator-cfg`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'OceanSafe-Netlify/1.0 (nick@oceansafety.app)' },
      body: JSON.stringify({ slug: body.slug, key: body.key, config: body.config }),
    });
    const out = await r.json().catch(() => null);
    if (!out) return json({ ok: false, reason: 'worker_bad_response' }, 502);
    return json(out, r.status);
  } catch {
    return json({ ok: false, reason: 'worker_unreachable' }, 502);
  }
};
