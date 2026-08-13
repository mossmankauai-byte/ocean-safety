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
  status: "live", stripe_charges_enabled: true, stripe_payouts_enabled: true, stripe_onboarded_at: "2026-06-01", amazon_tag: "oceansafety-20", fulfillment_mode: "both" };

// ── plan gate: Free vs Paid ──────────────────────────────────────────────────
// Canonical RETAIL SHOP model (Nick, 2026-07-24): Free tier, revenue split on
// tour commissions only. Paid tier is FLAT — covers BOTH the shop (products)
// and rentals, shop keeps 100% of store sales AND 100% of tour commissions,
// and unlocks visitor analytics + promotions.
// So analytics and promotions are PAID-ONLY — on Free they render locked, never
// as data. Demo/sales calls can flip with ?plan=paid to show a prospect both.
const PLAN_PAID_PRICE = "Pricing on request";
// RETAIL BUILD (Nick, 2026-08-11): a free retail shop gets the REAL console, not a
// locked shell — products, inventory, sales, promotions all open. Per-feature gating
// comes later, so nothing here renders locked. What varies by partner is the PLAN LINE
// they read, and that comes from their own row (see planLabel), never from a hardcode:
// asserting a plan the partner row doesn't hold is what put a wrong-price claim in front of
// a shop that was never billed.
window.OCEANSAFE_PLAN = "open";
window.isPaid = function () { return true; };
// FEATURE ACCESS (isPaid) and BILLING TRUTH are two different questions on this build —
// everything is unlocked, but only a row with monthly_cents > 0 is actually being billed.
// Any sentence a shop reads about money must ask billedPaid, never isPaid.
window.billedPaid = function (p) { return !!(p && p.monthly_cents > 0); };
window.planChipHTML = function (p) {
  const paid = window.billedPaid(p);
  return `<span class="planchip ${paid ? "paid" : "free"}">${paid ? "Paid plan" : "Free plan"}</span>`;
};
// The one sentence a shop reads about what they're on. Derived from their row:
//   free_until in the future → free through that date · monthly_cents > 0 → paid · else free.
window.planLabel = function (p) {
  if (!p) return "";
  const until = p.free_until ? new Date(p.free_until) : null;
  if (until && until > new Date()) {
    // timeZone: UTC — free_until is stored as UTC midnight; formatting it in HST renders
    // the day BEFORE, so a shop granted a year would read a date one day short.
    const d = until.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
    return `Your shop console is free through <b>${d}</b> — the full console, nothing locked. We'll reach out before then; no card on file and nothing renews on its own.`;
  }
  if (p.monthly_cents > 0) return `You're on the <b>Paid plan — ${PLAN_PAID_PRICE}</b> (shop + rentals), billed monthly, cancel any time.`;
  return "Your shop console is free — the full console, nothing locked. No card on file and nothing renews on its own.";
};
// Store take: Free = 100% (store fee unruled for retail Free, so no fee is claimed
// or taken here) · Paid = 100% flat regardless. Only tour commissions split on Free.
window.payoutRate = function () { return 1; };
window.payoutPct  = function () { return "100%"; };
window.feePct     = function () { return window.isPaid() ? "0%" : "0%"; };
// Renders in place of a Paid-only panel when the shop is on Free.
window.lockedPanel = function (what, why) {
  return `<div class="lockwrap">
    <div class="lockico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
    <div class="lockt">${what} — part of the Paid plan</div>
    <div class="locks">${why} Your storefront, orders, inventory and payouts stay free — this is the part that comes with the ${PLAN_PAID_PRICE} plan.</div>
    <div class="lockn">Paid partners are set up by hand — reach out and we'll turn this on for you.</div>
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
  // Carry embed across the auth bounce: without it the sign-in card lands un-embedded
  // inside the console's frame and renders in a 100vh well of dead space.
  if (!session) { location.replace("index.html" + (EMBED ? "?embed=1" : "")); throw new Error("not authed"); }
  return session;
}
async function signOut() { await sb.auth.signOut(); location.replace("index.html"); }

// ── data ─────────────────────────────────────────────────────────────────────
// The logged-in owner's shop row (null until they finish get-started).
async function getMyPartner(userId) {
  if (DEMO) { const demo = { ...DEMO_PARTNER }; mountBrandBadge(demo); return demo; }
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
  const row = rows.find((r) => r.status === "live") || rows[0] || null;
  // The header brand icon is mounted from here, not from six copies of the same
  // snippet: every portal page calls getMyPartner immediately after requireAuth.
  mountBrandBadge(row);
  return row;
}

// ── brand icon in the header ─────────────────────────────────────────────────
// Nick, 2026-08-13: "Brand wont be a tab it will be a clickable icon on header
// where they will input info." The icon sits beside the OceanSafe mark and opens
// a modal for their own icon, their brand color, and their basic business info.
//
// Two different write rails, on purpose:
//   logo   -> the partner-logo Edge Function, the same one behind d.html. It is
//             the only thing that validates the file server-side (size, type,
//             magic numbers) and refuses SVG, which matters because the bucket is
//             public and an SVG is an executable document. Its one credential is
//             the row's dashboard_token. Verified 2026-08-13 against the live
//             project: a signed-in owner's select DOES return dashboard_token, so
//             the upload is offered unconditionally. If the call fails it reports
//             the function's own error, which is the honest failure state.
//   color + business info -> a direct partners UPDATE as the owner, the same rail
//             dashboard.html already uses for store_mode and status. The update
//             asks for the changed row back and only reports "saved" when a row
//             actually comes back, so a policy that silently matches nothing can
//             never read as success.
const BRAND_MARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9.5" r="1.6"/><path d="M20 15l-4.5-4.5L7 19"/></svg>';

function mountBrandBadge(partner) {
  if (!partner) return;
  const bar = document.querySelector(".bar");
  if (!bar || document.getElementById("brandBtn")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "brandBtn";
  btn.className = "brandbtn";
  btn.title = "Your brand";
  btn.setAttribute("aria-label", "Your brand and business info");
  const nav = bar.querySelector(".nav");
  if (nav) bar.insertBefore(btn, nav); else bar.appendChild(btn);
  paintBrandBadge(partner.logo_url);
  btn.addEventListener("click", () => openBrandModal(partner));
}

function paintBrandBadge(url) {
  const btn = document.getElementById("brandBtn");
  if (!btn) return;
  if (url) {
    btn.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "Your logo";
    img.src = url;
    btn.appendChild(img);
  } else {
    btn.innerHTML = BRAND_MARK;
  }
}

function openBrandModal(partner) {
  let scrim = document.getElementById("brandModal");
  if (scrim) { scrim.classList.add("on"); return; }

  scrim = document.createElement("div");
  scrim.id = "brandModal";
  scrim.className = "osb-scrim on";
  scrim.innerHTML =
    '<div class="osb-card" role="dialog" aria-modal="true" aria-label="Your brand">' +
      '<div class="osb-top"><h2>Your brand</h2><button type="button" class="osb-x" id="osbClose" aria-label="Close">&times;</button></div>' +
      '<p class="muted small" style="margin:0">Your icon, your color, and the details guests see. Your color is what your printable assets and your guest page are built with. Your icon shows on your guest page, and on your shop card in the app.</p>' +

      '<label class="f">Your icon</label>' +
      '<div class="osb-logorow">' +
        '<div class="osb-prev" id="osbPrev" aria-live="polite">No icon yet</div>' +
        '<div><input id="osbFile" type="file" accept="image/png,image/jpeg">' +
        '<div class="hint">PNG or JPG, under 2 MB. Square reads best.</div></div>' +
      '</div>' +
      '<div class="osb-foot" style="margin-top:10px">' +
        '<button type="button" class="btn primary" id="osbLogoSave">Upload icon</button>' +
        '<button type="button" class="btn ghost sm" id="osbLogoClear" style="display:none">Remove</button>' +
      '</div>' +
      '<div id="osbLogoMsg" class="hint"></div>' +

      '<label class="f" for="osbHex">Your brand color</label>' +
      '<div class="osb-hexrow"><input type="color" id="osbHexPick" aria-label="Pick your brand color">' +
        '<input type="text" id="osbHex" maxlength="7" spellcheck="false" placeholder="#0a8ba8"></div>' +

      '<label class="f" for="osbName">Business name</label><input type="text" id="osbName">' +
      '<div class="row2">' +
        '<div><label class="f" for="osbPhone">Phone</label><input type="tel" id="osbPhone"></div>' +
        '<div><label class="f" for="osbWebsite">Website</label><input type="url" id="osbWebsite" placeholder="https://"></div>' +
      '</div>' +
      '<label class="f" for="osbRegion">Town or area</label><input type="text" id="osbRegion">' +
      '<label class="f" for="osbAddress">Address</label><input type="text" id="osbAddress">' +

      '<div id="osbMsg"></div>' +
      '<div class="osb-foot">' +
        '<button type="button" class="btn primary" id="osbSave">Save</button>' +
        '<button type="button" class="btn ghost" id="osbCancel">Close</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(scrim);

  const close = () => scrim.classList.remove("on");
  el("osbClose").addEventListener("click", close);
  el("osbCancel").addEventListener("click", close);
  scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // ── fields ──
  const hex = "#" + String(partner.primary_hex || "0a8ba8").replace(/^#/, "");
  el("osbHex").value = hex;
  el("osbHexPick").value = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#0a8ba8";
  el("osbHexPick").addEventListener("input", () => { el("osbHex").value = el("osbHexPick").value; });
  el("osbName").value = partner.name || "";
  el("osbPhone").value = partner.phone || "";
  el("osbWebsite").value = partner.website || "";
  el("osbRegion").value = partner.region || "";
  el("osbAddress").value = partner.address || "";

  // ── logo ──
  const prev = el("osbPrev"), logoMsg = el("osbLogoMsg"),
        saveLogo = el("osbLogoSave"), clearLogo = el("osbLogoClear");
  const sayLogo = (t, cls) => { logoMsg.textContent = t || ""; logoMsg.className = cls ? "msg " + cls : "hint"; };
  function paintPrev(url) {
    if (url) {
      prev.innerHTML = "";
      const img = document.createElement("img"); img.alt = "Your icon"; img.src = url;
      prev.appendChild(img);
      clearLogo.style.display = "";
    } else {
      prev.textContent = "No icon yet";
      clearLogo.style.display = "none";
    }
    paintBrandBadge(url || null);
  }
  paintPrev(partner.logo_url || null);

  const token = partner.dashboard_token;
  const logoCall = (body) =>
    fetch(`${CFG.FUNCTIONS_BASE}/partner-logo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ token }, body)),
    }).then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || "Something went wrong."); return j; }));

  if (window.OCEANSAFE_DEMO) {
    // The demo shop has no row to write to. Say so rather than fake a save.
    el("osbFile").disabled = true;
    saveLogo.disabled = true;
    sayLogo("Icon upload is off in the demo. On a real shop this saves your icon for real.", "info");
  } else {
    saveLogo.addEventListener("click", () => {
      const f = el("osbFile").files && el("osbFile").files[0];
      if (!f) return sayLogo("Choose a PNG or JPG first.", "err");
      // Checked here for a fast, friendly message. Re-checked server-side regardless.
      if (f.size > 2 * 1024 * 1024) return sayLogo("That icon is " + (f.size / 1048576).toFixed(1) + " MB. Please keep it under 2 MB.", "err");
      saveLogo.disabled = true; sayLogo("Uploading…");
      const fr = new FileReader();
      fr.onerror = () => { saveLogo.disabled = false; sayLogo("Could not read that file. Try again.", "err"); };
      fr.onload = () => {
        logoCall({ action: "set", dataUrl: String(fr.result) })
          .then((j) => { partner.logo_url = j.logo_url; paintPrev(j.logo_url); el("osbFile").value = ""; sayLogo("Icon saved. It is on your guest page now.", "ok"); })
          .catch((e) => sayLogo(e.message, "err"))
          .then(() => { saveLogo.disabled = false; });
      };
      fr.readAsDataURL(f);
    });
    clearLogo.addEventListener("click", () => {
      clearLogo.disabled = true; sayLogo("Removing…");
      logoCall({ action: "clear" })
        .then(() => { partner.logo_url = null; paintPrev(null); sayLogo("Icon removed.", "ok"); })
        .catch((e) => sayLogo(e.message, "err"))
        .then(() => { clearLogo.disabled = false; });
    });
  }

  // ── color + business info ──
  el("osbSave").addEventListener("click", async () => {
    const msg = el("osbMsg"), btn = el("osbSave");
    const raw = el("osbHex").value.trim();
    if (raw && !/^#?[0-9a-fA-F]{6}$/.test(raw)) return toast(msg, "err", "That color needs to be six hex digits, like #0a8ba8.");
    const patch = {
      primary_hex: raw.replace(/^#/, "").toLowerCase(),
      name: el("osbName").value.trim(),
      phone: el("osbPhone").value.trim() || null,
      website: el("osbWebsite").value.trim() || null,
      region: el("osbRegion").value.trim() || null,
      address: el("osbAddress").value.trim() || null,
    };
    if (!patch.name) return toast(msg, "err", "Your business name cannot be empty.");
    btn.disabled = true; toast(msg, "info", "Saving…");
    if (window.OCEANSAFE_DEMO) {
      Object.assign(partner, patch);
      btn.disabled = false;
      toast(msg, "info", "Demo shop, so nothing is written. On a real shop this saves to your row.");
      return;
    }
    const { data, error } = await sb.from("partners").update(patch).eq("id", partner.id).select("id");
    btn.disabled = false;
    // No row back means the update matched nothing. That is a failure, not a save.
    if (error || !data || data.length === 0) {
      toast(msg, "err", error ? error.message : "That did not save. Refresh and try again.");
      return;
    }
    Object.assign(partner, patch);
    const nm = document.getElementById("shopName");
    if (nm) nm.textContent = "· " + patch.name;
    toast(msg, "ok", "Saved.");
  });
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
// Ported from hotel's tour engine, restyled light (portal.css).
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

// ── first signed-in visit: set a password, then offer a desktop icon ──────────
// The welcome email lands them on the dashboard already signed in (the token
// exchange is a separate Edge Function, not this file's job). So by the time this
// runs there is a real session. Two questions get asked once each, in order, and
// each answer is remembered per user id in localStorage.
//
// Why localStorage and not the user record: whether an account has a password is
// NOT readable from the browser. Supabase exposes no such flag. So the only thing
// we can honestly remember is that WE ASKED. Ask once, never nag.
let osDeferredInstall = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); osDeferredInstall = e; });

const osStandalone = () =>
  (matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
// iOS and iPadOS Safari never fire beforeinstallprompt, so there is nothing to call
// and an Install button there would be dead. They get the Share sheet wording instead.
const osIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const osFlag = { get(k) { try { return localStorage.getItem(k); } catch (_) { return "1"; } },
                 set(k) { try { localStorage.setItem(k, "1"); } catch (_) {} } };

// Small centred dialog, same chrome as the brand modal. Returns the card element.
function osDialog(title, innerHTML) {
  const scrim = document.createElement("div");
  scrim.className = "osb-scrim on";
  scrim.innerHTML = '<div class="osb-card" role="dialog" aria-modal="true" style="max-width:430px">'
    + '<div class="osb-top"><h2></h2></div>' + innerHTML + "</div>";
  scrim.querySelector("h2").textContent = title;
  document.body.appendChild(scrim);
  scrim.close = () => scrim.remove();
  return scrim;
}

function osAskPassword(userId) {
  return new Promise((resolve) => {
    const key = "os_pw_asked_" + userId;
    if (osFlag.get(key) || window.OCEANSAFE_DEMO || EMBED) return resolve();
    const d = osDialog("Want a password?", ''
      + '<p class="muted small" style="margin:0 0 4px">Set one now and you can sign straight in from any device. If you would rather not, nothing changes.</p>'
      + '<label class="f" for="osPw">New password</label>'
      + '<input id="osPw" type="password" autocomplete="new-password" placeholder="At least 6 characters">'
      + '<div id="osPwMsg"></div>'
      + '<div class="osb-foot"><button type="button" class="btn primary" id="osPwSave">Set my password</button>'
      + '<button type="button" class="btn ghost" id="osPwSkip">No thanks</button></div>');
    const done = () => { osFlag.set(key); d.close(); resolve(); };
    d.querySelector("#osPwSkip").addEventListener("click", done);
    d.querySelector("#osPwSave").addEventListener("click", async () => {
      const btn = d.querySelector("#osPwSave"), msg = d.querySelector("#osPwMsg");
      const pw = d.querySelector("#osPw").value;
      if (!pw) return toast(msg, "err", "Type a password first.");
      btn.disabled = true; toast(msg, "info", "Saving…");
      const { error } = await sb.auth.updateUser({ password: pw });
      btn.disabled = false;
      // Supabase enforces its own minimum length and strength. Show what it said,
      // word for word, or the operator cannot tell what to fix.
      if (error) return toast(msg, "err", error.message);
      toast(msg, "ok", "Password set. You can sign in with it from now on.");
      setTimeout(done, 1200);
    });
  });
}

function osAskInstall(userId) {
  const key = "os_install_asked_" + userId;
  if (osFlag.get(key) || window.OCEANSAFE_DEMO || EMBED || osStandalone()) return;
  const ios = osIOS();
  if (!osDeferredInstall && !ios) return;   // no real install path here, so no dead button
  const d = osDialog("Put this on your desktop", ''
    + '<p class="muted small" style="margin:0">'
    + (ios ? "Tap the Share button in Safari, then <b>Add to Home Screen</b>. Your console opens like an app, with the OceanSafe icon."
           : "Add your console to your desktop and it opens in one tap, with the OceanSafe icon, no browser tabs to hunt through.")
    + "</p>"
    + '<div class="osb-foot">'
    + (ios ? "" : '<button type="button" class="btn primary" id="osInstall">Add to my desktop</button>')
    + '<button type="button" class="btn ghost" id="osInstallSkip">' + (ios ? "Got it" : "Skip") + "</button></div>");
  const close = () => { osFlag.set(key); d.close(); };
  d.querySelector("#osInstallSkip").addEventListener("click", close);
  const go = d.querySelector("#osInstall");
  if (go) go.addEventListener("click", async () => {
    go.disabled = true;
    try { await osDeferredInstall.prompt(); } catch (_) {}
    osDeferredInstall = null;
    close();
  });
}

// Call once, from the dashboard, after the partner row is in hand.
async function osFirstVisit(session, partner) {
  const uid = (session && session.user && session.user.id) || (partner && partner.id);
  if (!uid) return;
  await osAskPassword(uid);
  // beforeinstallprompt can land a beat after first paint, so give it a moment
  // before deciding there is no install path.
  setTimeout(() => osAskInstall(uid), 1200);
}

// ── ?t= dashboard-token sign-in ──────────────────────────────────────────────
// The welcome email lands retail operators on dashboard.html?t=<dashboard_token>.
// portal-session verifies that token, creates the auth user on demand, and mints a
// one-time hashed token without sending any email. We redeem it here for a real
// session, so they are simply signed in when the page paints. No second inbox trip.
//
// Any portal page linked with ?t= behaves the same: call this before requireAuth().
//
// The token is stripped from the URL the moment it is read, BEFORE the network call,
// not after. Everything this page loads while it is still in the address bar can leak
// it in a Referer, and a bookmark taken mid-exchange would capture a live credential.
// The value is held in a local variable, so stripping early costs nothing.
//
// verifyOtp type is "email", not "magiclink": a hashed token from generateLink
// redeems under the email OTP type.
async function osConsumeTokenLink() {
  const url = new URL(location.href);
  const token = url.searchParams.get("t");
  if (!token) return null;
  url.searchParams.delete("t");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
  if (DEMO) return null;

  const { data } = await sb.auth.getSession();
  if (data.session) return null;            // already signed in, so the token is moot

  try {
    const res = await fetch(`${CFG.FUNCTIONS_BASE}/portal-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "exchange" }),
    });
    const out = await res.json().catch(() => ({}));
    // portal-session's error strings are already written for the operator to read.
    if (!res.ok || !out.ok) throw new Error(errText(out.error) || "That link did not work. Sign in below.");
    const { error } = await sb.auth.verifyOtp({ token_hash: out.token_hash, type: "email" });
    if (error) throw new Error(error.message);
    return null;
  } catch (e) {
    // Never a blank screen: carry the sentence to the sign-in page and let
    // requireAuth() bounce there as it normally would.
    try { sessionStorage.setItem("os_signin_msg", e.message || String(e)); } catch (_) {}
    return e.message || String(e);
  }
}

// ── register the portal's own service worker ─────────────────────────────────
// Every portal page loads app.js, so registering here IS registering from every
// page that links the manifest. Two things depend on it, both covered in sw.js:
// the console stops being served stale by the root worker, and Chrome will fire
// beforeinstallprompt, without which the desktop-icon offer can never appear.
//
// isSecureContext, not a literal https check: it is true on localhost too, so the
// same code path is testable locally instead of only after a deploy.
// Relative "sw.js" resolves to /portal-shop/sw.js, which sets the scope to
// /portal-shop/ and is the whole point.
if ("serviceWorker" in navigator && window.isSecureContext) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* no worker, page still works */ });
  });
}
