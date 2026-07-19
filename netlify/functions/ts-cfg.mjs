// OceanSafe stay-close operator settings save — thin same-origin proxy to the worker.
//
// Saves the operator's stay-close config (CRM webhook, units, VPG, show/close rates)
// into pcfg:<slug>. Key-gated by the worker (operator's dashboard key).
//
// POST { slug, key, ts_crm_webhook?, units?, vpg?, show_rate?, close_rate?, resort? }
//   -> { ok, saved:[...] } | { ok:false, reason }

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
  if (!/^[a-z0-9-]{1,64}$/.test(String(body.slug || '').toLowerCase()) || String(body.key || '').length < 8)
    return json({ ok: false, reason: 'bad_ref' }, 400);

  try {
    const r = await fetch(`${WORKER}/ts-cfg`, {
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
