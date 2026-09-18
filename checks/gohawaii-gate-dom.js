#!/usr/bin/env node
/* Writes the gate copies for the GoHawaii advisories build: the RENDERED page with script source and
 * comments stripped, because the single-file app carries every shop string in its bytes and the gate
 * must read what a visitor reads (learned 2026-09-17). App: one file per island, with a sample red
 * and a sample yellow staff post live, a featured campaign, and the GoHawaii page open under the red.
 * Dashboard: its Advisories view with the same posts listed.
 *   ORIGIN=http://127.0.0.1:4631 node checks/gohawaii-gate-dom.js <outdir>
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
    Object.assign({}, base, { id: 'gate-feat', kind: 'feature', sub: 'Campaign', title: 'Sample: travel with care this winter', body: 'Watch big surf from the lookouts.', link: 'https://www.gohawaii.com/' })
  ] };
}
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
  for (const isl of ['kauai', 'oahu', 'maui', 'hawaii']) {
    const ctx = await br.createBrowserContext(); const pg = await ctx.newPage();
    await pg.setViewport({ width: 390, height: 844 });
    await pg.evaluateOnNewDocument((v) => { try { localStorage.setItem('gh_notices_v1', v); } catch(e){} }, JSON.stringify(seed(isl)));
    await pg.goto(ORIGIN + '/?ref=gohawaii&island=' + isl, { waitUntil: 'networkidle2', timeout: 60000 });
    await pg.waitForSelector('#ghaRed', { timeout: 15000 });
    await pg.evaluate(() => ghOpenHub()); await sleep(600);
    const f = path.join(OUT, 'gohawaii-advisories-' + isl + '-visible.html');
    fs.writeFileSync(f, await visible(pg)); console.log('wrote', f);
    await ctx.close();
  }
  const ctx = await br.createBrowserContext(); const pg = await ctx.newPage();
  await pg.setViewport({ width: 1280, height: 900 });
  await pg.evaluateOnNewDocument((v) => { try { localStorage.setItem('gh_notices_v1', v); } catch(e){} }, JSON.stringify(seed('kauai')));
  await pg.goto(ORIGIN + '/gohawaii-dashboard?view=adv', { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(2500);
  const f = path.join(OUT, 'gohawaii-dashboard.html');
  fs.writeFileSync(f, await visible(pg)); console.log('wrote', f);
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
