// OceanSafe creator co-brand config save.
//
// The creator dashboard (creator-dash.html) posts here to update what their ?ref=cr-<handle>
// link shows: the islands they cover, their featured beach picks per island, and their uploaded
// banner image. This mints the worker config (pcfg:<slug>) the app reads via GET /cfg/<slug>.
//
// OWNERSHIP: the caller must prove they own the slug. We verify by calling the worker's
// access-gated dashboard read with the caller's key — a 200 means key:<slug> matches, so the
// caller is the real creator (their key was seeded at signup by creator-provision). Only then
// do we mint. This is why the dashboard link carries &k=<key>.
//
// SAFETY: the uploaded banner is stored but the APP renders the DEFAULT OceanSafe banner until
// a human sets banner_ok:true (see index.html _creatorBanner). So a self-serve upload never
// shows in the live safety app un-reviewed. Picks + name are low-risk and apply immediately.
//
// Secrets (Netlify env): MINT_KEY (same as Supabase). TELEMETRY_URL optional (defaults to prod).

const DEFAULT_TELEMETRY = 'https://concierge-guide-api.oceansafe-hi.workers.dev';
const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: HEADERS });

const ISLANDS = new Set(['kauai', 'oahu', 'maui']);
const BANNER_MAX = 190 * 1024;   // ~190KB data URL ceiling; worker config cap is 256KB total

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'method' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, reason: 'bad_json' }, 400); }

  const slug = String(body.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
  const key = String(body.key || '');
  if (!/^cr-[a-z0-9]+$/.test(slug)) return json({ ok: false, reason: 'bad_slug' }, 400);
  if (key.length < 8) return json({ ok: false, reason: 'bad_key' }, 400);

  const base = (globalThis.Netlify?.env?.get?.('TELEMETRY_URL')
    || process.env.TELEMETRY_URL || DEFAULT_TELEMETRY).replace(/\/+$/, '');
  const mint = globalThis.Netlify?.env?.get?.('MINT_KEY') || process.env.MINT_KEY || '';
  if (!mint) return json({ ok: false, reason: 'unprovisioned' });

  // --- Ownership check: the access-gated dashboard read must accept this key ---
  try {
    const chk = await fetch(`${base}/api/dashboard/${slug}?period=1&key=${encodeURIComponent(key)}`);
    if (chk.status === 403) return json({ ok: false, reason: 'forbidden' }, 403);
    if (!chk.ok) return json({ ok: false, reason: 'verify_' + chk.status }, 502);
  } catch { return json({ ok: false, reason: 'verify_unreachable' }, 502); }

  // --- Build a clean config from the caller's input (never trust it raw) ---
  const inCfg = (body.config && typeof body.config === 'object') ? body.config : {};
  const cfg = { creator: true, signed: true };   // signed:true suppresses the "pilot preview" tag

  const name = String(inCfg.name || slug.replace(/^cr-/, '')).slice(0, 40);
  cfg.name = name;

  // islands: { <island>: { featured: [beachId,...] } } — only valid islands, ids sanitized/capped
  const islands = {};
  const src = (inCfg.islands && typeof inCfg.islands === 'object') ? inCfg.islands : {};
  for (const isl of Object.keys(src)) {
    if (!ISLANDS.has(isl)) continue;
    const feat = Array.isArray(src[isl]?.featured) ? src[isl].featured : [];
    const clean = [];
    for (const id of feat) {
      const b = String(id || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40);
      if (b && !clean.includes(b)) clean.push(b);
      if (clean.length >= 12) break;   // sane cap on featured picks per island
    }
    if (clean.length) islands[isl] = { featured: clean };
  }
  if (Object.keys(islands).length) cfg.islands = islands;

  // banner: a compressed data:image/(jpeg|png|webp) URL. Stored but gated by banner_ok until
  // a human approves it. Reject anything that isn't a bounded image data URL.
  if (typeof inCfg.banner === 'string' && inCfg.banner) {
    if (!/^data:image\/(jpe?g|png|webp);base64,/i.test(inCfg.banner))
      return json({ ok: false, reason: 'bad_banner_type' }, 400);
    if (inCfg.banner.length > BANNER_MAX)
      return json({ ok: false, reason: 'banner_too_large' }, 413);
    cfg.banner = inCfg.banner;
    cfg.banner_ok = false;   // pending review — app shows the default OceanSafe banner meanwhile
  }

  // --- Mint (overwrite: this replaces any prior creator config; the access key is untouched) ---
  try {
    const r = await fetch(`${base}/cfg`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mint}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, config: cfg, overwrite: true }),
    });
    if (!r.ok) {
      const d = await r.text().catch(() => '');
      return json({ ok: false, reason: 'mint_' + r.status, detail: d.slice(0, 200) }, 502);
    }
  } catch { return json({ ok: false, reason: 'mint_unreachable' }, 502); }

  return json({ ok: true, slug, bannerPending: cfg.banner_ok === false });
};
