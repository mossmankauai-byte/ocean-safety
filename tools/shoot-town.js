#!/usr/bin/env node
/* Capture the REAL OceanSafe Town tab for the promotions preview.
 *
 * There is no ?tab= deep link, so headless Chrome alone lands on Beaches — the only
 * way to the Town tab is to drive the app's own tab button. Same rig responsive.js
 * uses: puppeteer-core from brochure-src against system Chrome.
 *
 *   node shoot-town.js <outdir>
 *
 * Shoots two states from ONE partner (free-demo = plan:"free", so _renderPartnerPromos
 * returns early and NO promo chip is baked into the image — that is the point: the
 * backdrop must be clean so the live chip can be drawn on top of it in the portal).
 */
'use strict';
const puppeteer = require('/Users/nickmossman/Desktop/OceanSafe/brochure-src/node_modules/puppeteer-core');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE = 'https://ocean-safety.netlify.app';
const OUT = process.argv[2] || '.';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--hide-scrollbars', '--disable-gpu'],
  });
  const page = await browser.newPage();
  // 390x844 CSS at 2x — iPhone 14 logical size, retina source for the portal.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  async function shoot(ref, file, prep) {
    await page.goto(`${SITE}/?ref=${ref}`, { waitUntil: 'networkidle2', timeout: 60000 });
    // A fresh profile gets the safety disclaimer modal — it is the gate every real
    // visitor passes, and it covers the whole screen until accepted. Accept it the
    // way a guest does rather than hiding it, so what we shoot is a genuine
    // post-acceptance session.
    await page.evaluate(() => {
      const b = document.querySelector('.dis-accept');
      if (b) b.click();
      else if (typeof acceptDisclaimer === 'function') acceptDisclaimer();
    });
    await new Promise((r) => setTimeout(r, 800));
    // The service worker's "New version available" toast is z-index 99999 and fires on
    // first load; the app hides it the same way for its own demo curtain.
    await page.evaluate(() => {
      const t = document.getElementById('swUpdateToast');
      if (t) t.style.display = 'none';
    });
    // The app boots the map + partner config async; wait for the Town tab to exist.
    await page.waitForSelector('.tab[data-tab="shopping"]', { timeout: 30000 });
    await page.evaluate(() => document.querySelector('.tab[data-tab="shopping"]').click());
    // Let tiles, markers and the tab transition settle before the shutter.
    await new Promise((r) => setTimeout(r, 6000));
    await page.evaluate(() => {
      const t = document.getElementById('swUpdateToast');
      if (t) t.style.display = 'none';
      const w = document.getElementById('partnerWelcome') || document.querySelector('.partner-welcome');
      if (w) w.remove();          // the one-shot "Welcome from ..." ribbon, not part of the map
    });
    if (prep) await page.evaluate(prep);
    await new Promise((r) => setTimeout(r, 1200));
    const out = path.join(OUT, file);
    await page.screenshot({ path: out, type: 'png' });
    const state = await page.evaluate(() => ({
      tab: document.body.getAttribute('data-tab'),
      chip: !!document.getElementById('promoChip'),
      pop: !!document.getElementById('promoPop'),
      markers: document.querySelectorAll('.leaflet-marker-icon').length,
    }));
    console.log(file, JSON.stringify(state));
  }

  // Clean backdrop: free plan => no chip, no pop-up, no sheet. Just the Town tab.
  await shoot('free-demo', 'town-backdrop.png', null);

  // Reference shot of the real paid chip, to check the portal overlay lands in the
  // same spot. Not shipped — evidence only.
  await shoot('demo-resort', 'town-real-chip.png', () => {
    const p = document.getElementById('promoPop');
    if (p && typeof _promoPopClose === 'function') _promoPopClose();
  });

  await browser.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
