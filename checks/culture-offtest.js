#!/usr/bin/env node
/* Culture-theme off-test. Proves, against a real headless render of every island:
 *   OFF  a plain load has no data-theme, no culture card, requests nothing under /culture/, and the beach
 *        sheet carries no culture block.
 *   SAME for a sample of beaches, the sheet's safety text is identical with the theme on and off. The only
 *        lines allowed to differ are the title and the subtitle (names lead Hawaiian by design) and the
 *        culture blocks themselves, which are stripped before comparing.
 * Same rig as tools/shoot-town.js: puppeteer-core from brochure-src, system Chrome.
 *
 *   ORIGIN=http://127.0.0.1:8792 node checks/culture-offtest.js [beaches-per-island]
 */
'use strict';
const puppeteer = require('/Users/nickmossman/Desktop/OceanSafe/brochure-src/node_modules/puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8792';
const N = parseInt(process.argv[2] || '6', 10);
const ISLANDS = ['kauai', 'maui', 'oahu', 'hawaii'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FAIL ') + msg); if (!c) fails++; };

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const requested = [];
  page.on('request', (r) => requested.push(r.url()));

  for (const isl of ISLANDS) {
    requested.length = 0;
    await page.goto(`${ORIGIN}/?island=${isl}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => { try { localStorage.setItem('os_theme', 'default'); } catch (e) {} const b = document.querySelector('.dis-accept'); if (b) b.click(); });
    await sleep(1500);
    const off = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'), card: !!document.getElementById('cultureCard'),
      isCulture: !!(window._isCulture && window._isCulture()), ribbon: !!document.getElementById('cultureRibbon'),
      ids: (typeof B !== 'undefined' ? B : []).map((b) => b.id),
    }));
    ok(off.theme === null && !off.isCulture, `${isl} off: no data-theme`);
    ok(!off.card && !off.ribbon, `${isl} off: no culture card, no ribbon`);
    ok(!requested.some((u) => u.includes('/culture/')), `${isl} off: nothing requested under /culture/`);

    // Safety text of the beach sheet, theme off vs on.
    const sample = off.ids.slice(0, N);
    const grab = async (id) => page.evaluate((id) => {
      openSheet(id);
      const sc = document.getElementById('sc').cloneNode(true);
      sc.querySelectorAll('.cc-block, details.cc-proto-block, .sname, .sreg, p.cc-credit, .cc-land').forEach((e) => e.remove());
      const text = sc.innerText.replace(/\s+/g, ' ').trim();
      const cult = document.getElementById('sc').querySelectorAll('.cc-block, .cc-proto-block').length;
      try { closeSheet(); } catch (e) {}
      return { text, cult };
    }, id);
    // The beach list the liveNow chip opens. Its rows depend on live conditions, which a headless run does
    // not have, so the grouping itself is driven directly over the island's real beaches: theme off it must
    // hand the flat list straight back, theme on it must place every beach under a header exactly once.
    const grabList = async () => {
      await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="beaches"]'); if (t) t.click(); });
      await sleep(1000);
      return page.evaluate(() => {
        openOutlookSheet('temp');
        const sc = document.getElementById('sc');
        const wrap = [...sc.querySelectorAll('.slbl')].find((e) => e.textContent.trim() === 'Best beaches now');
        const html = wrap && wrap.nextElementSibling ? wrap.nextElementSibling.innerHTML : '';
        const picks = (typeof B !== 'undefined' ? B : []).filter((b) => !b.warning_only).map((b) => ({ b, r: { status: 'green' } }));
        const out = window._cultureOutlookGroups ? window._cultureOutlookGroups(picks, ({ b }) => `<i data-id="${b.id}"></i>`) : undefined;
        const box = document.createElement('div');
        if (typeof out === 'string') box.innerHTML = out;
        try { closeSheet(); } catch (e) {}
        return {
          html, flat: out === null, n: picks.length,
          ids: [...box.querySelectorAll('i[data-id]')].map((e) => e.getAttribute('data-id')),
          heads: box.querySelectorAll('.cb-moku, .cb-ahu').length,
        };
      });
    };
    const offList = await grabList();
    ok(offList.flat, `${isl} off: beach list stays the flat list, no grouping applied`);
    ok(!/cb-moku|cb-ahu/.test(offList.html), `${isl} off: beach list HTML carries no culture header`);

    const offText = {};
    for (const id of sample) { const g = await grab(id); offText[id] = g.text; ok(g.cult === 0, `${isl} off: ${id} sheet has no culture block`); }

    await page.evaluate(() => toggleCulture());
    await page.waitForFunction(() => window._cultureLines && window._culturePlaces, { timeout: 20000 }).catch(() => {});
    await sleep(800);
    const on = await page.evaluate(() => ({ isCulture: window._isCulture(), ribbon: !!document.getElementById('cultureRibbon') }));
    ok(on.isCulture, `${isl} on: theme applied`);
    const onList = await grabList();
    const dupes = onList.ids.filter((id, i) => onList.ids.indexOf(id) !== i);
    ok(!onList.flat && !dupes.length && onList.ids.length === onList.n,
      `${isl} on: grouped list holds every beach exactly once (${onList.ids.length} of ${onList.n})` + (dupes.length ? `\n     duplicated: ${dupes.join(',')}` : ''));
    ok(onList.heads > 0, `${isl} on: list carries moku and ahupuaʻa headers (${onList.heads})`);
    for (const id of sample) {
      const g = await grab(id);
      ok(g.text === offText[id], `${isl} same: ${id} safety text identical with the theme on` + (g.text === offText[id] ? '' : `\n     off: ${offText[id].slice(0, 160)}\n     on:  ${g.text.slice(0, 160)}`));
    }
    await page.evaluate(() => toggleCulture());
    await sleep(400);
    const backList = await grabList();
    ok(backList.flat && backList.html === offList.html, `${isl} off again: beach list HTML unchanged, byte for byte`);
    const back = await page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), ribbon: !!document.getElementById('cultureRibbon'), lines: !!(window._cultureLines && map.hasLayer(window._cultureLines)) }));
    ok(back.theme === null && !back.ribbon && !back.lines, `${isl} off again: theme, ribbon and sections gone`);
  }
  await browser.close();
  console.log(fails ? `HOLD, ${fails} failure(s)` : 'PASS, theme off is the app as it was; safety text identical on');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
