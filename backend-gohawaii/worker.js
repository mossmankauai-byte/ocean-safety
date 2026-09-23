// GoHawaii backend: shared staff posts and place changes, and visitor totals, for the GoHawaii
// Dashboard and the GoHawaii link of the OceanSafety app. Cloudflare Worker + D1 (schema.sql).
//
// Routes
//   POST /gh/e                 visitor totals from the app (no id, no IP, nothing per person)
//   GET  /gh/public            what visitors see: live posts and every island's place changes
//   GET  /gh/me                staff: who this key belongs to
//   GET  /gh/doc/:name         staff: a document with its version
//   PUT  /gh/doc/:name         staff: replace a document ({ ver, body }); 409 if someone saved first
//   GET  /gh/stats?days=30     staff: totals per island per day, plus top lists
//   GET  /gh/audit             staff: the server's own record of who saved what
//   POST /gh/admin/staff       admin (Bearer ADMIN_KEY): add or turn off a staff key
//
// Staff sign in with a key issued per person. The server keeps only its SHA-256, and fills every
// "who" from the key, never from what the page sends. County staff change only their own island.
// A red advisory goes live only when an Approver who did not write it approves it.

const ISLANDS = ['kauai', 'oahu', 'maui', 'hawaii'];
const ORGS = ['state'].concat(ISLANDS);
const METRICS = new Set(['visit', 'tab', 'beach', 'place', 'link', 'adv', 'lang', 'dev', 'hour']);
const DOCS = new Set(['notices'].concat(ISLANDS.map((i) => 'places:' + i)));
const DOC_MAX = 900 * 1024;

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
});
function json(obj, status, origin, extra) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, cors(origin), extra || {}) });
}
// Hawaiʻi has no daylight saving: its calendar day is UTC minus ten hours.
function hstDay(t) { return new Date((t == null ? Date.now() : t) - 10 * 3600e3).toISOString().slice(0, 10); }
function nowIso() { return new Date().toISOString(); }
function clean(s, n) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9_:.-]/g, '').slice(0, n || 64); }
async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function staffOrigin(req, env) {
  const o = req.headers.get('Origin') || '';
  const ok = String(env.STAFF_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ok.indexOf(o) >= 0 ? o : '';
}
async function staffFor(req, env) {
  const a = req.headers.get('Authorization') || '';
  const key = a.startsWith('Bearer ') ? a.slice(7).trim() : '';
  if (key.length < 20) return null;
  const row = await env.DB.prepare('SELECT name, role, org FROM staff WHERE key_hash = ? AND active = 1').bind(await sha256(key)).first();
  return row || null;
}
function orgLabel(org) {
  return { state: 'State of Hawaiʻi', kauai: 'County of Kauaʻi', oahu: 'City and County of Honolulu', maui: 'County of Maui', hawaii: 'County of Hawaiʻi' }[org] || org;
}

// ---- visitor totals ----
// Body: { island, rows: [[metric, key, n], ...] }. The app adds up a visit before it sends, so one
// visit is a handful of upserts. Totals only: the server never sees who sent them.
async function ingest(req, env) {
  let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad_json' }, 400); }
  const island = clean(b && b.island, 12);
  if (ISLANDS.indexOf(island) < 0) return json({ error: 'bad_island' }, 400);
  const rows = Array.isArray(b.rows) ? b.rows.slice(0, 60) : [];
  const day = hstDay();
  const stmts = [];
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const m = clean(r[0], 8), k = clean(r[1], 64), n = Math.max(1, Math.min(50, parseInt(r[2], 10) || 1));
    if (!METRICS.has(m)) continue;
    stmts.push(env.DB.prepare('INSERT INTO counts (day, island, metric, k, n) VALUES (?, ?, ?, ?, ?) ON CONFLICT(day, island, metric, k) DO UPDATE SET n = n + excluded.n').bind(day, island, m, k, n));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, n: stmts.length }, 200);
}

// ---- documents ----
async function readDoc(env, name) {
  const row = await env.DB.prepare('SELECT body, ver, updated_at, updated_by FROM docs WHERE name = ?').bind(name).first();
  if (!row) return { body: name === 'notices' ? { items: [], hta: {}, log: [] } : { edits: {}, hidden: {}, added: [] }, ver: 0, updated_at: null, updated_by: null };
  let body; try { body = JSON.parse(row.body); } catch (e) { body = {}; }
  return { body, ver: row.ver, updated_at: row.updated_at, updated_by: row.updated_by };
}

// What visitors may see: never a draft or a post waiting for approval, never the staff log.
async function publicRead(req, env) {
  const cache = caches.default, ck = new Request(new URL('/gh/public', req.url).toString());
  const hit = await cache.match(ck);
  if (hit) return hit;
  const n = await readDoc(env, 'notices');
  const items = (n.body.items || []).filter((it) => it && it.status !== 'draft' && it.status !== 'pending' && it.status !== 'rejected')
    .map((it) => { const c = Object.assign({}, it); delete c.by; delete c.approvedBy; return c; });
  const places = {};
  for (const i of ISLANDS) places[i] = (await readDoc(env, 'places:' + i)).body;
  const res = json({ items, hta: n.body.hta || {}, places, at: nowIso() }, 200, '*', { 'Cache-Control': 'public, max-age=30' });
  await cache.put(ck, res.clone());
  return res;
}
async function purgePublic(req) { try { await caches.default.delete(new Request(new URL('/gh/public', req.url).toString())); } catch (e) {} }

// Rules a save must keep, checked against the saved version, with "who" filled from the key.
function vetNotices(prev, next, me) {
  const old = {}; (prev.items || []).forEach((it) => { if (it && it.id) old[it.id] = it; });
  const out = [];
  for (const it of (next.items || [])) {
    if (!it || typeof it.id !== 'string') continue;
    const was = old[it.id];
    if (was && JSON.stringify(was) === JSON.stringify(it)) { out.push(it); continue; }
    const isl = Array.isArray(it.islands) ? it.islands : [];
    if (me.org !== 'state' && (isl.length !== 1 || isl[0] !== me.org)) return { error: 'county_island', id: it.id };
    const c = Object.assign({}, it);
    if (!was) { c.by = me.name; c.created = c.created || nowIso(); }
    else { c.by = was.by; c.created = was.created; if (was.approvedBy) c.approvedBy = was.approvedBy; }
    const wasLive = was && was.status === 'live';
    if (c.level === 'red' && c.status === 'live' && !wasLive) {
      if (me.role !== 'Approver') return { error: 'red_needs_approver', id: it.id };
      if (c.by === me.name) return { error: 'red_needs_second_person', id: it.id };
      c.approvedBy = me.name;
    }
    out.push(c);
  }
  // A post this person may not touch cannot disappear either.
  if (me.org !== 'state') {
    const kept = {}; out.forEach((x) => { kept[x.id] = 1; });
    for (const id in old) {
      const isl = old[id].islands || [];
      if (!kept[id] && !(isl.length === 1 && isl[0] === me.org)) return { error: 'county_island', id };
    }
  }
  // The saved log is kept as it was; entries this save adds are stamped with the signed-in name.
  const sig = (l) => [l && l.at, l && l.what, l && l.id].join('|');
  const had = {}; (prev.log || []).forEach((l) => { had[sig(l)] = 1; });
  const added = (next.log || []).filter((l) => l && !had[sig(l)]).slice(-50).map((l) => ({ at: String(l.at || nowIso()).slice(0, 30), who: me.name, what: String(l.what || '').slice(0, 60), id: String(l.id || '').slice(0, 64), title: String(l.title || '').slice(0, 120) }));
  const log = (prev.log || []).concat(added).slice(-300);
  return { body: { items: out, hta: next.hta || prev.hta || {}, log } };
}
function vetPlaces(next, isl) {
  const b = { edits: {}, hidden: {}, added: [] };
  const e = next && next.edits && typeof next.edits === 'object' ? next.edits : {};
  for (const id in e) if (/^gh_/.test(id)) b.edits[id] = e[id];
  const h = next && next.hidden && typeof next.hidden === 'object' ? next.hidden : {};
  for (const id in h) if (/^gh_/.test(id)) b.hidden[id] = h[id];
  b.added = (Array.isArray(next && next.added) ? next.added : []).filter((r) => r && /^gh_staff_/.test(r.id) && r.name && isFinite(+r.lat) && isFinite(+r.lon));
  for (const r of b.added) for (const f of ['website', 'img']) if (r[f] && !/^https:\/\//.test(r[f])) r[f] = '';
  return b;
}
async function putDoc(req, env, name, me, origin) {
  if (!DOCS.has(name)) return json({ error: 'no_such_doc' }, 404, origin);
  const isl = name.indexOf('places:') === 0 ? name.slice(7) : '';
  if (isl && me.org !== 'state' && me.org !== isl) return json({ error: 'county_island' }, 403, origin);
  const raw = await req.text();
  if (raw.length > DOC_MAX) return json({ error: 'too_large' }, 413, origin);
  let b; try { b = JSON.parse(raw); } catch (e) { return json({ error: 'bad_json' }, 400, origin); }
  const cur = await readDoc(env, name);
  if ((+b.ver || 0) !== cur.ver) return json({ error: 'conflict', ver: cur.ver, body: cur.body, updated_by: cur.updated_by }, 409, origin);
  let body;
  if (name === 'notices') { const v = vetNotices(cur.body, b.body || {}, me); if (v.error) return json(v, 403, origin); body = v.body; }
  else body = vetPlaces(b.body || {}, isl);
  const ver = cur.ver + 1, at = nowIso();
  // The version check rides inside the write, so two saves in the same instant cannot both win.
  const r = await env.DB.prepare('INSERT INTO docs (name, body, ver, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET body = excluded.body, ver = excluded.ver, updated_at = excluded.updated_at, updated_by = excluded.updated_by WHERE docs.ver = ?')
    .bind(name, JSON.stringify(body), ver, at, me.name, cur.ver).run();
  if (!r.meta || !r.meta.changes) { const now = await readDoc(env, name); return json({ error: 'conflict', ver: now.ver, body: now.body }, 409, origin); }
  await env.DB.prepare('INSERT INTO audit (at, who, org, what, doc, ref) VALUES (?, ?, ?, ?, ?, ?)').bind(at, me.name, me.org, 'saved', name, String(b.note || '').slice(0, 120)).run();
  await purgePublic(req);
  return json({ ok: true, ver, body }, 200, origin);
}

// ---- totals for the Dashboard ----
async function stats(req, env, origin) {
  const u = new URL(req.url);
  const days = Math.max(1, Math.min(400, parseInt(u.searchParams.get('days'), 10) || 30));
  const from = hstDay(Date.now() - (days - 1) * 864e5);
  const [perDay, top] = await Promise.all([
    env.DB.prepare("SELECT day, island, n FROM counts WHERE metric = 'visit' AND day >= ? ORDER BY day").bind(from).all(),
    env.DB.prepare("SELECT island, metric, k, SUM(n) AS n FROM counts WHERE metric != 'visit' AND day >= ? GROUP BY island, metric, k ORDER BY n DESC LIMIT 2000").bind(from).all(),
  ]);
  return json({ from, to: hstDay(), days, visits: perDay.results || [], top: top.results || [], at: nowIso() }, 200, origin);
}

async function admin(req, env) {
  const a = req.headers.get('Authorization') || '';
  if (!env.ADMIN_KEY || a !== 'Bearer ' + env.ADMIN_KEY) return json({ error: 'forbidden' }, 403);
  let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad_json' }, 400); }
  if (b.off) { await env.DB.prepare('UPDATE staff SET active = 0 WHERE key_hash = ?').bind(await sha256(String(b.off))).run(); return json({ ok: true }); }
  const name = String(b.name || '').trim().slice(0, 60), role = b.role === 'Approver' ? 'Approver' : 'Editor', org = clean(b.org, 8);
  if (!name || ORGS.indexOf(org) < 0) return json({ error: 'need_name_and_org' }, 400);
  const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
  const key = 'gh_' + [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('INSERT INTO staff (key_hash, name, role, org, created) VALUES (?, ?, ?, ?, ?)').bind(await sha256(key), name, role, org, nowIso()).run();
  // The key is shown once, here. Only its hash is stored.
  return json({ ok: true, name, role, org: orgLabel(org), key });
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url), p = u.pathname, so = staffOrigin(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(p === '/gh/e' || p === '/gh/public' ? '*' : so) });
    try {
      if (p === '/gh/e' && req.method === 'POST') return await ingest(req, env);
      if (p === '/gh/public' && req.method === 'GET') return await publicRead(req, env);
      if (p === '/gh/admin/staff' && req.method === 'POST') return await admin(req, env);
      if (p.indexOf('/gh/') === 0) {
        if (!so) return json({ error: 'origin' }, 403);
        const me = await staffFor(req, env);
        if (!me) return json({ error: 'sign_in' }, 401, so);
        if (p === '/gh/me') return json({ name: me.name, role: me.role, org: me.org, orgLabel: orgLabel(me.org) }, 200, so);
        if (p === '/gh/stats') return await stats(req, env, so);
        if (p === '/gh/audit') return json({ rows: (await env.DB.prepare('SELECT at, who, org, what, doc, ref FROM audit ORDER BY id DESC LIMIT 300').all()).results || [] }, 200, so);
        const dm = p.match(/^\/gh\/doc\/([a-z:]+)$/);
        if (dm && req.method === 'GET') { if (!DOCS.has(dm[1])) return json({ error: 'no_such_doc' }, 404, so); return json(await readDoc(env, dm[1]), 200, so); }
        if (dm && req.method === 'PUT') return await putDoc(req, env, dm[1], me, so);
      }
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500, so || '*');
    }
  },
};
