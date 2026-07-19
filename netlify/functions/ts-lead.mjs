// OceanSafe stay-close lead ingest — thin same-origin proxy to the telemetry worker.
//
// The worker owns storage + the CRM forward (POST /ts-lead). This function just
// forwards so the guest app keeps a same-origin /api/ts-lead endpoint (no CORS
// preflight, no secrets here).
//
// POST { slug, lead:{seg,event,gift,slot,daysLeft,qualify,contact,ref,net} }
//   -> { ok, id, outcome_token, dispose_url, forwarded } | { ok:false, reason }

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
  if (!/^[a-z0-9-]{1,64}$/.test(String(body.slug || '').toLowerCase())) return json({ ok: false, reason: 'bad_slug' }, 400);

  try {
    const r = await fetch(`${WORKER}/ts-lead`, {
      method: 'POST',
      // text/plain dodges the worker preflight + bot-fight UA heuristics, same as the creator proxy
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
