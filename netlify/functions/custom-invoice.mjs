// OceanSafe custom invoice — mints a Square payment link for an ARBITRARY amount
// the rep sets in the Closing tab. Two cadences:
//   once    -> quick_pay one-time payment link (pay the exact amount once)
//   monthly -> a per-amount STATIC monthly subscription variation on a carrier
//              plan, then a subscription checkout link (same mechanism the fixed
//              tier links use — mint-jade-correct-links.mjs).
//
// Admin-gated (same key as /ts-upgrade). Square creds from Netlify env:
//   SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_ENVIRONMENT (production|sandbox)
//
// POST { admin, business, amount, cadence?, email?, dry? }
//   amount  = dollars (number or numeric string)
//   cadence = 'once' | 'monthly'  (default 'monthly')
//   dry:true -> validates only, creates nothing.
// Creating a link charges NO ONE — links are dormant until a buyer opens one and
// enters a card. Returns { ok, url, amount, cadence, business }.

const CARRIER_PLAN_ID = 'BZKMTIEFKMVMZID7R6N7IA4P'; // hotel plan = generic subscription carrier (holds the price on the variation)
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

  const business = String(body.business || '').trim().slice(0, 80);
  const dollars = Number(body.amount);
  const cadence = body.cadence === 'once' ? 'once' : 'monthly';
  const email = String(body.email || '').trim();
  if (!business) return json({ ok: false, reason: 'need_business' }, 400);
  if (!(dollars > 0) || dollars > 100000) return json({ ok: false, reason: 'bad_amount', hint: 'amount is dollars, 0 < amount <= 100000' }, 400);
  const cents = Math.round(dollars * 100);

  const TOKEN = env('SQUARE_ACCESS_TOKEN'), LOCATION = env('SQUARE_LOCATION_ID');
  const BASE = env('SQUARE_ENVIRONMENT') === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  if (!TOKEN || !LOCATION) return json({ ok: false, reason: 'square_not_configured', hint: 'Set SQUARE_ACCESS_TOKEN + SQUARE_LOCATION_ID + SQUARE_ENVIRONMENT in Netlify env vars.' }, 503);

  const uniq = () => `${Date.now()}${Math.round(Math.random() * 1e9)}`; // fresh key per link — avoids IDEMPOTENCY_KEY_REUSED when the same business/amount is re-sent with a tweaked body
  const sq = async (path, b, method = 'POST') => {
    const r = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${TOKEN}`, 'Square-Version': '2025-01-23', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    const out = await r.json().catch(() => null);
    return { ok: r.ok && out && !out.errors, status: r.status, out };
  };

  const dLabel = Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
  const per = cadence === 'monthly' ? '/mo' : ' one-time';
  const name = `OceanSafe — ${business} — $${dLabel}${per}`;

  if (body.dry) return json({ ok: true, dry: true, business, amount: dollars, cadence, would_charge: name });

  // buyer_email is a best-effort checkout prefill: attach only if it looks valid, and
  // if Square still rejects it, retry once without it — a bad email (it's optional) must
  // never block link creation.
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const createLink = async (base) => {
    const b = { ...base, idempotency_key: `ci_${uniq()}` };
    if (emailOk) b.pre_populated_data = { buyer_email: email };
    let r = await sq('/v2/online-checkout/payment-links', b);
    if (!r.ok && b.pre_populated_data && JSON.stringify(r.out?.errors || '').includes('buyer_email')) {
      delete b.pre_populated_data; b.idempotency_key = `ci_${uniq()}`;
      r = await sq('/v2/online-checkout/payment-links', b);
    }
    return r;
  };

  // ONE-TIME: quick_pay carries the amount directly.
  if (cadence === 'once') {
    const link = await createLink({ quick_pay: { name, price_money: { amount: cents, currency: 'USD' }, location_id: LOCATION } });
    if (!link.ok) return json({ ok: false, reason: 'square_link_failed', detail: link.out?.errors || link.status }, 502);
    return json({ ok: true, url: link.out.payment_link?.url || link.out.payment_link?.long_url, amount: dollars, cadence, business });
  }

  // MONTHLY: mint (or reuse) a STATIC monthly variation at this amount, then a subscription checkout link.
  const vname = `OceanSafe Custom — $${dLabel}/mo`;
  let variationId = null;
  const search = await sq('/v2/catalog/search', { object_types: ['SUBSCRIPTION_PLAN_VARIATION'] });
  if (search.ok) variationId = (search.out.objects || []).find((o) => o.subscription_plan_variation_data?.name === vname)?.id || null;
  if (!variationId) {
    const v = await sq('/v2/catalog/object', {
      idempotency_key: `civar_${cents}`,
      object: {
        type: 'SUBSCRIPTION_PLAN_VARIATION', id: `#civar_${cents}`,
        subscription_plan_variation_data: {
          name: vname, subscription_plan_id: CARRIER_PLAN_ID,
          phases: [{ cadence: 'MONTHLY', ordinal: 0, pricing: { type: 'STATIC', price: { amount: cents, currency: 'USD' } } }],
        },
      },
    });
    if (!v.ok) return json({ ok: false, reason: 'square_variation_failed', detail: v.out?.errors || v.status }, 502);
    variationId = v.out.catalog_object.id;
  }
  const link = await createLink({ quick_pay: { name, price_money: { amount: 0, currency: 'USD' }, location_id: LOCATION }, checkout_options: { subscription_plan_id: variationId } });
  if (!link.ok) return json({ ok: false, reason: 'square_link_failed', detail: link.out?.errors || link.status }, 502);
  return json({ ok: true, url: link.out.payment_link?.url || link.out.payment_link?.long_url, amount: dollars, cadence, business, variation_id: variationId });
};
