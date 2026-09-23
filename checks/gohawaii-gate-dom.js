#!/usr/bin/env node
/* Writes the gate copies for the GoHawaii advisories build: the RENDERED page with script source and
 * comments stripped, because the single-file app carries every shop string in its bytes and the gate
 * must read what a visitor reads (learned 2026-09-17). App: one file per island, with a sample red
 * and a sample yellow staff post live, a featured campaign, and the GoHawaii page open under the red.
 * Dashboard: its Advisories view with the same posts listed.
 * Also writes the review screenshots into <outdir>/shots: live NWS and HTA feeds plus the labeled
 * sample posts only, never test fixtures, so no screenshot puts words in an agency's mouth.
 *   ORIGIN=http://127.0.0.1:4631 node checks/gohawaii-gate-dom.js <outdir>
 * Live mode (gh/config.js names a backend, which is what ships since 2026-09-23): the app reads posts from the
 * backend, not localStorage, so the sample posts are published there first (red approved by a second key),
 * and the Dashboard is signed in. Point it at a LOCAL backend (backend-gohawaii, wrangler dev), never the real one:
 *   GH_API=http://127.0.0.1:8787 GH_KEY_EDITOR=gh_... GH_KEY_APPROVER=gh_... ORIGIN=... node checks/gohawaii-gate-dom.js <outdir>
 */
'use strict';
const puppeteer = require('/Users/nickmossman/Desktop/OceanSafe/brochure-src/node_modules/puppeteer-core');
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:4631';
const OUT = process.argv[2] || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const H = 3600e3, now = Date.now(), iso = (t) => new Date(t).toISOString();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function seed(isl){
  const base = { src: 'staff', srcName: 'GoHawaii', islands: [isl], beaches: [], link: '', starts: iso(now - H), ends: iso(now + 20 * H), sent: iso(now - H), created: iso(now - H), status: 'live', by: 'Editor', sample: true };
  return { hta: {}, log: [], items: [
    Object.assign({}, base, { id: 'gate-red', kind: 'advisory', level: 'red', approvedBy: 'Approver', title: 'Sample: road closed past mile 10', where: 'Sample location', body: 'Sample text. A rockslide has closed the road ahead. Turn around at the last open pullout and plan another stop today.' }),
    Object.assign({}, base, { id: 'gate-yel', kind: 'advisory', level: 'yellow', title: 'Sample: parking lot full by 9am', where: 'Sample location', body: 'Sample text. Arrive early or use the shuttle.' }),
    Object.assign({}, base, { id: 'gate-feat', kind: 'feature', sub: 'Campaign', title: 'Sample: travel with care this winter', body: 'Watch big surf from the lookouts.', link: 'https://www.gohawaii.com/' }),
    // A timed promotion inside its Hawaiʻi-time hours right now, so the hub copy carries GoHawaii's own deal text in a promo block.
    Object.assign({}, base, { id: 'gate-promo', kind: 'promo', title: 'Sample: 10% off the North Shore shuttle before 9am', body: 'Book the early run and save. A sample promotion for the review build.', link: 'https://www.gohawaii.com/', window: (function(){ var hh = new Date(new Date().toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' })).getHours(), p = function(n){ return String(n).padStart(2, '0'); }; return { start: p(hh) + ':00', end: p((hh + 2) % 24) + ':00' }; })() })
  ] };
}
const API = process.env.GH_API || '', KEY_E = process.env.GH_KEY_EDITOR || '', KEY_A = process.env.GH_KEY_APPROVER || '';
async function doc(key){ const r = await fetch(API + '/gh/doc/notices', { headers: { Origin: ORIGIN, Authorization: 'Bearer ' + key } }); return r.json(); }
async function put(key, ver, body){ const r = await fetch(API + '/gh/doc/notices', { method: 'PUT', headers: { Origin: ORIGIN, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ ver, body }) }); return r.json(); }
async function publish(isl){
  if(!API) return;
  const s = seed(isl), red = s.items.find((x) => x.level === 'red');
  let d = await doc(KEY_E);
  let r = await put(KEY_E, d.ver, { hta: {}, log: [], items: s.items.map((x) => x === red ? Object.assign({}, x, { status: 'pending' }) : x) });
  if(!r.ok) throw new Error('publish (editor) failed: ' + JSON.stringify(r).slice(0, 200));
  r = await put(KEY_A, r.ver, Object.assign({}, r.body, { items: r.body.items.map((x) => x.id === red.id ? Object.assign({}, x, { status: 'live' }) : x) }));
  if(!r.ok) throw new Error('publish (approver) failed: ' + JSON.stringify(r).slice(0, 200));
}
// Screenshot hygiene: the SW "New version available" toast is a local-rig artifact.
async function shot(pg, f, full){ await pg.evaluate(() => { const t = document.getElementById('swUpdateToast'); if(t) t.remove(); }); await pg.screenshot({ path: f, fullPage: !!full }); }
async function visible(pg){
  return pg.evaluate(() => {
    const d = document.documentElement.cloneNode(true);
    d.querySelectorAll('script,noscript').forEach(n => n.remove());
    const w = document.createTreeWalker(d, NodeFilter.SHOW_COMMENT); const cs = []; while(w.nextNode()) cs.push(w.currentNode); cs.forEach(c => c.remove());
    return '<!doctype html>\n' + d.outerHTML;
  });
}
(async () => {
  const br = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const SH = path.join(OUT, 'shots'); fs.mkdirSync(SH, { recursive: true });
  for (const isl of ['kauai', 'oahu', 'maui', 'hawaii']) {
    await publish(isl);
    const ctx = await br.createBrowserContext(); const pg = await ctx.newPage();
    await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await pg.evaluateOnNewDocument((v) => { try { localStorage.setItem('gh_notices_v1', v); localStorage.setItem('disclaimerAccepted', '1'); } catch(e){}
      document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#swUpdateToast{display:none!important}'; document.head.appendChild(st); }); }, JSON.stringify(seed(isl)));
    await pg.goto(ORIGIN + '/?ref=gohawaii&island=' + isl, { waitUntil: 'networkidle2', timeout: 60000 });
    await pg.waitForSelector('#ghaRed', { timeout: 15000 });
    if(isl === 'kauai') await shot(pg, path.join(SH, 'review-app-red-390.png'));
    await pg.evaluate(() => ghOpenHub()); await sleep(600);
    const f = path.join(OUT, 'gohawaii-advisories-' + isl + '-visible.html');
    fs.writeFileSync(f, await visible(pg)); console.log('wrote', f);
    if(isl === 'kauai'){
      await pg.click('#ghaRed .gha-ok'); await sleep(900);
      await pg.evaluate(() => { if(typeof closeSheet === 'function') closeSheet(); }); await sleep(400);
      await shot(pg, path.join(SH, 'review-app-yellow-390.png'));
      await pg.evaluate(() => { const p = document.getElementById('ghaPop'); if(p) p.remove(); ghOpenHub(); }); await sleep(600);
      await shot(pg, path.join(SH, 'review-app-gohawaii-page-390.png'));
      await pg.evaluate(() => { document.getElementById('sc').scrollTop = 99999; }); await sleep(300);
      await shot(pg, path.join(SH, 'review-app-gohawaii-page-lower-390.png'));
    }
    await ctx.close();
  }
  for (const w of [390, 1280]) {
    const ctx = await br.createBrowserContext(); const pg = await ctx.newPage();
    await pg.setViewport({ width: w, height: 900, deviceScaleFactor: 2 });
    await pg.evaluateOnNewDocument((v) => { try { localStorage.setItem('gh_notices_v1', v); } catch(e){} }, JSON.stringify(seed('kauai')));
    if(API && w === 390) await publish('kauai');
    await pg.goto(ORIGIN + '/gohawaii-dashboard?view=adv', { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(2500);
    if(API){ await pg.type('#siKey', KEY_A); await pg.click('#siForm button[type=submit]'); await pg.waitForFunction(() => !document.getElementById('whoChip').hidden, { timeout: 15000 }); await sleep(1500); }
    for (const v of ['now', 'adv', 'feat', 'promo', 'place', 'use', 'rep']) {
      await pg.evaluate((v) => document.querySelector('.rail button[data-view="' + v + '"]').click(), v); await sleep(v === 'feat' || v === 'place' ? 1500 : 500);
      // Report view: every dataset on, methodology notes on, so the gate copy carries the whole report.
      if(v === 'rep') await pg.evaluate(() => { document.querySelector('#v-rep .presets button[data-preset="all"]').click(); const m = document.getElementById('rpMeth'); if(m && !m.checked) m.click(); });
      await shot(pg, path.join(SH, 'review-dashboard-' + v + '-' + w + '.png'), true);
    }
    // Gate copy after every view has rendered once, so the Visitors and Report sample figures are in it.
    if(w === 1280){ const f = path.join(OUT, 'gohawaii-dashboard.html'); fs.writeFileSync(f, await visible(pg)); console.log('wrote', f); }
    await ctx.close();
  }
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
