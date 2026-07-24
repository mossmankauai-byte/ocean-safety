// OceanSafe car-fleet PAID upgrade — starts the operator's Square subscription
// (vehicles x $5/mo, billed by emailed invoice, no card-on-file), then flips their
// config to tier=paid so the in-app store + dollar dashboard unlock.
//
// Sibling of ts-upgrade.mjs (rooms x $8). Same operator backbone (/ts-cfg), different
// plan + rate, so a Turo host's invoice reads "Car Fleet", never "timeshare".
// Admin-gated (same key as /ts-signup). Reads Square creds from Netlify env:
//   SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_ENVIRONMENT (production|sandbox)
//
// POST { admin, slug, key, name, email, cars, dry? }
//   dry:true  -> reads only (customer lookup + amount), never creates a charge.
//   otherwise -> creates the real recurring subscription + emails the operator.

const CAR_PLAN = { variationId: 'X5T5UFGCRLIXWW3NEY3NJ7GO', planId: 'HAIFGDNCFDFJOSNPPDPYYJYM', base: 500 }; // $5/vehicle/mo
const WORKER = (globalThis.Netlify?.env?.get?.('TELEMETRY_URL')
  || process.env.TELEMETRY_URL || 'https://concierge-guide-api.oceansafe-hi.workers.dev').replace(/\/+$/, '');
const ADMIN = (globalThis.Netlify?.env?.get?.('TS_ADMIN_KEY') || process.env.TS_ADMIN_KEY || 'os-stayclose-admin-2026');
// The store lives in Supabase, the guide lives in the worker KV — two systems that never
// met. This is the bridge: paying creates the partners row, so the thing the fleet is
// actually buying exists the moment the subscription does.
const SUPA_FN = 'https://arndnljtmjfsnzcpcuen.supabase.co/functions/v1';

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
  const cars = Math.round(Number(body.cars) || 0);
  const slug = String(body.slug || '').toLowerCase();
  const key = String(body.key || '');
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, reason: 'need_name_and_email' }, 400);
  if (!cars || cars < 1) return json({ ok: false, reason: 'need_cars' }, 400);
  if (!slug || !key) return json({ ok: false, reason: 'need_slug_key' }, 400);

  const TOKEN = env('SQUARE_ACCESS_TOKEN'), LOCATION = env('SQUARE_LOCATION_ID');
  const BASE = env('SQUARE_ENVIRONMENT') === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  if (!TOKEN || !LOCATION) return json({ ok: false, reason: 'square_not_configured', hint: 'Set SQUARE_ACCESS_TOKEN + SQUARE_LOCATION_ID + SQUARE_ENVIRONMENT in Netlify env vars.' }, 503);

  const amount = cars * CAR_PLAN.base; // cents
  const sq = async (path, b, method = 'POST') => {
    const r = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${TOKEN}`, 'Square-Version': '2025-01-23', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    const out = await r.json().catch(() => null);
    return { ok: r.ok && out && !out.errors, status: r.status, out };
  };

  // 1) customer (read; create only on a real run)
  const search = await sq('/v2/customers/search', { query: { filter: { email_address: { exact: email } } } });
  if (!search.ok) return json({ ok: false, reason: 'square_customer_search_failed', detail: search.out?.errors || search.status }, 502);
  let customerId = search.out.customers?.[0]?.id || null;

  const subBody = { idempotency_key: `sub_car_${slug}`, location_id: LOCATION, plan_variation_id: CAR_PLAN.variationId, customer_id: customerId || '(new customer)', price_override_money: { amount, currency: 'USD' } };

  if (body.dry) {
    // store_ready reports whether step 4 would actually be able to build the store, so a
    // dry run pre-flights the WHOLE upgrade — not just the charge.
    return json({ ok: true, dry: true, monthly: amount / 100, cars, rate: CAR_PLAN.base / 100, customer_exists: !!customerId, store_ready: !!env('CAR_PROVISION_SECRET'), would_create: subBody });
  }

  if (!customerId) {
    const cust = await sq('/v2/customers', { idempotency_key: `cust_car_${slug}`, given_name: name, company_name: name, email_address: email });
    if (!cust.ok) return json({ ok: false, reason: 'square_customer_create_failed', detail: cust.out?.errors }, 502);
    customerId = cust.out.customer.id;
  }

  // 2) subscription — emailed invoice (no card_id)
  subBody.customer_id = customerId;
  const sub = await sq('/v2/subscriptions', subBody);
  if (!sub.ok) return json({ ok: false, reason: 'square_subscription_failed', detail: sub.out?.errors }, 502);
  const s = sub.out.subscription;

  // 3) flip the operator to paid so the store + dollar dashboard unlock
  let tierSet = false;
  try {
    const c = await fetch(`${WORKER}/ts-cfg`, { method: 'POST', headers: { 'Content-Type': 'text/plain', 'User-Agent': 'OceanSafe-Netlify/1.0' }, body: JSON.stringify({ slug, key, tier: 'paid' }) });
    tierSet = (await c.json().catch(() => ({})))?.ok === true;
  } catch {}

  // 4) build the actual store — a live `partners` row in Supabase. The subscription id
  // created above is the payment proof the go-live invariant requires, so this is the
  // only point in the flow where a fleet can legitimately be published.
  //
  // Reported, never thrown: the subscription is already real by the time we get here, so
  // a Supabase blip must not surface as "payment failed". `store_provisioned:false` tells
  // the caller (and /onboard-cars) to retry rather than re-charge.
  const store = { provisioned: false, reason: null, page_url: null, qr_codes: [] };
  const secret = env('CAR_PROVISION_SECRET');
  if (!secret) {
    store.reason = 'not_configured';
  } else {
    try {
      const r = await fetch(`${SUPA_FN}/car-provision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret, slug, name, email, cars,
          island: String(body.island || 'kauai').toLowerCase(),
          subscription_id: s.id, customer_id: customerId,
        }),
      });
      const out = await r.json().catch(() => ({}));
      if (out?.ok) {
        store.provisioned = true;
        store.page_url = out.page_url;
        store.qr_codes = out.qr_codes || [];
      } else {
        store.reason = out?.error || `http_${r.status}`;
      }
    } catch (e) {
      store.reason = 'unreachable';
    }
  }

  return json({ ok: true, subscription_id: s.id, status: s.status, monthly: amount / 100, cars, rate: CAR_PLAN.base / 100, customer_id: customerId, tier_set_paid: tierSet, invoiced_to: email, store });
};
