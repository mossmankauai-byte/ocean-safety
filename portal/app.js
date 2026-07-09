// app.js — shared portal wiring. Load order on every page:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="config.js"></script>
//   <script src="app.js"></script>

const CFG = window.OCEANSAFE_CONFIG;
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY);
window.sb = sb;

// ── demo mode ────────────────────────────────────────────────────────────────
// When the Supabase keys are still placeholders, the portal runs off built-in
// sample data so it's fully viewable locally — no login, no backend.
const DEMO = /YOUR-PROJECT|REPLACE_ME|^$/.test(CFG.SUPABASE_URL || "") || /REPLACE_ME|^$/.test(CFG.SUPABASE_PUBLISHABLE_KEY || "");
window.OCEANSAFE_DEMO = DEMO;
const DEMO_PARTNER = { id: "demo", name: "Your Shop (demo)", slug: "your-shop", store_mode: "storefront",
  status: "live", stripe_charges_enabled: true, stripe_payouts_enabled: true, stripe_onboarded_at: "2026-06-01", platform_fee_bps: 670, amazon_tag: "oceansafety-20", fulfillment_mode: "both" };
window.demoData = function () {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const pat = [2200,0,1800,4900,2200,0,0,6600,2200,1800,0,4900,2200,8800,0,2200,1800,4900,6600,2200,0,11000,2200,4900,1800,8800,2200,6600,4900,13200];
  const titles = ["Reef-safe SPF 50", "Snorkel set — day rental", "UPF 50+ rash guard", "Water shoes"];
  // A mix of fulfillment + status so the orders/fulfillment UI shows its full range.
  const fulfills = ["pickup", "pickup", "ship", "pickup", "ship"];
  const statuses = ["paid", "ready", "shipped", "collected", "paid"];
  const orders = [], items = []; let n = 0;
  pat.forEach((amt, i) => {
    if (!amt) return;
    const d = new Date(today); d.setDate(d.getDate() - (29 - i));
    const id = "demo-" + (++n);
    const fulfillment = fulfills[n % fulfills.length];
    const status = statuses[n % statuses.length];
    const o = { id, total_cents: amt, status, fulfillment, created_at: d.toISOString() };
    if (fulfillment === "pickup") o.pickup_code = "P" + String(1000 + n).slice(-4);
    if (fulfillment === "ship" && status === "shipped") o.tracking = "1Z" + String(900000 + n);
    orders.push(o);
    items.push({ order_id: id, title: titles[n % titles.length], qty: 1, price_cents: amt });
  });
  orders.push({ id: "demo-0", total_cents: 3400, status: "pending", fulfillment: "pickup", pickup_code: "P0000", created_at: today.toISOString() });
  // Rental examples (orders.rental_return_due, 0015) — clearly demo: one due
  // back tomorrow 4pm, one overdue since yesterday 10am. The pickup code
  // doubles as the claim ticket; deposits/reminder texts live in the seller's
  // own Square, never in OceanSafe.
  const rDue = new Date(today); rDue.setDate(rDue.getDate() + 1); rDue.setHours(16, 0, 0, 0);
  orders.push({ id: "demo-r1", total_cents: 4500, status: "paid", fulfillment: "pickup", pickup_code: "RENT",
    rental_return_due: rDue.toISOString(), created_at: today.toISOString() });
  items.push({ order_id: "demo-r1", title: "Beach chair set — day rental (demo)", qty: 1, price_cents: 4500 });
  const rLate = new Date(today); rLate.setDate(rLate.getDate() - 1); rLate.setHours(10, 0, 0, 0);
  const rOut = new Date(today); rOut.setDate(rOut.getDate() - 3);
  orders.push({ id: "demo-r2", total_cents: 9800, status: "collected", fulfillment: "pickup", pickup_code: "KAYK",
    rental_return_due: rLate.toISOString(), created_at: rOut.toISOString() });
  items.push({ order_id: "demo-r2", title: "Kayak — 3-day rental (demo)", qty: 1, price_cents: 9800 });
  orders.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  // Inventory: one sold out (0), one unlimited (null), the rest counted.
  const products = [
    { id: "demo-p1", title: "Reef-safe SPF 50", price_cents: 2200, stock: 18, active: true },
    { id: "demo-p2", title: "Snorkel set — day rental", price_cents: 4900, stock: null, active: true },
    { id: "demo-p3", title: "UPF 50+ rash guard", price_cents: 3800, stock: 3, active: true },
    { id: "demo-p4", title: "Water shoes", price_cents: 2800, stock: 0, active: false },
    { id: "demo-p5", title: "Dry bag — 10L", price_cents: 1800, stock: 7, active: true },
  ];
  return { orders, items, products };
};

// ── auth ─────────────────────────────────────────────────────────────────────
async function currentSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}
// Redirect to login if not signed in. Returns the session otherwise.
async function requireAuth() {
  if (DEMO) return { user: { id: "demo" } };
  const session = await currentSession();
  if (!session) { location.replace("index.html"); throw new Error("not authed"); }
  return session;
}
async function signOut() { await sb.auth.signOut(); location.replace("index.html"); }

// ── data ─────────────────────────────────────────────────────────────────────
// The logged-in owner's shop row (null until they finish get-started).
async function getMyPartner(userId) {
  if (DEMO) return { ...DEMO_PARTNER };
  // Adopt any unowned partner row(s) matching the verified email before reading.
  try { await sb.rpc("claim_my_partner"); } catch (_) { /* swallow softly */ }
  const { data, error } = await sb.from("partners").select("*").eq("owner", userId).maybeSingle();
  if (error) throw error;
  return data;
}

// Call an Edge Function with the user's JWT (so it can verify ownership).
async function fn(name, body) {
  const session = await currentSession();
  const res = await fetch(`${CFG.FUNCTIONS_BASE}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token ?? CFG.SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errText(out.error) || `HTTP ${res.status}`);
  return out;
}

// ── helpers ──────────────────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (id) => document.getElementById(id);
const money = (cents) => (cents == null ? "—" : "$" + (cents / 100).toFixed(2));
const slugify = (s) => (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const errText = (e) => (typeof e === "string" ? e : e ? JSON.stringify(e) : "");

function toast(node, kind, text) {
  if (!node) return;
  node.className = `msg ${kind}`;
  node.textContent = text;
  node.classList.remove("hide");
}

// Upload a file to a public bucket under the owner's partner_id folder
// (matches the owner-foldered storage write policy from migration 0002).
async function uploadToBucket(bucket, partnerId, file) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${partnerId}/${Date.now()}_${safe}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Mirror of functions/_shared/asin.ts — extract an ASIN from a URL or raw code.
function parseAsin(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[A-Z0-9]{10}$/i.test(s)) return s.toUpperCase();
  const m = s.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})/i)
    || s.match(/[/=]([A-Z0-9]{10})(?:[/?]|$)/i);
  return m ? m[1].toUpperCase() : null;
}
function affiliateLink(asin, tag) {
  return asin && tag ? `https://www.amazon.com/dp/${asin}/ref=nosim?tag=${encodeURIComponent(tag)}` : null;
}
