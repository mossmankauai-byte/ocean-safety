#!/usr/bin/env node
/* Gate copies for the culture layer on the GoHawaii review build. The nine existing copies are all
 * theme-OFF dumps, so nothing the plate, the cards or the tour puts on screen has ever been read by
 * oscheck. This writes, per island, the RENDERED theme-ON page with script source and comments
 * stripped, plus one copy carrying all four tour steps and the ahupuaa and moku cards.
 *   ORIGIN=http://127.0.0.1:47651 node checks/culture-gate-dom.js <outdir>
 */
'use strict';
const puppeteer = require('/Users/nickmossman/Desktop/OceanSafe/brochure-src/node_modules/puppeteer-core');
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:47651';
const OUT = process.argv[2] || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function visible(pg){
  return pg.evaluate(() => {
    const d = document.documentElement.cloneNode(true);
    d.querySelectorAll('script,noscript').forEach(n => n.remove());
    const w = document.createTreeWalker(d, NodeFilter.SHOW_COMMENT); const cs = []; while (w.nextNode()) cs.push(w.currentNode); cs.forEach(c => c.remove());
    return '<!doctype html>\n' + d.outerHTML;
  });
}
(async () => {
  const br = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  for (const isl of ['kauai', 'oahu', 'maui', 'hawaii']){
    const pg = await br.newPage();
    await pg.setViewport({ width: 430, height: 900, deviceScaleFactor: 2 });
    await pg.goto(`${ORIGIN}/?ref=gohawaii&island=${isl}&theme=culture`, { waitUntil: 'networkidle2', timeout: 60000 });
    await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /I Understand/.test(x.textContent)); if (b) b.click(); });
    await pg.waitForFunction(() => window._cultureIdx && window._isCulture && window._isCulture(), { timeout: 30000 }).catch(() => {});
    await sleep(2500);
    fs.writeFileSync(path.join(OUT, `culture-${isl}-visible.html`), await visible(pg));
    // Everything the layer can put on screen, in one copy the gate can read at once.
    const all = await pg.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const parts = [];
      const grab = () => document.getElementById('cultureCard') ? document.getElementById('cultureCard').innerHTML : '';
      for (let s = 1; s <= 4; s++){ window._culturePathOpen(s); await sleep(500); parts.push('<section data-copy="tour-step' + s + '">' + grab() + '</section>\n<hr>'); }
      const id = Object.keys(window._cultureIdx.byId)[0];
      window._cultureCloseCard(); window._cultureOpenAhupuaa(id); await sleep(500);
      parts.push('<section data-copy="ahupuaa-card">' + grab() + '</section>');
      const moku = window._cultureIdx.byId[id].moku;
      window._cultureCloseCard(); window._cultureOpenMoku(moku); await sleep(500);
      parts.push('<section data-copy="moku-card">' + grab() + '</section>');
      window._cultureCloseCard();
      const plan = window._culturePlanHTML ? window._culturePlanHTML() : '';
      parts.push('<section data-copy="plan-learn">' + plan + '</section>');
      const ribbon = document.getElementById('cultureRibbon');
      parts.push('<section data-copy="ribbon">' + (ribbon ? ribbon.innerHTML : '') + '</section>');
      const cred = document.querySelector('.leaflet-control-attribution');
      parts.push('<section data-copy="credit">' + (cred ? cred.innerHTML : '') + '</section>');
      return parts.join('\n<hr>\n');
    });
    // The wrapper carries the page's own brand head, or the gate reads a bare fragment as an unbranded
    // artifact. Each surface is wrapped in its own block so the gate never reads two of them as one run-on.
    const head = await pg.evaluate(() => {
      const g = (s) => { const e = document.head.querySelector(s); return e ? e.outerHTML : ''; };
      return g('meta[name="theme-color"]') + g('link[rel="icon"]') + g('link[rel="apple-touch-icon"]');
    });
    fs.writeFileSync(path.join(OUT, `culture-${isl}-surfaces-visible.html`),
      '<!doctype html>\n<html><head><meta charset="utf-8">' + head +
      '<title>Culture surfaces ' + isl + '</title></head><body><h1>OceanSafe</h1>\n' + all + '\n</body></html>');
    console.log(`wrote culture-${isl}-visible.html and culture-${isl}-surfaces-visible.html`);
    await pg.close();
  }
  await br.close();
})().catch((e) => { console.error(String(e)); process.exit(1); });
