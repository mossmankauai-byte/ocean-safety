// OceanSafe creator auto-onboarding — the "hook everything up automatically" linchpin.
//
// A creator submits the /creators join form; this function provisions them exactly the way
// a hotel is provisioned on go-live: it registers their own telemetry slug (cr-<handle>) with
// the Concierge-Guide worker and seeds that slug's dashboard access key. After this returns,
// the creator's ?ref=cr-<handle> link emits real telemetry (sessions, tab + POI taps) and
// their /creator-dash.html?c=cr-<handle>&k=<key> reads the full access-gated rollup — no
// manual step from OceanSafe, same shape as square-webhook's seedTelemetryKey().
//
// Endpoint (via /api/creator-provision redirect, or the function URL directly):
//   POST { name, email, handle, platform, island } -> { ok, slug, key } | { ok:false, reason }
//
// Secrets (Netlify env):
//   MINT_KEY      — bearer for the worker POST /cfg (SAME value as the Supabase MINT_KEY secret).
//   TELEMETRY_URL — worker base; defaults to the known prod worker so only MINT_KEY must be set.
//
// If MINT_KEY is unset the function returns {ok:false, reason:"unprovisioned"} and the page
// falls back to a pooled link that still tracks — a creator is never left without a working link.

const DEFAULT_TELEMETRY = 'https://concierge-guide-api.oceansafe-hi.workers.dev';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: HEADERS });

// handle -> worker slug. Worker requires /^[a-z0-9-]{3,32}$/, so cr- + 1..29 clean chars.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function cleanHandle(h) {
  return String(h || '').toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9]+/g, '').slice(0, 29);
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'method' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, reason: 'bad_json' }, 400); }

  const name = String(body.name || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().slice(0, 120);
  const clean = cleanHandle(body.handle);
  if (clean.length < 1) return json({ ok: false, reason: 'bad_handle' }, 400);
  if (!EMAIL.test(email)) return json({ ok: false, reason: 'bad_email' }, 400);

  const slug = 'cr-' + clean;                                  // the creator's own telemetry slug
  const key = crypto.randomUUID().replace(/-/g, '');           // 32-hex dashboard access token

  const base = (globalThis.Netlify?.env?.get?.('TELEMETRY_URL')
    || process.env.TELEMETRY_URL || DEFAULT_TELEMETRY).replace(/\/+$/, '');
  const mint = globalThis.Netlify?.env?.get?.('MINT_KEY') || process.env.MINT_KEY || '';

  if (!mint) {
    // No secret yet — the page falls back to the pooled ?ref=creators&u=<handle> link.
    return json({ ok: false, reason: 'unprovisioned', slug, cleanHandle: clean });
  }

  // Mirror square-webhook's seedTelemetryKey: POST /cfg with {slug,key} (config omitted) is the
  // key-seed path — it registers the slug in the worker allowlist AND sets key:<slug>=<token>,
  // so telemetry is accepted for this slug and its dashboard is access-gated by <token>.
  try {
    const r = await fetch(`${base}/cfg`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mint}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, key }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return json({ ok: false, reason: 'worker_' + r.status, detail: detail.slice(0, 200), slug, cleanHandle: clean });
    }
  } catch (e) {
    return json({ ok: false, reason: 'worker_unreachable', slug, cleanHandle: clean });
  }

  // Best-effort: mint a minimal co-brand config so the creator's chosen island + default banner
  // work the moment they share the link, before they've customized anything in the dashboard.
  // A failure here does NOT fail provisioning — the tracked link + access key are already live;
  // the co-brand just fills in on their first dashboard save. signed:true suppresses the pilot tag.
  const ISLANDS = new Set(['kauai', 'oahu', 'maui']);
  const island = String(body.island || 'kauai').toLowerCase();
  const seedCfg = { creator: true, signed: true, name: '@' + clean };
  if (ISLANDS.has(island)) seedCfg.islands = { [island]: { featured: [] } };
  try {
    await fetch(`${base}/cfg`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mint}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, config: seedCfg, overwrite: true }),
    });
  } catch (e) { /* non-fatal */ }

  // Provisioned. The human-readable record (name/email for payouts) is captured separately by
  // the page's Netlify Forms POST — this function only handles the automatic telemetry hookup.
  return json({ ok: true, slug, key, cleanHandle: clean });
};
