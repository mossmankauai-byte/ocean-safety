#!/usr/bin/env node
/* Writes gh/beaches.json: every beach the app shows, per island ({id, name, r}), so the GoHawaii
 * Dashboard can mark specific beaches on an advisory. Read from a real headless render of the app,
 * because each island's dataset only exists once the app has loaded it. Rerun after any beach
 * dataset change.
 *   ORIGIN=http://127.0.0.1:4631 node scripts/build-gh-beaches.js
 */
'use strict';
const puppeteer = require('/Users/nickmossman/Desktop/OceanSafe/brochure-src/node_modules/puppeteer-core');
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:4631';
(async () => {
  const br = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const out = {};
  for (const slug of ['kauai', 'oahu', 'maui', 'hawaii']) {
    const ctx = await br.createBrowserContext();
    const pg = await ctx.newPage();
    await pg.goto(ORIGIN + '/?island=' + slug, { waitUntil: 'networkidle2', timeout: 60000 });
    await pg.waitForFunction('typeof B!=="undefined" && B.length>0 && window.ACTIVE && ACTIVE.slug==="' + slug + '"', { timeout: 30000 });
    out[slug] = await pg.evaluate(() => B.map(b => ({ id: b.id, name: b.name, r: b.r || '' })).sort((a, b) => a.name.localeCompare(b.name)));
    console.log(slug, out[slug].length);
    await ctx.close();
  }
  await br.close();
  fs.writeFileSync(path.join(__dirname, '..', 'gh', 'beaches.json'), JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
