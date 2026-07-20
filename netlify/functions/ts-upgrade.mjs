// OceanSafe stay-close PAID upgrade — starts the operator's Square subscription
// (rooms x $8/mo, billed by emailed invoice, no card-on-file), then flips their
// config to tier=paid so the dollar dashboard unlocks.
//
// Ports scripts/subscribe-operator.mjs (timeshare tier) into a same-origin endpoint.
// Admin-gated (same key as /ts-signup). Reads Square creds from Netlify env:
//   SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_ENVIRONMENT (production|sandbox)
//
// POST { admin, slug, key, name, email, rooms, dry? }
//   dry:true  -> reads only (customer lookup + amount), never creates a charge.
//   otherwise -> creates the real recurring subscription + emails the operator.

const TS_PLAN = { variationId: '2V4DOOUUIYYMCNWNXSQMAJFS', planId: 'NJYI4SKWLAOAXUGF65IIBNHU', base: 800 }; // $8/room/mo
const WORKER = (globalThis.Netlify?.env?.get?.('TELEMETRY_URL')
  || process.env.TELEMETRY_URL || 'https://concierge-guide-api.oceansafe-hi.workers.dev').replace(/\/+$/, '');
const ADMIN = (globalThis.Netlify?.env?.get?.('TS_ADMIN_KEY') || process.env.TS_ADMIN_KEY || 'os-stayclose-admin-2026');

const env = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];

const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: HEADERS });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'method' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, reason: 'bad_json' }, 400); }
  if (String(body.admin || '') !== ADMIN) return json({ ok: false, reason: 'forbidden' }, 403);

  const name = String(body.name || '').slice(0, 80);
  const email = String(body.email || '').trim();
  const rooms = Math.round(Number(body.rooms) || 0);
  const slug = String(body.slug || '').toLowerCase();
  const key = String(body.key || '');
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, reason: 'need_name_and_email' }, 400);
  if (!rooms || rooms < 1) return json({ ok: false, reason: 'need_rooms' }, 400);
  if (!slug || !key) return json({ ok: false, reason: 'need_slug_key' }, 400);

  const TOKEN = env('SQUARE_ACCESS_TOKEN'), LOCATION = env('SQUARE_LOCATION_ID');
  const BASE = env('SQUARE_ENVIRONMENT') === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  if (!TOKEN || !LOCATION) return json({ ok: false, reason: 'square_not_configured', hint: 'Set SQUARE_ACCESS_TOKEN + SQUARE_LOCATION_ID + SQUARE_ENVIRONMENT in Netlify env vars.' }, 503);

  const amount = rooms * TS_PLAN.base; // cents
  const sq = async (path, b, method = 'POST') => {
    const r = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${TOKEN}`, 'Square-Version': '2025-01-23', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    const out = await r.json().catch(() => null);
    return { ok: r.ok && out && !out.errors, status: r.status, out };
  };

  // 1) customer (read; create only on a real run)
  const search = await sq('/v2/customers/search', { query: { filter: { email_address: { exact: email } } } });
  if (!search.ok) return json({ ok: false, reason: 'square_customer_search_failed', detail: search.out?.errors || search.status }, 502);
  let customerId = search.out.customers?.[0]?.id || null;

  const subBody = { idempotency_key: `sub_ts_${slug}`, location_id: LOCATION, plan_variation_id: TS_PLAN.variationId, customer_id: customerId || '(new customer)', price_override_money: { amount, currency: 'USD' } };

  if (body.dry) {
    return json({ ok: true, dry: true, monthly: amount / 100, rooms, customer_exists: !!customerId, would_create: subBody });
  }

  if (!customerId) {
    const cust = await sq('/v2/customers', { idempotency_key: `cust_ts_${slug}`, given_name: name, company_name: name, email_address: email });
    if (!cust.ok) return json({ ok: false, reason: 'square_customer_create_failed', detail: cust.out?.errors }, 502);
    customerId = cust.out.customer.id;
  }

  // 2) subscription — emailed invoice (no card_id)
  subBody.customer_id = customerId;
  const sub = await sq('/v2/subscriptions', subBody);
  if (!sub.ok) return json({ ok: false, reason: 'square_subscription_failed', detail: sub.out?.errors }, 502);
  const s = sub.out.subscription;

  // 3) flip the operator to paid so the dollar dashboard unlocks
  let tierSet = false;
  try {
    const c = await fetch(`${WORKER}/ts-cfg`, { method: 'POST', headers: { 'Content-Type': 'text/plain', 'User-Agent': 'OceanSafe-Netlify/1.0' }, body: JSON.stringify({ slug, key, tier: 'paid' }) });
    tierSet = (await c.json().catch(() => ({})))?.ok === true;
  } catch {}

  return json({ ok: true, subscription_id: s.id, status: s.status, monthly: amount / 100, rooms, customer_id: customerId, tier_set_paid: tierSet, invoiced_to: email });
};
