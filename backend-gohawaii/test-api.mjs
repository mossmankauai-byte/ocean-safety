// Runs against `wrangler dev --local` (see README). node test-api.mjs [base]
const B = process.argv[2] || 'http://127.0.0.1:8787', ADMIN = process.env.ADMIN_KEY || 'local-admin-key-for-testing-only';
const O = 'http://127.0.0.1:4694';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const call = async (p, o = {}) => { const r = await fetch(B + p, Object.assign({}, o, { headers: Object.assign({ Origin: O, 'Content-Type': 'application/json' }, o.headers || {}) })); let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };
const as = (key) => ({ Authorization: 'Bearer ' + key });
const mk = async (name, role, org) => (await call('/gh/admin/staff', { method: 'POST', headers: { Authorization: 'Bearer ' + ADMIN }, body: JSON.stringify({ name, role, org }) })).j;
const put = (key, name, ver, body) => call('/gh/doc/' + name, { method: 'PUT', headers: as(key), body: JSON.stringify({ ver, body }) });

const tag = Date.now().toString(36);
ok((await call('/gh/admin/staff', { method: 'POST', headers: { Authorization: 'Bearer wrong' }, body: '{}' })).s === 403, 'admin route refuses a wrong key');
const ed = await mk('Kai Editor ' + tag, 'Editor', 'state'), ap = await mk('Lei Approver ' + tag, 'Approver', 'state'), co = await mk('Noa County ' + tag, 'Editor', 'kauai');
ok(ed && /^gh_[0-9a-f]{48}$/.test(ed.key), 'admin issues a staff key once');
ok((await call('/gh/me')).s === 401, 'no key: 401');
ok((await call('/gh/me', { headers: Object.assign(as(ed.key), { Origin: 'https://evil.example' }) })).s === 403, 'unknown site: 403');
const me = await call('/gh/me', { headers: as(co.key) });
ok(me.s === 200 && me.j.orgLabel === 'County of Kauaʻi' && me.j.role === 'Editor', 'me names the county: ' + JSON.stringify(me.j));

// notices: red rule
let d = (await call('/gh/doc/notices', { headers: as(ed.key) })).j;
const red = { id: 'r' + tag, kind: 'advisory', level: 'red', title: 'Test red', islands: ['kauai'], status: 'live', by: 'Someone else' };
let r = await put(ed.key, 'notices', d.ver, Object.assign({}, d.body, { items: d.body.items.concat([red]) }));
ok(r.s === 403 && r.j.error === 'red_needs_approver', 'an Editor cannot put a red live');
r = await put(ed.key, 'notices', d.ver, Object.assign({}, d.body, { items: d.body.items.concat([Object.assign({}, red, { status: 'pending' })]), log: (d.body.log || []).concat([{ at: new Date().toISOString(), who: 'Faked', what: 'Sent red for approval', id: red.id, title: 'Test red' }]) }));
ok(r.s === 200 && r.j.body.items.find((x) => x.id === red.id).by === ed.name, 'server writes who posted it from the key, not the page');
ok(r.j.body.log.slice(-1)[0].who === ed.name, 'log entry stamped with the signed-in name');
const pub1 = (await call('/gh/public')).j;
ok(!pub1.items.some((x) => x.id === red.id), 'a pending red never reaches visitors');
d = (await call('/gh/doc/notices', { headers: as(ed.key) })).j;
const live = (b) => Object.assign({}, b, { items: b.items.map((x) => x.id === red.id ? Object.assign({}, x, { status: 'live' }) : x) });
r = await put(ap.key, 'notices', d.ver - 1, live(d.body));
ok(r.s === 409 && r.j.ver === d.ver, 'a stale save gets 409 with the current version');
r = await put(ap.key, 'notices', d.ver, live(d.body));
ok(r.s === 200 && r.j.body.items.find((x) => x.id === red.id).approvedBy === ap.name, 'a second person, an Approver, puts the red live');
const pub2 = (await call('/gh/public')).j;
const pr = pub2.items.find((x) => x.id === red.id);
ok(pr && !('by' in pr) && !('approvedBy' in pr) && !pub2.log, 'visitors see the red, without staff names or the log');

// county limits
d = (await call('/gh/doc/notices', { headers: as(co.key) })).j;
r = await put(co.key, 'notices', d.ver, Object.assign({}, d.body, { items: d.body.items.concat([{ id: 'o' + tag, kind: 'advisory', level: 'info', title: 'Oʻahu note', islands: ['oahu'], status: 'live' }]) }));
ok(r.s === 403 && r.j.error === 'county_island', 'county staff cannot post for another island');
r = await put(co.key, 'notices', d.ver, Object.assign({}, d.body, { items: d.body.items.filter((x) => x.id !== red.id) }));
ok(r.s === 200, 'county staff can end a Kauaʻi-only post');
r = await put(co.key, 'places:oahu', 0, { edits: {}, hidden: {}, added: [] });
ok(r.s === 403, 'county staff cannot change another island\'s places');
d = (await call('/gh/doc/places:kauai', { headers: as(co.key) })).j;
r = await put(co.key, 'places:kauai', d.ver, { edits: { gh_100087: { hours: 'Daily' } }, hidden: { gh_100848: { at: 'x' } }, added: [{ id: 'gh_staff_' + tag, name: 'Lookout', lat: 22.15, lon: -159.64, img: 'http://insecure' }, { id: 'nope', name: 'bad' }] });
ok(r.s === 200 && r.j.body.added.length === 1 && r.j.body.added[0].img === '', 'places save keeps valid rows only, drops non-https links');
const pub3 = (await call('/gh/public')).j;
ok(pub3.places.kauai.edits.gh_100087 && pub3.places.kauai.hidden.gh_100848, 'visitors get the place changes at once (cache cleared on save)');

// counts
const before = (await call('/gh/stats?days=2', { headers: as(ed.key) })).j;
const v0 = (before.visits.find((x) => x.island === 'maui' && x.day === before.to) || { n: 0 }).n;
for (let i = 0; i < 3; i++) await call('/gh/e', { method: 'POST', headers: { Origin: 'https://anywhere.example' }, body: JSON.stringify({ island: 'maui', rows: [['visit', '', 1], ['beach', 'hookipa', 2], ['tab', 'beaches', 1], ['bogus', 'x', 1], ['lang', 'ja', 1]] }) });
ok((await call('/gh/e', { method: 'POST', body: JSON.stringify({ island: 'lanai', rows: [['visit', '', 1]] }) })).s === 400, 'counts for an island we do not cover are refused');
const st = (await call('/gh/stats?days=2', { headers: as(ed.key) })).j;
const v1 = (st.visits.find((x) => x.island === 'maui' && x.day === st.to) || { n: 0 }).n;
ok(v1 - v0 === 3, 'three visits counted on Maui today (Hawaiʻi day ' + st.to + ')');
ok(st.top.some((x) => x.island === 'maui' && x.metric === 'beach' && x.k === 'hookipa' && x.n >= 6), 'beach opens summed');
ok(!st.top.some((x) => x.metric === 'bogus'), 'unknown kinds of count are dropped');
ok((await call('/gh/stats')).s === 401, 'totals need a staff key');
const au = (await call('/gh/audit', { headers: as(ap.key) })).j;
ok(au.rows.some((x) => x.who === co.name && x.doc === 'places:kauai'), 'server audit names who saved places');
// allowlists, preflight, rate limit
const w0 = (await call('/gh/stats?days=1', { headers: as(ed.key) })).j;
await call('/gh/e', { method: 'POST', body: JSON.stringify({ island: 'oahu', rows: [['tab', 'free money', 1], ['lang', 'english', 1], ['dev', 'toaster', 1], ['link', 'evil.example', 1], ['place', 'nope', 1], ['hour', '25', 1], ['tab', 'beaches', 999]] }) });
const w1 = (await call('/gh/stats?days=1', { headers: as(ed.key) })).j;
const oTop = (j) => j.top.filter((x) => x.island === 'oahu');
ok(!oTop(w1).some((x) => /free|english|toaster|evil|nope|^25$/.test(x.k)), 'made-up words and values never reach the lists');
const tb = (j) => (oTop(j).find((x) => x.metric === 'tab' && x.k === 'beaches') || { n: 0 }).n;
ok(tb(w1) - tb(w0) === 20, 'one row adds at most 20');
const pre = await fetch(B + '/gh/doc/notices', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'PUT' } });
ok(!pre.headers.get('access-control-allow-origin'), 'preflight from an unknown site gets no Allow-Origin');
let limited = false;
for (let i = 0; i < 40 && !limited; i++) { const r = await fetch(B + '/gh/e', { method: 'POST', body: JSON.stringify({ island: 'hawaii', rows: [] }) }); if (r.status === 429) limited = true; }
ok(limited, 'the counter slows down one address after 30 batches a minute');
console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
