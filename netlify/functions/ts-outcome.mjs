// OceanSafe stay-close outcome callback — thin same-origin proxy to the telemetry worker.
//
// A lead's disposition (showed / no_show / closed / lost + contract value) is posted
// back here — by the operator's CRM webhook, by a "sales desk taps a link" flow, or by
// the dashboard. Auth is either the per-lead outcome_token (least privilege) or the
// operator's dashboard key; the worker enforces it. This function just forwards.
//
// POST { token, status, contract_value?, gift_redeemed?, rep? }              (token path)
//   or { slug, key, id, status, ... }                                        (dashboard path)
//   -> { ok, id, status } | { ok:false, reason }

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
  if (!body.token && !(body.slug && body.key && body.id)) return json({ ok: false, reason: 'bad_ref' }, 400);

  try {
    const r = await fetch(`${WORKER}/ts-outcome`, {
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
