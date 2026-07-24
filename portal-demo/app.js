// app.js — shared portal wiring. Load order on every page:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="config.js"></script>
//   <script src="app.js"></script>

const CFG = window.OCEANSAFE_CONFIG;
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY);
window.sb = sb;

// ── embedded mode (?embed=1) ─────────────────────────────────────────────────
// The operator consoles mount this portal inside their Shop tab as an iframe
// (first: /fleet). The console supplies the sub-tabs and the sign-out, so the
// portal's own top bar would be duplicate chrome — drop it. Also suppress the
// first-open tour: the console runs its own, and two spotlight overlays at once
// is worse than none. The Tour link still replays on demand where it's shown.
const EMBED = new URLSearchParams(location.search).get("embed") === "1";
window.OCEANSAFE_EMBED = EMBED;
if (EMBED) document.documentElement.classList.add("os-embed");

// ── demo mode ────────────────────────────────────────────────────────────────
// When the Supabase keys are still placeholders, the portal runs off built-in
// sample data so it's fully viewable locally — no login, no backend.
const DEMO = /YOUR-PROJECT|REPLACE_ME|^$/.test(CFG.SUPABASE_URL || "") || /REPLACE_ME|^$/.test(CFG.SUPABASE_PUBLISHABLE_KEY || "");
window.OCEANSAFE_DEMO = DEMO;
const DEMO_PARTNER = { id: "demo", name: "Your Shop (demo)", slug: "your-shop", store_mode: "storefront",
  status: "live", stripe_charges_enabled: true, stripe_payouts_enabled: true, stripe_onboarded_at: "2026-06-01", platform_fee_bps: 1270, amazon_tag: "oceansafety-20", fulfillment_mode: "both" };

// ── plan gate: Free vs Paid ──────────────────────────────────────────────────
// Canonical concierge/3rd-party model: Free = $0/mo, OceanSafe takes 12.7% of
// store sales (shop keeps 87.3%) + 50/50 on tour commissions. Paid = $829/mo,
// shop keeps 100% of both AND unlocks visitor analytics + promotions.
// So analytics and promotions are PAID-ONLY — on Free they render locked, never
// as data. Demo/sales calls can flip with ?plan=paid to show a prospect both.
const PLAN_PAID_PRICE = "$829/mo";
// DEFAULTS DIFFER BY MODE, on purpose:
//   demo  -> "paid". Every OceanSafe demo shows the FULL product (same as the
//            operator consoles, whose isFree is only true on an explicit
//            ?plan=free). A prospect should never open a sales link onto a
//            locked box. ?plan=free still shows the gated view for contrast.
//   real  -> "free". A signed-in shop must actually see its gate, and no paid
//            shop exists yet. When the Paid plan is wired to the backend this
//            should read the partner row instead of defaulting.
window.OCEANSAFE_PLAN = (function () {
  const fallback = DEMO ? "paid" : "free";
  const q = new URLSearchParams(location.search).get("plan");
  if (q === "paid" || q === "free") { try { localStorage.setItem("os_portal_plan", q); } catch (e) {} return q; }
  try { return localStorage.getItem("os_portal_plan") || fallback; } catch (e) { return fallback; }
})();
window.isPaid = function () { return window.OCEANSAFE_PLAN === "paid"; };
// Store take: Free 12.7% (payout 87.3%) · Paid 0% (payout 100%).
window.payoutRate = function () { return window.isPaid() ? 1 : 0.873; };
window.payoutPct  = function () { return window.isPaid() ? "100%" : "87.3%"; };
window.feePct     = function () { return window.isPaid() ? "0%" : "12.7%"; };
// Renders in place of a Paid-only panel when the shop is on Free.
window.lockedPanel = function (what, why) {
  return `<div class="lockwrap">
    <div class="lockico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
    <div class="lockt">${what} — part of the Paid plan</div>
    <div class="locks">${why} Your storefront, orders, inventory and payouts stay free — this is the part that comes with the ${PLAN_PAID_PRICE} plan.</div>
    <a class="btn primary" href="mailto:nick@oceansafety.app?subject=Upgrade%20to%20Paid%20—%20OceanSafe">Upgrade to Paid — ${PLAN_PAID_PRICE} ↗</a>
    <div class="lockn">On Paid you also keep <b>100%</b> of store sales and <b>100%</b> of tour commissions instead of 87.3% / 50%.</div>
  </div>`;
};
// One-line "this is sample data" badge — only ever shown in demo mode.
window.sampleBadge = function (extra) {
  return window.OCEANSAFE_DEMO ? `<span class="samp" title="Demo figures — not a real shop">SAMPLE${extra ? " · " + extra : ""}</span>` : "";
};
// ── the one sample catalog ───────────────────────────────────────────────────
// Single source of truth for demo prices. These match the guest app's storefront
// (index.html shop sheet) item-for-item, so a prospect never sees the same product
// at two different prices across the app, the portal and the product preview.
window.DEMO_CATALOG = [
  // stock/active mirror the inventory tables on dashboard.html + inventory.html,
  // so "4 items tracked · 1 to reorder · 1 sold out" is true of this same list.
  { id: "demo-p1", sku: "SPF50-8OZ",   title: "Reef-safe SPF 50",         price_cents: 2200, stock: 4,    active: true },
  { id: "demo-p2", sku: "SNK-SET",     title: "Snorkel set — day rental", price_cents: 4500, stock: 9,    active: true },
  { id: "demo-p3", sku: "RG-UPF50-M",  title: "UPF 50+ rash guard",       price_cents: 3200, stock: 0,    active: true },
  { id: "demo-p4", sku: "WS-10",       title: "Water shoes",              price_cents: 3000, stock: 22,   active: true },
  { id: "demo-p5", sku: "DRY-20L",     title: "Dry bag — 20L",            price_cents: 2800, stock: null, active: true },
];
window.demoData = function () {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cat = window.DEMO_CATALOG;
  // Orders per day across the last 30 — a real beach shop does several a day, and
  // weekends run hot. Deterministic so the demo reads the same on every load.
  const perDay = [3,3,4,5,6,4,3, 4,3,5,6,7,4,3, 4,4,5,7,8,5,3, 4,5,6,7,9,5,4, 6,5];
  // Each order takes 1–3 items off the catalog; the basket pattern keeps the mix
  // realistic (sunscreen attaches to almost everything) and the totals honest —
  // an order's total is the sum of its lines, never an invented number.
  const baskets = [[0],[1],[0,2],[1,0],[2,4],[0,1,4],[3],[1,4],[0,3],[2,0,4],[1,2],[4,0]];
  // A mix of fulfillment + status so the orders/fulfillment UI shows its full range.
  const fulfills = ["pickup", "pickup", "ship", "pickup", "pickup", "ship"];
  const statuses = ["paid", "paid", "collected", "paid", "shipped", "paid", "paid", "ready"];
  const orders = [], items = []; let n = 0;
  perDay.forEach((count, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (29 - i));
    for (let k = 0; k < count; k++) {
      const id = "demo-" + (++n);
      const hr = 9 + ((n * 3) % 9); const dd = new Date(d); dd.setHours(hr, (n * 7) % 60, 0, 0);
      const fulfillment = fulfills[n % fulfills.length];
      const status = statuses[n % statuses.length];
      const basket = baskets[n % baskets.length];
      let total = 0;
      basket.forEach((ci) => {
        const p = cat[ci]; const qty = (n + ci) % 5 === 0 ? 2 : 1;
        total += p.price_cents * qty;
        items.push({ order_id: id, title: p.title, qty, price_cents: p.price_cents });
      });
      const o = { id, total_cents: total, status, fulfillment, created_at: dd.toISOString() };
      if (fulfillment === "pickup") o.pickup_code = ["NALU", "HONU", "REEF", "TIDE", "SURF", "PALM", "WAVE", "SAND"][n % 8];
      if (fulfillment === "ship" && status === "shipped") o.tracking = "1Z" + String(900000 + n);
      orders.push(o);
    }
  });
  orders.push({ id: "demo-0", total_cents: 3400, status: "pending", fulfillment: "pickup", pickup_code: "LIMU", created_at: today.toISOString() });
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
  const products = cat.map((p) => ({ ...p }));
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
  // An owner can legitimately hold MORE THAN ONE partner row — claim_my_partner adopts
  // EVERY unowned row matching the verified email (a free draft plus a later paid signup,
  // a re-submitted form, two locations). maybeSingle() THROWS on >1 row (PGRST116), which
  // blanked the portal for exactly the people who had paid — they could never reach the
  // Connect Square button. Read all rows and pick: a live one first, newest first.
  const { data, error } = await sb.from("partners").select("*")
    .eq("owner", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  return rows.find((r) => r.status === "live") || rows[0] || null;
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

// ── first-open guided tour ───────────────────────────────────────────────────
// Ported from operator-console.html's tour engine, restyled light (portal.css).
// Pages call osPortalTour({ key, steps, button, auto, delay }):
//   key    localStorage flag — set when the tour finishes (or is skipped)
//   steps  [{ center:true, title, body } or { sel:"#id", title, body }]
//   button optional element that replays the tour on click
//   auto   run once automatically when the key isn't set yet
// Stops whose target is missing or hidden are dropped when the tour starts, so
// a partial page (say, Square not connected yet) never shows a dead stop — and
// if NO target is visible the tour doesn't run and the key is NOT consumed.
function osPortalTour(opts) {
  const root = document.createElement("div");
  root.className = "os-tour";
  root.innerHTML =
    '<div class="tor-block"></div><div class="tor-hi off"></div>' +
    '<div class="tor-card"><div class="tc-top"><span class="tc-step"></span><button type="button" class="tc-skip">Skip tour</button></div>' +
    "<h4></h4><p></p>" +
    '<div class="tc-foot"><span class="tor-dots"></span><button type="button" class="tor-btn tc-back">Back</button><button type="button" class="tor-btn primary tc-next">Next</button></div></div>';
  document.body.appendChild(root);
  const hi = $(".tor-hi", root), card = $(".tor-card", root),
    stepEl = $(".tc-step", root), titleEl = $("h4", card), bodyEl = $("p", card),
    dotsEl = $(".tor-dots", root), backBtn = $(".tc-back", root),
    nextBtn = $(".tc-next", root), skipBtn = $(".tc-skip", root);

  let STEPS = [], idx = -1, curEl = null, active = false;
  const shown = (n) => !!(n && n.getClientRects().length && getComputedStyle(n).visibility !== "hidden");

  function position() {
    if (!active || !curEl) return;
    const r = curEl.getBoundingClientRect(), pad = 9;
    hi.style.top = r.top - pad + "px"; hi.style.left = r.left - pad + "px";
    hi.style.width = r.width + pad * 2 + "px"; hi.style.height = r.height + pad * 2 + "px";
    const ch = card.offsetHeight, cw = card.offsetWidth, vw = innerWidth, vh = innerHeight;
    const top = r.bottom + pad + 14 + ch < vh ? r.bottom + pad + 14 : Math.max(12, r.top - pad - 14 - ch);
    const left = Math.min(Math.max(12, r.left), vw - cw - 12);
    card.style.top = top + "px"; card.style.left = left + "px";
  }
  function setStep(i) {
    idx = i; const s = STEPS[i];
    stepEl.textContent = "Step " + (i + 1) + " of " + STEPS.length;
    titleEl.innerHTML = s.title; bodyEl.innerHTML = s.body;
    $$("i", dotsEl).forEach((d, j) => { d.className = j === i ? "on" : ""; });
    backBtn.style.display = i === 0 ? "none" : "";
    nextBtn.textContent = STEPS.length === 1 ? "Got it" : i === STEPS.length - 1 ? "Finish" : i === 0 ? "Start the tour" : "Next";
    if (s.center) {
      // "tc-center", not "center" — portal.css already uses .center as a
      // full-viewport flex utility, which would stretch the card to 100vh.
      curEl = null; card.classList.add("tc-center"); hi.classList.add("off");
      card.style.top = ""; card.style.left = "";
      return;
    }
    card.classList.remove("tc-center");
    curEl = document.querySelector(s.sel);
    // belt-and-suspenders: a target that vanished mid-tour skips forward
    if (!shown(curEl)) { if (i < STEPS.length - 1) setStep(i + 1); else end(true); return; }
    hi.classList.remove("off");
    curEl.scrollIntoView({ block: "center" });
    position();
    setTimeout(position, 250);
  }
  function start() {
    STEPS = opts.steps.filter((s) => s.center || shown(document.querySelector(s.sel)));
    if (!STEPS.some((s) => !s.center)) return; // nothing to point at — don't run, don't consume the key
    dotsEl.innerHTML = STEPS.length === 1 ? "" : STEPS.map(() => "<i></i>").join("");
    $(".tc-top", card).style.display = STEPS.length === 1 ? "none" : "";
    active = true; root.classList.add("on"); setStep(0);
  }
  function end(markDone) {
    active = false; root.classList.remove("on"); curEl = null; hi.classList.add("off");
    if (markDone) { try { localStorage.setItem(opts.key, "1"); } catch (_) {} }
  }
  nextBtn.addEventListener("click", () => { if (idx >= STEPS.length - 1) end(true); else setStep(idx + 1); });
  backBtn.addEventListener("click", () => { if (idx > 0) setStep(idx - 1); });
  skipBtn.addEventListener("click", () => end(true));
  document.addEventListener("keydown", (e) => { if (active && e.key === "Escape") end(true); });
  let raf = false;
  const onMove = () => { if (raf) return; raf = true; requestAnimationFrame(() => { raf = false; position(); }); };
  addEventListener("scroll", onMove, true); addEventListener("resize", onMove);
  if (opts.button) opts.button.addEventListener("click", (e) => { e.preventDefault(); start(); });
  let done = null;
  try { done = localStorage.getItem(opts.key); } catch (_) {}
  if (opts.auto && !done && !EMBED) setTimeout(start, opts.delay || 700);
}
