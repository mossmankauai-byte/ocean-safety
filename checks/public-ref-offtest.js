#!/usr/bin/env node
/* Public-ref off-test, Phase 0 of the GoHawaii embed (Option A).
 *
 * Proves two things against a REAL headless render, not the file bytes:
 *   1. OFF: a no-ref load of every island is unchanged versus the baseline tree (origin/main):
 *      same tab bar, same marker count, no /data/poi- request.
 *   2. ON:  ?ref=gohawaii has no Tours, Shop or Town tab (removed, not hidden), no request to any
 *      commerce or telemetry host, no Nearby Tours block on a beach sheet, no Viator script,
 *      _planPaid() false, nothing persisted as a referrer, the brand strip present, and the
 *      disclaimer without the affiliate paragraph. ?mode=shop and openToursSheet() stay inert.
 *
 * Also writes the rendered Kauai DOM (the thing oscheck gates) and the screenshots for the
 * Andy pack. Same rig as tools/shoot-town.js: puppeteer-core from brochure-src, system Chrome.
 *
 *   NEW_ORIGIN=http://127.0.0.1:4611 BASE_ORIGIN=http://127.0.0.1:4612 node checks/public-ref-offtest.js <outdir>
 */
'use strict';
const puppeteer = require('/Users/nickmossman/Desktop/OceanSafe/brochure-src/node_modules/puppeteer-core');
const fs = require('fs'), path = require('path');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const NEW = process.env.NEW_ORIGIN, BASE = process.env.BASE_ORIGIN;
const OUT = process.argv[2] || '.';
const ISLANDS = ['kauai', 'maui', 'oahu', 'hawaii'];
const FORBIDDEN = /get_town_listings|get_partner_page|get_partner_promotions|workers\.dev|viator\.com|getyourguide|posthog/i;
const fails = [];
function check(cond, msg){ if(cond) console.log('  ok   ' + msg); else { console.log('  FAIL ' + msg); fails.push(msg); } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Chrome sometimes disposes an incognito context before puppeteer asks it to; closing is best effort.
async function closeCtx(c){ try { await c.close(); } catch (e) {} }

async function fresh(browser){
  const ctx = browser.createIncognitoBrowserContext ? await browser.createIncognitoBrowserContext() : await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const reqs = [];
  page.on('request', r => reqs.push(r.url()));
  return { ctx, page, reqs };
}
async function boot(page, url){
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.waitForFunction(() => window.ACTIVE && document.querySelectorAll('.leaflet-marker-icon').length > 0, { timeout: 60000 });
  await sleep(2500);
}
async function accept(page){
  await page.evaluate(() => { const b = document.querySelector('.dis-accept'); if (b) b.click(); else if (typeof acceptDisclaimer === 'function') acceptDisclaimer(); });
  await sleep(600);
  await page.evaluate(() => { const t = document.getElementById('swUpdateToast'); if (t) t.style.display = 'none'; });
}
async function state(page){
  return page.evaluate(() => ({
    island: (window.ACTIVE && ACTIVE.slug) || null,
    tabs: [...document.querySelectorAll('#tabs .tab')].map(t => t.dataset.tab + ':' + (getComputedStyle(t).display === 'none' ? 'hidden' : 'shown')),
    markers: document.querySelectorAll('.leaflet-marker-icon').length,
    referrer: (() => { try { return localStorage.getItem('referrer'); } catch (e) { return 'unreadable'; } })(),
    planPaid: (typeof _planPaid === 'function') ? _planPaid() : 'missing',
    strip: (document.getElementById('publicBrandStrip') || {}).textContent || '',
    disAffiliate: !!document.getElementById('disAffiliate'),
    disPrivacy: (document.getElementById('disPrivacy') || {}).textContent || '',
    cfgPlan: window._partnerCfg ? window._partnerCfg.plan : null,
  }));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--disable-gpu'] });

  console.log('\n[1] OFF: no-ref load, new tree versus baseline tree');
  for (const slug of ISLANDS) {
    const a = await fresh(browser), b = await fresh(browser);
    await boot(a.page, `${NEW}/?island=${slug}`);  await accept(a.page);
    await boot(b.page, `${BASE}/?island=${slug}`); await accept(b.page);
    const sa = await state(a.page), sb = await state(b.page);
    check(JSON.stringify(sa.tabs) === JSON.stringify(sb.tabs), `${slug}: tab bar identical ${JSON.stringify(sa.tabs)}`);
    check(sa.markers === sb.markers, `${slug}: marker count identical (${sa.markers} vs ${sb.markers})`);
    check(!a.reqs.some(u => /\/data\/poi-/.test(u)), `${slug}: no /data/poi- request`);
    check(sa.strip === '' && !sa.tabs.some(t => t.startsWith('explore')), `${slug}: no public strip, no explore tab`);
    check(sa.disAffiliate === true, `${slug}: disclaimer keeps the affiliate paragraph`);
    await closeCtx(a.ctx); await closeCtx(b.ctx);
  }

  console.log('\n[2] ON: ?ref=gohawaii on every island');
  for (const slug of ISLANDS) {
    const { ctx, page, reqs } = await fresh(browser);
    await boot(page, `${NEW}/?ref=gohawaii&island=${slug}`);
    if (slug === 'kauai') await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-disclaimer.png`) });
    await accept(page);
    const s = await state(page);
    check(s.island === slug, `${slug}: booted as ${s.island}`);
    check(!s.tabs.some(t => /^(tours|shop|shopping):/.test(t)), `${slug}: no Tours, Shop or Town tab node ${JSON.stringify(s.tabs)}`);
    check(s.planPaid === false, `${slug}: _planPaid() is false`);
    check(s.referrer === null, `${slug}: nothing persisted as referrer (${s.referrer})`);
    check(/GoHawaii/.test(s.strip) && /Ocean Safe/.test(s.strip), `${slug}: brand strip "${s.strip.trim()}"`);
    check(s.disAffiliate === false, `${slug}: affiliate paragraph removed from the disclaimer`);
    check(/no analytics/.test(s.disPrivacy), `${slug}: public privacy paragraph in place`);
    check(s.cfgPlan === 'free', `${slug}: committed config resolved (plan=${s.cfgPlan})`);
    const bad = reqs.filter(u => FORBIDDEN.test(u));
    check(bad.length === 0, `${slug}: no commerce or telemetry request` + (bad.length ? ' ' + JSON.stringify(bad.slice(0, 4)) : ''));
    await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-beaches.png`) });

    // Beach sheet: no Nearby Tours, no Viator script.
    await page.evaluate(() => { const b = (typeof B !== 'undefined' && B[0]) || null; if (b && typeof openSheet === 'function') openSheet(b.id); });   // B is a top-level let, not a window property
    await sleep(2500);
    const sheet = await page.evaluate(() => ({
      on: document.getElementById('sheet').classList.contains('on'),
      text: document.getElementById('sheet').textContent,
      viator: document.querySelectorAll('script[data-vi-script]').length,
    }));
    check(sheet.on, `${slug}: beach sheet opened`);
    check(!/Nearby Tours|Viator|GetYourGuide|Sponsored/.test(sheet.text), `${slug}: sheet has no tours or sponsored wording`);
    check(sheet.viator === 0, `${slug}: no Viator script tag`);
    if (slug === 'kauai') {
      await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-beach-sheet.png`) });
      fs.writeFileSync(path.join(OUT, 'gohawaii-rendered-kauai.html'), await page.evaluate(() => document.documentElement.outerHTML));
      // The visible document: the same DOM with script source, comments and noscript removed.
      // This is what a visitor can see, and the file the segment gate runs on (the inline
      // scripts still carry every shop string in their source, which nobody is shown).
      fs.writeFileSync(path.join(OUT, 'gohawaii-rendered-kauai-visible.html'), await page.evaluate(() => {
        const c = document.documentElement.cloneNode(true);
        c.querySelectorAll('script, noscript').forEach(n => n.remove());
        const w = document.createTreeWalker(c, NodeFilter.SHOW_COMMENT), dead = [];
        while (w.nextNode()) dead.push(w.currentNode);
        dead.forEach(n => n.remove());
        return c.outerHTML;
      }));
      const visible = await page.evaluate(() => document.body.innerText);
      check(!/\$\d/.test(visible), 'kauai: no price anywhere in the visible text' + (/\$\d/.test(visible) ? ' ' + JSON.stringify(visible.match(/.{0,30}\$\d.{0,10}/g).slice(0, 3)) : ''));
    }
    const bad2 = reqs.filter(u => FORBIDDEN.test(u));
    check(bad2.length === 0, `${slug}: still no commerce request after the sheet`);

    // Deep-link attempts stay inert.
    const inert = await page.evaluate(() => {
      document.getElementById('sheet').classList.remove('on');
      if (typeof openToursSheet === 'function') openToursSheet();
      return !document.getElementById('sheet').classList.contains('on');
    });
    check(inert, `${slug}: openToursSheet() is inert`);
    await closeCtx(ctx);
  }

  console.log('\n[3] ON: ?mode=shop cannot bring Shop back; Plan tab has no booking');
  {
    const { ctx, page } = await fresh(browser);
    await boot(page, `${NEW}/?ref=gohawaii&island=kauai&mode=shop`); await accept(page);
    const s = await state(page);
    check(!s.tabs.some(t => /^(tours|shop|shopping):/.test(t)), `mode=shop: no Tours, Shop or Town tab ${JSON.stringify(s.tabs)}`);
    await page.evaluate(() => { const t = document.querySelector('#tabs .tab[data-tab="activities"]'); if (t) t.click(); });
    await sleep(3000);
    const plan = await page.evaluate(() => ({ book: document.querySelectorAll('.plan-book').length, text: document.body.innerText }));   // innerText: rendered text only, never the inline script source
    check(plan.book === 0, 'Plan: no "See times & book" button');
    check(!/Tours woven in/.test(plan.text), 'Plan: no tours woven in');
    await page.screenshot({ path: path.join(OUT, 'gohawaii-kauai-plan.png') });
    await closeCtx(ctx);
  }

  await browser.close();
  console.log(`\n${fails.length ? 'FAIL' : 'PASS'}: ${fails.length} failure(s)`);
  fails.forEach(f => console.log('  - ' + f));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('offtest crashed:', e); process.exit(2); });
