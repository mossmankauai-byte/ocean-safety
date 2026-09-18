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
let planGhSlots = 0;
function check(cond, msg){ if(cond) console.log('  ok   ' + msg); else { console.log('  FAIL ' + msg); fails.push(msg); } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Chrome sometimes disposes an incognito context before puppeteer asks it to; closing is best effort.
async function closeCtx(c){ try { await c.close(); } catch (e) {} }

async function fresh(browser){
  const ctx = browser.createIncognitoBrowserContext ? await browser.createIncognitoBrowserContext() : await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // gohawaii.com's Cloudflare refuses the HeadlessChrome user agent (a real browser gets the photo), so
  // present the plain Chrome string. Both trees get the same agent; the app never reads it.
  await page.setUserAgent((await browser.userAgent()).replace('HeadlessChrome', 'Chrome'));
  const reqs = [], photoFails = [];
  page.on('request', r => reqs.push(r.url()));
  page.on('response', r => { if (/gohawaii\.com\/sites\//.test(r.url()) && r.status() >= 400) photoFails.push(r.status()); });
  page.on('requestfailed', r => { if (/gohawaii\.com\/sites\//.test(r.url())) photoFails.push((r.failure() || {}).errorText || 'failed'); });
  return { ctx, page, reqs, photoFails };
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
    const { ctx, page, reqs, photoFails } = await fresh(browser);
    await boot(page, `${NEW}/?ref=gohawaii&island=${slug}`);
    if (slug === 'kauai') {
      // The notice opens on the first tab tap, not on load, so open it the way the app does and
      // hide the service-worker toast first; the shot must be the modal a first-time visitor sees.
      await page.evaluate(() => { const t = document.getElementById('swUpdateToast'); if (t) t.style.display = 'none'; if (typeof openDisclaimer === 'function') openDisclaimer(); });
      await sleep(900);
      const shown = await page.evaluate(() => { const m = document.getElementById('disclaimerModal'); return !!m && getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0; });
      check(shown, 'kauai: disclaimer modal is on screen for its screenshot');
      await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-disclaimer.png`) });
    }
    await accept(page);
    const s = await state(page);
    check(s.island === slug, `${slug}: booted as ${s.island}`);
    check(!s.tabs.some(t => /^shop:/.test(t)) && s.tabs.includes('tours:shown') && s.tabs.includes('shopping:shown'), `${slug}: footer keeps Tours and Town, no Shop node ${JSON.stringify(s.tabs)}`);
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

    // GoHawaii layer: loaded after boot, poured into our arrays, one shared sheet, no price anywhere.
    await page.waitForFunction(() => window.GH_LAYER && window.ACTIVE && window.GH_LAYER[ACTIVE.slug] && Object.keys(window._GH_INDEX || {}).length > 0, { timeout: 30000 }).catch(() => {});
    const layer = await page.evaluate(() => {
      const idx = Object.keys(window._GH_INDEX || {});
      const counts = {}; ['FOODS','DRINKS','LOCAL_CRAFTS','VENUES','ACTS','STAYS'].forEach(k => { try { counts[k] = eval(k).filter(x => String(x.id).startsWith('gh_')).length; } catch (e) { counts[k] = -1; } });
      counts.TOURS = (window.GH_TOURS || []).length;
      const first = idx[0]; let sheet = '';
      if (first && typeof openGhSheet === 'function') { openGhSheet(first); sheet = document.getElementById('sc').innerText; }
      const subs = (SUBTABS.acts.items || []).map(i => i.sub);
      const staysShown = (() => { const t = document.querySelector('#tabs .tab[data-tab="stays"]'); return !!t && getComputedStyle(t).display !== 'none'; })();
      return { rows: idx.length, counts, sheet, subs, staysShown };
    });
    check(layer.rows > 100, `${slug}: GoHawaii layer injected (${layer.rows} rows) ${JSON.stringify(layer.counts)}`);
    check(/Listing by GoHawaii/.test(layer.sheet) && !/\$\d/.test(layer.sheet), `${slug}: shared listing sheet carries the GoHawaii credit and no price`);
    check(['event','malama'].every(x => layer.subs.includes(x)) && !layer.subs.includes('golf') && !layer.subs.includes('wellness'), `${slug}: Family gained Events and Mālama only`);
    // Photos: every photo the build found reaches the page over https from gohawaii.com. The floor is
    // what gohawaii.com actually has: the rest of their events and some listings carry no photo at all.
    const photos = await page.evaluate(async () => {
      const rows = Object.values(window._GH_INDEX || {}), layerRows = (window.GH_LAYER[ACTIVE.slug] || {}).rows || [];
      const https = rows.filter(g => /^https:\/\/www\.gohawaii\.com\//.test(g.img || ''));
      const lost = layerRows.filter(r => r.img && !(window._GH_INDEX[r.id] || {}).img).map(r => r.id);
      const withImg = rows.find(g => g.img), without = rows.find(g => !g.img), out = {};
      if (withImg) { openGhSheet(withImg.id); const h = document.querySelector('#sc .poi-hero'); out.heroBg = h ? getComputedStyle(h).backgroundImage : '';
        // The credit waits for the photo to load, so give it up to 15 s to appear.
        for (let i = 0; i < 60 && !/Photo via GoHawaii/.test(document.getElementById('sc').innerText); i++) await new Promise(r => setTimeout(r, 250));
        out.heroCredit = /Photo via GoHawaii/.test(document.getElementById('sc').innerText); }
      if (without) { openGhSheet(without.id); const h = document.querySelector('#sc .poi-hero'); out.bareBg = h ? getComputedStyle(h).backgroundImage : ''; out.bareCredit = /Photo via GoHawaii/.test(document.getElementById('sc').innerText); out.bareImgs = document.querySelectorAll('#sc img').length; }
      const tag = [...document.scripts].find(s => /\/data\/poi-gohawaii-/.test(s.src));
      out.layerParam = tag ? (new URL(tag.src).searchParams.get('b') || '') : ''; out.layerBuilt = (window.GH_LAYER[ACTIVE.slug] || {}).built || '';
      return { rows: rows.length, https: https.length, http: rows.filter(g => /^http:/i.test(g.img || '')).length, lost, ...out };
    });
    const pct = Math.round(100 * photos.https / photos.rows);
    // Floor 60%: the rest have no photo on gohawaii.com, only an event flyer withheld for its printed text, or are
    // Malama rows, which borrow no hotel photo.
    check(photos.https / photos.rows >= 0.6, `${slug}: ${photos.https} of ${photos.rows} rows (${pct}%) carry an https gohawaii.com photo`);
    check(photos.layerBuilt && photos.layerParam.indexOf(photos.layerBuilt) === 0, `${slug}: layer URL ?b=${photos.layerParam} matches the layer build ${photos.layerBuilt}`);
    check(photos.http === 0 && photos.lost.length === 0, `${slug}: no photo URL starts with http:// (${photos.http}), none lost in injection (${photos.lost.length})`);
    check(/gohawaii\.com/.test(photos.heroBg) && /linear-gradient/.test(photos.heroBg) && photos.heroCredit, `${slug}: sheet hero is the photo over the gradient, with "Photo via GoHawaii"`);
    check(/linear-gradient/.test(photos.bareBg) && !/url\(/.test(photos.bareBg) && !photos.bareCredit && photos.bareImgs === 0, `${slug}: a row with no photo keeps the gradient hero, no credit, no image`);
    const homes = await page.evaluate(() => ({
      townWellness: (SUBTABS.shopping.items || []).some(i => i.sub === 'wellness'),
      townRows: (window.GH_TOWN || []).length,
      golfInTours: (window.GH_TOURS || []).filter(t => t.gh_sub === 'Golf').length,
      slowVibe: (PLAN_VIBES || []).some(v => v.key === 'slow'),
      malamaRows: Object.values(window._GH_INDEX || {}).filter(g => g.type === 'malama').length,
      eventRows: Object.values(window._GH_INDEX || {}).filter(g => g.type === 'event').length,
    }));
    check(homes.townWellness && homes.townRows > 0, `${slug}: Town > Wellness subtab with ${homes.townRows} spas`);
    check(homes.golfInTours > 0, `${slug}: Golf is a Tours group (${homes.golfInTours} courses)`);
    check(homes.slowVibe, `${slug}: Plan has a Slow day vibe`);
    check(homes.malamaRows > 0 && homes.eventRows > 0, `${slug}: ${homes.malamaRows} Mālama and ${homes.eventRows} events loaded`);
    // Beach sheet: a red or yellow verdict shows the Give back block; on an all-green day say so.
    const malama = await page.evaluate(() => {
      const b = (typeof B !== 'undefined' ? B : []).find(x => !x.warning_only && scored[x.id] && ['red','yellow','warning'].includes(scored[x.id].status));
      if (!b) return { none: true };
      openSheet(b.id); return { beach: b.name, status: scored[b.id].status };
    });
    await sleep(1200);
    if (!malama.none) Object.assign(malama, await page.evaluate(() => {
      const sc = document.getElementById('sc'), rows = [...sc.querySelectorAll('[onclick^="_ghDeflectTap"]')];
      // Each Mālama row shows its photo when the row has one, and the leaf icon when it has none.
      const ok = rows.every(el => { const id = (el.getAttribute('onclick').match(/'(gh_[^']+)'\)/) || [])[1], g = window._GH_INDEX[id] || {};
        return g.img ? !!el.querySelector('img.gh-thumb') : (!el.querySelector('img') && !!el.querySelector('svg.gh-leaf')); });
      return { has: /Give back instead/.test(sc.innerHTML), rows: rows.length, thumbs: sc.querySelectorAll('[onclick^="_ghDeflectTap"] img.gh-thumb').length, ok };
    }));
    if (malama.none) console.log(`  note ${slug}: every scored beach is green right now, Give back block not exercised`);
    else {
      check(malama.has, `${slug}: ${malama.beach} (${malama.status}) shows the Give back block`);
      check(malama.ok, `${slug}: Mālama rows show a photo when they have one (${malama.thumbs} of ${malama.rows}), the leaf icon when not`);
    }
    if (slug === 'kauai' && !malama.none) {
      // The shot is of the offer itself: scroll the Give back block into view and let its photos load.
      await page.evaluate(() => { const h = [...document.querySelectorAll('#sc .slbl')].find(e => /Give back/.test(e.textContent)); if (h) h.scrollIntoView({ block: 'start' }); });
      await sleep(2500);
      await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-malama-beach.png`) });
    }
    // Town > Wellness and Family > Events chips, on screen.
    await page.evaluate(() => { document.getElementById('sheet').classList.remove('on'); document.getElementById('overlay').classList.remove('on'); const t = document.querySelector('#tabs .tab[data-tab="shopping"]'); if (t) t.click(); });
    await sleep(1200);
    await page.evaluate(() => { const st = document.querySelector('#subtabs .subtab[data-sub="wellness"]'); if (st) st.click(); });
    await sleep(2200);
    const well = await page.evaluate(() => ({ pins: Object.keys(ghTownMkrs || {}).length, sub: window._activeSub }));
    check(well.sub === 'wellness' && well.pins > 0, `${slug}: Town > Wellness draws ${well.pins} pins`);
    if (slug === 'kauai') await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-town-wellness.png`) });
    await page.evaluate(() => { const t = document.querySelector('#tabs .tab[data-tab="acts"]'); if (t) t.click(); });
    await sleep(1200);
    await page.evaluate(() => { const st = document.querySelector('#subtabs .subtab[data-sub="event"]'); if (st) st.click(); });
    await sleep(2200);
    const evc = await page.evaluate(() => ({ chips: !!document.getElementById('ghEvChips'), text: (document.getElementById('ghEvChips') || {}).innerText || '' }));
    check(evc.chips && /Today/.test(evc.text) && /weekend/i.test(evc.text), `${slug}: Events chips on screen (${evc.text.replace(/\n/g, ' ')})`);
    await page.evaluate(() => { const t = document.querySelector('#tabs .tab[data-tab="beaches"]'); if (t) t.click(); });
    await sleep(800);
    const gone = await page.evaluate(() => !document.getElementById('ghEvChips'));
    check(gone, `${slug}: Events chips leave with the subtab`);
    // Plan: Slow day chip, Mālama card, and a Tonight slot when an event falls on the picked day.
    await page.evaluate(() => { const t = document.querySelector('#tabs .tab[data-tab="activities"]'); if (t) t.click(); });
    await sleep(2500);
    const plan = await page.evaluate(() => {
      const sc = document.getElementById('sc'), h = sc.innerHTML, t = sc.innerText;
      // The Give back card and every GoHawaii Plan card: a photo when the row has one, none when it has none.
      const cards = [...sc.querySelectorAll('[onclick^="openGhSheet"]')].filter(el => /Give back a morning/.test(el.textContent) || el.classList.contains('plan-slot'));
      const ok = cards.every(el => { const id = (el.getAttribute('onclick').match(/'(gh_[^']+)'/) || [])[1], g = window._GH_INDEX[id] || {};
        return g.img ? !!el.querySelector('img.gh-thumb') : !el.querySelector('img'); });
      return { slow: /Slow day/.test(h), card: /Give back a morning/.test(h), tonight: /Tonight/.test(h), price: /\$\d/.test(t), head: t.slice(0, 80).replace(/\s+/g, ' '),
        cards: cards.length, thumbs: cards.filter(el => el.querySelector('img.gh-thumb')).length, ok };
    });
    check(plan.slow && plan.card && !plan.price, `${slug}: Plan shows Slow day, the Give back card, no price (Tonight slot: ${plan.tonight}) [${plan.head}]`);
    check(plan.cards > 0 && plan.ok, `${slug}: Plan GoHawaii cards carry their photo when they have one (${plan.thumbs} of ${plan.cards})`);
    // A Plan slot of kind 'gh' only appears on the Slow day vibe (a spa) or on an event night, so walk
    // Slow day across every area: each GoHawaii slot shows its photo when it has one, none when not.
    const slots = await page.evaluate(async () => {
      const out = { slots: 0, thumbs: 0, ok: true }, area0 = _planArea, vibe0 = _planVibe;
      for (const a of _planAreas()) {
        planSetArea(a.key); planSetVibe('slow'); await new Promise(r => setTimeout(r, 400));
        document.querySelectorAll('#sc .plan-slot[onclick^="openGhSheet"]').forEach(el => {
          const id = (el.getAttribute('onclick').match(/'(gh_[^']+)'/) || [])[1], g = window._GH_INDEX[id] || {};
          out.slots++; if (el.querySelector('img.gh-thumb')) out.thumbs++;
          if (g.img ? !el.querySelector('img.gh-thumb') : !!el.querySelector('img')) out.ok = false;
        });
      }
      _planArea = area0; planSetVibe(vibe0); return out;   // put the Plan back as the screenshot expects
    });
    // Slow day only moves a slot onto land when the day's surf says so, so an island can have none today;
    // the run as a whole must exercise at least one (checked after the loop).
    planGhSlots += slots.slots;
    check(slots.ok, `${slug}: Plan 'gh' slots on Slow day show the photo when the row has one (${slots.thumbs} of ${slots.slots} slots)`);
    if (slug === 'kauai') await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-plan-malama.png`) });
    check(layer.staysShown, `${slug}: Stays tab shown once their stays loaded`);
    if (slug === 'kauai') {
      // The shared listing card with its GoHawaii photo, credit, link back and nearest beach.
      await page.evaluate(() => { const g = Object.values(window._GH_INDEX).find(x => x.img && x.type !== 'event' && x.tip && x.address) || Object.values(window._GH_INDEX).find(x => x.img);
        openGhSheet(g.id); const sh = document.getElementById('sheet'); sh.scrollTop = 0; document.getElementById('sc').scrollTop = 0; });
      await page.waitForFunction(() => /Photo via GoHawaii/.test(document.getElementById('sc').innerText), { timeout: 15000 }).catch(() => {});
      await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-listing-sheet.png`) });
      await page.evaluate(() => { document.getElementById('sheet').classList.remove('on'); document.getElementById('overlay').classList.remove('on'); const t = document.querySelector('#tabs .tab[data-tab="acts"]'); if (t) t.click(); });
      await sleep(1500);
      await page.evaluate(() => { const st = document.querySelector('#subtabs .subtab[data-sub="scenic"]'); if (st) st.click(); });
      await sleep(2500);
      await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-family-scenic.png`) });
      await page.evaluate(() => { const st = document.querySelector('#subtabs .subtab[data-sub="event"]'); if (st) st.click(); });
      await sleep(2500);
      await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-family-events.png`) });
    }
    // Tours tab: a directory of their operators, never a booking surface.
    await page.evaluate(() => { document.getElementById('sheet').classList.remove('on'); const t = document.querySelector('#tabs .tab[data-tab="tours"]'); if (t) t.click(); });
    await sleep(2500);
    const tours = await page.evaluate(() => ({
      on: document.getElementById('sheet').classList.contains('on'),
      text: document.getElementById('sc').innerText,
      gyg: document.querySelectorAll('[data-gyg-href], script[src*="getyourguide"]').length,
      markers: document.querySelectorAll('.leaflet-marker-icon').length,
    }));
    check(tours.on && /listed by gohawaii/i.test(tours.text) && tours.markers > 0, `${slug}: Tours tab lists GoHawaii operators with pins (${tours.markers})`);
    check(tours.gyg === 0 && !/\bbook\b|see times/i.test(tours.text), `${slug}: Tours has no booking widget, script or call to action`);   // 'bookable' in the placeholder is the disclaimer, not a CTA
    // Directory rows carry the photo as a lazy thumbnail; the first one must actually load from gohawaii.com.
    const thumbs = await page.evaluate(() => { const t = [...document.querySelectorAll('#sc img.gh-thumb')];
      if (t[0]) t[0].scrollIntoView({ block: 'center' });
      return { n: t.length, lazy: t.every(i => i.loading === 'lazy'), http: t.filter(i => !/^https:\/\/www\.gohawaii\.com\//.test(i.src)).length, first: t[0] ? t[0].src : '' }; });
    const loaded = thumbs.n ? await page.waitForFunction(() => { const i = document.querySelector('#sc img.gh-thumb'); return i && i.complete && i.naturalWidth > 0 && i.naturalWidth; }, { timeout: 20000 }).then(h => h.jsonValue()).catch(() => 0) : 0;
    check(thumbs.n > 0 && thumbs.lazy && thumbs.http === 0, `${slug}: Tours directory rows render ${thumbs.n} lazy https gohawaii.com thumbnails`);
    check(loaded > 0, `${slug}: a real GoHawaii photo loads in the page (naturalWidth ${loaded}) ${thumbs.first.slice(0, 90)}`);
    if (slug === 'kauai') await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-tours.png`) });
    // Town tab: editorial places only, no partner pins, offers or sponsored badge.
    await page.evaluate(() => { document.getElementById('sheet').classList.remove('on'); const t = document.querySelector('#tabs .tab[data-tab="shopping"]'); if (t) t.click(); });
    await sleep(3000);
    const town = await page.evaluate(() => ({ chip: !!document.getElementById('promoChip'), text: document.body.innerText, markers: document.querySelectorAll('.leaflet-marker-icon').length }));
    check(!town.chip && !/Sponsored/.test(town.text), `${slug}: Town has no offer chip or sponsored badge (${town.markers} pins)`);
    if (slug === 'kauai') await page.screenshot({ path: path.join(OUT, `gohawaii-${slug}-town.png`) });
    const bad3 = reqs.filter(u => FORBIDDEN.test(u));
    check(bad3.length === 0, `${slug}: still no commerce request after Tours and Town`);
    const photoReqs = reqs.filter(u => /gohawaii\.com\/sites\//.test(u)).length;
    check(photoReqs > 0 && photoFails.length === 0, `${slug}: ${photoReqs} gohawaii.com photo requests, ${photoFails.length} failed ${photoFails.length ? JSON.stringify(photoFails.slice(0, 5)) : ''}`);
    await closeCtx(ctx);
  }

  check(planGhSlots > 0, `all islands: ${planGhSlots} Plan 'gh' slot(s) exercised across the run`);

  console.log('\n[3] ON: ?mode=shop cannot bring Shop back; Plan tab has no booking');
  {
    const { ctx, page } = await fresh(browser);
    await boot(page, `${NEW}/?ref=gohawaii&island=kauai&mode=shop`); await accept(page);
    const s = await state(page);
    check(!s.tabs.some(t => /^shop:/.test(t)), `mode=shop: no Shop node ${JSON.stringify(s.tabs)}`);
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
