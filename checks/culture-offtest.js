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
        const twrap = [...sc.querySelectorAll('.slbl')].find((e) => e.textContent.trim() === 'Best trails now');
        const thtml = twrap && twrap.nextElementSibling ? twrap.nextElementSibling.innerHTML : '';
        const picks = (typeof B !== 'undefined' ? B : []).filter((b) => !b.warning_only).map((b) => ({ b, r: { status: 'green' } }));
        const out = window._cultureOutlookGroups ? window._cultureOutlookGroups(picks, ({ b }) => `<i data-id="${b.id}"></i>`) : undefined;
        const box = document.createElement('div');
        if (typeof out === 'string') box.innerHTML = out;
        const hikes = (typeof HIKES !== 'undefined' ? HIKES : []);
        const tout = window._cultureOutlookGroups ? window._cultureOutlookGroups(hikes, (h) => `<i data-id="${h.id}"></i>`, window._cultureHikeEntry) : undefined;
        const tbox = document.createElement('div');
        if (typeof tout === 'string') tbox.innerHTML = tout;
        try { closeSheet(); } catch (e) {}
        return {
          html, flat: out === null, n: picks.length,
          ids: [...box.querySelectorAll('i[data-id]')].map((e) => e.getAttribute('data-id')),
          heads: box.querySelectorAll('.cb-moku, .cb-ahu').length,
          thtml, tflat: tout === null, tn: hikes.length,
          tids: [...tbox.querySelectorAll('i[data-id]')].map((e) => e.getAttribute('data-id')),
          theads: tbox.querySelectorAll('.cb-moku, .cb-ahu').length,
        };
      });
    };
    // Town (crafts), the Plan Learn card and the GoHawaii event chips: theme off they are the app's own bytes
    // (no card, navy chips); theme on the crafts rows sit under headers exactly once, the card lists every moku,
    // and the chips take the parchment style.
    const grabMore = async () => page.evaluate(() => {
      const src = (typeof TOWN_SUB_SRC !== 'undefined' && TOWN_SUB_SRC.crafts) ? TOWN_SUB_SRC.crafts : null;
      const rows = src ? src() : [];
      const out = window._cultureOutlookGroups ? window._cultureOutlookGroups(rows, (p) => `<i data-id="${p.x.id}"></i>`, (p) => window._cultureEntryAt(p.x)) : undefined;
      const box = document.createElement('div'); if (typeof out === 'string') box.innerHTML = out;
      const prev = window._activeSub; window._activeSub = 'crafts'; let html = '';
      try { openTownList(); html = document.getElementById('sc').innerHTML; closeSheet(); } catch (e) { html = 'ERR ' + e; }
      window._activeSub = prev;
      const plan = window._culturePlanHTML ? window._culturePlanHTML() : '';
      const pbox = document.createElement('div'); pbox.innerHTML = plan;
      let chips = ''; try { _ghEventChips(true); chips = document.getElementById('ghEvChips').innerHTML; _ghEventChips(false); } catch (e) { chips = 'ERR ' + e; }
      return { flat: out === null, n: rows.length, ids: [...box.querySelectorAll('i[data-id]')].map((e) => e.getAttribute('data-id')), heads: box.querySelectorAll('.cb-moku, .cb-ahu').length,
        html, plan, planChips: pbox.querySelectorAll('.cc-say').length, nMoku: window._cultureIdx ? Object.keys(window._cultureIdx.byMoku).length : 0, chips };
    });
    const offList = await grabList();
    ok(offList.flat, `${isl} off: beach list stays the flat list, no grouping applied`);
    ok(!/cb-moku|cb-ahu/.test(offList.html), `${isl} off: beach list HTML carries no culture header`);
    ok(offList.tflat, `${isl} off: trail list stays the flat list, no grouping applied`);
    ok(!/cb-moku|cb-ahu/.test(offList.thtml), `${isl} off: trail list HTML carries no culture header`);
    const offMore = await grabMore();
    ok(offMore.flat && !/cb-moku|cb-ahu/.test(offMore.html), `${isl} off: Town crafts list stays flat, no culture header`);
    ok(offMore.plan === '', `${isl} off: Plan has no Learn card`);
    ok(!/hula|#3f2e1c/.test(offMore.chips), `${isl} off: event chips are the app's own`);

    const offText = {};
    for (const id of sample) { const g = await grab(id); offText[id] = g.text; ok(g.cult === 0, `${isl} off: ${id} sheet has no culture block`); }

    await page.evaluate(() => toggleCulture());
    await page.waitForFunction(() => window._cultureLines && window._culturePlaces, { timeout: 20000 }).catch(() => {});
    await sleep(800);
    const on = await page.evaluate(() => ({ isCulture: window._isCulture(), ribbon: !!document.getElementById('cultureRibbon') }));
    ok(on.isCulture, `${isl} on: theme applied`);
    // Names in the theme lead Hawaiian and must keep their marks. _cultureShortName restores the ʻokina and
    // the kahōkō the app's plain short field drops, and must do it without inventing a name, without making
    // a title longer, and without leaving a straight apostrophe standing in for an ʻokina. Checked over every
    // beach on the island, using the same two regexes culture-lint.py uses, so an English possessive
    // (Queen's Bath, Chun's Reef) is not counted as an ʻokina substitute.
    const names = await page.evaluate(() => {
      const bare = (t) => String(t || '').toLowerCase().replace(/[\u02bb\u02bc'\u2018\u2019`]/g, '')
        .replace(/\u0101/g, 'a').replace(/\u0113/g, 'e').replace(/\u012b/g, 'i').replace(/\u014d/g, 'o').replace(/\u016b/g, 'u')
        .replace(/\s+/g, ' ').trim();
      const APOS = /[A-Za-z\u0101\u0113\u012b\u014d\u016b\u0100\u0112\u012a\u014c\u016a]+'[A-Za-z\u0101\u0113\u012b\u014d\u016b]+/g;
      const HAW = /^[aeiouhklmnpw\u0101\u0113\u012b\u014d\u016b']+$/i;
      const out = { n: 0, fixed: 0, invented: [], longer: [], apos: [] };
      (typeof B !== 'undefined' ? B : []).forEach((b) => {
        const was = window._cultureNames(b).n || '', now = window._cultureShortName(b);
        out.n++;
        if (bare(now) !== bare(was) && bare(now) !== bare(b.name || '')) out.invented.push(b.id + ': ' + was + ' -> ' + now);
        if (now.length > was.length && bare(now) !== bare(was)) out.longer.push(b.id + ': ' + was + ' -> ' + now);
        (String(now).match(APOS) || []).forEach((w) => { if (HAW.test(w)) out.apos.push(b.id + ': ' + now); });
        if (now !== was) out.fixed++;
      });
      return out;
    });
    ok(!names.invented.length, `${isl} on: no short name invented` + (names.invented.length ? `\n     ${names.invented.slice(0, 4).join('\n     ')}` : ''));
    ok(!names.longer.length, `${isl} on: no short name made longer` + (names.longer.length ? `\n     ${names.longer.slice(0, 4).join('\n     ')}` : ''));
    ok(!names.apos.length, `${isl} on: no straight apostrophe standing in for an ʻokina` + (names.apos.length ? `\n     ${names.apos.slice(0, 4).join('\n     ')}` : ''));
    console.log(`     ${isl}: ${names.fixed} of ${names.n} names had their marks restored`);

    const onList = await grabList();
    const dupes = onList.ids.filter((id, i) => onList.ids.indexOf(id) !== i);
    ok(!onList.flat && !dupes.length && onList.ids.length === onList.n,
      `${isl} on: grouped list holds every beach exactly once (${onList.ids.length} of ${onList.n})` + (dupes.length ? `\n     duplicated: ${dupes.join(',')}` : ''));
    ok(onList.heads > 0, `${isl} on: list carries moku and ahupuaʻa headers (${onList.heads})`);
    const tdupes = onList.tids.filter((id, i) => onList.tids.indexOf(id) !== i);
    ok(!onList.tflat && !tdupes.length && onList.tids.length === onList.tn,
      `${isl} on: grouped trail list holds every trail exactly once (${onList.tids.length} of ${onList.tn})` + (tdupes.length ? `\n     duplicated: ${tdupes.join(',')}` : ''));
    if (onList.tn) ok(onList.theads > 0, `${isl} on: trail list carries moku and ahupuaʻa headers (${onList.theads})`);
    const onMore = await grabMore();
    const cdupes = onMore.ids.filter((id, i) => onMore.ids.indexOf(id) !== i);
    ok(!onMore.flat && !cdupes.length && onMore.ids.length === onMore.n, `${isl} on: grouped crafts list holds every row exactly once (${onMore.ids.length} of ${onMore.n})`);
    if (onMore.n) ok(onMore.heads > 0 && /cb-ahu/.test(onMore.html), `${isl} on: Town sheet carries the headers (${onMore.heads})`);
    ok(/cc-plan/.test(onMore.plan) && onMore.planChips === onMore.nMoku && /_culturePathOpen\(1\)/.test(onMore.plan), `${isl} on: Plan Learn card lists every moku (${onMore.planChips} of ${onMore.nMoku}) and opens the path`);
    ok(/Hula/.test(onMore.chips) && /#f6efdf/.test(onMore.chips), `${isl} on: event chips lead with Hula in the parchment style`);
    for (const id of sample) {
      const g = await grab(id);
      ok(g.text === offText[id], `${isl} same: ${id} safety text identical with the theme on` + (g.text === offText[id] ? '' : `\n     off: ${offText[id].slice(0, 160)}\n     on:  ${g.text.slice(0, 160)}`));
    }
    await page.evaluate(() => toggleCulture());
    await sleep(400);
    const backList = await grabList();
    ok(backList.flat && backList.html === offList.html, `${isl} off again: beach list HTML unchanged, byte for byte`);
    ok(backList.tflat && backList.thtml === offList.thtml, `${isl} off again: trail list HTML unchanged, byte for byte`);
    const backMore = await grabMore();
    ok(backMore.html === offMore.html && backMore.chips === offMore.chips && backMore.plan === '', `${isl} off again: Town sheet and event chips unchanged, byte for byte; no Learn card`);
    const back = await page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), ribbon: !!document.getElementById('cultureRibbon'), lines: !!(window._cultureLines && map.hasLayer(window._cultureLines)) }));
    ok(back.theme === null && !back.ribbon && !back.lines, `${isl} off again: theme, ribbon and sections gone`);
  }
  await browser.close();
  console.log(fails ? `HOLD, ${fails} failure(s)` : 'PASS, theme off is the app as it was; safety text identical on');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
